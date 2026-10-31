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
MAX_LEN = 640       # whole input
MAX_DISHES = 20
MAX_OPTIONS = 60


# ---------- inputs ----------

def norm(s):
    return re.sub(r"[^\w]+", " ", s.lower()).strip()


def dish_label(d):
    """A dish's label: its Chinese name first (what a Chinese guest matches, and kept if the label is cut)."""
    return f"dish: {d['zh']} {d['name']}" if d.get("zh") else f"dish: {d['name']}"


def select_labels(tok, menu, text, keep=(), rng=None, gold=()):
    """The labels for a message, all fitting the input: generic ones; then dishes, the ones the message's
    words hit first (most hits first), then (in training) the gold ones, then the order's (`keep`), then the
    rest of the menu, up to MAX_DISHES; then those dishes' add-ons in the same order, while they fit. In
    training (`rng`), dishes and add-ons are shuffled, so a label's place says nothing about the answer."""
    words = set(norm(text).split())
    def hit(d):
        zh = d.get("zh") or ""
        return sum(w in words for w in norm(d["name"]).split() if len(w) >= 3) + sum(zh[k:k + 2] in text for k in range(max(0, len(zh) - 1)))
    hits = sorted([d for d in menu if hit(d)], key=lambda d: -hit(d))
    seen = {d["name"] for d in hits}
    ranked = hits + [d for d in menu if d["name"] in gold and d["name"] not in seen]
    seen |= set(gold)
    ranked += [d for d in menu if d["name"] in keep and d["name"] not in seen]
    seen |= set(keep)
    ranked += [d for d in menu if d["name"] not in seen]
    budget = MAX_LEN - MAX_TEXT - 3
    cost = lambda l, cap: 1 + min(cap, len(tok(l, add_special_tokens=False).input_ids))
    used = sum(cost(l, 8) for l in GENERIC)
    dishes, dish_labels, opt_labels = [], [], []
    for d in ranked[:MAX_DISHES]:
        c = cost(dish_label(d), 10)
        if used + c > budget:
            break
        used += c
        dishes.append(d)
        dish_labels.append(dish_label(d))
    for d in dishes:
        for g in d.get("groups", []):
            for o in g["options"]:
                l = f"add-on: {o}"
                if l in opt_labels or len(opt_labels) >= MAX_OPTIONS:
                    continue
                c = cost(l, 8)
                if used + c <= budget:
                    used += c
                    opt_labels.append(l)
    if rng:
        rng.shuffle(dish_labels)
        rng.shuffle(opt_labels)
    return dishes, GENERIC + dish_labels + opt_labels


def encode(tok, text, labels):
    """Token ids, the label markers' positions, where the message starts, and each message token's character span."""
    ids, markers = [tok.cls_token_id], []
    for l in labels:
        markers.append(len(ids))
        ids += [tok.mask_token_id] + tok(l, add_special_tokens=False).input_ids[: 10 if l.startswith("dish: ") else 8]
    ids.append(tok.sep_token_id)
    enc = tok(text, add_special_tokens=False, return_offsets_mapping=True)
    tid, offs = enc.input_ids[:MAX_TEXT], enc.offset_mapping[:MAX_TEXT]
    start = len(ids)
    ids += tid + [tok.sep_token_id]
    return ids, markers, start, offs


def char_to_tokens(offs, span, text=None):
    """The [first, last] token of a character span (None if it isn't inside the kept tokens)."""
    if not span:
        return None
    s, e = span
    toks = [k for k, (a, b) in enumerate(offs) if b > s and a < e and b > a and (text is None or text[a:b].strip())]
    if not toks or toks[-1] - toks[0] >= MAX_W:
        return None
    return toks[0], toks[-1]


