// The till inside the Beautifood Android app: the built-in printer transport over window.BeautifoodNative.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base64, connect, loadSettings, nativeInfo, reconnect, support } from "../../src/ui/printer";

type Win = { BeautifoodNative?: unknown; __beautifoodNative?: { done(id: string, ok: boolean, error: string | null): void } };
const w = () => (globalThis as unknown as { window: Win }).window;

function fakeDevice(printer: { available: boolean; paper?: 58 | 80 } | null, answer: (id: string, data: Uint8Array) => void) {
  const writes: Uint8Array[] = [];
  (globalThis as unknown as { window: Win }).window = {
    BeautifoodNative: {
      info: () => JSON.stringify({ app: "beautifood-android", version: "1.0.0", device: "SUNMI V2_PRO", printer: printer && { model: "V2 Pro", state: 1, status: "Ready", paper: 58, ...printer } }),
      write: (id: string, b64: string) => {
        const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        writes.push(data);
        queueMicrotask(() => answer(id, data));
      },
    },
  };
  return writes;
}

describe("built-in printer (Android app)", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => delete (globalThis as { window?: unknown }).window);

  it("isn't offered in a plain browser", () => {
    (globalThis as unknown as { window: Win }).window = {};
    expect(nativeInfo()).toBeNull();
    expect(support().builtin).toBe(false);
  });

  it("is offered, with the device's paper, when the app reports a printer", () => {
    fakeDevice({ available: true, paper: 58 }, () => {});
    expect(nativeInfo()?.device).toBe("SUNMI V2_PRO");
    expect(support().builtin).toBe(true);
    const s = loadSettings();
    expect(s).toMatchObject({ paper: 58, autoPrint: true, device: { kind: "builtin" } });
  });

  it("not on an Android device without one", () => {
    fakeDevice({ available: false }, () => {});
    expect(support().builtin).toBe(false);
  });

  it("sends the exact bytes and resolves once the app says the paper is out", async () => {
    const writes = fakeDevice({ available: true }, (id) => w().__beautifoodNative!.done(id, true, null));
    const link = await connect("builtin", 9600, () => {});
    expect(link).toMatchObject({ kind: "builtin", name: "V2 Pro", device: { kind: "builtin" } });
    const bytes = Uint8Array.from([0x1b, 0x40, 0x1d, 0x76, 0x30, 0, 255, 0x1b, 0x70, 0, 25, 250]);
    await link.write(bytes);
    expect(writes[0]).toEqual(bytes);
    // and it reconnects with no prompt next time (or on first run, by default)
    expect((await reconnect({ kind: "builtin" }, 9600, () => {}))?.kind).toBe("builtin");
    expect((await reconnect(null, 9600, () => {}))?.kind).toBe("builtin");
  });

  it("rejects with the printer's reason", async () => {
    fakeDevice({ available: true }, (id) => w().__beautifoodNative!.done(id, false, "Out of paper"));
    const link = await connect("builtin", 9600, () => {});
    await expect(link.write(Uint8Array.of(1, 2, 3))).rejects.toThrow("Out of paper");
  });

  it("gives up when the app never answers", async () => {
    vi.useFakeTimers();
    fakeDevice({ available: true }, () => {});
    const link = await connect("builtin", 9600, () => {});
    const p = link.write(Uint8Array.of(1));
    vi.advanceTimersByTime(30_001);
    await expect(p).rejects.toThrow("didn't answer");
  });

  it("encodes big receipts to base64 without blowing the call stack", () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(Uint8Array.from(atob(base64(big)), (c) => c.charCodeAt(0))).toEqual(big);
  });
});
