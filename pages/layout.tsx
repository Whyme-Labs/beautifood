import { useEffect, type ReactNode } from "react";
import "../src/ui/styles.css";
import { ToastProvider } from "../src/ui/components";

export default function RootLayout({ children }: { children: ReactNode }) {
  // Marks the page interactive (used by end-to-end tests to avoid typing into server-rendered HTML).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
