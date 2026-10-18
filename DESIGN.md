---
name: Beautifood
description: Front of house for hawker and casual-dining restaurants, where every promise is a ticket stub.
colors:
  sun: "#ffd12e"
  sun-deep: "#e8b400"
  sun-soft: "#fff5cc"
  carbon: "#1a1814"
  ink: "#1a1814"
  ink-2: "#4a453c"
  ink-3: "#6f675b"
  ground: "#ffffff"
  ground-2: "#f5f4f0"
  surface: "#ffffff"
  line: "#e4e1d8"
  line-strong: "#cfcabe"
  stock-a: "#ffd12e"
  stock-b: "#ff8fa8"
  stock-c: "#7fddbf"
  stock-d: "#bba8ff"
  stock-x: "#e9e6dd"
  ok: "#12753a"
  ok-soft: "#dcf4e4"
  warn: "#8f5200"
  warn-soft: "#fdefd0"
  bad: "#b8232b"
  bad-soft: "#fde2e2"
  info: "#1d55c4"
  info-soft: "#e1eafc"
  board: "#14120e"
typography:
  serial-mega:
    fontFamily: "Big Shoulders Display, Figtree Variable, PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(88px, 28vw, 148px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  serial:
    fontFamily: "Big Shoulders Display, Figtree Variable, PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title-sm:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.4
  caption:
    fontFamily: "Figtree Variable, Figtree, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.6
rounded:
  tag: "4px"
  stub: "6px"
  btn-small: "8px"
  ctl: "10px"
  card: "12px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "18px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.sun}"
    rounded: "{rounded.ctl}"
    padding: "9px 14px"
    height: "42px"
  button-primary-disabled:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.ctl}"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "9px 14px"
    height: "42px"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.ctl}"
    padding: "9px 14px"
    height: "42px"
  button-big:
    rounded: "{rounded.card}"
    height: "54px"
  button-small:
    rounded: "{rounded.btn-small}"
    padding: "4px 10px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "9px 12px"
    height: "42px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
    height: "34px"
  chip-selected:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.sun}"
    rounded: "{rounded.pill}"
  badge:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-brand:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  topbar:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.carbon}"
  nav-link-active:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.sun}"
    rounded: "9px"
    padding: "7px 9px"
  stub:
    backgroundColor: "{colors.stock-a}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.stub}"
    padding: "18px 20px"
  rowstub:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.stub}"
  rowstub-number:
    backgroundColor: "{colors.stock-a}"
    textColor: "{colors.carbon}"
    width: "76px"
  toast:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.ground}"
    rounded: "{rounded.card}"
    padding: "11px 16px"
---

# Design System: Beautifood

## Overview

**Creative North Star: "The Kopitiam Ticket Stub"**

Every promise Beautifood makes is a ticket you can hold. Queue numbers, preorders, open bills, kitchen tickets, bookings and branch summaries are drawn as stubs: a block of ticket stock, a stamped serial numeral in a tall condensed face, a dashed tear line, and on the full stub, half-moon perforation notches and a row of punched holes. The shell around them is a kopitiam-sign yellow bar with carbon ink, loud and local like good hawker-centre signage.

The stub is the one signature move. Everything else is a calm, standard working screen: white ground (warm charcoal in dark mode), hairline warm-grey rules, soft-shadowed cards, ink-filled primary buttons. Guest screens are one-handed and glanceable (the number always wins the viewport). Staff screens are dense but calm, with big tablet targets and state carried by a small, fixed set of tones. The system is fully bilingual (English and Simplified Chinese) and every layout holds for CJK text.

It rejects two things, both named in the direction contract: the category default (grey cards with one accent colour) and the gimmick (a fake paper-ticket skin over everything).

**Key Characteristics:**
- Yellow shell bar, carbon ink, white or charcoal ground.
- Ticket stock colour per party-size class: A yellow, B rose, C mint, D lilac, X neutral.
- Serial numerals in Big Shoulders Display, tabular, stamped; everything else in Figtree with system CJK fallback.
- Dashed tear lines separate a stub's serial from its body, at every scale.
- Lucide icons at their default 2px stroke inline (15 to 19px), 1.75 beside section titles, 1.5 for large empty-state icons.
- Short, decisive motion on a custom ease-out; reduced motion keeps only colour and opacity changes.

