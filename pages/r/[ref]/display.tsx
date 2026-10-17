// TV "now calling" board for the restaurant entrance.
import { useEffect, useRef } from "react";
import { useParams } from "@void/react";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Mins } from "../../../src/ui/components";

interface Status {
  name: string;
  categories: { code: string; label: string; waiting: number; estimateMinutes: number; min: number; max: number }[];
  nowCalling: { number: string; tables: string[] }[];
}

export default function Display() {
  const { ref } = useParams<{ ref: string }>();
  const { data } = usePoll(() => api<Status>(`/api/public/branches/${ref}/status`), { interval: 3000, maxInterval: 3000 });
  const last = useRef<string>("");
  useEffect(() => {
    const now = data?.nowCalling.map((n) => n.number).join(",") ?? "";
    if (now && now !== last.current && "speechSynthesis" in window) {
      const fresh = data!.nowCalling.filter((n) => !last.current.split(",").includes(n.number));
      for (const n of fresh) speechSynthesis.speak(new SpeechSynthesisUtterance(`Number ${n.number.split("").join(" ")}${n.tables.length ? `, table ${n.tables.join(" and ")}` : ""}`));
    }
    last.current = now;
  }, [data]);
  return (
    <div className="display">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 40 }}>{data?.name}</h1>
        <span style={{ opacity: 0.7, fontSize: 22 }}>Scan the QR at the door to join the queue</span>
      </div>
      <h2 style={{ fontSize: 32, opacity: 0.8, marginTop: 30 }}>Now calling</h2>
      <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }} data-testid="now-calling">
        {data?.nowCalling.length ? (
          data.nowCalling.map((n) => (
            <div key={n.number}>
              <div className="calling">{n.number}</div>
              {n.tables.length ? <div style={{ fontSize: 28 }}>Table {n.tables.join(" + ")}</div> : null}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 36, opacity: 0.6 }}>—</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 60, flexWrap: "wrap" }}>
        {data?.categories.map((c) => (
          <div key={c.code} style={{ background: "#2a1d14", borderRadius: 18, padding: "20px 28px", minWidth: 220 }}>
            <div style={{ fontSize: 22, opacity: 0.8 }}>
              {c.label} ({c.min}–{c.max})
            </div>
            <div style={{ fontSize: 48, fontWeight: 800 }}>{c.waiting} waiting</div>
            <div style={{ fontSize: 22 }}>
              ~<Mins v={c.estimateMinutes} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
