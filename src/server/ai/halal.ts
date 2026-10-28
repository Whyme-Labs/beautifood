// What a branch's halal standing (BranchConfig.halal) says about its dishes. A certified kitchen
// or one that declares itself Muslim-friendly makes every dish halal, or halal-friendly, unless the
// dish itself says otherwise (a "beef bacon" is fine, a "pork belly" or "wine-braised" is not): a
// dish that names pork, lard or alcohol is never claimed halal, whatever the branch says.
import type { HalalInfo, HalalStatus, MenuItem } from "../../shared/types";
import { unsaid } from "../../shared/brain/text";

export type Halal = HalalInfo & { standing: HalalStatus | "expired" };

const PORK =
  /\b(pork|lard|bacon|ham|babi|char siu|lap cheong|chinese sausage|pork floss|siu yuk|bak kut teh)\b|猪|叉烧|腊肠|烧肉|肉骨茶/i;
const BEEF_OR_CHICKEN_HAM = /\b(beef|chicken|turkey|duck)\s+(bacon|ham)\b/gi;
const ALCOHOL =
  /\b(wine|shaoxing|hua tiao|beer|lager|stout|sake|soju|mirin|rum|brandy|whisky|whiskey|liqueur|baileys|cocktail|gin|vodka|tequila|champagne|prosecco)\b|酒/i;

const text = (
  i: Pick<MenuItem, "name" | "description"> & {
    translations?: MenuItem["translations"];
  },
) =>
  `${i.name} ${i.description ?? ""} ${Object.values(i.translations ?? {})
    .map((x) => x?.name ?? "")
    .join(" ")}`;

/** The pork or alcohol a dish names ("pork", "wine", "猪"), or null. */
export function notHalalWord(
  i: Pick<MenuItem, "name" | "description"> & {
    translations?: MenuItem["translations"];
  },
): string | null {
  // ("no pork, no alcohol" in a description says what it hasn't)
  const s = unsaid(text(i)).replace(BEEF_OR_CHICKEN_HAM, "");
  return s.match(PORK)?.[0] ?? s.match(ALCOHOL)?.[0] ?? null;
}

/** The alcohol a dish names, or null (pork-free kitchens may still cook with wine). */
export const alcoholWord = (
  i: Pick<MenuItem, "name" | "description"> & {
    translations?: MenuItem["translations"];
  },
) => text(i).match(ALCOHOL)?.[0] ?? null;

/**
 * The menu as the branch's halal standing has it: at a certified branch every dish that names no
 * pork or alcohol is "halal", at a Muslim-friendly one "halal_friendly". Anywhere else (pork-free,
 * an expired certificate, nothing declared) dishes keep their own tags.
 */
export function withBranchHalal<T extends MenuItem>(
  items: T[],
  halal: Halal | undefined,
): T[] {
  const tag =
    halal?.standing === "certified"
      ? "halal"
      : halal?.standing === "muslim_friendly"
        ? "halal_friendly"
        : null;
  if (!tag) return items;
  return items.map((i) =>
    i.dietary.includes(tag) || notHalalWord(i)
      ? i
      : { ...i, dietary: [...i.dietary, tag] },
  );
}