## Colors

A loud yellow and a near-black carbon do the brand work; four pastel ticket stocks encode party-size class; everything else is warm neutral.

### Primary
- **Kopitiam Sign Yellow** (sun): the brand colour. The shell top bar, the A-class stock, seated tables on the floor plan, the KDS ticket header, the boss branch header band, the POS change-due panel, the signature-dish tag, text selection and the outer focus halo. It is a fill colour, never a text colour on white.
- **Sign Shadow Yellow** (sun-deep): the yellow's edge. Top-bar bottom border, seated-table border, link underlines, sun-button border, branch meters.
- **Steamed Milk** (sun-soft): the yellow wash. A lit (just-called) queue row, the current POS round, selected inbox rows, the "sun" alert.

### Secondary
- **Carbon** (carbon): fixed near-black used wherever ink sits on yellow or stock, and as the primary-button fill. It does not flip in dark mode, so text on yellow and on stock stays dark in both schemes.

### Tertiary (ticket stocks)
- **Stock A, Sign Yellow** (stock-a): party-size class A.
- **Stock B, Rose Ticket** (stock-b): class B.
- **Stock C, Mint Ticket** (stock-c): class C.
- **Stock D, Lilac Ticket** (stock-d): class D.
- **Stock X, Void Grey** (stock-x): unknown, custom, cancelled or no-show tickets. In dark mode it darkens to #3a362d and its text switches to light ink.

### Neutral
- **Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): primary text, secondary text and labels, muted text and meta. In dark mode they become #f4f1e8, #d2cbbb and #a59d8c.
- **Ground** (ground) and **Ground 2** (ground-2): page and sunk surfaces, segmented-control and badge fills. Dark: #14120e and #1c1a15.
- **Surface** (surface): cards, inputs, buttons, sheets. Dark: #211e18.
- **Line** (line) and **Line Strong** (line-strong): hairline rules and card borders; control and chip borders. Dark: #36322a and #4a453a.
- **Calling Board** (board): the fixed charcoal of the big-screen "now calling" display, with yellow numerals.

