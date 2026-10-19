// A restaurant's own page: its design (published from the storefront editor), filled with what's on now.
import type { Props } from "./[slug].server";
import { StorefrontView, type StorefrontPayload } from "../../src/ui/storefront";

export default function StorefrontPage(p: Props) {
  return <StorefrontView design={p.design} data={p.data as unknown as StorefrontPayload} />;
}
