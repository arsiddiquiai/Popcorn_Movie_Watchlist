# Popcorn — Design Deltas

**Read this file before making any UI change.** It does not replace the existing
design system in `src/index.css` — that system is sound and stays. This file
lists only what changes and why.

**Rule for every prompt:** never hardcode a colour, radius, duration, or font.
Everything reads from the existing tokens (`--bg`, `--surface`, `--text`,
`--accent-warm`, `--hero`, `--radius-*`, `--transition-*`, `--font-*`). A change
that requires a new value means adding a token, not a literal.

---

## 0. The one-line brief

Popcorn is a watchlist that is honest about the fact that watchlists rot.
Everything else is a list; Popcorn is a **shelf where films visibly age**.
Design for millennials / Gen-Z / Gen-Alpha on a phone, in the dark, deciding
what to watch in under ninety seconds.

---

## 1. Signature element — The Decay Shelf

Spend the boldness here. Everything else stays quiet and disciplined.

The decay mechanic already exists in `WatchlistCard.tsx`. It is currently a
styling side-effect. Promote it to the thing the app is remembered for.

- A poster **desaturates and dims progressively** the longer it sits unwatched.
  Four stages, driven by days-since-added: `fresh` (0 filter) → `settling`
  (`saturate(0.85)`) → `stale` (`saturate(0.55) brightness(0.82)`) →
  `graveyard` (`saturate(0.15) brightness(0.6)`).
- A **1px decay hairline** sits flush at the poster's base — `--accent-warm`
  at `fresh`, shortening and fading toward `--muted-subtle` as it decays.
  No numbers, no percentages, no tooltip. It should read as a feeling.
- Graveyard posters get one line of copy on tap: dry, never guilt-tripping.
- **Rescue or bury** is a swipe, not a menu (see §5).

Do not add a second flourish that competes with this. If a screen already has
the Decay Shelf, everything else on it is plain.

---

## 2. Themes — replace `cinema` with `neon`

### Why

`nightcap` (`#161211`) and `cinema` (`#1c0f0b`) are both warm near-black. Side
by side they are indistinguishable, which is why the Settings swatches all
render the same. You are paying for three themes and shipping about one and a
half. Replacing `cinema` with a genuinely different third theme is the highest
value-per-line change available.

### Changes

`src/theme/types.ts`:

```ts
export type Theme = 'nightcap' | 'daylight' | 'neon'
```

`src/theme/ThemeProvider.tsx`:

```ts
const THEMES: Theme[] = ['nightcap', 'daylight', 'neon']
```

Add a migration in `readStoredTheme()` — anyone with `'cinema'` in
localStorage or their Supabase profile row maps to `'neon'`, not to the
default. Same for the profile pull in `ThemeProvider`.

### The `neon` token block

Marquee bulbs and arcade glow, not brown. Magenta / cyan on violet-black. This
is deliberately not the warm family — that is the entire point.

```css
[data-theme='neon'] {
  color-scheme: dark;
  --bg: #0a0616;
  --surface: #1b1340;
  --surface-2: #251a57;
  --border: #3a2a66;
  --text: #f4eeff;
  --muted: #a99bc7;
  --muted-subtle: #8b7dab;   /* 5.35:1 on --bg, 4.63:1 on --surface — AA */
  --accent-warm: #ff3d8a;    /* 5.98:1 on --bg */
  --accent-cold: #3de0ff;    /* 12.66:1 on --bg */
  --hero: #7c2bff;
  --danger: #ff5c5c;
  --hero-ink: #ffffff;       /* see below — 5.76:1 on --hero */
  --glow: 0 0 0 1px rgb(255 61 138 / 0.55), 0 12px 44px -8px rgb(124 43 255 / 0.65);
}
```

Note `--accent-cold` is overridden here (it is `#5b7fa8` everywhere else).
`ratingScale.ts` interpolates cold → warm, so cyan → magenta keeps the
"1/10 reads cool, 10/10 reads warm" meaning intact and actually strengthens it.

### Two token bugs this exposes

Both live in `.btn-hero` in `src/index.css`:

