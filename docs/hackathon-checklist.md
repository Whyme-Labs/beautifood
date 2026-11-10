# Hackathon pre-submission checklist

Use this for every hackathon entry. Copy it into the entry's notes, tick each box, and link the proof
beside it. It comes from two entries that won nothing (Devpost "Build With AI: Basics" and the Qloo
Agentic Hackathon, Oct 2026) and from the six projects that won them.

**The lesson in one line:** judges reward one sharp idea they can try in ten seconds, with a number
that proves it works. They don't reward the size of the codebase. Three winners were 3–7k lines,
built in one to two days.

---

## 0. Before choosing to enter (day 1)

- [ ] Read the overview, the rules and the judging criteria in full. Paste each criterion into a
      table: one row per criterion, then a column for how the entry will score on it.
- [ ] List every **eligibility requirement**, word for word, with where its proof will live. Examples:
      - "new project, started during the submission period";
      - "built with the skills";
      - "`scope.md`, `prd.md`, `spec.md` in the repo";
      - "public repo with a licence visible in About";
      - "hosted demo, not local";
      - "video 1–3 minutes".
- [ ] Note who the judges are (engineers, marketers, investors, celebrities) and what each one wants
      to see.
- [ ] Note the dates: deadline (with time zone), judging period, winners announced, and any live
      final the finalists must be free for.
- [ ] Note any free help before the deadline: live reviews, office hours, Discord. Book a slot.
- [ ] Decide: **is this a new project, or a slice of Beautifood?** Enter Beautifood only if the
      brief rewards exactly what it already does. Otherwise build a new, small thing.

## 1. The idea (before any code)

- [ ] **One person, one moment, one sentence.** "When [someone] is [in this moment], they can't
      [do X]." Name a real person and a real moment, not a market.
- [ ] **A number in the first line.** A real statistic about the problem, from a cited source.
- [ ] **The sponsor's technology is the product.** Without it, nothing is left. ("If your
      submission would work the same without Qloo, you're building the wrong thing.")
- [ ] **A with-and-without claim planned from day 1.** Plan how to show the sponsor's technology,
      or our method, beats the obvious baseline (an LLM alone, the current tool, guessing). Plan it
      as a number.
- [ ] **The AI's limit, in one line.** Write the rule that keeps the AI honest, and design the app
      around it. Examples: "The AI only looks; the chart decides"; "A wrong name is worse than no
      name"; "The model may only name what Qloo returned."
- [ ] **Known alternatives named** (2–3), and one sentence on how this differs.
- [ ] **Non-obvious and timely.** Fits the judges and the moment (Undertow: an election forecast
      judged during election week).
- [ ] **A cut list.** Write down what this entry will *not* do.

## 2. Building

- [ ] The demo path first: the one flow a judge will try works end to end before anything else.
- [ ] Required files written as you go, not at the end: planning docs, licence, README.
- [ ] **Measure it.**
      - Keep a small labelled set, part of it held out and scored once.
      - Run the baseline against it.
      - Record the failures too; winners publish theirs.
      - Beautifood already does this (blind held-out sets): use it.
- [ ] Every AI output is checked against data or rules, and the app says so on screen. Examples: a
      source per price, a cited finding per suggestion, an "unverified" flag.
- [ ] **Time check, twice a week:** at least 80% of commits go to this entry's core. Count with
      `git log --since=<start> --oneline -- <entry paths>`. In the Qloo window, 13 of 197 commits
      went to the Qloo feature.
- [ ] Keys stay server-side, with rate limits per visitor and a fallback when a provider fails.

## 3. What a judge sees first (the first 10 seconds)

- [ ] **A one-tap example** on the first screen opens a finished result with no typing. Examples:
      "Try it: 12 cranial nerves", "Surprise me", recorded example runs.
- [ ] **No login, no setup, no camera needed** for that example. If a login can't be avoided, use a
      judge account in the private field, already signed in through a link.
- [ ] **No cold start.** Keep the demo warm, cache example results, or record them. Our Qloo page
      could take a minute to wake up.
