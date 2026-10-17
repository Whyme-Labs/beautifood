// Accept a staff invitation (sign up or sign in first, then link to the restaurant).
import { useEffect, useState } from "react";
import { api } from "../../src/ui/api";
import { useQuery } from "../../src/ui/hooks";
import { Logo, useAction } from "../../src/ui/components";

export default function Join() {
  const code = useQuery().get("code") ?? "";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { run, pending } = useAction();
  useEffect(() => {
    api("/api/m/me")
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);
  return (
    <main className="narrow" style={{ paddingTop: 40 }}>
      <Logo />
      <div className="card col" style={{ marginTop: 20 }}>
        <h1>Join your team</h1>
        {signedIn === false && (
          <p>
            First <a href={`/m/login?next=${encodeURIComponent(`/m/join?code=${code}`)}`}>sign in or create an account</a> with the email your manager invited.
          </p>
        )}
        {signedIn && (
          <button className="btn primary" disabled={pending} onClick={() => run(async () => (await api("/api/m/invites", { body: { code } }), (location.href = "/m")))}>
            Accept invitation
          </button>
        )}
      </div>
    </main>
  );
}
