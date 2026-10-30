# The owned order reader: a menu-conditioned span-and-link encoder (docs/menu-brain.md, "The owned
# reader"). One multilingual encoder (mDeBERTa-v3-base) reads the guest's message and tags its
# words (a dish, a count, an add-on, "one … the other", a dish the menu doesn't have); each dish it
# tags is linked to one of this menu's dishes, each add-on to one of that dish's own options, and
# each count and add-on is attached to its line. The menu's dishes and options are encoded by the
# same encoder, apart from the message, so a menu's encodings can be cached. What it returns is an
# order reading (src/server/ai/brain/reading.ts), checked by the brain like any other.
#
# Data: scripts/reader/gen.ts (synthetic menus and orders, with exact spans). Never the benchmark.
#
#   python train.py --train train.jsonl --valid valid.jsonl --out model/ [--epochs 3] [--steps N]
#   python train.py --check valid.jsonl      (the decoder on the gold labels must give the gold readings)
import argparse, json, math, os, random, re, time
from collections import Counter, defaultdict

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

LABELS = ["DISH", "COUNT", "OPTION", "SPLIT", "UNMATCHED"]
TAGS = ["O"] + [f"{p}-{l}" for l in LABELS for p in ("B", "I")]
ANCHOR = ("DISH", "SPLIT")
MAX_MSG = 96
MAX_ENTRY = 24
NEG_DISHES = 7

# ---- data ----

def load(path):
    menus = json.load(open(path.replace(".jsonl", ".menus.json")))
    rows = [json.loads(l) for l in open(path) if l.strip()]
    for r in rows:
        r["menu_items"] = menus[r["menu"]]
    return rows

def dish_text(d):
    return f"{d['name']} | {d['zh']}" if d.get("zh") else d["name"]

def option_texts(d):
    return [(o["name"], f"{g['name']}: {o['name']}") for g in d["groups"] for o in g["options"]]

ZH_NUM = {"一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
WORD_NUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6, "tujuh": 7, "lapan": 8, "sembilan": 9, "sepuluh": 10}

def parse_count(text):
    """A count as the guest wrote it: "3", "x3", "two", "dua", "两杯", "十二份"."""
    t = text.strip().lower()
    m = re.search(r"\d+", t)
    if m:
        return int(m.group())
    for w in re.findall(r"[a-z]+", t):
        if w in WORD_NUM:
            return WORD_NUM[w]
    zh = "".join(c for c in t if c in ZH_NUM)
    if zh:
        if zh == "十":
            return 10
        if zh.startswith("十"):
            return 10 + ZH_NUM.get(zh[1:2], 0)
        if "十" in zh:
            return ZH_NUM[zh[0]] * 10 + ZH_NUM.get(zh[2:3], 0)
        return ZH_NUM[zh[0]]
    return 1

def gold_attach(spans):
    """Each count, add-on and split marker's anchor: the dish or split marker of its own line just
    before it, else the first one after it (a Chinese add-on before its dish, a Malay count after)."""
    anchors = [i for i, s in enumerate(spans) if s["label"] in ANCHOR]
    out = {}
    for i, s in enumerate(spans):
        if s["label"] not in ("COUNT", "OPTION"):
            continue
        own = [a for a in anchors if spans[a].get("line") == s.get("line")]
        before = [a for a in own if spans[a]["start"] < s["start"]]
        after = [a for a in own if spans[a]["start"] > s["start"]]
        out[i] = before[-1] if before else (after[0] if after else None)
    return out

def rule_attach(spans):
    """The same without knowing the lines: the anchor just before, else the one just after."""
    anchors = [i for i, s in enumerate(spans) if s["label"] in ANCHOR]
    out = {}
    for i, s in enumerate(spans):
        if s["label"] not in ("COUNT", "OPTION"):
            continue
        before = [a for a in anchors if spans[a]["start"] < s["start"]]
        after = [a for a in anchors if spans[a]["start"] > s["start"]]
        # (a count right before a dish is that dish's: "2 nasi lemak, 1 teh")
        if s["label"] == "COUNT" and after and (not before or spans[after[0]]["start"] - s["end"] <= 2):
            out[i] = after[0]
        else:
            out[i] = before[-1] if before else (after[0] if after else None)
    return out