- [ ] Works on a phone and on a desktop, in a logged-out browser on another network.
- [ ] The "wow" visual is reachable in one click: a map, a 3D view, a before-and-after.
- [ ] The README opens with the problem, then a **"Judge in 60 seconds"** section with numbered
      steps. Then how it uses the sponsor's technology (endpoints named), then the evidence. Dev
      setup goes last. Our Qloo repo README didn't mention Qloo at all.
- [ ] The demo stays up through judging and the announcement. Undertow's temporary tunnel was dead
      a week later. Use a permanent host.

## 4. The written story (Devpost form)

- [ ] **Written in your own voice.** Some hackathons require it.
- [ ] Order:
      1. problem and number;
      2. who it's for;
      3. what it does (short bullets);
      4. how the sponsor's technology is used (specific);
      5. evidence (a table with numbers, failures included);
      6. challenges (honest);
      7. what's next.
- [ ] The with-and-without number appears in the first screen of text and in an image caption.
- [ ] **No placeholders.** No `[...]`, `(Add ...)`, `TODO`, `TBD`, or "Your moment:". Run the check
      in section 8 on the pasted text.
- [ ] Built-with tags are complete. "Try it out" links point to the permanent URL, not a preview
      or old one.
- [ ] Any required extra question (e.g. "how did you upgrade an existing project") is answered,
      within its character limit.

## 5. Video

- [ ] Length within the rules (check the form: Basics wanted 1–3 minutes).
- [ ] **Narrated**, with captions. Our Qloo video had no audio.
- [ ] The product works on screen within the first 20 seconds, then follows the one demo path end
      to end.
- [ ] Says the problem, who it's for and the evidence number aloud.
- [ ] No secrets, emails, tokens or private data on screen.
- [ ] Public or unlisted. Plays logged out. Correct link in the form.

## 6. Gallery

- [ ] At least 8 images. Our Qloo entry had 0; the winners had 8–26.
- [ ] The first image is the hero result, not a logo.
- [ ] Each image has a one-line caption saying what it proves. One image shows the
      with-and-without comparison or the evidence table.
- [ ] No sponsor data that the terms forbid publishing, and no private data.

## 7. Final review (48 hours before the deadline)

- [ ] Fill the eligibility table from section 0. Every requirement has a link to its proof.
- [ ] Fill the judging table from section 0. Every criterion has one sentence and one piece of
      evidence.
- [ ] Open the **public** Devpost page logged out and read it top to bottom as a judge would.
- [ ] Click every link from a logged-out browser, on a phone too.
- [ ] Run the automated checks in section 8. All pass.
- [ ] Someone who hasn't seen the project tries the demo from the Devpost page alone, in under 60
      seconds, while you watch without helping.
- [ ] Submit at least 24 hours early. Edits are usually allowed until the deadline.
- [ ] Note the judging and announcement dates. Keep the demo warm and be reachable (finalists may
      be called for a live round).

## 8. Automated checks

Run from the entry's repo root. Paste the Devpost text into `submission.md` first; keep it out of
git if it holds a judge login.

```sh
# required files (edit the list to the rules)
for f in scope.md prd.md spec.md LICENSE README.md; do
  git ls-files | grep -q "$f$" && echo "ok   $f" || echo "MISSING $f"
done

# placeholders left in the story or README
grep -nE '\[[A-Z][^]]*\]|\(Add [^)]*\)|TODO|TBD|Your moment|In your words' submission.md README.md

# every link answers, logged out
grep -oE 'https?://[^ )>"]+' submission.md README.md | sort -u | while read u; do
  echo "$(curl -s -o /dev/null -m 20 -w '%{http_code} %{time_total}s' -L "$u") $u"
done

# video length and audio track (local copy)
ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4
ffprobe -v error -show_entries stream=codec_type -of csv=p=0 video.mp4 | grep -q audio \
  && echo "has audio" || echo "NO AUDIO"

# where the time went since the start date
git log --since=YYYY-MM-DD --oneline | wc -l
git log --since=YYYY-MM-DD --oneline -- <entry paths> | wc -l
```

## 9. After submitting

- [ ] Keep the demo, repo and video up until winners are announced (and after: the page stays
      public).
- [ ] Answer comments on the Devpost page.
- [ ] Write a short 复盘 within a week of results, win or lose: what the winners did that we didn't.
      Add new lessons to this checklist.
