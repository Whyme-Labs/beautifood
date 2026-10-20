// The device's barcode scanner, inside the Beautifood Android app: each read arrives as a
// `beautifood:scan` event. With a text field focused (the till's search, a promo code, a member's
// email), the code goes into it as if typed.
import { useEffect } from "react";

export type ScanEvent = CustomEvent<{ code: string }>;

/** Type `code` into a focused text field the way React notices (its value setter, then an input event). */
export function typeInto(el: Element | null, code: string): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement && !["text", "search", "email", "tel", "url", ""].includes(el.type)) return false;
  if (el.readOnly || el.disabled) return false;
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, code);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Once per page: scans fill the focused field. */
export function useScanIntoFields() {
  useEffect(() => {
    const on = (e: Event) => typeInto(document.activeElement, (e as ScanEvent).detail.code);
    window.addEventListener("beautifood:scan", on);
    return () => window.removeEventListener("beautifood:scan", on);
  }, []);
}
