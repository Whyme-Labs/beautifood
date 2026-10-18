import { useEffect, type ReactNode } from "react";
import "@fontsource-variable/figtree";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "../src/ui/styles.css";
import { ToastProvider } from "../src/ui/components";
import { I18nProvider } from "../src/i18n/react";

export default function RootLayout({ children }: { children: ReactNode }) {
  // Marks the page interactive (used by end-to-end tests to avoid typing into server-rendered HTML).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