def decode(message, spans, dish_link, option_link, attach, total, each):
    """An order reading from tagged spans: `dish_link[i]` a menu key or None for each DISH span,
    `option_link[i]` an option name or None for each OPTION span, `attach[i]` the anchor of each
    COUNT and OPTION span. A dish followed by split markers ("one … the other …") gives a line per
    marker, each with its own count (1 if none) and add-ons, plus any said on the dish itself."""
    order = sorted(range(len(spans)), key=lambda i: spans[i]["start"])
    anchors = [i for i in order if spans[i]["label"] in ANCHOR]
    owner = {}  # split marker -> the dish span before it
    last = None
    for i in anchors:
        if spans[i]["label"] == "DISH":
            last = i
        else:
            owner[i] = last
    parts = defaultdict(lambda: {"count": None, "options": []})
    for i, a in attach.items():
        if a is None:
            continue
        if spans[i]["label"] == "COUNT":
            parts[a]["count"] = parse_count(message[spans[i]["start"]:spans[i]["end"]])
        elif option_link.get(i):
            parts[a]["options"].append(option_link[i])
    lines, unmatched = [], []
    for i in anchors:
        s = spans[i]
        if s["label"] == "DISH":
            key = dish_link.get(i)
            if key is None:
                unmatched.append(message[s["start"]:s["end"]])
                continue
            if any(owner.get(j) == i for j in anchors):
                continue
            lines.append({"dish": key, "count": parts[i]["count"] or 1, "options": parts[i]["options"], "off": []})
        else:
            d = owner.get(i)
            if d is None or dish_link.get(d) is None:
                continue
            lines.append({"dish": dish_link[d], "count": parts[i]["count"] or 1, "options": parts[d]["options"] + parts[i]["options"], "off": []})
    for i in order:
        if spans[i]["label"] == "UNMATCHED":
            unmatched.append(message[spans[i]["start"]:spans[i]["end"]])
    return {"lines": lines, "unmatched": unmatched, "total": bool(total), "each": bool(each)}

def line_set(r):
    return Counter((l["dish"], l["count"], tuple(sorted(l["options"]))) for l in r["lines"])

def same_reading(a, b):
    return line_set(a) == line_set(b) and sorted(a["unmatched"]) == sorted(b["unmatched"]) and a["total"] == b["total"] and a["each"] == b["each"]

def check(path):
    """The decoder on the gold spans, links and attachments must give every gold reading."""
    rows = load(path)
    for name, how in (("gold attach", gold_attach), ("rule attach", rule_attach)):
        ok = Counter(); n = Counter(); bad = []
        for r in rows:
            sp = r["spans"]
            got = decode(r["message"], sp, {i: s.get("ref") for i, s in enumerate(sp) if s["label"] == "DISH"},
                         {i: s.get("ref") for i, s in enumerate(sp) if s["label"] == "OPTION"}, how(sp), r["target"]["total"], r["target"]["each"])
            n[r["lang"]] += 1
            if same_reading(got, r["target"]):
                ok[r["lang"]] += 1
            elif len(bad) < 5:
                bad.append((r["message"], r["target"]["lines"], got["lines"]))
        print(name, {k: f"{ok[k]}/{n[k]}" for k in n}, f"all {sum(ok.values()) / sum(n.values()):.4f}")
        for b in bad[:3]:
            print("   ", b)
    return rows

# ---- features ----

def token_tags(tok, message, spans):
    enc = tok(message, return_offsets_mapping=True, truncation=True, max_length=MAX_MSG)
    offs = enc["offset_mapping"]
    tags = [0] * len(offs)
    span_tokens = []
    misaligned = 0
    for s in spans:
        idx = []
        for t, (a, b) in enumerate(offs):
            if a == b:
                continue
            while a < b and message[a].isspace():
                a += 1
            if a < b and a < s["end"] and b > s["start"]:
                idx.append(t)
        if idx:
            first = offs[idx[0]][0]
            while message[first].isspace():
                first += 1
            if first != s["start"] or offs[idx[-1]][1] != s["end"]:
                misaligned += 1
            tags[idx[0]] = TAGS.index(f"B-{s['label']}")
            for t in idx[1:]:
                tags[t] = TAGS.index(f"I-{s['label']}")
        span_tokens.append(idx)
    for t, (a, b) in enumerate(offs):
        if a == b:
            tags[t] = -100
    return enc["input_ids"], tags, span_tokens, offs, misaligned

def alignment_report(tok, rows):
    bad = Counter(); n = Counter()
    for r in rows:
        _, _, _, _, mis = token_tags(tok, r["message"], r["spans"])
        bad[r["lang"]] += mis; n[r["lang"]] += len(r["spans"])
    print("spans not on token boundaries:", {k: f"{bad[k]}/{n[k]}" for k in n})

# ---- model ----

