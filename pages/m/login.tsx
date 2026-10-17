// Staff sign-in / sign-up (Better Auth via Void).
import { useState } from "react";
import { auth } from "void/client";
import { useQuery } from "../../src/ui/hooks";
import { Logo, useAction } from "../../src/ui/components";

export default function Login() {
  const q = useQuery();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(q.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  const submit = () =>
    run(async () => {
      const r = mode === "up" ? await auth.signUp.email({ email, password, name }) : await auth.signIn.email({ email, password });
      if ((r as { error?: { message?: string } }).error) throw new Error((r as { error: { message?: string } }).error.message ?? "Could not sign in");
      location.href = q.get("next") || "/m";
    });
  return (
    <main className="narrow" style={{ paddingTop: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Logo />
        <p className="muted">For restaurant teams</p>
      </div>
      <form
        className="card col"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1>{mode === "in" ? "Sign in" : "Create your account"}</h1>
        {mode === "up" && (
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        <button className="btn primary" disabled={pending}>
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
