# The teacher: an open model (Qwen3.8-27B, Apache-2.0, run with vLLM on our own SageMaker GPU) writes
# training data for the browser reader. It never talks to guests. First it writes restaurant menus as
# Malaysian restaurants have them (dishes, Chinese names, prices, add-on groups); then, on each menu,
# guest conversations, each guest turn labelled as a typed turn reading (src/server/ai/brain/turnReading.ts):
# what the turn does, each change to the order in the menu's own names, the guest's own words for
# each part (quoted exactly, for the reader to learn where they are), and the order after the turn.
# Nothing here is trusted: scripts/reader/teacher/check.ts keeps only turns whose quotes are in the
# message, whose names are the menu's and whose changes give the order the teacher says they do.
#
#   (on SageMaker, via launch.py --source scripts/reader/teacher --program teach.py)
#   python teach.py --out <dir> [--menus 400] [--convs 8000] [--minutes 150]
import argparse, json, os, random, re, time

CUISINES = [
    "mamak (roti canai, nasi kandar, mee goreng, teh tarik)", "Chinese kopitiam (toast, eggs, noodles, coffee)", "Cantonese dim sum", "Hainanese chicken rice",
    "char siu and roast meat rice", "Teochew porridge", "Penang hawker (char kway teow, laksa, cendol)", "Malay nasi campur warung", "nasi lemak stall",
    "satay and grilled skewers", "Indonesian penyet", "Thai street food", "Vietnamese pho and banh mi", "Korean fried chicken", "Korean BBQ",
    "Japanese ramen", "Japanese donburi and bento", "sushi bar", "Taiwanese bubble tea", "dessert house (ais kacang, cendol, tau fu fah)",
    "Western cafe brunch", "burger joint", "pizza and pasta", "steakhouse", "fish and chips", "Middle Eastern mandi and kebab", "North Indian tandoor",
    "South Indian banana leaf", "vegetarian Chinese", "vegan cafe", "yong tau foo", "pan mee and dry noodles", "bak kut teh", "fish head curry",
    "zi char seafood", "Sichuan mala", "hotpot", "Hakka food", "Nyonya Peranakan", "Sarawak laksa and kolo mee", "Sabah food", "East Coast Malay (nasi kerabu, keropok lekor)",
    "economy rice", "noodle soup stall", "wantan mee", "curry mee", "mixed rice and soups", "coffee roastery", "juice and smoothie bar", "bakery and cakes",
    "Japanese curry", "Mexican", "Turkish grill", "poke bowls", "salad bar", "chicken chop western stall", "lok lok and street snacks", "breakfast roti bakar",
    "fried chicken and rice", "seafood soup", "herbal soup", "Thai mookata", "Hong Kong cha chaan teng", "Taiwanese street snacks", "nasi briyani",
]
LANGS = [("English", 3), ("Manglish (Malaysian English mixed with Malay and Chinese words, casual, lah/ah)", 3), ("Malay (Bahasa Malaysia, casual)", 2),
         ("Chinese (Simplified, Malaysian usage, with Cantonese or Hokkien ordering words where natural)", 3), ("a mix of English and Chinese in one message", 1)]
TURN_KINDS = [
    ("order: order 1-4 dishes, with counts and add-ons, sizes or preferences", 6),
    ("more: add more of something already ordered, or add new dishes", 3),
    ("remove: cancel a dish, or take off some of it", 3),
    ("set_count: change how many of something", 3),
    ("swap: change a dish for another, or one of several for another", 3),
    ("modify: change, add or take off add-ons of a dish already ordered", 3),
    ("split_off: one of several of a dish gets other add-ons ('one of them iced')", 2),
    ("pointer: order something from a list the assistant just gave ('the first one', 'that one', '2 of the second one')", 2),
    ("whose: say who had what, or ask what each person pays ('I only had the X', 'my friend the Y')", 2),
    ("total: ask the total, with or without service and tax, with or without an order in the same message", 3),
    ("question: ask about a dish, an allergy, a diet, or chat, without changing the order", 2),
]

