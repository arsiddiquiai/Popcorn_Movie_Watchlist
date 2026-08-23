# CLAUDE.md — 🍿 Popcorn

Project instructions for Claude Code. Read before every task.

---

## What we are building

**Popcorn** — a movie watchlist that decides what you should watch.

**Problem statement:**
> Busy viewers waste their evening deciding what to watch because their watchlist has become a second overwhelming catalogue, and no existing tool converts that pile into a single confident choice that fits their mood, energy and available time.

**Core promise:** search movies → save to a personal watchlist → rate them → **Pick For Me** returns *one* film with a reason.

---

## Non-negotiables

1. **The must-have flow always works.** Sign up → search → add → mark watched → rate. Never break this for a new feature.
2. **CSS variables for all colour and motion.** Three themes switch at runtime. Never hardcode a colour.
3. **RLS on every user table.** A user must never read another user's rows.
4. **The Anthropic key never reaches the browser.** All AI calls go through the Netlify Function.
5. **Reduced-motion is respected everywhere.**
6. **Pick For Me returns exactly one primary result.** Never a list. This is the product thesis.

---

## The two-mode structure

Popcorn has two explicit modes. This is architectural, not cosmetic.

- **🔍 DISCOVER** — *fills* the watchlist: search, trending, regional, filters, Cinema Bridge
- **🎯 DECIDE** — *empties* it: Pick For Me, Surprise Me, the Graveyard

Navigation must make this split visible. Without it, Popcorn reads as another browse app with an AI button bolted on.

---

## Stack

Vite · React 18 · TypeScript · Tailwind (with CSS custom properties) · Framer Motion · Recharts · React Router · Supabase (auth + Postgres + RLS) · TMDB (client-side) · Anthropic Claude via **Netlify Functions** · deployed on Netlify.

---

## Design system

### Palette
```css
/* nightcap (dark, default) */
--bg: #0B0B0F;  --surface: #16161D;  --text: #F2F0EC;  --muted: #8A8A96;
--accent-warm: #F5B841;   /* positive / loved — this is the popcorn colour */
--accent-cold: #5B7FA8;   /* negative / rejected */

/* daylight (light) */
--bg: #FAF8F4;  --surface: #FFFFFF;  --text: #16161D;  --muted: #6B6B76;

/* cinema (near-black, minimal chrome, poster-forward) */
--bg: #000000;  --surface: #0A0A0A;  --text: #E8E6E2;  --muted: #6A6A72;
```

### Type
Heavy grotesk for display, Inter for UI. Large sizes, high contrast. **No thin serifs.**

### Motion rules
Demoed over **Google Meet screen share**. Video compression destroys fine detail.

- ✅ Large solid colour blocks, slow sweeping transitions, scale-and-settle
- ❌ Film grain, fine particles, confetti, subtle dark-on-dark gradients, fast micro-animations
- **Fewer, bigger, slower.**

### Logo
A single popcorn kernel, mid-pop, in `--accent-warm` on `--bg`.

---

## The rating slider (signature interaction)

A continuous **1–10** slider, shown after a movie is marked watched.

**Live, as the value changes:**
- **Colour interpolates** `--accent-cold` (1) → neutral grey (5) → `--accent-warm` (10). Panel gradient follows.
- **Poster reacts:** 1–3 greyscale + tilts away · 4–6 neutral · 7–8 saturation returns + lifts · 9–10 scales up with a soft warm bloom behind it.
- **Verdict word crossfades** each step:
  `1 Never again · 2 Regret it · 3 Weak · 4 Meh · 5 Fine · 6 Decent · 7 Solid · 8 Really good · 9 Loved it · 10 All-timer`
- **Pulse line:** thin EKG-style line beneath the slider. Amplitude and speed scale with value — flat and slow at 1, tall and fast at 10.

**On release:** 9–10 → one large soft bloom + scale-and-settle (**no fine confetti**). 1–2 → quick shake + fade-down.

**Immediately after:** one row of single-tap "why" chips — Story / Visuals / Performance / Mood / Pacing. Multi-select, optional, saved to `ratings.reason_tags`.

**Fallback:** if the animation proves unstable after 3 attempts, ship a plain working 1–10 slider that saves correctly. **Working plain beats broken beautiful.**

---

## Data model

```
profiles         id(uuid,fk auth.users) · display_name · theme_pref · reduced_motion · created_at
movies_cache     tmdb_id(pk) · title · poster_path · backdrop_path · release_year ·
                 runtime_minutes · genres(text[]) · overview · tmdb_rating ·
                 original_language · trailer_key · credits(jsonb)
watchlist_items  id · user_id · tmdb_id · status(want|watched|dropped) · added_at · watched_at
ratings          id · user_id · tmdb_id · score(int 1-10) · reason_tags(text[]) ·
                 review_text · created_at
ai_sessions      id · user_id · mode(pick|bridge|taste|assistant) · mood_text · energy_level ·
                 minutes_available · company · tier(1|2) · source_tmdb_id · target ·
                 recommended_tmdb_id · reason_text · accepted(bool) · created_at
```

