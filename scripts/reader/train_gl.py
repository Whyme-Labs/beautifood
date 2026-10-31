# The browser reader: GLiNER2.5-multi's encoder (fastino/gliner2.5-multi-v1, mDeBERTa-v3-base, Apache-2.0)
# with our own GLiNER-style heads, fine-tuned on the teacher's checked turns (teacher/check.ts).
#
# The menu is in the input, as labels: "[MASK] count [MASK] person [MASK] pointer [MASK] dish: Curry Laksa
# 咖喱叻沙 … [MASK] add-on: Large … [SEP] <guest message>". One forward pass gives:
#   - spans × labels: which words name which dish of THIS menu (or count, person, a pointer like "the
#     first one", or one of its add-ons), by matching span states to label states, so a new menu needs
#     no retraining;
#   - attach: which count, person and add-on (put on or taken off) belong to which dish mention;
#   - change: what each dish mention does to the order (new, more, set_count, remove, swap_out,
#     swap_in, modify, split_off, assign);
#   - acts: what the turn is (order, change, ask_total, …).
# Decoding (decode()) is plain and deterministic, and the brain applies the result (applyTurn), checked.
#
#   python train_gl.py --train train.jsonl --valid train.valid.jsonl --menus train.menus.json --out <dir>
#   (on SageMaker the data channel and model dir come from SM_CHANNEL_DATA and SM_MODEL_DIR)
import argparse, json, math, os, random, re, time, collections

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer, DebertaV2Config, DebertaV2Model

BASE = "fastino/gliner2.5-multi-v1"
TOKENIZER = "microsoft/mdeberta-v3-base"
CHANGES = ["new", "more", "set_count", "remove", "swap_out", "swap_in", "modify", "split_off", "assign"]
ACTS = ["order", "change", "ask_total", "ask_price", "split", "ask_dish", "diet", "chat"]
GENERIC = ["count", "person", "pointer"]
MAX_W = 12          # longest span, in tokens
MAX_TEXT = 96       # message tokens kept
MAX_LEN = 512       # whole input
MAX_DISHES = 40
MAX_OPTIONS = 60


# ---------- inputs ----------

def norm(s):
    return re.sub(r"[^\w]+", " ", s.lower()).strip()


def menu_labels(menu, text, keep=()):
    """The label list for a message: generic ones, the menu's dishes (the ones the message or the order
    names first, up to MAX_DISHES), then their add-on names (up to MAX_OPTIONS)."""
    words = set(norm(text).split())
    def score(d):
        name_words = [w for w in norm(d["name"]).split() if len(w) >= 3]
        zh = d.get("zh") or ""
        hit = sum(w in words for w in name_words) + sum(zh[k:k + 2] in text for k in range(max(0, len(zh) - 1)))
        return (d["name"] in keep) * 100 + hit
    dishes = sorted(menu, key=lambda d: -score(d))[:MAX_DISHES]
    opts = []
    for d in dishes:
        for g in d.get("groups", []):
            for o in g["options"]:
                if o not in opts:
                    opts.append(o)
    return dishes, opts[:MAX_OPTIONS]


def encode(tok, text, dishes, opts):
    """Token ids, the label markers' positions, and each text token's character span."""
    labels = GENERIC + [f"dish: {d['name']} {d.get('zh') or ''}".strip() for d in dishes] + [f"add-on: {o}" for o in opts]
    ids, markers = [tok.cls_token_id], []
    for l in labels:
        piece = tok(l, add_special_tokens=False).input_ids[:10]
        if len(ids) + 1 + len(piece) > MAX_LEN - MAX_TEXT - 2:
            break
        markers.append(len(ids))
        ids += [tok.mask_token_id] + piece
    ids.append(tok.sep_token_id)
    enc = tok(text, add_special_tokens=False, return_offsets_mapping=True)
    tid, offs = enc.input_ids[:MAX_TEXT], enc.offset_mapping[:MAX_TEXT]
    start = len(ids)
    ids += tid + [tok.sep_token_id]
    return ids, markers, labels[: len(markers)], start, offs


def char_to_tokens(offs, span, text=None):
    """The [first, last] token of a character span (None if it isn't inside the kept tokens)."""
    if not span:
        return None
    s, e = span
    toks = [k for k, (a, b) in enumerate(offs) if b > s and a < e and b > a and (text is None or text[a:b].strip())]
    if not toks or toks[-1] - toks[0] >= MAX_W:
        return None
    return toks[0], toks[-1]


