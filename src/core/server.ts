// Worker-side loader: Workers can't compile WASM from bytes at runtime, so the
// module is imported precompiled (`?module`) and instantiated synchronously.
import * as raw from "./wasm/bf_core.js";
import wasmModule from "./wasm/bf_core_bg.wasm?module";
import { makeCore, type Core } from "./api";

let instance: Core | null = null;

export function core(): Core {
  if (!instance) {
    raw.initSync({ module: wasmModule });
    instance = makeCore(raw);
  }
  return instance;
}
