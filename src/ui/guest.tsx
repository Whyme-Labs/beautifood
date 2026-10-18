import type { ReactNode } from "react";
import { LangSwitch, Logo } from "./components";

/** The guest pages' yellow bar: logo, optional context, page actions and the language switch. */
export function GuestBar({ children, right, className = "" }: { children?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={`topbar ${className}`}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Logo href="/eat" />
        {children ? <div className="grow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 650 }}>{children}</div> : <span className="grow" />}
        {right}
        <LangSwitch />
      </div>
    </header>
  );
}
