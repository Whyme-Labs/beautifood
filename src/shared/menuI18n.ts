// Show a menu in the guest's language. Translations travel with the menu, so
// switching language is instant and server and browser render the same thing.
// Orders and carts always use the original names; only labels are localised.
import type { MenuCategory, MenuItem } from "./types";

export interface LocalItem {
  name: string;
  description: string;
  story: string;
  /** The original name, when it differs (shown small, so staff and guests can match it). */
  original: string | null;
  group: (group: string) => string;
  option: (group: string, option: string) => string;
}

export function localizeItem(item: Pick<MenuItem, "name" | "description" | "story" | "translations">, locale: string, menuLanguage = "en"): LocalItem {
  const tr = locale === menuLanguage ? undefined : item.translations?.[locale];
  const name = tr?.name?.trim() || item.name;
  return {
    name,
    description: tr?.description?.trim() || item.description,
    story: tr?.story?.trim() || item.story,
    original: name !== item.name ? item.name : null,
    group: (g) => tr?.modifiers?.[g]?.name?.trim() || g,
    option: (g, o) => tr?.modifiers?.[g]?.options?.[o]?.trim() || o,
  };
}

export function localizeCategory(cat: Pick<MenuCategory, "name" | "translations">, locale: string, menuLanguage = "en"): string {
  if (locale === menuLanguage) return cat.name;
  return cat.translations?.[locale]?.name?.trim() || cat.name;
}

/** Name of a dish in an order/cart line, looked up from the menu by id. */
export function localName(menu: { items: Pick<MenuItem, "id" | "name" | "description" | "story" | "translations">[]; language?: string } | null | undefined, itemId: string, fallback: string, locale: string): string {
  const it = menu?.items.find((i) => i.id === itemId);
  return it ? localizeItem(it, locale, menu?.language ?? "en").name : fallback;
}