MENU_PROMPT = """Write the menu of a real-looking restaurant in Malaysia: {cuisine}. Give it a name.
Write {n} items across sensible categories, including drinks. For most items give the Chinese name a Malaysian Chinese guest would use.
Prices in ringgit as numbers (e.g. 12.9). Give MANY items choices the way real menus do: sizes, noodle or rice choices, spice levels,
hot or iced, sugar levels, add-ons with prices (e.g. extra egg 1.5), free preferences (no onion, less oil). Each group has a name, the
fewest and most choices a guest may pick (min, max), and options with their extra price (0 if free). Use the restaurant's own wording
for options (e.g. "Telur Mata", "Hard-boiled Egg", "Tau Pok", "Kurang Manis", "Level 3"), not generic ones.
Answer with JSON only, in exactly this shape:
{{"name": "...", "dishes": [{{"name": "...", "zh": "..." or null, "category": "...", "price": 12.9, "groups": [{{"name": "...", "min": 0, "max": 1, "options": [{{"name": "...", "price": 0}}]}}]}}]}}"""

CONV_PROMPT = """You write realistic chats between a guest and a restaurant's ordering assistant, and label each guest message exactly.

MENU (dish | Chinese | price | choice groups: options):
{menu}

Write one chat of {turns} guest messages. Guest language: {lang}. Write the way real Malaysian guests type: short, casual,
sometimes with typos, abbreviations or no punctuation; they shorten dish names or use local names. Before each guest message
except the first, write the assistant's short reply to the previous message (listing dishes with prices, or confirming the order).
The guest messages, in order, should do: {plan}.
{people}

Label EACH guest message:
- "acts": the kinds of turn it is, from: order, change, ask_total, ask_price, split, ask_dish, diet, chat.
- "items": each change it makes to the order, in order. Each item:
  "change": one of new (a dish ordered), more (more of a dish already ordered), set_count (its count changed), remove (taken off: all,
  or "count" of it), swap_out then swap_in (a dish replaced by another: all, or "count" of it), modify (add-ons of a line already ordered
  changed), split_off ("count" of a line given other add-ons), assign (whose it is: all, or "count" of it).
  "dish": the menu's exact dish name. "count": a number, if said or meant. "options": add-ons put on, by the menu's exact option names.
  "removeOptions": add-ons taken off, by exact names. "owner": "me", or who it is for ("friend", "wife", "sister"...), only if said.
  "quotes": the guest's own words for each part, copied EXACTLY from the guest message (same characters): "dish" (the words naming the
  dish, or pointing at it, e.g. "the first one", "that"), "count" (e.g. "2", "dua", "两"), "options" (a map from each option name to the
  words for it), "owner" (e.g. "my friend", "I"). Leave a quote out if the guest didn't say it in words.
- "order_after": the whole order after this message, as lines {{"dish", "count", "options", "owner"}} (owner only if known).
A message that changes nothing has "items": [] and the same order_after as before. Never invent a dish or option the menu doesn't have;
if the guest asks for one, leave it out of items.

Answer with JSON only: {{"turns": [{{"assistant_before": "..." or null, "guest": "...", "acts": [...], "items": [...], "order_after": [...]}}]}}"""


def menu_text(m):
    rows = []
    for d in m["dishes"]:
        groups = "; ".join(f"{g['name']} (min {g.get('min', 0)}, max {g.get('max', 1)}): " + ", ".join(f"{o['name']}" + (f" +{o['price']}" if o.get("price") else "") for o in g.get("options", [])) for g in d.get("groups", []))
        rows.append(f"{d['name']} | {d.get('zh') or ''} | {d.get('price')} | {groups}")
    return "\n".join(rows)