def example_targets(ex, menu, tok, rng=None):
    gold = {i["dish"] for i in ex["items"]}
    dishes, labels = select_labels(tok, menu, ex["text"], {l["dish"] for l in ex["before"]}, rng, gold)
    ids, markers, start, offs = encode(tok, ex["text"], labels)
    lab = {l: k for k, l in enumerate(labels)}
    dish_lab = {d["name"]: lab.get(dish_label(d)) for d in dishes}
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
        lbl = lab["pointer"] if it.get("dishKind") == "pointer" else dish_lab.get(it["dish"])
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
        # A plain mean over every span x label pair (~30k, a handful positive) barely moves: a wrong
        # span costs 1/30k of the loss. Balanced instead: the positives' mean, the hardest negatives' mean,
        # and a little of all the negatives.
        bce = F.binary_cross_entropy_with_logits(logits, target, reduction="none")
        pos_m = target > 0
        neg = bce[~pos_m]
        span_loss = neg.topk(min(100, neg.numel())).values.mean() + 0.1 * neg.mean()
        if pos_m.any():
            span_loss = span_loss + bce[pos_m].mean()
        total["span"] = total["span"] + span_loss
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
def decode(model, x, device, threshold=0.5, allowed=None):
    ids = torch.tensor([x["ids"]], device=device)
    hs = model.states(ids, torch.ones_like(ids))[0]
    idx, S = model.span_reps(hs, x["start"], x["valid"])
    L = model.label(hs[torch.tensor(x["markers"], device=device)])

    def heads(dish, part, cls):
        n, k = dish.shape[0], part.shape[0]
        d, p = dish.unsqueeze(1).expand(n, k, -1), part.unsqueeze(0).expand(n, k, -1)
        attach = model.attach(torch.cat([d, p, d * p], -1)) if k else torch.zeros(n, 0, 3, device=device)
        return attach, model.change(torch.cat([dish, cls.unsqueeze(0).expand(n, -1)], -1)), model.acts(cls)
    return decode_from(idx, S @ L.T, S, hs[0], heads, x["labels"], threshold, allowed)


def decode_from(idx, logits, S, cls, heads, labels, threshold=0.5, allowed=None):
    """The reading from the encoder's outputs (span x label logits, span states, [CLS] state) and the
    heads (dish states, part states, cls) -> (attach [n, k, 3], change [n, changes], acts): the same
    decoding for PyTorch and for the exported graphs (export_gl.py). `allowed(dish label, part label)`
    says whether the menu lets that part go with that dish (an add-on only on a dish that has it)."""
    t = lambda v: v if torch.is_tensor(v) else torch.from_numpy(v)
    logits, S, cls = t(logits).float(), t(S).float(), t(cls).float()
    P = torch.sigmoid(logits)
    cand = [(P[s, l].item(), s, l) for s, l in (P > threshold).nonzero().tolist()]
    taken, spans = set(), []
    for p, s, l in sorted(cand, reverse=True):
        a, b = idx[s]
        if any(q in taken for q in range(a, b + 1)):
            continue
        taken.update(range(a, b + 1))
        spans.append((a, b, l, s))
    spans.sort()
    # a name split in two ("黑糖珍珠 鲜奶", "2 x"): side by side with the same label is one span
    where = {sp: k for k, sp in enumerate(idx)}
    merged = []
    for sp in spans:
        if merged and merged[-1][2] == sp[2] and sp[0] == merged[-1][1] + 1 and (merged[-1][0], sp[1]) in where:
            a = merged[-1][0]
            merged[-1] = (a, sp[1], sp[2], where[(a, sp[1])])
        else:
            merged.append(sp)
    spans = merged
    prob = lambda sp: P[sp[3], sp[2]].item()
    is_dish = lambda l: labels[l].startswith("dish: ") or labels[l] == "pointer"
    dishes = [k for k, sp in enumerate(spans) if is_dish(sp[2])]
    parts = [k for k, sp in enumerate(spans) if not is_dish(sp[2])]
    sure = []
    items = {k: {"label": labels[spans[k][2]], "span": spans[k][:2], "parts": []} for k in dishes}
    if dishes:
        dish_S = S[[spans[k][3] for k in dishes]]
        part_S = S[[spans[k][3] for k in parts]] if parts else S[:0]
        attach, change, acts = (t(v).float() for v in heads(dish_S, part_S, cls))
        probs = F.softmax(attach, -1)  # [dishes, parts, 3]
        # each part to the dish it goes with; an item has one of each (one count, one owner, an add-on once):
        # of two with the same label, the likelier
        chosen = {}
        for j, k in enumerate(parts):
            if allowed:
                ok = torch.tensor([allowed(labels[spans[d][2]], labels[spans[k][2]]) for d in dishes])
                if not ok.any():
                    continue
                probs[~ok, j, 0] = 1.0
            best = int(torch.argmax(1 - probs[:, j, 0]))
            if probs[best, j, 0] < 0.5:
                key = (best, spans[k][2])
                score = prob(spans[k]) * float(1 - probs[best, j, 0])
                if key not in chosen or score > chosen[key][0]:
                    chosen[key] = (score, k, "off" if probs[best, j, 2] > probs[best, j, 1] else "on")
        for (best, _), (score, k, kind) in sorted(chosen.items(), key=lambda kv: spans[kv[1][1]][0]):
            items[dishes[best]]["parts"].append((labels[spans[k][2]], spans[k][:2], kind))
            sure.append(score)
        for j, k in enumerate(dishes):
            items[k]["change"] = CHANGES[int(torch.argmax(change[j]))]
            sure += [prob(spans[k]), float(F.softmax(change[j], -1).max())]
    else:
        acts = t(heads(S[:0], S[:0], cls)[2]).float()
    pa = torch.sigmoid(acts).tolist()
    acts = [a for a, p in zip(ACTS, pa) if p > 0.5]
    sure += [max(p, 1 - p) for p in pa]
    # (how sure the least sure decision was: a reading can be refused below some level)
    return {"acts": acts, "items": [items[k] for k in dishes], "sure": min(sure)}


