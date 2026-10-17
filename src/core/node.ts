// Node loader for unit tests and scripts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as raw from "./wasm/bf_core.js";
import { makeCore, type Core } from "./api";

let instance: Core | null = null;

export function core(): Core {
  if (!instance) {
    raw.initSync({ module: readFileSync(fileURLToPath(new URL("./wasm/bf_core_bg.wasm", import.meta.url))) });
    instance = makeCore(raw);
  }
  return instance;
}