class Reader(nn.Module):
    def __init__(self, base):
        super().__init__()
        self.enc = AutoModel.from_pretrained(base)
        h = self.enc.config.hidden_size
        self.tag = nn.Linear(h, len(TAGS))
        self.q_dish, self.k_dish = nn.Linear(h, 256), nn.Linear(h, 256)
        self.q_opt, self.k_opt = nn.Linear(h, 256), nn.Linear(h, 256)
        self.none_dish, self.none_opt = nn.Parameter(torch.randn(256) * 0.02), nn.Parameter(torch.randn(256) * 0.02)
        self.att = nn.Sequential(nn.Linear(4 * h + 16, 256), nn.GELU(), nn.Linear(256, 1))
        self.relpos = nn.Embedding(9, 16)
        self.flags = nn.Linear(h, 2)
        self.scale = nn.Parameter(torch.tensor(10.0))

    def encode(self, ids, mask):
        return self.enc(input_ids=ids, attention_mask=mask).last_hidden_state

    def pooled(self, ids, mask):
        h = self.encode(ids, mask)
        m = mask.unsqueeze(-1).float()
        return (h * m).sum(1) / m.sum(1).clamp(min=1)

    def link_scores(self, q_vec, keys, qlin, klin, none):
        q = F.normalize(qlin(q_vec), dim=-1)
        k = F.normalize(torch.cat([klin(keys), none.unsqueeze(0)], 0), dim=-1)
        return self.scale * q @ k.T  # last column is "none"

    def attach_scores(self, u, anchors, du):
        # u: [h], anchors: [A, h], du: [A] signed span-index distances
        A = anchors.shape[0]
        uu = u.unsqueeze(0).expand(A, -1)
        rp = self.relpos(du.clamp(-4, 4) + 4)
        return self.att(torch.cat([uu, anchors, uu * anchors, (uu - anchors).abs(), rp], -1)).squeeze(-1)

def span_vec(h, idx):
    return h[idx].mean(0)

def batch_texts(tok, texts, dev):
    e = tok(texts, padding=True, truncation=True, max_length=MAX_ENTRY, return_tensors="pt")
    return e["input_ids"].to(dev), e["attention_mask"].to(dev)

def batch_losses(model, tok, rows, idx, h, span_tokens, dev, rng):
    """The linking and attaching losses of a batch, its messages already encoded (h). Every dish and
    option text the batch needs is encoded once, in one call."""
    texts, at = [], {}
    def text_id(t):
        if t not in at:
            at[t] = len(texts); texts.append(t)
        return at[t]
    plans = []
    for k, i in enumerate(idx):
        r = rows[i]; spans = r["spans"]; menu = r["menu_items"]; keys = [d["key"] for d in menu]
        golds = {s["ref"] for s in spans if s["label"] == "DISH" and s.get("ref")}
        others = [x for x in keys if x not in golds]
        rng.shuffle(others)
        cand = sorted(golds) + others[:NEG_DISHES]
        dspans = [(j, s) for j, s in enumerate(spans) if s["label"] in ("DISH", "UNMATCHED") and span_tokens[i][j]]
        dish_ids = [text_id(dish_text(menu[keys.index(c)])) for c in cand] if dspans else []
        att = gold_attach(spans)
        anchor_dish, last = {}, None
        for j in sorted(range(len(spans)), key=lambda j: spans[j]["start"]):
            if spans[j]["label"] == "DISH":
                last = spans[j].get("ref"); anchor_dish[j] = last
            elif spans[j]["label"] == "SPLIT":
                anchor_dish[j] = last
        optq = []
        for j, s in enumerate(spans):
            if s["label"] != "OPTION" or not span_tokens[i][j] or att.get(j) is None:
                continue
            dk = anchor_dish.get(att[j])
            if dk is None:
                continue
            opts = option_texts(menu[keys.index(dk)])
            names = [n for n, _ in opts]
            if s.get("ref") in names:
                optq.append((j, [text_id(t) for _, t in opts], names.index(s["ref"])))
        plans.append((k, i, cand, dspans, dish_ids, att, optq))
    loss = torch.zeros((), device=dev)
    if not texts:
        return loss
    ids, mask = batch_texts(tok, texts, dev)
    kv = model.pooled(ids, mask)
    n = 0
    for k, i, cand, dspans, dish_ids, att, optq in plans:
        spans = rows[i]["spans"]; st = span_tokens[i]
        if dspans:
            qv = torch.stack([span_vec(h[k], st[j]) for j, _ in dspans])
            sc = model.link_scores(qv, kv[dish_ids], model.q_dish, model.k_dish, model.none_dish)
            gold = torch.tensor([cand.index(s["ref"]) if s["label"] == "DISH" else len(cand) for _, s in dspans], device=dev)
            loss = loss + F.cross_entropy(sc, gold); n += 1
        for j, tids, g in optq:
            sc = model.link_scores(span_vec(h[k], st[j]).unsqueeze(0), kv[tids], model.q_opt, model.k_opt, model.none_opt)
            loss = loss + F.cross_entropy(sc, torch.tensor([g], device=dev)); n += 1
        anchors = [a for a, s in enumerate(spans) if s["label"] in ANCHOR and st[a]]
        if anchors:
            av = torch.stack([span_vec(h[k], st[a]) for a in anchors])
            for j, a in att.items():
                if a is None or a not in anchors or not st[j]:
                    continue
                du = torch.tensor([a2 - j for a2 in anchors], device=dev)
                sc = model.attach_scores(span_vec(h[k], st[j]), av, du)
                loss = loss + F.cross_entropy(sc.unsqueeze(0), torch.tensor([anchors.index(a)], device=dev)); n += 1
    return loss / max(1, len(idx))