def parse_json(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    m = re.search(r"\{.*\}", text, flags=re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def weighted(r, pairs):
    total = sum(w for _, w in pairs)
    x = r.random() * total
    for v, w in pairs:
        x -= w
        if x <= 0:
            return v
    return pairs[-1][0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="Qwen/Qwen3.8-27B-FP8")
    ap.add_argument("--out", default=os.environ.get("SM_MODEL_DIR", "out"))
    ap.add_argument("--menus", type=int, default=400)
    ap.add_argument("--convs", type=int, default=8000)
    ap.add_argument("--minutes", type=float, default=150, help="stop starting new work after this long")
    ap.add_argument("--seed", type=int, default=31)
    a = ap.parse_args()
    t0 = time.time()
    r = random.Random(a.seed)
    os.makedirs(a.out, exist_ok=True)
    # (the training image's flash-attn was built for its own PyTorch, not the one vLLM brings; vLLM has its own kernels)
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "flash-attn", "flash_attn"], check=False)
    from vllm import LLM, SamplingParams

    # (text only: the model can read images too, which this doesn't need)
    llm = LLM(model=a.model, max_model_len=8192, gpu_memory_utilization=0.92, max_num_seqs=128, enable_prefix_caching=True, limit_mm_per_prompt={"image": 0, "video": 0})
    params = SamplingParams(temperature=0.8, top_p=0.95, max_tokens=3000)
    chat = lambda prompts: [o.outputs[0].text for o in llm.chat([[{"role": "user", "content": p}] for p in prompts], params, chat_template_kwargs={"enable_thinking": False}, use_tqdm=False)]
    print(f"model loaded in {time.time() - t0:.0f}s", flush=True)

    # 1. menus
    menus = []
    while len(menus) < a.menus and time.time() - t0 < a.minutes * 60 * 0.3:
        batch = [MENU_PROMPT.format(cuisine=r.choice(CUISINES), n=r.randint(18, 36)) for _ in range(min(100, a.menus - len(menus)))]
        for text in chat(batch):
            m = parse_json(text)
            if m and isinstance(m.get("dishes"), list) and len(m["dishes"]) >= 8:
                menus.append(m)
        print(f"menus {len(menus)} ({time.time() - t0:.0f}s)", flush=True)
    with open(os.path.join(a.out, "menus.jsonl"), "w", encoding="utf-8") as f:
        for i, m in enumerate(menus):
            f.write(json.dumps({"id": f"tm{i}", **m}, ensure_ascii=False) + "\n")

    # 2. conversations on them, labelled turn by turn
    done = 0
    with open(os.path.join(a.out, "convs.jsonl"), "w", encoding="utf-8") as f:
        while done < a.convs and time.time() - t0 < a.minutes * 60:
            batch, meta = [], []
            for _ in range(min(400, a.convs - done)):
                k = r.randrange(len(menus))
                turns = r.choice([1, 2, 2, 3, 3, 4])
                plan = [weighted(r, TURN_KINDS) for _ in range(turns)]
                # (a chat opens with an order, or a question whose answer lists dishes it can point at later)
                plan[0] = TURN_KINDS[0][0] if r.random() < 0.7 else TURN_KINDS[-1][0]
                people = "The guest is ordering for a group and says who has what." if any(p.startswith("whose") for p in plan) else ""
                lang = weighted(r, LANGS)
                batch.append(CONV_PROMPT.format(menu=menu_text(menus[k]), turns=turns, lang=lang, plan="; then ".join(f"({i + 1}) {p}" for i, p in enumerate(plan)), people=people))
                meta.append({"menu": f"tm{k}", "lang": lang.split(" ")[0], "plan": plan})
            for m, text in zip(meta, chat(batch)):
                c = parse_json(text)
                if c and isinstance(c.get("turns"), list):
                    f.write(json.dumps({**m, **c}, ensure_ascii=False) + "\n")
                    done += 1
            f.flush()
            print(f"convs {done} ({time.time() - t0:.0f}s)", flush=True)
    print(f"done: {len(menus)} menus, {done} conversations in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
