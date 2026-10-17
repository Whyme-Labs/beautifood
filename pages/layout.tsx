import type { ReactNode } from "react";
import "../src/ui/styles.css";
import { ToastProvider } from "../src/ui/components";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