# ---- inference ----

class Inference:
    def __init__(self, model, tok, dev):
        self.m, self.tok, self.dev = model.eval(), tok, dev
        self.cache = {}

    def menu_keys(self, menu):
        sig = json.dumps(menu, sort_keys=True)
        if sig not in self.cache:
            with torch.no_grad():
                ids, mask = batch_texts(self.tok, [dish_text(d) for d in menu], self.dev)
                dishes = self.m.pooled(ids, mask)
                opts = {}
                for d in menu:
                    o = option_texts(d)
                    if o:
                        i2, m2 = batch_texts(self.tok, [t for _, t in o], self.dev)
                        opts[d["key"]] = ([n for n, _ in o], self.m.pooled(i2, m2))
            self.cache = {sig: (dishes, opts)} if len(self.cache) > 64 else {**self.cache, sig: (dishes, opts)}
        return self.cache[sig]

    @torch.no_grad()
    def read(self, menu, message):
        enc = self.tok(message, return_offsets_mapping=True, truncation=True, max_length=MAX_MSG, return_tensors="pt")
        offs = enc.pop("offset_mapping")[0].tolist()
        h = self.m.encode(enc["input_ids"].to(self.dev), enc["attention_mask"].to(self.dev))[0]
        tags = self.m.tag(h).argmax(-1).tolist()
        flags = torch.sigmoid(self.m.flags(h[0])).tolist()
        # spans from the tags
        spans, toks = [], []
        for t, (a, b) in enumerate(offs):
            if a == b:
                continue
            name = TAGS[tags[t]]
            if name == "O":
                continue
            kind, label = name.split("-", 1)
            if kind == "I" and spans and spans[-1]["label"] == label and toks[-1][-1] == t - 1:
                spans[-1]["end"] = b; toks[-1].append(t)
            else:
                while a < b and message[a].isspace():
                    a += 1
                spans.append({"start": a, "end": b, "label": label}); toks.append([t])
        dishes, opts = self.menu_keys(menu)
        keys = [d["key"] for d in menu]
        dish_link, option_link, attach = {}, {}, {}
        for i, s in enumerate(spans):
            if s["label"] == "DISH":
                sc = self.m.link_scores(span_vec(h, toks[i]).unsqueeze(0), dishes, self.m.q_dish, self.m.k_dish, self.m.none_dish)[0]
                j = int(sc.argmax())
                dish_link[i] = keys[j] if j < len(keys) else None
        anchors = [i for i, s in enumerate(spans) if s["label"] in ANCHOR]
        anchor_dish, last = {}, None
        for i in anchors:
            if spans[i]["label"] == "DISH":
                last = dish_link.get(i)
            anchor_dish[i] = last
        if anchors:
            av = torch.stack([span_vec(h, toks[a]) for a in anchors])
            for i, s in enumerate(spans):
                if s["label"] not in ("COUNT", "OPTION"):
                    continue
                du = torch.tensor([a - i for a in anchors], device=self.dev)
                attach[i] = anchors[int(self.m.attach_scores(span_vec(h, toks[i]), av, du).argmax())]
                if s["label"] == "OPTION":
                    dk = anchor_dish.get(attach[i])
                    if dk in opts:
                        names, kv = opts[dk]
                        sc = self.m.link_scores(span_vec(h, toks[i]).unsqueeze(0), kv, self.m.q_opt, self.m.k_opt, self.m.none_opt)[0]
                        j = int(sc.argmax())
                        option_link[i] = names[j] if j < len(names) else None
        return decode(message, spans, dish_link, option_link, attach, flags[0] > 0.5, flags[1] > 0.5)