def gold_view(x):
    labels = x["labels"]
    items = []
    for d, c in x["change"]:
        a, b, l = x["spans"][d]
        parts = sorted((labels[x["spans"][p][2]], tuple(x["spans"][p][:2]), "off" if kind == 2 else "on") for dd, p, kind in x["attach"] if dd == d)
        items.append((labels[l], (a, b), CHANGES[c], tuple(parts)))
    return sorted(items), sorted(a for a, v in zip(ACTS, x["acts"]) if v)


def span_fit(model, data, device):
    """How the span scores sit: the mean score on gold spans, how many gold spans score below 0.5, and
    how many other span x label pairs score above it, a message."""
    gp, fp = [], 0
    with torch.no_grad():
        for x in data:
            ids = torch.tensor([x["ids"]], device=device)
            hs = model.states(ids, torch.ones_like(ids))[0]
            idx, S = model.span_reps(hs, x["start"], x["valid"])
            P = torch.sigmoid(S @ model.label(hs[torch.tensor(x["markers"], device=device)]).T)
            pos = {(a, b): k for k, (a, b) in enumerate(idx)}
            g = {(pos[(a, b)], l) for a, b, l in x["spans"]}
            gp += [P[s_, l].item() for s_, l in g]
            fp += sum(1 for s_, l in (P > 0.5).nonzero().tolist() if (s_, l) not in g)
    return {"gold_p": round(sum(gp) / max(1, len(gp)), 3), "gold_missed": sum(p < 0.5 for p in gp), "gold": len(gp), "false_pos_a_turn": round(fp / max(1, len(data)), 2)}


def evaluate(model, data, device, limit=1000):
    model.eval()
    fit = span_fit(model, data[:200], device)
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
    return {"items_exact": round(hit_items / n, 4), "all_exact": round(hit / n, 4), "spans": fit, "lang": {k: round(a / b, 3) for k, (a, b) in by_lang.items()}}


# ---------- training ----------

def tokenizer_from(vocab_json):
    """The trimmed tokenizer trim_vocab.py wrote (its tokenizer.json text)."""
    from tokenizers import Tokenizer
    from transformers import PreTrainedTokenizerFast
    return PreTrainedTokenizerFast(tokenizer_object=Tokenizer.from_str(vocab_json), cls_token="[CLS]", sep_token="[SEP]", pad_token="[PAD]", unk_token="[UNK]", mask_token="[MASK]")


def load_reader(model_dir):
    """A trained reader (reader.pt) and its tokenizer, the vocabulary however big it was trained."""
    tok = AutoTokenizer.from_pretrained(model_dir)
    sd = torch.load(os.path.join(model_dir, "reader.pt"), map_location="cpu")
    cfg = DebertaV2Config.from_pretrained(TOKENIZER)
    cfg.vocab_size = sd["encoder.embeddings.word_embeddings.weight"].shape[0]
    model = Reader(DebertaV2Model(cfg))
    model.load_state_dict(sd)
    model.eval()
    return tok, model


