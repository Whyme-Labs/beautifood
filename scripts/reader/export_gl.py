# Exports the browser reader (train_gl.py) for onnxruntime-web, and times it.
# Two graphs:
#   reader.onnx: token ids, the label markers and the candidate spans in → span × label logits, span
#     states and the [CLS] state out (one encoder pass);
#   heads.onnx: dish-span and part-span states in → attach, change and acts logits (tiny).
# Spans are listed outside the graph (every span of up to MAX_W tokens starting and ending on a token
# with text), as decode() does, so the graph has no data-dependent shapes. Checks the exported graphs
# give the PyTorch numbers, quantises the encoder to 8-bit, and times a typical turn on 4 CPU threads.
#
#   python export_gl.py <model dir> [--quantize]
import argparse, json, os, statistics, time

import numpy as np
import torch
import torch.nn as nn

import train_gl as T


class ReaderGraph(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, ids, mask, markers, span_a, span_b, span_w):
        hs = self.m.encoder(input_ids=ids, attention_mask=mask).last_hidden_state[0]
        S = self.m.span(torch.cat([hs[span_a], hs[span_b], self.m.width(span_w)], -1))
        L = self.m.label(hs[markers])
        return S @ L.T, S, hs[0]


class HeadsGraph(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, dish, part, cls):
        # every dish span against every part span: attach logits [dishes, parts, 3]; change [dishes, changes]; acts [acts]
        n, k = dish.shape[0], part.shape[0]
        d = dish.unsqueeze(1).expand(n, k, -1)
        p = part.unsqueeze(0).expand(n, k, -1)
        attach = self.m.attach(torch.cat([d, p, d * p], -1))
        change = self.m.change(torch.cat([dish, cls.unsqueeze(0).expand(n, -1)], -1))
        return attach, change, self.m.acts(cls)