def example_targets(ex, menu, tok):
    keep = {i["dish"] for i in ex["items"]} | {l["dish"] for l in ex["before"]}
    dishes, opts = menu_labels(menu, ex["text"], keep)
    ids, markers, labels, start, offs = encode(tok, ex["text"], dishes, opts)
    lab = {l: k for k, l in enumerate(labels)}
    dish_label = {d["name"]: lab.get(f"dish: {d['name']} {d.get('zh') or ''}".strip()) for d in dishes}
    spans, attach, change = [], [], []   # (start tok, end tok, label), (dish span idx, part span idx, kind 1=on/link 2=off), (dish span idx, change idx)
    def add_span(t, label):
        if t is None or label is None:
            return None
        for k, (a, b, l) in enumerate(spans):
            if (a, b, l) == (t[0], t[1], label):
                return k
        spans.append((t[0], t[1], label))
        return len(spans) - 1
    for it in ex["items"]:
        t = char_to_tokens(offs, it.get("dishSpan"), ex["text"])
        lbl = lab["pointer"] if it.get("dishKind") == "pointer" else dish_label.get(it["dish"])
        di = add_span(t, lbl)
        if di is None:
            continue
        change.append((di, CHANGES.index(it["change"])))
        for key, label in (("countSpan", lab["count"]), ("ownerSpan", lab["person"])):
            pi = add_span(char_to_tokens(offs, it.get(key), ex["text"]), label)
            if pi is not None:
                attach.append((di, pi, 1))
        for name, sp in (it.get("optionSpans") or {}).items():
            pi = add_span(char_to_tokens(offs, sp, ex["text"]), lab.get(f"add-on: {name}"))
            if pi is not None:
                attach.append((di, pi, 2 if name in (it.get("removeOptions") or []) else 1))
    acts = [float(a in ex["acts"]) for a in ACTS]
    return {"ids": ids, "markers": markers, "start": start, "n_text": len(offs), "valid": text_tokens(ex["text"], offs), "spans": spans, "attach": attach, "change": change, "acts": acts, "labels": labels, "offs": offs}


def text_tokens(text, offs):
    """The tokens a span may start or end on: ones with text (mDeBERTa splits off a bare "▁" before some words)."""
    return [k for k, (a, b) in enumerate(offs) if b > a and text[a:b].strip()]


# ---------- model ----------

class Reader(nn.Module):
    def __init__(self, encoder, d=256):
        super().__init__()
        self.encoder = encoder
        h = encoder.config.hidden_size
        self.width = nn.Embedding(MAX_W, 64)
        self.span = nn.Sequential(nn.Linear(2 * h + 64, h), nn.GELU(), nn.Linear(h, d))
        self.label = nn.Sequential(nn.Linear(h, h), nn.GELU(), nn.Linear(h, d))
        self.attach = nn.Sequential(nn.Linear(3 * d, d), nn.GELU(), nn.Linear(d, 3))
        self.change = nn.Sequential(nn.Linear(d + h, d), nn.GELU(), nn.Linear(d, len(CHANGES)))
        self.acts = nn.Sequential(nn.Linear(h, d), nn.GELU(), nn.Linear(d, len(ACTS)))

    def states(self, ids, mask):
        return self.encoder(input_ids=ids, attention_mask=mask).last_hidden_state

    def span_reps(self, hs, start, valid):
        """Every span of up to MAX_W text tokens, starting and ending on a token with text: (span list, reps)."""
        ok = set(valid)
        idx = [(i, j) for i in valid for j in range(i, min(max(valid) + 1, i + MAX_W)) if j in ok]
        a = torch.tensor([start + i for i, _ in idx], device=hs.device)
        b = torch.tensor([start + j for _, j in idx], device=hs.device)
        w = torch.tensor([j - i for i, j in idx], device=hs.device)
        return idx, self.span(torch.cat([hs[a], hs[b], self.width(w)], -1))


