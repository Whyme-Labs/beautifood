// Public menu display (server-rendered, with schema.org JSON-LD for search engines and AI agents).
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Props } from "./menu.server";
import { Modal } from "../../../src/ui/components";
import { MenuList } from "../../../src/ui/menuList";
import { AssistantChat } from "../../../src/ui/chat";
import { GuestBar } from "../../../src/ui/guest";
import { useI18n } from "../../../src/i18n/react";

export default function MenuPage(p: Props) {
  const { t } = useI18n();
  const [chat, setChat] = useState(false);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: `${p.restaurant} ${p.branch}`,
    servesCuisine: p.cuisine || undefined,
    address: p.address || undefined,
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: p.menu.categories.map((c) => ({
        "@type": "MenuSection",
        name: c.name,
        hasMenuItem: p.menu.items
          .filter((i) => i.categoryId === c.id)
          .map((i) => ({ "@type": "MenuItem", name: i.name, description: i.description || undefined, offers: { "@type": "Offer", price: (i.price / 100).toFixed(2), priceCurrency: p.currency }, suitableForDiet: i.dietary.includes("vegan") ? "https://schema.org/VeganDiet" : i.dietary.includes("vegetarian") ? "https://schema.org/VegetarianDiet" : undefined })),
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <GuestBar
        right={
          p.aiAssistant ? (
            <button className="btn small" onClick={() => setChat(true)}>
              <Sparkles size={15} /> {t("assistant.openShort")}
            </button>
          ) : null
        }
      >
        {p.restaurant}
      </GuestBar>
      <main className="narrow">
        <a href={`/r/${p.ref}`} className="row" style={{ gap: 4, fontWeight: 650, fontSize: 14, textDecoration: "none", marginBottom: 6 }}>
          <ArrowLeft size={16} /> {p.restaurant} {p.branch}
        </a>
        <h1>{t("menu.title")}</h1>
        {p.menuDisplay ? <MenuList menu={p.menu as never} currency={p.currency} /> : <p className="muted">{t("menu.notPublished")}</p>}
      </main>
      <Modal open={chat} onClose={() => setChat(false)} title={t("assistant.title")}>
        <AssistantChat branch={p.ref} currency={p.currency} />
      </Modal>
    </>
  );
}
