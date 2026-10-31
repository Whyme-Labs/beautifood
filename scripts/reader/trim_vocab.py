# Trims mDeBERTa's 250k-piece vocabulary to the scripts guests write (ASCII, Latin, CJK), before the
# reader is fine-tuned, so training and the browser segment text the same way. Two thirds of the
# encoder's weights are embedding rows; most are for scripts no guest here types.
#
# Kept: the special tokens; every single-character piece of those scripts (so their text never
# becomes [UNK], only splits into smaller pieces); every piece the teacher's text and menus use;
# then the most likely remaining multi-character pieces of those scripts (by the tokenizer's own
# unigram score), up to --size pieces in all.
#
# Writes vocab.json: {"kept": [old ids, new order], "tokenizer": tokenizer.json text}. train_gl.py
# --vocab takes it. Reports, for the teacher text and any --measure files (measured only, never used
# to choose): tokens a message, how many messages segment differently, [UNK]s, and menu labels that
# no longer fit their 10 tokens.
#
#   python trim_vocab.py --train train.jsonl --menus train.menus.json --size 60000 --out vocab.json [--measure a.txt ...]
import argparse, json

from transformers import AutoTokenizer, PreTrainedTokenizerFast
from tokenizers import Tokenizer

BASE_TOKENIZER = "microsoft/mdeberta-v3-base"


def script_ok(piece):
    t = piece.replace("▁", "")
    for c in t:
        o = ord(c)
        if o < 0x250:  # ASCII and Latin-1/Extended (Malay, accented names)
            continue
        if 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0x3000 <= o <= 0x303F or 0xFF00 <= o <= 0xFFEF or 0x2000 <= o <= 0x206F or 0x20A0 <= o <= 0x20CF:
            continue  # CJK, CJK punctuation, full-width forms, general punctuation, currency signs
        return False
    return True


def wrap(tokenizer_json):
    return PreTrainedTokenizerFast(tokenizer_object=Tokenizer.from_str(tokenizer_json), cls_token="[CLS]", sep_token="[SEP]", pad_token="[PAD]", unk_token="[UNK]", mask_token="[MASK]")


def trim(full, texts, size):
    j = json.loads(full.backend_tokenizer.to_str())
    vocab = j["model"]["vocab"]  # [piece, score]; [MASK] is an added token past its end
    n = len(vocab)
    special = {0, 1, 2, 3}
    keep = set(special)
    for i, (p, _) in enumerate(vocab):
        if p.startswith("<0x") or "<extra_id_" in p:
            continue
        if len(p.replace("▁", "")) <= 1 and script_ok(p):
            keep.add(i)
    used = set()
    for t in texts:
        used.update(i for i in full(t, add_special_tokens=False).input_ids if i < n)
    keep |= used
    rest = sorted((i for i, (p, s) in enumerate(vocab) if i not in keep and script_ok(p) and not p.startswith("<0x") and "<extra_id_" not in p), key=lambda i: -vocab[i][1])
    keep |= set(rest[: max(0, size - len(keep) - 1)])
    kept = sorted(keep)
    j["model"]["vocab"] = [vocab[i] for i in kept]
    j["model"]["unk_id"] = kept.index(3)
    mask_id = len(kept)
    j["added_tokens"] = [t for t in j["added_tokens"] if t["id"] in special] + [dict(next(t for t in j["added_tokens"] if t["content"] == "[MASK]"), id=mask_id)]
    for name, old in (("[CLS]", 1), ("[SEP]", 2)):
        j["post_processor"]["special_tokens"][name]["ids"] = [kept.index(old)]
    return kept + [full.mask_token_id], json.dumps(j, ensure_ascii=False), {"used": len(used)}


def report(name, full, small, texts):
    if not texts:
        return
    a = [full(t, add_special_tokens=False).input_ids for t in texts]
    b = [small(t, add_special_tokens=False).input_ids for t in texts]
    seg = lambda tk, ids: tk.convert_ids_to_tokens(ids)
    differ = sum(seg(full, x) != seg(small, y) for x, y in zip(a, b))
    unk_a = sum(x.count(full.unk_token_id) for x in a)
    unk_b = sum(y.count(small.unk_token_id) for y in b)
    print(f"{name}: {len(texts)} texts; tokens a text {sum(map(len, a)) / len(a):.1f} -> {sum(map(len, b)) / len(b):.1f}; segmented differently {differ} ({100 * differ / len(texts):.1f}%); [UNK] {unk_a} -> {unk_b}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", required=True)
    ap.add_argument("--menus", required=True)
    ap.add_argument("--size", type=int, default=60000)
    ap.add_argument("--out", required=True)
    ap.add_argument("--measure", nargs="*", default=[], help="text files, one message a line (measured only)")
    a = ap.parse_args()
    full = AutoTokenizer.from_pretrained(BASE_TOKENIZER)
    rows = [json.loads(l) for l in open(a.train, encoding="utf-8") if l.strip()]
    menus = json.load(open(a.menus, encoding="utf-8"))
    labels = []
    for m in (menus.values() if isinstance(menus, dict) else menus):
        for d in m:
            labels.append(f"dish: {d['name']} {d.get('zh') or ''}".strip())
            labels += [f"add-on: {o}" for g in d.get("groups", []) for o in g["options"]]
    texts = [r["text"] for r in rows] + [r.get("assistant") or "" for r in rows if r.get("assistant")]
    kept, tj, info = trim(full, texts + labels, a.size)
    small = wrap(tj)
    params = len(kept) * 768
    print(f"kept {len(kept)} of {len(full)} pieces ({info['used']} used by the teacher's text and menus); embeddings {params / 1e6:.0f}M params (were {len(full) * 768 / 1e6:.0f}M)")
    # (the markers: the [MASK] id must be the new one)
    assert small.mask_token_id == len(kept) - 1 and small.convert_ids_to_tokens([small.cls_token_id, small.sep_token_id]) == ["[CLS]", "[SEP]"]
    report("teacher messages", full, small, [r["text"] for r in rows])
    long_a = sum(len(full(l, add_special_tokens=False).input_ids) > 10 for l in labels)
    long_b = sum(len(small(l, add_special_tokens=False).input_ids) > 10 for l in labels)
    print(f"menu labels over 10 tokens: {long_a} -> {long_b} of {len(labels)}")
    for f in a.measure:
        report(f, full, small, [l.strip() for l in open(f, encoding="utf-8") if l.strip()])
    json.dump({"base": BASE_TOKENIZER, "kept": kept, "tokenizer": tj}, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