def spans_of(valid, start):
    ok = set(valid)
    idx = [(i, j) for i in valid for j in range(i, min(max(valid) + 1, i + T.MAX_W)) if j in ok]
    return idx, np.array([start + i for i, _ in idx]), np.array([start + j for _, j in idx]), np.array([j - i for i, j in idx])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--quantize", action="store_true")
    a = ap.parse_args()
    from transformers import AutoTokenizer
    import onnxruntime as ort

    tok = AutoTokenizer.from_pretrained(a.model)
    m = T.Reader(T.load_encoder())
    m.load_state_dict(torch.load(f"{a.model}/reader.pt", map_location="cpu"))
    m.eval()
    menu = [{"name": f"Dish {k}", "zh": "炒面", "groups": [{"name": "Size", "options": ["Small", "Large"]}, {"name": "Add-ons", "options": [f"Extra {w}" for w in ("egg", "prawns", "tofu", "noodles")]}]} for k in range(30)]
    text = "boss 2 dish 3 large tambah telur, and one dish 7 iced kurang manis. total brapa"
    dishes, opts = T.menu_labels(menu, text)
    ids, markers, labels, start, offs = T.encode(tok, text, dishes, opts)
    idx, sa, sb, sw = spans_of(T.text_tokens(text, offs), start)
    inputs = (torch.tensor([ids]), torch.ones(1, len(ids), dtype=torch.long), torch.tensor(markers), torch.tensor(sa), torch.tensor(sb), torch.tensor(sw))
    out = f"{a.model}/onnx"
    os.makedirs(out, exist_ok=True)
    with torch.no_grad():
        torch.onnx.export(ReaderGraph(m).eval(), inputs, f"{out}/reader.onnx", input_names=["ids", "mask", "markers", "span_a", "span_b", "span_w"], output_names=["logits", "spans", "cls"],
                          dynamic_axes={"ids": {1: "n"}, "mask": {1: "n"}, "markers": {0: "labels"}, "span_a": {0: "s"}, "span_b": {0: "s"}, "span_w": {0: "s"}, "logits": {0: "s", 1: "labels"}, "spans": {0: "s"}}, opset_version=18, dynamo=True)
        logits, S, cls = ReaderGraph(m)(*inputs)
        hd = (S[:3], S[3:9], cls)
        torch.onnx.export(HeadsGraph(m).eval(), hd, f"{out}/heads.onnx", input_names=["dish", "part", "cls"], output_names=["attach", "change", "acts"],
                          dynamic_axes={"dish": {0: "n"}, "part": {0: "k"}, "attach": {0: "n", 1: "k"}, "change": {0: "n"}}, opset_version=18, dynamo=True)
        ref_heads = HeadsGraph(m)(*hd)
    feed = {"ids": inputs[0].numpy(), "mask": inputs[1].numpy(), "markers": inputs[2].numpy(), "span_a": sa, "span_b": sb, "span_w": sw}
    opts_ = ort.SessionOptions()
    opts_.intra_op_num_threads = 4
    sess = ort.InferenceSession(f"{out}/reader.onnx", opts_)
    got = sess.run(None, feed)
    print("reader.onnx max |diff| vs PyTorch:", float(np.abs(got[0] - logits.numpy()).max()))
    # (and on a message of another length: DeBERTa's relative positions must not be fixed at the traced length)
    text2 = "dua dish 5 small, satu dish 9"
    ids2, markers2, _, start2, offs2 = T.encode(tok, text2, *T.menu_labels(menu, text2))
    _, sa2, sb2, sw2 = spans_of(T.text_tokens(text2, offs2), start2)
    with torch.no_grad():
        ref2 = ReaderGraph(m)(torch.tensor([ids2]), torch.ones(1, len(ids2), dtype=torch.long), torch.tensor(markers2), torch.tensor(sa2), torch.tensor(sb2), torch.tensor(sw2))[0].numpy()
    got2 = sess.run(None, {"ids": np.array([ids2]), "mask": np.ones((1, len(ids2)), dtype=np.int64), "markers": np.array(markers2), "span_a": sa2, "span_b": sb2, "span_w": sw2})[0]
    print("reader.onnx max |diff| at another length:", float(np.abs(got2 - ref2).max()))
    hs_ = ort.InferenceSession(f"{out}/heads.onnx", opts_).run(None, {"dish": hd[0].numpy(), "part": hd[1].numpy(), "cls": hd[2].numpy()})
    print("heads.onnx max |diff|:", max(float(np.abs(x - y.numpy()).max()) for x, y in zip(hs_, ref_heads)))
    path = f"{out}/reader.onnx"
    if a.quantize:
        import onnx
        from onnxruntime.quantization import QuantType, quantize_dynamic
        # (the exporter's own shape notes trip the quantiser's shape inference: drop them, it infers its own)
        g = onnx.load(path)
        del g.graph.value_info[:]
        onnx.save(g, f"{out}/reader.noshapes.onnx", save_as_external_data=True, location="reader.noshapes.data")
        quantize_dynamic(f"{out}/reader.noshapes.onnx", f"{out}/reader.int8.onnx", weight_type=QuantType.QInt8)
        path = f"{out}/reader.int8.onnx"
        q = ort.InferenceSession(path, opts_).run(None, feed)
        print("int8 max |diff| in logits:", float(np.abs(q[0] - logits.numpy()).max()), "| same spans above 0:", bool(((q[0] > 0) == (logits.numpy() > 0)).all()))
    sess = ort.InferenceSession(path, opts_)
    times = []
    for _ in range(20):
        t = time.time(); sess.run(None, feed); times.append(1000 * (time.time() - t))
    print(f"{os.path.basename(path)}: {os.path.getsize(path) / 1e6:.0f} MB; {len(ids)} tokens, {len(idx)} spans, {len(markers)} labels; median {statistics.median(times[5:]):.0f} ms on 4 threads")
    json.dump({"labels_max": T.MAX_LEN, "max_w": T.MAX_W, "changes": T.CHANGES, "acts": T.ACTS, "generic": T.GENERIC}, open(f"{out}/reader.json", "w"))


if __name__ == "__main__":
    main()
