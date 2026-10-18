---
version: 1
slug: "src-ui-styles-css"
primary_target: "src/ui/styles.css"
related_targets: ["pages"]
---

# Surface: whole app (guest pages + staff console + POS/KDS)

Mode: Operate. Audience and job: see PRODUCT.md. Build path: code-led (no image generation; operate surface).

## Direction contract

THESIS: Every promise Beautifood makes is a ticket. Queue numbers, preorders, bills, bookings and receipts are stubs you can hold: perforated, serial-numbered, colour-coded by stock. The screens refuse the category default (grey cards with one accent) and the gimmick (a fake paper ticket app). Working screens stay standard; the stub is the one signature move.

OWN-WORLD: The shell is kopitiam-sign yellow (#FFD12E) with carbon ink (#1A1814). The ground is clean white in light mode and warm charcoal in dark. Each party-size class has its own ticket stock: A yellow, B rose (#FF8FA8), C mint (#7FDDBF), D lilac (#BBA8FF). Serial numerals are set in Big Shoulders Display, tabular and stamped. Body text is Figtree, with system CJK faces (PingFang SC / Noto Sans SC) for Chinese. Radius is 10px on controls and 6px on stubs. Icons are Lucide at 1.75 stroke. Stubs use a perforation edge (mask notches) and a punched-hole row.

STORY: A guest sees their stub: number, place in line and time, with punches counting down. They act from the stub: preorder, get notified, leave. Staff see the same stubs as rows that re-rank in place. Owners see every branch's stubs at a glance.

FIRST VIEWPORT: Guest queue page: a yellow bar (logo, branch, language). One big stub per class with waiting count and ETA, then the join form with the party stepper and the "Get my number" primary (ink button). Ticket page: a full-width stub with a monumental number, punches, status line and actions below. Host stand: a yellow bar, nav tabs, a left column of suggestion rows and a stub-row queue, and a right floor grid of tables tinted by state.

FORM: ticket-stub world, assigned candidate 3 of 7; seed: cec12790be1c4f7f
RAISES: (from the boarding-pass/gate-board challenger) queue rows re-rank in place with FLIP and a newly called number stays lit until acknowledged. (From the declined grid/rail challengers) a strict 4px spacing grid with hairline 1px rules and tabular figures everywhere numbers sit.
SIGNATURE MOTION: the stub tears in (clip-path reveal, 260ms, ease-out cubic-bezier(.23,1,.32,1)) when a number is issued. Rows FLIP-reorder at 220ms. Buttons press to scale(.97). Reduced motion keeps only opacity.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