RLS: users access only their own rows in `profiles`, `watchlist_items`, `ratings`, `ai_sessions`.
`movies_cache` is shared reference data, readable by any authenticated user.
**Favorites are derived** (`score >= 9`) — do not add a favorites column or table.

---

## Screens

| Screen | Mode | Purpose |
|---|---|---|
| Auth | — | Signup / login |
| Watchlist (home) | Decide | Poster grid, Want/Watched tabs, decay visible |
| Search / Discover | Discover | TMDB search, trending, language chips, filters |
| Movie Detail | Both | Metadata, trailer, cast, providers, mark watched, slider, share |
| Pick For Me | Decide | Mood input → transformation → single result card |
| Cinema Bridge | Discover | Cross-industry equivalents |
| Movie Assistant | Discover | Conversational discovery — chat, tool-assisted search, add to watchlist |
| Taste DNA | — | Animated stats, personality, Blind Spots |
| Settings | — | Themes, reduced motion, export, Coming Soon |

---

## AI architecture

**One Netlify Function, `/ai`**, routed by a `mode` parameter. One deploy, one env var, one debugging surface.

### `mode: pick` — Pick For Me
- **Input:** mood text (free), energy 1–5, minutes available, alone / with someone
- **Tier 1:** best match from the user's *unwatched* watchlist, reasoning over rating history and reason tags
- **Tier 2:** nothing fits → say so honestly (*"Nothing in your list suits right now. Here's what does."*), then TMDB Discover filtered by runtime/genre/rating, pick from the full catalogue, offer one-tap "Add to watchlist"
- **Cold start:** fewer than 3 ratings → runtime + genre heuristics, stated plainly (*"I don't know your taste yet — this fits your time and mood."*). **Never return nothing.**
- **Output:** one `tmdb_id` + one-line personal reason + two alternates hidden behind "Not this one"
- Log every call to `ai_sessions`

### `mode: bridge` — Cinema Bridge
- **Input:** source film + target industry/language
- **Process:** Claude proposes candidates → **every candidate is round-tripped through TMDB search and dropped if unmatched**
- ⚠️ **The validation gate is mandatory.** Claude will occasionally name films that don't exist or misattribute language. Without the gate this fails live.

### `mode: taste` — Taste DNA + Blind Spots
- Personality label, genre/decade/runtime breakdowns (Recharts), plus unexplored territory with 3 entry-point suggestions

### `mode: assistant` — AI Movie Assistant
- **Input:** the new message, plus recent conversation turns held client-side (no server-side chat storage — nothing persists across sessions)
- **Process:** multi-turn tool-use loop (`tool_choice: auto`, not the forced single-call pattern the other three modes use) — Claude can call `search_movies_by_title`, `discover_movies_by_criteria`, or `add_to_watchlist` as the conversation needs, capped at **3 tool calls per turn** as a guardrail, not a tight constraint. Every film discussed must come from a tool result — never invented from memory, same anti-hallucination principle as Cinema Bridge's validation gate, enforced here by never giving Claude a bare "name a movie" path at all.
- **Redirects, doesn't replicate:** a mood/energy/time/company request gets pointed at Pick For Me rather than reasoned through here (the assistant has no access to ratings/watchlist context Pick For Me uses); a cross-industry/language request gets pointed at Cinema Bridge rather than guessed at without its validation gate.
- ⚠️ **Usage cap: 30 messages per user per UTC calendar day**, checked against `ai_sessions` (`mode='assistant'`, same user, `created_at` within today) **before** calling Claude — a capped-out user must never trigger a paid call. Resets at UTC midnight. This protects real cost at scale now that the app is shared broadly, not just demoed.
- Log every call to `ai_sessions`

---

## Scope discipline

**Must:** auth · search · watchlist · mark watched · rating slider · movie detail · Pick For Me · Discover/Decide split · themes · regional-language discovery · trending.

**Should:** trailers · cast/director · filters · Surprise Me · Cinema Bridge · mood transformation · decay/Graveyard · Taste DNA + Blind Spots · why-chips · Web Share · reduced motion · AI Movie Assistant (30 messages/day cap).

**Could (cut in this order if hours slip):** watch providers → CSV export → reviews → Blind Spots.

**Parked — do not build. Surface on the Coming Soon page instead:**
TV shows & web series · public share links · social feed / following · Duo Match · PDF export.

If asked to add something outside this list, **flag it rather than building it.**

---

## Working style

- Prefer **one large well-specified change** over many small ones — we are rate-limited.
- After each block, run the must-have flow end to end and report if anything broke.
- Print RLS policies whenever you create or change them.
- Clear commit messages: `Add rating slider with colour interpolation`.
- Never commit secrets. `.env` stays gitignored; production env vars live in the Netlify dashboard.

---

## Attribution

Keep in the footer:
> This product uses the TMDB API but is not endorsed or certified by TMDB.
