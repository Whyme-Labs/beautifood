// The product page. The live restaurant directory moved to /eat.
// Media lives in public/media and may be missing on a fresh checkout: every reel paints a
// fallback underneath, so a 404 video or poster leaves a designed frame, never a hole.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Bot, ConciergeBell, Play, Smartphone, Store } from "lucide-react";
import { LangSwitch, Logo, Punches } from "../src/ui/components";
import { useI18n } from "../src/i18n/react";
import type { MessageKey } from "../src/i18n/core";

const REPO = "https://github.com/Whyme-Labs/beautifood";
const EVIDENCE = `${REPO}/tree/main/docs/evidence`;
const LICENSE = `${REPO}/blob/main/LICENSE`;

/** Dishes from the demo menu (src/server/dev/sample.ts) with their glossary names. */
const SPECIMEN = [
  { en: "Char Kway Teow", zh: "炒粿条", price: 1690 },
  { en: "Penang Assam Laksa", zh: "槟城亚参叻沙", price: 1550 },
  { en: "Cendol", zh: "煎蕊", price: 850 },
  { en: "Teh Tarik", zh: "拉茶", price: 550 },
];

const STACK = ["Cloudflare Workers", "D1", "Queues", "Workers AI", "Email Sending", "Rust / WASM", "React", "Claude", "Playwright"];

/** The wordmark's ticket, drawn without a link, for frames behind the reels. */
const Mark = () => (
  <span className="landing-mark">
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z" fill="#ffd12e" />
      <path d="M11 9.5v13M11 9.5h5.5a3.25 3.25 0 0 1 0 6.5H11m0 0h6a3.25 3.25 0 0 1 0 6.5h-6" fill="none" stroke="#1a1814" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    beautifood
  </span>
);

type FeatureId = "queue" | "table" | "assistant" | "host" | "kitchen-pos" | "owner" | "languages" | "agents";
const featureKey = (id: FeatureId) => (id === "kitchen-pos" ? "kitchenPos" : id);

/** A video in a dark frame. "loop" plays muted on its own; "click" waits for the viewer. */
function Reel({ src, poster, label, mode, fallback }: { src: string; poster: string; label: string; mode: "loop" | "click"; fallback?: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // A load error can land before hydration attaches onError.
    if (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) setFailed(true);
    if (mode === "loop" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      v.controls = true;
    }
  }, [mode]);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    v.play().catch(() => {
      if (v.error) setFailed(true);
    });
  };

  return (
    <figure className="landing-reel" data-mode={mode} data-failed={failed || undefined}>
      <div className="landing-reel-fallback" aria-hidden="true">
        {fallback ?? <Mark />}
      </div>
      {!failed && (
        <video
          ref={ref}
          src={src}
          poster={poster}
          aria-label={label}
          muted
          playsInline
          {...(mode === "loop" ? { autoPlay: true, loop: true, preload: "auto" } : { controls: true, preload: "none" })}
          onError={() => setFailed(true)}
          onPlay={() => setStarted(true)}
        />
      )}
      {mode === "click" && !started && !failed && (
        <button type="button" className="landing-play" onClick={play} aria-label={t("landing.features.play", { title: label })}>
          <Play size={26} fill="currentColor" strokeWidth={0} />
        </button>
      )}
      {failed && mode === "click" && <figcaption className="landing-reel-missing">{t("landing.features.missing")}</figcaption>}
    </figure>
  );
}

function Feature({ id, wide }: { id: FeatureId; wide?: boolean }) {
  const { t } = useI18n();
  const k = featureKey(id);
  const title = t(`landing.features.${k}.title` as MessageKey);
  return (
    <article className={`landing-feature ${wide ? "wide" : ""}`} id={`feature-${id}`}>
      <Reel
        src={`/media/features/${id}.mp4`}
        poster={`/media/features/${id}.jpg`}
        label={title}
        mode="click"
        fallback={
          <>
            <Mark />
            <span className="landing-reel-title">{title}</span>
          </>
        }
      />
      <div className="landing-feature-text">
        <h4>{title}</h4>
        <p>{t(`landing.features.${k}.body` as MessageKey)}</p>
      </div>
    </article>
  );
}

type PersonaId = "guests" | "foh" | "owners" | "agents";
function Persona({ id, icon, ticks, children }: { id: PersonaId; icon: ReactNode; ticks: number; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="landing-persona" aria-labelledby={`persona-${id}`}>
      <div className="landing-persona-head">
        <div className="landing-tab">
          <span className="landing-tab-mark">{icon}</span>
          <div>
            <h3 id={`persona-${id}`}>{t(`landing.personas.${id}.name` as MessageKey)}</h3>
            <p>{t(`landing.personas.${id}.line` as MessageKey)}</p>
          </div>
        </div>
        <ul className="landing-ticks">
          {Array.from({ length: ticks }, (_, i) => (
            <li key={i}>{t(`landing.personas.${id}.f${i + 1}` as MessageKey)}</li>
          ))}
        </ul>
      </div>
      <div className="landing-persona-body">{children}</div>
    </section>
  );
}