def evaluate(inf, rows, limit=None):
    ok, n = Counter(), Counter()
    for r in rows[:limit] if limit else rows:
        got = inf.read(r["menu_items"], r["message"])
        n[r["lang"]] += 1
        ok[r["lang"]] += same_reading(got, r["target"])
    return {k: round(ok[k] / n[k], 4) for k in n} | {"all": round(sum(ok.values()) / max(1, sum(n.values())), 4)}

# ---- training ----

def train(a):
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(a.base)
    rows, valid = load(a.train), load(a.valid)
    if a.limit:
        rows = rows[: a.limit]
    alignment_report(tok, valid)
    feats = [token_tags(tok, r["message"], r["spans"]) for r in rows]
    model = Reader(a.base).to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.01)
    steps = a.steps or math.ceil(len(rows) / a.batch) * a.epochs
    sched = get_linear_schedule_with_warmup(opt, int(0.06 * steps), steps)
    use_bf16 = dev == "cuda" and torch.cuda.is_bf16_supported()
    rng = random.Random(7)
    order = list(range(len(rows)))
    step, t0 = 0, time.time()
    model.train()
    while step < steps:
        rng.shuffle(order)
        for b in range(0, len(order), a.batch):
            if step >= steps:
                break
            idx = order[b : b + a.batch]
            L = max(len(feats[i][0]) for i in idx)
            ids = torch.tensor([feats[i][0] + [tok.pad_token_id] * (L - len(feats[i][0])) for i in idx], device=dev)
            mask = (ids != tok.pad_token_id).long()
            mask[:, 0] = 1
            tags = torch.tensor([feats[i][1] + [-100] * (L - len(feats[i][1])) for i in idx], device=dev)
            flags = torch.tensor([[float(rows[i]["target"]["total"]), float(rows[i]["target"]["each"])] for i in idx], device=dev)
            with torch.autocast(device_type="cuda", dtype=torch.bfloat16, enabled=use_bf16):
                h = model.encode(ids, mask)
                loss = F.cross_entropy(model.tag(h).reshape(-1, len(TAGS)).float(), tags.reshape(-1), ignore_index=-100)
                loss = loss + F.binary_cross_entropy_with_logits(model.flags(h[:, 0]).float(), flags)
                loss = loss + batch_losses(model, tok, rows, idx, h, {i: feats[i][2] for i in idx}, dev, rng)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            step += 1
            if step % 50 == 0 or step == 1:
                print(f"step {step}/{steps} loss {loss.item():.4f} {time.time() - t0:.0f}s", flush=True)
            if a.eval_every and step % a.eval_every == 0:
                print("valid", evaluate(Inference(model, tok, dev), valid, 500), flush=True)
                model.train()
    os.makedirs(a.out, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(a.out, "reader.pt"))
    tok.save_pretrained(os.path.join(a.out, "tokenizer"))
    json.dump({"base": a.base, "tags": TAGS}, open(os.path.join(a.out, "config.json"), "w"))
    res = evaluate(Inference(model, tok, dev), valid, a.valid_limit)
    print("final valid", res, flush=True)
    json.dump(res, open(os.path.join(a.out, "valid.json"), "w"))

def load_reader(path, dev="cpu"):
    cfg = json.load(open(os.path.join(path, "config.json")))
    tok = AutoTokenizer.from_pretrained(os.path.join(path, "tokenizer"))
    model = Reader(cfg["base"])
    model.load_state_dict(torch.load(os.path.join(path, "reader.pt"), map_location=dev))
    return Inference(model.to(dev), tok, dev)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--check")
    p.add_argument("--train", default=os.environ.get("SM_CHANNEL_DATA", ".") + "/train.jsonl")
    p.add_argument("--valid", default=os.environ.get("SM_CHANNEL_DATA", ".") + "/valid.jsonl")
    p.add_argument("--out", default=os.environ.get("SM_MODEL_DIR", "model"))
    p.add_argument("--base", default="microsoft/mdeberta-v3-base")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--steps", type=int, default=0)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-5)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--eval-every", dest="eval_every", type=int, default=0)
    p.add_argument("--valid-limit", dest="valid_limit", type=int, default=0)
    a = p.parse_args()
    if a.check:
        check(a.check)
        alignment_report(AutoTokenizer.from_pretrained(a.base), load(a.check))
    else:
        train(a)