def losses(model, batch, device):
    ids = nn.utils.rnn.pad_sequence([torch.tensor(x["ids"]) for x in batch], batch_first=True, padding_value=0).to(device)
    mask = (ids != 0).long()
    for k, x in enumerate(batch):
        mask[k, : len(x["ids"])] = 1
    H = model.states(ids, mask)
    total = {"span": 0.0, "attach": 0.0, "change": 0.0, "acts": 0.0}
    for k, x in enumerate(batch):
        hs = H[k]
        idx, S = model.span_reps(hs, x["start"], x["valid"])
        L = model.label(hs[torch.tensor(x["markers"], device=device)])
        logits = S @ L.T                                       # spans × labels
        target = torch.zeros_like(logits)
        pos = {(a, b): n for n, (a, b) in enumerate(idx)}
        gold = [pos[(a, b)] for a, b, _ in x["spans"]]
        for (a, b, l), g in zip(x["spans"], gold):
            target[g, l] = 1.0
        # (negatives are many: weigh the positives up)
        w = torch.where(target > 0, torch.tensor(20.0, device=device), torch.tensor(1.0, device=device))
        total["span"] = total["span"] + F.binary_cross_entropy_with_logits(logits, target, weight=w)
        if x["attach"] or x["change"]:
            G = S[torch.tensor(gold, device=device)] if gold else S[:0]
            dish_idx = sorted({d for d, _ in x["change"]})
            if dish_idx and len(gold) > 1:
                pairs, labels_ = [], []
                link = {(d, p): kind for d, p, kind in x["attach"]}
                for d in dish_idx:
                    for p in range(len(gold)):
                        if p in dish_idx:
                            continue
                        pairs.append((d, p))
                        labels_.append(link.get((d, p), 0))
                if pairs:
                    A = torch.stack([torch.cat([G[d], G[p], G[d] * G[p]]) for d, p in pairs])
                    total["attach"] = total["attach"] + F.cross_entropy(model.attach(A), torch.tensor(labels_, device=device))
            if x["change"]:
                C = torch.stack([torch.cat([G[d], hs[0]]) for d, _ in x["change"]])
                total["change"] = total["change"] + F.cross_entropy(model.change(C), torch.tensor([c for _, c in x["change"]], device=device))
        total["acts"] = total["acts"] + F.binary_cross_entropy_with_logits(model.acts(hs[0]), torch.tensor(x["acts"], device=device))
    n = len(batch)
    return {k: v / n for k, v in total.items()}


# ---------- decoding (the TypeScript runtime does the same) ----------

@torch.no_grad()
def decode(model, x, device, threshold=0.5):
    ids = torch.tensor([x["ids"]], device=device)
    hs = model.states(ids, torch.ones_like(ids))[0]
    idx, S = model.span_reps(hs, x["start"], x["valid"])
    L = model.label(hs[torch.tensor(x["markers"], device=device)])
    P = torch.sigmoid(S @ L.T)
    cand = [(P[s, l].item(), s, l) for s, l in (P > threshold).nonzero().tolist()]
    taken, spans = set(), []
    for p, s, l in sorted(cand, reverse=True):
        a, b = idx[s]
        if any(t in taken for t in range(a, b + 1)):
            continue
        taken.update(range(a, b + 1))
        spans.append((a, b, l, s))
    spans.sort()
    labels = x["labels"]
    is_dish = lambda l: labels[l].startswith("dish: ") or labels[l] == "pointer"
    dishes = [k for k, sp in enumerate(spans) if is_dish(sp[2])]
    items = {k: {"label": labels[spans[k][2]], "span": spans[k][:2], "parts": []} for k in dishes}
    for k, sp in enumerate(spans):
        if is_dish(sp[2]) or not dishes:
            continue
        A = torch.stack([torch.cat([S[spans[d][3]], S[sp[3]], S[spans[d][3]] * S[sp[3]]]) for d in dishes])
        probs = F.softmax(model.attach(A), -1)
        best = int(torch.argmax(1 - probs[:, 0]))
        if probs[best, 0] < 0.5:
            items[dishes[best]]["parts"].append((labels[sp[2]], sp[:2], "off" if probs[best, 2] > probs[best, 1] else "on"))
    for k in dishes:
        items[k]["change"] = CHANGES[int(torch.argmax(model.change(torch.cat([S[spans[k][3]], hs[0]]))))]
    acts = [a for a, p in zip(ACTS, torch.sigmoid(model.acts(hs[0])).tolist()) if p > 0.5]
    return {"acts": acts, "items": [items[k] for k in dishes]}


def gold_view(x):
    labels = x["labels"]
    items = []
    for d, c in x["change"]:
        a, b, l = x["spans"][d]
        parts = sorted((labels[x["spans"][p][2]], tuple(x["spans"][p][:2]), "off" if kind == 2 else "on") for dd, p, kind in x["attach"] if dd == d)
        items.append((labels[l], (a, b), CHANGES[c], tuple(parts)))
    return sorted(items), sorted(a for a, v in zip(ACTS, x["acts"]) if v)


def evaluate(model, data, device, limit=1000):
    model.eval()
    hit, hit_items, by_lang = 0, 0, collections.defaultdict(lambda: [0, 0])
    for x in data[:limit]:
        r = decode(model, x, device)
        got = sorted((i["label"], tuple(i["span"]), i["change"], tuple(sorted((l, tuple(s), k) for l, s, k in i["parts"]))) for i in r["items"])
        want_items, want_acts = gold_view(x)
        ok_items = got == want_items
        ok = ok_items and sorted(r["acts"]) == want_acts
        hit += ok
        hit_items += ok_items
        by_lang[x.get("lang", "?")][0] += ok_items
        by_lang[x.get("lang", "?")][1] += 1
    model.train()
    n = max(1, min(limit, len(data)))
    return {"items_exact": round(hit_items / n, 4), "all_exact": round(hit / n, 4), "lang": {k: round(a / b, 3) for k, (a, b) in by_lang.items()}}