### State tones
Each state is a paired strong and soft value, used as badge text on its soft wash, as alert fills, or as floor-plan tints: **ok** (free, seated, paid, ready), **warn** (waiting, pending, to clean, allergens, kitchen notes), **bad** (no-show, void, refund, late), **info** (reserved, confirmed, held). Status-to-tone mapping lives in one table in the components, so a status never changes colour between screens. Dark mode lightens the strong tones (#5fd28c, #f4b54a, #ff7a7f, #8fb4ff) and deepens the washes.

### Named Rules
**The Ink-On-Yellow Rule.** Yellow is a fill, never a text colour on white. Text on yellow or on any stock is carbon (#1a1814), and stays carbon in dark mode.

**The Stock Means Class Rule.** Stock colours carry exactly one meaning: the party-size class letter of a ticket (A, B, C, D, else X). Never use rose, mint or lilac for decoration, charts or state.

**The Inverted Selection Rule.** Selected, pressed and active controls (nav tab, chip, language toggle, segmented POS bill, aria-pressed buttons) invert to a carbon fill with yellow text in light mode, and to a yellow fill with carbon text in dark mode.

## Typography

**Display Font:** Big Shoulders Display (700, 800, 900; self-hosted), falling back to Figtree and CJK system faces
**Body Font:** Figtree Variable, with PingFang SC, Hiragino Sans GB, Noto Sans SC and Microsoft YaHei for Chinese, then system-ui
**Label/Mono Font:** none distinct; numerals in body copy use tabular figures

**Character:** a tall, condensed, stamped numeral face against a friendly rounded grotesque. The display face is reserved for things that are numbers or codes: it reads like a printed ticket serial and carries the hawker-signage energy, while Figtree keeps the working text warm and plain.

### Hierarchy
- **Serial Mega** (800, clamp(88px, 28vw, 148px), 0.9): the guest's own queue number on the ticket stub. The number wins the screen.
- **Serial scale** (800, 56px / 34px / 26px / 22px, 0.9): issued numbers at smaller sizes; table labels on the floor plan, row-stub numerals, KDS table and qty, prices, stat values (30px), the logo wordmark (23px, lowercase), branch names on the boss band (26px), QR labels. The "now calling" board uses 900 at clamp(90px, 14vw, 180px).
- **Headline** (800, 1.75rem, 1.15, -0.015em): page titles (h1).
- **Title** (750, 1.2rem, 1.15): section and card titles (h2); h3 at 700, 1.02rem.
- **Body** (400, 15px, 1.5; 1.65 for Chinese): all running text. Inputs go to 16px under 640px to stop iOS zoom.
- **Label** (650, 13px): form labels, segmented controls, chips, stub field labels (700, 13px, 72% opacity), in sentence case.
- **Caption** (650, 12px): badges, table headers, legends, meta lines.

### Named Rules
**The Serial Face Rule.** Big Shoulders Display sets numbers, codes and short proper names on stubs (ticket numbers, table labels, prices, totals, branch names, the wordmark). It never sets sentences or headings.

**The Tabular Rule.** Wherever figures sit (serials, money, stats, table cells, bill lines, chart labels) they are tabular, so columns and live-updating counts do not jitter.

**The CJK Breathing Rule.** For Chinese, heading tracking returns to 0 and body line-height opens to 1.65. Never apply negative or positive tracking to CJK text, and never rely on uppercase for emphasis: Chinese has none.

## Layout

Two containers: a 1240px wide frame for staff and desktop, and a 560px narrow column for guest flows (the guest top bar caps at 760px). Page gutters are 16px with 20px vertical padding. Spacing runs on a small set of steps (4, 6, 8, 12, 16, 20, 24px) with 18px inside cards; the direction contract proposed a strict 4px grid, but the build uses 6, 10, 14 and 18px steps as well, and those are the system.

Grids are intrinsic: auto-fill with minmax tracks (250px cards, 330px wide cards, 150px tight tiles, 98px floor-plan tables, 270px KDS tickets, 140px POS items). Class tiles go 2-up on phones and 4-up from 520px. Two-column splits (even or 1.6:1) collapse to one column at 900px; the POS (menu plus a 340 to 420px bill column) also collapses at 900px and gains a sticky bottom dock. Row stubs drop their actions under the body below 640px. The staff top bar reorders under 720px: switchers take a full row and the nav becomes a horizontally scrolling strip with masked edges.

Stats sit in a hairline-divided strip (1px vertical rules between cells, no gaps). Fixed and sticky docks use a translucent ground (90 to 92%) with a 10px backdrop blur and a hairline top rule, and respect the safe-area inset.

**The Number First Rule.** On guest screens the stub with the number and "what happens next" is the first thing in the viewport; actions stack below it as full-width big buttons.

## Elevation & Depth

A light hybrid. Cards carry a soft two-layer ambient shadow and a hairline border; sunk and flat cards drop the shadow. Stubs are the only elements that float: they use a drop-shadow filter so the perforation notches cast correctly. Toasts, tooltips and segmented-selected pills take the lifted shadow. Dark mode deepens both shadows rather than removing them.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 1px 2px rgba(26,24,20,0.06), 0 6px 18px -6px rgba(26,24,20,0.12)`): resting cards, selected segmented pill.
- **Lift** (`box-shadow: 0 2px 4px rgba(26,24,20,0.06), 0 14px 32px -10px rgba(26,24,20,0.22)`): toasts and chart tooltips.
- **Stub float** (`filter: drop-shadow(0 6px 14px rgba(26,24,20,0.14))`): full stubs only; removed on the calling board and in print.
- **Primary hover** (`box-shadow: 0 6px 16px -8px rgba(26,24,20,0.6)`): fine-pointer hover on the ink button.
- **Lit ring** (`box-shadow: 0 0 0 2px var(--sun), card ambient`): a just-called queue row, until acknowledged.

### Named Rules
**The Only Stubs Float Rule.** Drop-shadow filters belong to stubs. Every other surface uses the card ambient shadow or none.

## Shapes

Three corner families. Stubs and stub-derived parts (row stubs, POS bill stubs, setup marks) are crisp at 6px, like cut card stock. Controls (buttons, inputs, POS items) are 10px, small buttons 8px, big buttons and cards 12px. Pills (badges, chips, meters) are fully round; bottom sheets are 20px on the top corners only (18px all round as a centred dialog from 640px). Tags inside stubs (signature dish, promo code, late stamp) are 4px.

The perforation is the recurring geometry: on a full stub, two 11px radius half-circle notches are masked out of the side edges at the tear height, and a 2px dashed carbon rule (28% opacity) runs between them. Every stub-derived component repeats the tear as a 2px dashed carbon rule at 25 to 30% opacity: vertical on row stubs and POS bills, horizontal under the KDS ticket header and the boss branch band. Punches are 14px circles with a 2px carbon border; done punches fill with carbon; "you" is an 18px open ring with a 3px border and a white halo.

**The Tear Line Rule.** A dashed carbon rule always separates the stock-coloured serial area of a stub from its content. Dashed borders elsewhere mean "not solid": blocked or split tables, QR cut sheets, the promo form divider.

## Components

### Buttons
Tactile and plain: a firm press, no gradients.
- **Shape:** gently rounded (10px), 42px minimum height; small 32px at 8px; big 54px at 12px for guest primary actions.
- **Primary:** carbon fill with yellow label, weight 650. In dark mode it inverts to yellow fill with carbon label. Disabled primary turns to a sunk grey fill with muted text rather than fading.
- **Default:** surface fill, 1px strong-line border, ink label. **Sun:** yellow fill, sun-deep border, carbon label. **Ghost:** transparent until a 7% ink wash on hover. **Danger:** red label with a 35% red border.
- **Hover / Focus:** hover only on fine pointers (border darkens to ink-3). Press scales to 0.97 over 160ms on the custom ease-out. Focus-visible draws a 2px ink outline with a 5px yellow halo.
- **Icon-only:** square 42px (32px small), always with an accessible name.

### Chips
- **Style:** pill, surface fill, strong-line border, ink-2 label at 13px/650, 34px tall; menu category chips scroll horizontally with snap.
- **State:** pressed inverts to carbon fill with yellow text (The Inverted Selection Rule).

### Badges and status
- **Style:** pill, 12px/650, a soft wash with the strong tone as text (ok, warn, bad, info) or yellow with carbon ("brand", used for called and fired). Status labels come from one tone table and are always translated.
- **Lucide glyphs** inside badges are 12px (leaf for vegetarian, repeated flames for spice level, with a screen-reader count).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** surface; sunk variant on ground-2.
- **Shadow Strategy:** card ambient at rest; flat and sunk variants none.
- **Border:** 1px line.
- **Internal Padding:** 18px; tight 12px 14px.

### Inputs / Fields
- **Style:** surface fill, 1px strong-line border, 10px radius, 42px tall, labels stacked above in 13px/650 ink-2 with a 12px hint line.
- **Focus:** border goes to ink plus a 3px yellow ring at 70%.
- **Party stepper:** a joined 52px control with the count set in the serial face at 26px.
- **Checkboxes and radios:** native, carbon accent, 18px.

### Navigation
- **Guest bar:** yellow, sticky, with the logo, a truncating context line (branch or restaurant) and the EN | 中 language switch on the right.
- **Staff bar:** yellow, sticky; logo, tenant name, branch switcher (a translucent white select), user name with a carbon role tag, language switch, sign-out; a second row of nav tabs with 16px Lucide icons, 14px/650 labels at 78% carbon. Active tab inverts to carbon with yellow text. Below 720px the tabs scroll sideways with faded edges.
- **Language switch:** a joined two-button group (EN, 中) with a 25% carbon border; the active language inverts. Every registered locale adds a button.

### Ticket Stub (signature)
The guest's ticket: stock-coloured fill by class letter, carbon text, 6px corners, perforation notches and dashed tear at an adjustable height (66 to 76% of the stub), a mega serial, sentence-case field labels at 72% opacity, a punch row counting parties ahead (capped at 12 with "+n"), and wait figures in the serial face. A newly issued stub tears in: a top-down clip-path reveal with a 6px drop, 280ms on the custom ease-out. Used on the ticket page, kiosk confirmation, table landing, rewards card, booking confirmation, the class tiles on the branch page and the calling board.

### Row Stub (staff)
The same stub turned sideways for lists: a 76px stock-coloured number cell (serial at 26px, pax beneath in 11px/700) separated by a vertical dashed tear from a surface body and a right-aligned action group. Queue rows re-rank in place with a 220ms FLIP transform. A called row is lit (yellow ring and steamed-milk wash) until acknowledged. Under 640px the number cell narrows to 64px and actions wrap below.

### KDS Ticket
A card with no padding whose header is a yellow band (table or source in the serial face at 30px, ticket age with a timer) over a dashed tear; late tickets turn the band red with white text and a small outlined "late" stamp. Items are 19px/750 names with 26px serial quantities; bumped items strike through at half opacity; notes sit in a warn-wash tag. Bump buttons are 48px tall for gloved, distant use.

### POS Bill Stub
Open bills are a horizontal snap-scroll of small stubs: a yellow serial cell, dashed vertical tear, then table/meta and amount due. The selected bill inverts to carbon with yellow text. Menu items are 92px tiles with a serial-face price and a carbon quantity bubble; the change-due panel is a yellow block with the amount in the serial face at 30px, switching to the bad wash when short.

### Boss Branch Band
Each branch card opens with a full-bleed yellow band (branch name in the serial face at 26px) separated by a dashed tear, then a 2x2 hairline stats grid and a sun-deep meter. Branch totals use the same hairline stats strip.

### Floor Plan Table
98px minimum tiles at 12px radius: free tables are plain with a small green dot; seated fill yellow; reserved and to-clean take the info and warn washes with their strong borders; blocked and split go dashed at 55% opacity; selection is a double ring (surface then ink). Table labels are in the serial face at 22px.

### Sheets and Toasts
Dialogs are bottom sheets on phones (20px top corners, grip handle, 92dvh max, slide-up 320ms on the drawer curve) and centred 540px dialogs from 640px (scale from 0.96, 220ms). Toasts are carbon pills at the bottom centre with a yellow Lucide check (red fill with a white icon for errors), rising in over 260ms.

### Motion
One custom ease-out (cubic-bezier(0.23, 1, 0.32, 1)) for everything that moves; a drawer curve (cubic-bezier(0.32, 0.72, 0, 1)) for the phone sheet only. Feedback runs 120 to 280ms and animates transform and opacity; colour changes use plain ease. Entrances use @starting-style. Reduced motion collapses animations to 1ms, strips transform transitions from buttons, tables, sheets, toasts, bubbles, POS items and bills, and cancels press scaling.

**The Short Hands Rule.** Interaction motion stays under 300ms and moves only transform and opacity. The phone sheet (320ms), the lit-row wash fade (600ms) and meter fills (400ms) are the only longer transitions.

## Do's and Don'ts

### Do:
- **Do** draw any new numbered promise (ticket, bill, booking, order) as a stub: stock fill, serial face, dashed tear (The Tear Line Rule).
- **Do** pick stub stock from the class letter of the number (A, B, C, D) and fall back to X for anything else or for a cancelled ticket.
- **Do** put carbon (#1a1814) text on yellow and on every stock, in both colour schemes (The Ink-On-Yellow Rule).
- **Do** set every figure tabular and set serials, prices and table labels in Big Shoulders Display.
- **Do** write labels in sentence case and translate every string; check each new layout in Simplified Chinese at 1.65 line-height with zero tracking.
- **Do** use Lucide icons: default stroke at 15 to 19px inline, 1.75 stroke beside section titles, 28 to 32px at 1.5 stroke in empty states.
- **Do** keep tap targets at 42px or more (48px for kitchen bumps, 54px for guest primaries) and gate hover styles behind fine pointers.
- **Do** honour prefers-reduced-motion and prefers-color-scheme for every new component.

### Don't:
- **Don't** use yellow as text on white or light surfaces.
- **Don't** use rose, mint or lilac for anything except party-size class (The Stock Means Class Rule).
- **Don't** add uppercase, letter-spaced kicker or eyebrow labels above headings or numbers; the stub's field labels are sentence case, and Chinese has no case to fall back on.
- **Don't** turn whole screens into paper tickets; working screens stay standard and the stub is the one signature move.
- **Don't** put a drop shadow on anything that is not a stub, or animate layout properties for interaction feedback.
- **Don't** set sentences or headings in Big Shoulders Display, or apply negative tracking to CJK text.
- **Don't** use emoji or text glyphs as icons; icons are Lucide or the stub wordmark.