1. **`color: var(--bg)`** — a dark label on the hero gradient. That works on
   the warm themes, fails on neon (violet is too dark for dark ink). Introduce
   `--hero-ink`, set to `var(--bg)` in `:root`, `[data-theme='daylight']`, and
   `#ffffff` in `[data-theme='neon']`. Change `.btn-hero` to
   `color: var(--hero-ink)`.
2. **Hardcoded shadow** — `box-shadow: 0 10px 30px -10px rgb(200 68 45 / 0.8)`
   and the hover value are theme-blind ember. Replace both with `var(--glow)`
   / a `--glow-strong` token so the CTA glows the right colour in every theme.

Also fix `--shadow-glow-2` in `@theme`, which hardcodes `rgb(212 162 76)`.

### Theme swatches in Settings

Currently three identical black/gold pills. Replace each with a **live
miniature preview**: a `data-theme`-scoped div containing three tiny poster
rectangles, one text line, and one accent pill, at ~72×48px. The nested
`data-theme` scoping already works — that is exactly why the tokens were kept
out of `:root`-only scope. Use it.

---

## 3. Density — the fix that matters most

Measured on the current build at 390×844: the first poster row starts roughly
halfway down the screen. Target is **within 320px of the viewport top**.

### Kill the vertical tax

| Element | Now | Change |
|---|---|---|
| App bar | ~56px, always full | Sticky, 56px, `backdrop-blur`, `--bg` at 80% opacity |
| `ModeHeader` (Discover/Decide band) | Full-width band, ~56px | **Remove on mobile entirely.** Keep as a quiet sidebar group label on desktop only |
| Page `<h1>` | 34px, static | 28px, collapses to 17px into the app bar on scroll |
| Subcopy | Always visible | Visible only when the list is empty or on first visit |
| `Surprise Me` | Inline pill under subcopy | Moves into the app bar as an icon-button (dice) |
| Want/Watched tabs | Own row | Sticks directly under the app bar, 40px |

### Poster grid

| Breakpoint | Columns | Gap |
|---|---|---|
| `<640px` | 3 | 8px |
| `640–1023px` | 4 | 12px |
| `≥1024px` | 6 | 16px |

- **No border on poster cards.** Remove the current light stroke — it reads as
  a picture frame and flattens the artwork.
- Radius: add `--radius-poster: 12px`. Not `--radius-md` (14px), which is
  slightly too soft at 3-up.
- `aspect-ratio: 2/3`, `object-fit: cover`, no letterboxing.
- Shadow: none at rest. `--shadow-lift` on press only.

### Poster metadata

- **Title:** `font-ui` 600, 13px / 1.25, `-webkit-line-clamp: 2`. Never a
  mid-word ellipsis — "Demon Slayer -Kimets…" is the current bug.
- **Meta line:** `font-mono` 10px, uppercase, `letter-spacing: 0.06em`,
  `--muted-subtle`. Year · runtime only. Nothing else earns the row.

---

## 4. Navigation — bottom tab bar

The single biggest reason the app reads as amateur: sixteen routes and five
real destinations, all hidden behind a hamburger.

### Mobile (`<1024px`)

A fixed bottom tab bar. Five tabs, no more.

| Tab | Route | Icon intent |
|---|---|---|
| Shelf | `/` | Stacked posters |
| Search | `/search` | Magnifier |
| Pick | `/pick` | Dice |
| Assistant | `/assistant` | Kernel mark |
| You | `/taste` | Simple avatar/spark |

- Height 64px **+ `env(safe-area-inset-bottom)`**. Get this wrong and iOS
  Safari eats the tab bar.
- Active state: `--accent-warm` icon and label, plus a 3px top indicator bar.
  Inactive: `--muted`.
- Labels 10px `font-ui` 500. Icons 22px. Minimum 44×44 tap target.
- Hide on scroll down, reveal on scroll up, `--transition-fast`.
- All page content gets `padding-bottom: calc(64px + env(safe-area-inset-bottom))`.

### The hamburger and drawer are deleted

`Nav.tsx` becomes desktop-sidebar-only. `AppShell.tsx` renders the sidebar at
`≥1024px` and the tab bar below it.

### IA collapse — 16 routes into 5 destinations

