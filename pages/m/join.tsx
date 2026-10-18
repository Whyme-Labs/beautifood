// Accept a staff invitation (sign up or sign in first, then link to the restaurant).
import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { api } from "../../src/ui/api";
import { useQuery } from "../../src/ui/hooks";
import { LangSwitch, Logo, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

export default function Join() {
  const { t } = useI18n();
  const code = useQuery().get("code") ?? "";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { run, pending } = useAction();
  useEffect(() => {
    api("/api/m/me")
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);
  const [before, after] = t("staff.shell.join.first").split("{link}");
  return (
    <main className="narrow auth-page">
      <div className="row between nowrap" style={{ marginBottom: 22 }}>
        <Logo href="/" />
        <LangSwitch />
      </div>
      <div className="card col">
        <h1>{t("staff.shell.join.title")}</h1>
        {signedIn === null && <p className="muted">{t("staff.shell.join.checking")}</p>}
        {signedIn === false && (
          <p>
            {before}
            <a href={`/m/login?next=${encodeURIComponent(`/m/join?code=${code}`)}`}>{t("staff.shell.join.firstLink")}</a>
            {after}
          </p>
        )}
        {signedIn && (
          <button className="btn primary big" disabled={pending} onClick={() => run(async () => (await api("/api/m/invites", { body: { code } }), (location.href = "/m")))}>
            <UserCheck size={19} /> {t("staff.shell.join.accept")}
          </button>
        )}
      </div>
    </main>
  );
}
