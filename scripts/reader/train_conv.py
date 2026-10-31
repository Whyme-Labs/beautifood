# Fine-tunes a small open decoder (Qwen3-0.6B, Apache-2.0) as the conversation reader
# (src/server/ai/brain/convReader.ts): from the reader's prompt (the menu's dishes the turn could
# mean, the order so far, the assistant's last reply, the guest's message) to the order as it now
# stands, one line per order line. Data: scripts/reader/conv-gen.ts. The loss is on the answer only.
#
#   python train_conv.py --train train.jsonl --valid valid.jsonl --out <dir> [--epochs 2] [--lr 2e-5]
#   (on SageMaker: the data channel and the model dir come from SM_CHANNEL_DATA and SM_MODEL_DIR)
import argparse, json, math, os, random, time, collections

# (memory freed between batches of different lengths is reused, not left in pieces)
os.environ.setdefault("PYTORCH_ALLOC_CONF", "expandable_segments:True")

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE = "Qwen/Qwen3-0.6B"


def load(path, limit=0):
    with open(path, encoding="utf-8") as f:
        rows = [json.loads(l) for l in f if l.strip()]
    return rows[:limit] if limit else rows


def encode(tok, rows, max_len):
    out = []
    for r in rows:
        p = tok(r["prompt"], add_special_tokens=False).input_ids
        t = tok(r["target"] + "\n", add_special_tokens=False).input_ids + [tok.eos_token_id]
        if len(p) + len(t) > max_len:
            continue
        out.append((p + t, [-100] * len(p) + t))
    return out


def batches(data, tokens_per_batch, shuffle=True):
    """Batches of about `tokens_per_batch` tokens, of examples of like length."""
    idx = sorted(range(len(data)), key=lambda i: len(data[i][0]))
    groups, cur, longest = [], [], 0
    for i in idx:
        n = len(data[i][0])
        if cur and max(longest, n) * (len(cur) + 1) > tokens_per_batch:
            groups.append(cur)
            cur, longest = [], 0
        cur.append(i)
        longest = max(longest, n)
    if cur:
        groups.append(cur)
    if shuffle:
        random.shuffle(groups)
    return groups


def collate(data, group, pad_id, device):
    n = max(len(data[i][0]) for i in group)
    ids = torch.full((len(group), n), pad_id, dtype=torch.long)
    labels = torch.full((len(group), n), -100, dtype=torch.long)
    mask = torch.zeros((len(group), n), dtype=torch.long)
    for k, i in enumerate(group):
        x, y = data[i]
        ids[k, : len(x)] = torch.tensor(x)
        labels[k, : len(y)] = torch.tensor(y)
        mask[k, : len(x)] = 1
    return ids.to(device), labels.to(device), mask.to(device)


def answer_loss(model, ids, mask, labels):
    """Next-token loss on the answer only, with the vocabulary's logits made only where there is an answer token
    (over the whole prompt they'd be most of the memory: 150k logits a token)."""
    hidden = model.model(input_ids=ids, attention_mask=mask).last_hidden_state[:, :-1]
    target = labels[:, 1:]
    keep = target != -100
    logits = model.lm_head(hidden[keep]).float()
    return torch.nn.functional.cross_entropy(logits, target[keep])


@torch.no_grad()
def evaluate(model, tok, rows, device, limit=800):
    """Exact order after each turn (every line, count, add-on and owner), greedy, by kind of turn and language."""
    model.eval()
    tok.padding_side = "left"
    rows = rows[:limit]
    hit, by_op, by_lang = 0, collections.defaultdict(lambda: [0, 0]), collections.defaultdict(lambda: [0, 0])
    for k in range(0, len(rows), 32):
        chunk = rows[k : k + 32]
        enc = tok([r["prompt"] for r in chunk], return_tensors="pt", padding=True, add_special_tokens=False).to(device)
        with torch.autocast(device_type=device.split(":")[0], dtype=torch.bfloat16, enabled=device.startswith("cuda")):
            out = model.generate(**enc, max_new_tokens=96, do_sample=False, pad_token_id=tok.pad_token_id, eos_token_id=tok.eos_token_id)
        for r, o in zip(chunk, out):
            text = tok.decode(o[enc.input_ids.shape[1] :], skip_special_tokens=True).strip()
            ok = text == r["target"].strip()
            hit += ok
            for d, key in ((by_op, r.get("op", "?")), (by_lang, r.get("lang", "?"))):
                d[key][0] += ok
                d[key][1] += 1
    tok.padding_side = "right"
    model.train()
    share = lambda d: {k: round(a / b, 3) for k, (a, b) in sorted(d.items())}
    return {"all": round(hit / max(1, len(rows)), 4), "op": share(by_op), "lang": share(by_lang)}


def main():
    ap = argparse.ArgumentParser()
    data_dir = os.environ.get("SM_CHANNEL_DATA", ".")
    ap.add_argument("--train", default=os.path.join(data_dir, "train.jsonl"))
    ap.add_argument("--valid", default=os.path.join(data_dir, "valid.jsonl"))
    ap.add_argument("--out", default=os.environ.get("SM_MODEL_DIR", "out"))
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--tokens", type=int, default=6000, help="tokens per batch")
    ap.add_argument("--max-len", type=int, default=768)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--valid-limit", type=int, default=800)
    ap.add_argument("--max-minutes", type=float, default=0, help="stop training after this long (0: no limit)")
    a = ap.parse_args()
    random.seed(7)
    torch.manual_seed(7)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(a.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(a.base, dtype=torch.float32).to(device)
    model.config.use_cache = False
    # (each layer's activations recomputed in the backward pass: a 24 GB GPU holds the weights,
    # their gradients and Adam's state, but not every layer's activations for a whole batch)
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    train = encode(tok, load(a.train, a.limit), a.max_len)
    valid_rows = load(a.valid)
    print(f"train {len(train)} examples, {sum(len(x) for x, _ in train)} tokens; valid {len(valid_rows)}", flush=True)
    steps_per_epoch = len(batches(train, a.tokens, shuffle=False))
    total = math.ceil(steps_per_epoch * a.epochs)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.01, betas=(0.9, 0.95))
    warm = max(1, int(0.03 * total))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1.0, s / total))))
    print(f"{total} steps ({steps_per_epoch} an epoch)", flush=True)
    model.train()
    step, t0, seen = 0, time.time(), 0
    while step < total:
        for group in batches(train, a.tokens):
            ids, labels, mask = collate(train, group, tok.pad_token_id, device)
            with torch.autocast(device_type=device, dtype=torch.bfloat16, enabled=device == "cuda"):
                loss = answer_loss(model, ids, mask, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)
            step += 1
            seen += int(mask.sum())
            if step % 50 == 0:
                el = time.time() - t0
                print(f"step {step}/{total} loss {loss.item():.4f} lr {sched.get_last_lr()[0]:.2e} {seen / el:.0f} tok/s {el / 60:.1f} min", flush=True)
            if step >= total or (a.max_minutes and time.time() - t0 > a.max_minutes * 60):
                total = step
                break
    print("valid", json.dumps(evaluate(model, tok, valid_rows, device, a.valid_limit)), flush=True)
    os.makedirs(a.out, exist_ok=True)
    model.config.use_cache = True
    model.save_pretrained(a.out, safe_serialization=True)
    tok.save_pretrained(a.out)
    print("saved", a.out, flush=True)


if __name__ == "__main__":
    main()