Routes do not change. Only how they are reached.

- **Cinema Bridge** becomes a segmented tab inside `/search` ("Search" |
  "Bridge"). It is a discovery mode, not a destination, and on its own it is
  a form staring at an empty screen.
- **Taste DNA** becomes the "You" tab landing page.
- **Coming Soon, Settings, Feedback, Privacy, Terms** become a list at the
  bottom of "You". `Coming Soon` currently renders bold-active in the drawer —
  that is a live-state bug, fix it.

---

## 5. Gestures

Absent today. Non-negotiable for this audience.

- **Swipe right on a watchlist card → mark watched.** Reveals `--accent-warm`
  behind, with a check.
- **Swipe left → bury.** Reveals `--muted-subtle`, with a down-arrow.
- Threshold 88px or velocity > 0.4. Below that, spring back on
  `--ease-standard`. Both actions show an undo toast for 5s.
- **Long-press (400ms)** on any poster → bottom sheet: Add / Rate / Share /
  Bury. Haptic via `navigator.vibrate(8)` where available.
- **Pull-to-refresh** on Shelf and Search.
- Every gesture has a visible non-gesture equivalent. Gestures are an
  accelerant, never the only path.

---

## 6. Motion

Reuse `--transition-fast/base/slow` and `--ease-standard`. Do not invent
durations. All of this is already gated by `data-reduced-motion` — keep it
that way.

- **Poster → Detail:** Framer Motion shared element. `layoutId={tmdbId}` on the
  poster image in both `WatchlistCard`/`SearchResultCard` and `MovieDetail`.
  The poster expands into the detail hero. This one transition does more for
  perceived quality than any other change in this document.
- **Grid entry:** 20ms stagger, 8px rise, opacity 0→1. Cap the stagger at 12
  items or long lists feel slow.
- **Tab switch:** cross-fade at `--transition-fast`. No slide.
- **Decay:** filter transitions at `--transition-slow`. It should feel like it
  is settling, not switching.

---

## 7. Assistant / voice identity

`/assistant` currently has no visual identity, which makes the app's smartest
feature feel bolted on.

Give `KernelMark` (already in `layout/Logo.tsx`) five states:

| State | Treatment |
|---|---|
| `idle` | Still, `--muted` |
| `listening` | Breathing scale 1.0 ↔ 1.06, 1.8s loop, `--accent-cold` ring |
| `thinking` | Kernel rotates slowly, three dots orbit, `--accent-warm` |
| `speaking` | Five-bar waveform in `--accent-warm`, amplitude from audio where available, otherwise a plausible loop |
| `popped` | One-shot scale 1→1.3→1, `--hero` flash. Fires when an answer lands |

A 48px kernel FAB sits above the tab bar on Shelf and Search — tap to open the
assistant. It is the only floating element in the app.

---

## 8. Empty and loading states

- **Never a bare spinner on first load.** `PosterGridSkeleton` already exists
  and shimmers. Use it everywhere a grid or row is pending.
- **Empty watchlist:** KernelMark, one dry line, one primary action. An empty
  screen is an invitation, not an apology.
- **Cinema Bridge before a search:** show two or three example bridges as
  tappable cards ("Drishyam → its Korean equivalent"). Never an empty lower
  half.
- **Errors** state what happened and what to do. They do not apologise and
  they are never vague.

---

## 9. Copy

The existing voice is good — dry, observational, slightly self-aware
("everything quietly ageing out of it"). Keep it. Rules:

- Sentence case everywhere except the 10px mono meta line.
- Buttons name the outcome: "Add to shelf", not "Submit".
- The verb stays the same through the flow: a button that says "Bury" produces
  a toast that says "Buried".
- Never guilt the user about an unwatched list. Observe it, don't scold.

---

## 10. Quality floor

Non-negotiable on every screen:

- 44×44px minimum tap targets.
- Visible keyboard focus (the existing `:focus-visible` ring covers this —
  don't remove it per-component).
- `data-reduced-motion` respected. Test with it on.
- All three themes checked. A change is not done until it works in `neon`.
- Safe-area insets on top and bottom.
- No layout shift when images load — reserve the 2:3 box.