def load_encoder(kept=None):
    """GLiNER2.5-multi's encoder; with `kept` (trim_vocab.py), only those embedding rows, in that order."""
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    enc = DebertaV2Model(DebertaV2Config.from_pretrained(TOKENIZER))
    sd = load_file(hf_hub_download(BASE, "model.safetensors"))
    own = {k[len("encoder."):]: v for k, v in sd.items() if k.startswith("encoder.")}
    if own["embeddings.word_embeddings.weight"].shape[0] != enc.embeddings.word_embeddings.weight.shape[0]:
        enc.resize_token_embeddings(own["embeddings.word_embeddings.weight"].shape[0])
    missing, unexpected = enc.load_state_dict(own, strict=False)
    print(f"encoder from {BASE}: {len(own)} tensors, missing {len(missing)}, unexpected {len(unexpected)}", flush=True)
    if kept:
        rows = enc.embeddings.word_embeddings.weight.data[torch.tensor(kept)].clone()
        enc.embeddings.word_embeddings = nn.Embedding(len(kept), rows.shape[1], padding_idx=0)
        enc.embeddings.word_embeddings.weight.data.copy_(rows)
        enc.config.vocab_size = len(kept)
        print(f"vocabulary trimmed to {len(kept)} pieces", flush=True)
    return enc


def main():
    ap = argparse.ArgumentParser()
    data = os.environ.get("SM_CHANNEL_DATA", ".")
    ap.add_argument("--train", default=os.path.join(data, "train.jsonl"))
    ap.add_argument("--valid", default=os.path.join(data, "train.valid.jsonl"))
    ap.add_argument("--menus", default=os.path.join(data, "train.menus.json"))
    ap.add_argument("--vocab", default=os.path.join(data, "vocab.json"), help="trim_vocab.py's output (used if it exists)")
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
    vocab = json.load(open(a.vocab, encoding="utf-8")) if a.vocab and os.path.exists(a.vocab) else None
    tok = tokenizer_from(vocab["tokenizer"]) if vocab else AutoTokenizer.from_pretrained(TOKENIZER)
    menus = json.load(open(a.menus, encoding="utf-8"))
    read = lambda p: [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    train_rows, valid_rows = read(a.train), read(a.valid)
    if a.limit:
        train_rows = train_rows[: a.limit]
    label_rng = random.Random(11)
    train = [example_targets(e, menus[e["menu"]], tok, label_rng) for e in train_rows]
    valid = [example_targets(e, menus[e["menu"]], tok) | {"lang": e.get("lang")} for e in valid_rows]
    for x, e in zip(train, train_rows):
        x["lang"] = e.get("lang")
    print(f"train {len(train)}, valid {len(valid)}; spans a turn {sum(len(x['spans']) for x in train) / max(1, len(train)):.1f}", flush=True)
    model = Reader(load_encoder(vocab["kept"] if vocab else None)).to(device)
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
            if step % 400 == 0:
                print("valid", json.dumps(evaluate(model, valid, device, 300)), flush=True)
            if step >= steps or (a.max_minutes and time.time() - t0 > a.max_minutes * 60):
                steps = step
                break
    print("valid", json.dumps(evaluate(model, valid, device, a.valid_limit)), flush=True)
    model.eval()
    print("train spans", json.dumps(span_fit(model, train[:200], device)), flush=True)
    os.makedirs(a.out, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(a.out, "reader.pt"))
    tok.save_pretrained(a.out)
    json.dump({"base": BASE, "vocab": len(tok), "changes": CHANGES, "acts": ACTS, "generic": GENERIC, "max_w": MAX_W, "max_text": MAX_TEXT, "max_len": MAX_LEN, "max_dishes": MAX_DISHES, "max_options": MAX_OPTIONS}, open(os.path.join(a.out, "reader.json"), "w"))
    print("saved", a.out, flush=True)


if __name__ == "__main__":
    main()
