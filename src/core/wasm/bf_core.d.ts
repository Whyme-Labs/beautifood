/* tslint:disable */
/* eslint-disable */
export function compute_totals(input: string): string;
export function split_equally(input: string): string;
export function suggest(input: string): string;
export function estimate_waits(input: string): string;
export function candidates_for(input: string): string;
export function predict_turn(input: string): string;
export function observe_turn(input: string): string;
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly candidates_for: (a: number, b: number, c: number) => void;
  readonly compute_totals: (a: number, b: number, c: number) => void;
  readonly estimate_waits: (a: number, b: number, c: number) => void;
  readonly observe_turn: (a: number, b: number, c: number) => void;
  readonly predict_turn: (a: number, b: number, c: number) => void;
  readonly split_equally: (a: number, b: number, c: number) => void;
  readonly suggest: (a: number, b: number, c: number) => void;
  readonly version: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export_0: (a: number, b: number) => number;
  readonly __wbindgen_export_1: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