export default function Landing() {
  const { t, f, mins, locale } = useI18n();
  const zh = locale === "zh";

  return (
    <div className="landing" lang={zh ? "zh-Hans" : "en"}>
      <title>{t("landing.metaTitle")}</title>
      <meta name="description" content={t("landing.metaDescription")} />

      <header className="topbar landing-top">
        <div className="wrap">
          <Logo href="/" />
          <nav className="landing-nav" aria-label={t("landing.nav.label")}>
            <a href="#features">{t("landing.nav.features")}</a>
            <a href="/m/login">{t("landing.nav.restaurants")}</a>
            <a href={REPO} rel="noopener">
              {t("landing.nav.github")}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </nav>
          <span className="grow" />
          <a className="btn small primary landing-try" href="/eat">
            {t("landing.nav.tryIt")}
          </a>
          <LangSwitch />
        </div>
      </header>

      <main>
        {/* Hero: the offer, two actions, and the board with a ticket held up in front of it. */}
        <section className="landing-hero">
          <div className="landing-wrap landing-hero-grid">
            <div className="landing-hero-copy">
              <h1>{t("landing.hero.title")}</h1>
              <p className="landing-lead">{t("landing.hero.lead")}</p>
              <p className="landing-noapp">{t("landing.hero.noApp")}</p>
              <div className="landing-ctas">
                <a className="btn big primary" href="/eat" data-testid="landing-try">
                  {t("landing.hero.tryDemo")}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className="btn big" href="/m/login">
                  {t("landing.hero.setUp")}
                </a>
              </div>
              <p className="landing-note">{t("landing.hero.demoNote")}</p>
            </div>

            <div className="landing-hero-visual">
              <div className="landing-board">
                <Reel src="/media/promo-30.mp4" poster="/media/promo-30.jpg" label={t("landing.hero.videoLabel")} mode="loop" />
                <div className="landing-calling" aria-hidden="true">
                  <span>{t("landing.hero.nowCalling")}</span>
                  <b className="serial">A042</b>
                  <b className="serial">B017</b>
                  <b className="serial">C008</b>
                </div>
              </div>
              <div className="stub landing-hero-stub" data-stock="A" aria-hidden="true">
                <div className="landing-hero-stub-top">
                  <div>
                    <div className="stub-label">{t("landing.hero.yourNumber")}</div>
                    <div className="serial">A043</div>
                  </div>
                  <Punches ahead={4} label={t("landing.hero.ahead", { count: 4 })} />
                </div>
                <div className="landing-hero-stub-foot">
                  <span>
                    <span className="stub-label">{t("landing.hero.wait")}</span> <b className="serial">{mins(12)}</b>
                  </span>
                  <span>
                    <span className="stub-label">{t("landing.hero.party")}</span> <b className="serial">{t("landing.hero.partyOf", { count: 2 })}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The problem: three void tickets, then the yellow one. */}
        <section className="landing-section landing-problem" aria-labelledby="landing-problem">
          <div className="landing-wrap">
            <h2 id="landing-problem">{t("landing.problem.title")}</h2>
            <p className="landing-sub">{t("landing.problem.lead")}</p>
            <div className="landing-voids">
              {(["chit", "wait", "app"] as const).map((k) => (
                <div key={k} className="stub landing-void" data-stock="X">
                  <div className="landing-void-top">
                    <span className="stub-label">{t(`landing.problem.${k}Label`)}</span>
                    <b className="serial">{t(`landing.problem.${k}Serial`)}</b>
                  </div>
                  <p>{t(`landing.problem.${k}Body`)}</p>
                </div>
              ))}
            </div>
            <div className="rowstub landing-answer" data-stock="A">
              <span className="rs-num">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M11 9.5v13M11 9.5h5.5a3.25 3.25 0 0 1 0 6.5H11m0 0h6a3.25 3.25 0 0 1 0 6.5h-6" fill="none" stroke="#1a1814" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="rs-body">{t("landing.problem.answer")}</p>
            </div>
          </div>
        </section>

        {/* Who it's for: one band per persona, with short demo reels. */}
        <section className="landing-section landing-personas" id="features" aria-labelledby="landing-personas">
          <div className="landing-wrap">
            <h2 id="landing-personas">{t("landing.personas.title")}</h2>
            <p className="landing-sub">{t("landing.personas.lead")}</p>

            <Persona id="guests" icon={<Smartphone size={26} strokeWidth={1.75} />} ticks={5}>
              <Feature id="queue" wide />
              <Feature id="table" />
              <Feature id="assistant" />
            </Persona>
            <Persona id="foh" icon={<ConciergeBell size={26} strokeWidth={1.75} />} ticks={5}>
              <Feature id="host" wide />
              <Feature id="kitchen-pos" wide />
            </Persona>
            <Persona id="owners" icon={<Store size={26} strokeWidth={1.75} />} ticks={4}>
              <Feature id="owner" wide />
            </Persona>
            <Persona id="agents" icon={<Bot size={26} strokeWidth={1.75} />} ticks={3}>
              <Feature id="agents" wide />
            </Persona>
          </div>
        </section>

        {/* Languages: the specimen flips with the switch, like the real menu does. */}
        <section className="landing-section landing-langs" id="languages" aria-labelledby="landing-langs">
          <div className="landing-wrap landing-langs-grid">
            <div className="landing-langs-copy">
              <h2 id="landing-langs">{t("landing.languages.title")}</h2>
              <p>{t("landing.languages.body")}</p>
              <p>{t("landing.languages.menus")}</p>
              <h3 className="landing-ladder-title">
                {t("landing.languages.ladderTitle")} <span>{t("landing.languages.ladderHint")}</span>
              </h3>
              <ol className="landing-ladder">
                {(["owner", "claude", "workersAi", "glossary"] as const).map((k, i) => (
                  <li key={k} className="rowstub" data-stock={i === 0 ? "A" : "X"}>
                    <span className="rs-num">
                      <b className="serial">{i + 1}</b>
                    </span>
                    <span className="rs-body">
                      <b>{t(`landing.languages.${k}`)}</b>
                      <span className="muted">{t(`landing.languages.${k}Note`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="landing-langs-side">
              <div className="card landing-specimen" lang={zh ? "zh-Hans" : "en"}>
                <div className="landing-specimen-cap">{t("landing.languages.specimen")}</div>
                <ul>
                  {SPECIMEN.map((d) => (
                    <li key={d.en}>
                      <span className="landing-dish">
                        <b>{zh ? d.zh : d.en}</b>
                        <span lang={zh ? "en" : "zh-Hans"}>{zh ? d.en : d.zh}</span>
                      </span>
                      <span className="serial">{f.money(d.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Feature id="languages" wide />
            </div>
          </div>
        </section>

        {/* Proof: what the tests show, on the calling board. */}
        <section className="landing-section landing-proof" aria-labelledby="landing-proof">
          <div className="landing-wrap">
            <h2 id="landing-proof">{t("landing.proof.title")}</h2>
            <p className="landing-sub">{t("landing.proof.lead")}</p>
            <ul className="landing-proof-list">
              <li className="rowstub" data-stock="A">
                <span className="rs-num">
                  <b className="serial">56</b>
                </span>
                <span className="rs-body">
                  <b>{t("landing.proof.testsLabel")}</b>
                  <span>{t("landing.proof.testsBody")}</span>
                </span>
              </li>
              <li className="rowstub" data-stock="A">
                <span className="rs-num">
                  <b className="serial">300</b>
                </span>
                <span className="rs-body">
                  <b>{t("landing.proof.surgeLabel")}</b>
                  <span>{t("landing.proof.surgeBody")}</span>
                </span>
              </li>
              <li className="rowstub" data-stock="A">
                <span className="rs-num">
                  <b className="serial">11</b>
                </span>
                <span className="rs-body">
                  <b>{t("landing.proof.walksLabel")}</b>
                  <span>{t("landing.proof.walksBody")}</span>
                  <a href={EVIDENCE} rel="noopener">
                    {t("landing.proof.walksLink")} <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </span>
              </li>
            </ul>
            <div className="landing-demo">
              <div className="landing-demo-text">
                <h3>{t("landing.proof.demoTitle")}</h3>
                <p>{t("landing.proof.demoBody")}</p>
              </div>
              <Reel src="/media/demo.mp4" poster="/media/demo.jpg" label={t("landing.proof.demoLabel")} mode="click" />
            </div>
          </div>
        </section>

        <section className="landing-section landing-built" aria-labelledby="landing-built">
          <div className="landing-wrap">
            <h2 id="landing-built">{t("landing.built.title")}</h2>
            <ul className="landing-stack">
              {STACK.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="muted">{t("landing.built.note")}</p>
          </div>
        </section>

        <section className="landing-close" aria-labelledby="landing-close">
          <div className="landing-wrap">
            <h2 id="landing-close">{t("landing.close.title")}</h2>
            <p>{t("landing.close.body")}</p>
            <div className="landing-ctas">
              <a className="btn big primary" href="/eat">
                {t("landing.hero.tryDemo")}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className="btn big" href="/m/login">
                {t("landing.hero.setUp")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <div className="landing-wrap">
          <div className="landing-foot-brand">
            <Logo href="/" />
            <p className="muted">{t("landing.footer.tagline")}</p>
          </div>
          <ul className="landing-foot-links">
            <li>
              <a href="/eat">{t("landing.footer.directory")}</a>
            </li>
            <li>
              <a href="/m/login">{t("landing.footer.staff")}</a>
            </li>
            <li>
              <a href="/mcp">{t("landing.footer.mcp")}</a>
            </li>
            <li>
              <a href="/llms.txt">{t("landing.footer.llms")}</a>
            </li>
            <li>
              <a href={REPO} rel="noopener">
                {t("landing.footer.github")}
              </a>
            </li>
            <li>
              <a href={LICENSE} rel="noopener">
                {t("landing.footer.license")}
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