# ---------- training ----------

def load_encoder():
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    enc = DebertaV2Model(DebertaV2Config.from_pretrained(TOKENIZER))
    sd = load_file(hf_hub_download(BASE, "model.safetensors"))
    own = {k[len("encoder."):]: v for k, v in sd.items() if k.startswith("encoder.")}
    if own["embeddings.word_embeddings.weight"].shape[0] != enc.embeddings.word_embeddings.weight.shape[0]:
        enc.resize_token_embeddings(own["embeddings.word_embeddings.weight"].shape[0])
    missing, unexpected = enc.load_state_dict(own, strict=False)
    print(f"encoder from {BASE}: {len(own)} tensors, missing {len(missing)}, unexpected {len(unexpected)}", flush=True)
    return enc


def main():
    ap = argparse.ArgumentParser()
    data = os.environ.get("SM_CHANNEL_DATA", ".")
    ap.add_argument("--train", default=os.path.join(data, "train.jsonl"))
    ap.add_argument("--valid", default=os.path.join(data, "train.valid.jsonl"))
    ap.add_argument("--menus", default=os.path.join(data, "train.menus.json"))
    ap.add_argument("--out", default=os.environ.get("SM_MODEL_DIR", "out"))
    ap.add_argument("--epochs", type=float, default=3)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--head-lr", type=float, default=1e-4)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--valid-limit", type=int, default=1000)
    ap.add_argument("--max-minutes", type=float, default=0)
    a = ap.parse_args()
    random.seed(7)
    torch.manual_seed(7)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(TOKENIZER)
    menus = json.load(open(a.menus, encoding="utf-8"))
    read = lambda p: [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    train_rows, valid_rows = read(a.train), read(a.valid)
    if a.limit:
        train_rows = train_rows[: a.limit]
    train = [example_targets(e, menus[e["menu"]], tok) for e in train_rows]
    valid = [example_targets(e, menus[e["menu"]], tok) | {"lang": e.get("lang")} for e in valid_rows]
    for x, e in zip(train, train_rows):
        x["lang"] = e.get("lang")
    print(f"train {len(train)}, valid {len(valid)}; spans a turn {sum(len(x['spans']) for x in train) / max(1, len(train)):.1f}", flush=True)
    model = Reader(load_encoder()).to(device)
    heads = [p for n, p in model.named_parameters() if not n.startswith("encoder.")]
    opt = torch.optim.AdamW([{"params": model.encoder.parameters(), "lr": a.lr}, {"params": heads, "lr": a.head_lr}], weight_decay=0.01)
    steps = math.ceil(len(train) / a.batch * a.epochs)
    warm = max(1, int(0.05 * steps))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1.0, s / steps))))
    print(f"{steps} steps", flush=True)
    model.train()
    t0, step = time.time(), 0
    while step < steps:
        random.shuffle(train)
        for k in range(0, len(train), a.batch):
            with torch.autocast(device_type=device, dtype=torch.bfloat16, enabled=device == "cuda"):
                L = losses(model, train[k : k + a.batch], device)
            loss = L["span"] + L["attach"] + L["change"] + 0.5 * L["acts"]
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)
            step += 1
            if step % 100 == 0:
                print(f"step {step}/{steps} " + " ".join(f"{n} {float(v):.4f}" for n, v in L.items()) + f" {(time.time() - t0) / 60:.1f} min", flush=True)
            if step % 1500 == 0:
                print("valid", json.dumps(evaluate(model, valid, device, 300)), flush=True)
            if step >= steps or (a.max_minutes and time.time() - t0 > a.max_minutes * 60):
                steps = step
                break
    print("valid", json.dumps(evaluate(model, valid, device, a.valid_limit)), flush=True)
    os.makedirs(a.out, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(a.out, "reader.pt"))
    tok.save_pretrained(a.out)
    json.dump({"base": BASE, "changes": CHANGES, "acts": ACTS, "generic": GENERIC, "max_w": MAX_W, "max_text": MAX_TEXT, "max_len": MAX_LEN, "max_dishes": MAX_DISHES, "max_options": MAX_OPTIONS}, open(os.path.join(a.out, "reader.json"), "w"))
    print("saved", a.out, flush=True)


if __name__ == "__main__":
    main()
