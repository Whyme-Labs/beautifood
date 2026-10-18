// Staff sign-in / sign-up (Better Auth via Void).
import { useState } from "react";
import { auth } from "void/client";
import { LogIn, UserPlus } from "lucide-react";
import { useQuery } from "../../src/ui/hooks";
import { LangSwitch, Logo, Stub, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

export default function Login() {
  const { t } = useI18n();
  const q = useQuery();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(q.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  const submit = () =>
    run(async () => {
      const r = mode === "up" ? await auth.signUp.email({ email, password, name }) : await auth.signIn.email({ email, password });
      if ((r as { error?: { message?: string } }).error) throw new Error((r as { error: { message?: string } }).error.message ?? t("staff.shell.login.failed"));
      location.href = q.get("next") || "/m";
    });
  return (
    <main className="narrow auth-page">
      <div className="row between nowrap" style={{ marginBottom: 22 }}>
        <Logo href="/" />
        <LangSwitch />
      </div>
      <Stub stock="A" tear={100} className="auth-stub">
        <p style={{ margin: 0, fontWeight: 750, fontSize: 18 }}>{t("staff.shell.login.pitch")}</p>
      </Stub>
      <form
        className="card col"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1>{mode === "in" ? t("staff.shell.login.signIn") : t("staff.shell.login.signUp")}</h1>
        {mode === "up" && (
          <label>
            {t("staff.shell.login.yourName")}
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>
          {t("common.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          {t("staff.shell.login.password")}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        <button className="btn primary big" disabled={pending}>
          {mode === "in" ? <LogIn size={19} /> : <UserPlus size={19} />}
          {mode === "in" ? t("staff.shell.login.signIn") : t("staff.shell.login.createAccount")}
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? t("staff.shell.login.toSignUp") : t("staff.shell.login.toSignIn")}
        </button>
      </form>
    </main>
  );
}
