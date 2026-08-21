# 🍿 POPCORN — FINAL MASTER PLAN
### Movie Watchlist App · Built with Claude Code · Vibe Coding Hackathon

> **Status:** Ideation complete. Ready to execute.
> **Stack:** Claude Code · Vite/React/TS · Supabase · TMDB · Claude via Netlify Functions · Netlify hosting · GitHub
> **Budget:** ~35 hours of the 36 available. Buffer is thin by design.

---

# PART I — PHASE 1: IDEATION
*(Workbook Steps 1–4 — verify, then paste into the workbook)*

## Step 1.1 — Product one-liner

**Product name:** Popcorn

**One-liner:**
> For **people who spend twenty minutes scrolling and then watch nothing**, I am building **a watchlist that decides for you** so they can **start a film they'll actually finish, in under thirty seconds.**

## Step 1.2 — Who this is for

- **Primary user:** 22–35 working professional or student, 3–5 streaming subscriptions
- **Context:** Decides in the evening while mentally depleted, 60–150 minute window, laptop or TV, sometimes with a partner
- **Top 3 pains:**
  1. The watchlist grew into a second overwhelming catalogue — saving is free, so they over-save aspirationally and choosing stays as hard as before
  2. No tool knows their **state** — energy, mood, available time
  3. Recommendations arrive as generic rows of posters, not as a decision

## Step 1.3 — MVP success

- **A user should be able to:** sign up, search and add movies, rate them on an animated 10-point slider, then use **Pick For Me** to get one AI-chosen film with a personal reason.
- **Success metric:** a new user goes from signup to a recommended film in under 3 minutes, unaided.

## Step 2 — 5 Whys

| # | Question | Answer |
|---|---|---|
| 1 | Why is this a problem? | They lose 15–20 minutes of limited free time and often watch nothing, or default to a rewatch |
| 2 | Why does that happen? | Their watchlist is a flat undifferentiated pile with no priority, and platforms answer overload with more options |
| 3 | Why haven't existing tools solved it? | Letterboxd is a social diary with a flat list and paywalled stats; Trakt solves logging; JustWatch answers "where," not "what" |
| 4 | Why is the user still stuck? | Every tool optimises for *storing* choices; none reduce them to one, and none account for mood, energy or time |
| 5 | Why now? | Catalogues keep growing and decision fatigue peaks in the evening — the gap widens yearly |

## Step 2.3 — Final problem statement

> **Busy viewers waste their evening deciding what to watch because their watchlist has become a second overwhelming catalogue, and no existing tool converts that pile into a single confident choice that fits their mood, energy and available time.**

*Reuse this exact line in the PRD, the deck and the demo.*

## Step 3 — Competitor scan

| Product | Pages checked | Does well | Frustrates users |
|---|---|---|---|
| Letterboxd | Watchlist, profile, Pro pricing | Beautiful film-first UI; strong review culture | Flat watchlist, no priority; stats paywalled |
| Trakt | Watchlist, scrobbling, VIP pricing | Automatic tracking; movies + TV together | Built for logging, not deciding; dated UI |
| JustWatch | Search, watchlist, streaming guide | Definitive "where can I stream this" | A search engine with tracking bolted on |

**📌 Action (10 min, Step 3.1):** screenshot Letterboxd's flat watchlist and Pro pricing page yourself. Primary research beats citing a competitor's blog.

### Research anchors — verified

| Claim | Source |
|---|---|
| ~110 hrs/yr, ~16 min/day deciding (n=2,000 US) | UserTesting / Talker Research |
| 10.5 min per session; 2.7M titles available | Nielsen Gracenote *State of Play* |
| 49% watched nothing after deciding too long (n=2,000 UK) | NOW survey, via Simplestream |
| Mood-driven media selection | **Mood Management Theory — Zillmann (1988)** |

**Careful wording for the cancellation stat:**
> "Industry research indicates roughly half of subscribers report content discovery has gotten harder, with cancellation risk linked to it (Nielsen 2025, via industry reporting)."

**Do not use** the "mood ranks first" statistic — no primary source exists. Cite the theory instead.

## Step 4.2 — MoSCoW

| Feature | M | S | C | W | ⭐ | Why |
|---|---|---|---|---|---|---|
| Email signup / login | ☑ | | | | | Multi-user requirement |
| **Search movies (TMDB)** | ☑ | | | | | **Core brief** |
| **Add / remove from personal watchlist** | ☑ | | | | | **Core brief** |
| Mark as watched | ☑ | | | | | Enables ratings |
| **Animated 10-point rating slider** | ☑ | | | | ⭐ | **Core brief**, differentiated execution |
| Movie detail view | ☑ | | | | | Needed to rate and decide |
| **Pick For Me** (two-tier AI triage) | ☑ | | | | ⭐ | Headline differentiator |
| Discover / Decide mode split | ☑ | | | | | Prevents "browse app with an AI button" |
| Themes (Nightcap/Daylight/Cinema) | ☑ | | | | | Built from prompt #1 or never |
| Regional-language discovery | ☑ | | | | ⭐ | High value for our audience |
| Trending / Now Playing | ☑ | | | | | Solves empty-state |
| Trailers | | ☑ | | | | Cheap polish, TMDB native |
| Cast / director | | ☑ | | | | Cheap metadata |
| Advanced filters | | ☑ | | | | Extends Discover |
| Surprise Me | | ☑ | | | | Trivial, fun |
| **Cinema Bridge** | | ☑ | | | ⭐ | Highest-surprise feature; demo beat 3 |
| Mood transformation UI | | ☑ | | | ⭐ | Visual wow |
| Watchlist decay / Graveyard | | ☑ | | | ⭐ | Demo beat 1 |
| Taste DNA + Blind Spots | | ☑ | | | ⭐ | Charts + motion showcase |
| Why-chips after rating | | ☑ | | | ⭐ | Cheap, multiplies AI quality |
| Web Share | | ☑ | | | | Sharing with friends |
| Reduced-motion toggle | | ☑ | | | | Accessibility + demo safety net |
| Favorites | | | ☑ | | | Derived from score ≥ 9 — no new state |
| Reviews | | | ☑ | | | One column on `ratings` |
| Watch providers | | | ☑ | | | Last-in, first-cut |
| CSV / JSON export | | | ☑ | | | 20 minutes |
| Coming Soon roadmap page | | | ☑ | | | Signals deliberate cuts |
| AI Movie Assistant | | | | ☑ | | Different product; most expensive; breaks live |
| TV shows & web series | | | | ☑ | | Deliberately parked |
| Public share links | | | | ☑ | | RLS risk not worth it |
| Social feed / following | | | | ☑ | | Scope trap |
| Duo Match | | | | ☑ | | Too risky to demo live |

## Step 4.3 — Final MVP scope

- **Must-have flow committed:** Sign up → search a movie → add to watchlist → mark watched → rate on the animated slider → **Pick For Me** → one AI-chosen film with a reason.
- **Should-haves:** Cinema Bridge · watchlist decay · mood transformation.
- **Parked, surfaced in-app:** AI Assistant · TV & web series · public share links · social feed · Duo Match · PDF export.

---

# PART II — PHASE 2: ARCHITECTURE
*(Workbook Steps 5–7)*

## The two-mode structure

Popcorn has **two explicit modes.** This is not cosmetic — without it, the product reads as another browse app with an AI button.

- **🔍 DISCOVER** — *fills* your watchlist. Search, trending, regional, filters, Cinema Bridge.
- **🎯 DECIDE** — *empties* it. Pick For Me, Surprise Me, the Graveyard.

## Screens

| Screen | Mode | Purpose |
|---|---|---|
| Auth | — | Signup / login |
| Watchlist (home) | Decide | Poster grid, Want/Watched tabs, decay visible |
| Search / Discover | Discover | TMDB search, trending, language chips, filters |
| Movie Detail | Both | Metadata, trailer, cast, providers, mark watched, slider, share |
| **Pick For Me** | Decide | Mood input → transformation → single result card |
| **Cinema Bridge** | Discover | Cross-industry equivalents |
| Taste DNA | — | Animated stats, personality, Blind Spots |
| Settings | — | Themes, reduced motion, export, **Coming Soon** |

## Data model (final)

```
profiles         id(uuid,fk auth.users) · display_name · theme_pref · reduced_motion · created_at
movies_cache     tmdb_id(pk) · title · poster_path · backdrop_path · release_year ·
                 runtime_minutes · genres(text[]) · overview · tmdb_rating ·
                 original_language · trailer_key · credits(jsonb)
watchlist_items  id · user_id · tmdb_id · status(want|watched|dropped) · added_at · watched_at
ratings          id · user_id · tmdb_id · score(int 1-10) · reason_tags(text[]) ·
                 review_text · created_at
ai_sessions      id · user_id · mode(pick|bridge|taste) · mood_text · energy_level ·
                 minutes_available · company · tier(1|2) · recommended_tmdb_id ·
                 reason_text · accepted(bool) · created_at
```

**No new tables versus the original design** — every addition is an extra column. Auth, RLS and the security model are unchanged.

- RLS on `profiles`, `watchlist_items`, `ratings`, `ai_sessions` — users touch only their own rows
- `movies_cache` — shared reference data, readable by any authenticated user
- Favorites are **derived** (`score ≥ 9`), not stored

## AI architecture

**One Netlify Function, `/ai`, routed by a `mode` parameter** — `pick` | `bridge` | `taste`. One deploy, one env var, one place to debug.

🔒 The Anthropic key lives in Netlify environment variables and never reaches the browser.

### `mode: pick` — Pick For Me
- **Input:** mood text, energy 1–5, minutes available, alone/with someone
- **Tier 1:** best match from the user's unwatched watchlist, reasoning over rating history + reason tags
- **Tier 2:** nothing fits → say so honestly, then TMDB Discover filtered by runtime/genre/rating, pick from the full catalogue, offer one-tap add
- **Cold start:** fewer than 3 ratings → heuristic match, stated plainly
- **Output:** one `tmdb_id`, a one-line personal reason, two hidden alternates
- Every call logged to `ai_sessions`

### `mode: bridge` — Cinema Bridge
- **Input:** a source film + a target industry/language
- **Process:** Claude proposes candidates → **each is round-tripped through TMDB search and dropped if unmatched**
- ⚠️ **The validation gate is mandatory.** Claude will occasionally name films that don't exist. Without this, it embarrasses you live.

### `mode: taste` — Taste DNA + Blind Spots
- Analyses ratings and reason tags → personality label, genre/decade/runtime breakdowns, and unexplored territory ("you've never rated a film in Japanese") with 3 entry points

## Step 7 deliverable

`CLAUDE.md` in the repo root — this replaces the "starting prompt" the workbook describes for GUI tools. It's read automatically before every task, so design system, scope limits and the slider spec stay enforced without re-explaining.

---

# PART III — EXECUTION

## Rate-limit reality

Claude Pro gives roughly **10–40 Claude Code prompts per rolling 5-hour session**, shared with claude.ai chat. Across 35 hours: **~6 sessions, ~150 prompts**.

The build is **15 large prompts**, not fifty small ones. That is deliberate.

- Batch aggressively — one prompt for five screens beats five prompts
- `/clear` between blocks
- Never run two Claude Code sessions at once
- Trivial CSS tweaks: edit the file yourself, costs nothing
- If you stall: upgrade to **Max 5x ($100)**, not Bolt

## Schedule

| Block | Hours | Prompts | Output |
|---|---|---|---|
| **A. Freeze + setup** | T+0 → T+2 | — | Accounts, repo, CLAUDE.md, Phase 1 done |
| **B. Architecture + schema** | T+2 → T+5 | 1–3 | Supabase live, RLS in place |
| **C. Core build + DEPLOY** | T+5 → T+15 | 4–9 | Must-have flow live on a public URL |
| **D. Sleep** | T+15 → T+21 | — | Non-negotiable. Also resets your window |
| **E. AI features** | T+21 → T+29 | 10–14 | Pick For Me, Cinema Bridge, decay, Taste DNA |
| **F. Test + secure + seed** | T+29 → T+32 | 15 | Bug log, RLS audit, demo data |
| **G. Demo + submit** | T+32 → T+35 | — | Loom, deck, submitted |

⚠️ **Deploy in Block C, not Block G.** First deploys always surface environment-variable problems. Find them at hour 15, not hour 34.

## Block A — setup (~45 min)

**Accounts, all free:** TMDB key · Supabase project (save URL, `anon`, `service_role`) · Anthropic Console key + credit · GitHub repo `aiap-<cohort>-<team>` (private) · Netlify connected to GitHub

```bash
node --version                          # need v18+
npm install -g @anthropic-ai/claude-code
claude                                  # log in with Claude Pro
```

Then `git init`, connect the remote, drop in `CLAUDE.md`.

## The 15 prompts

| # | Block | Prompt |
|---|---|---|
| 1 | B | Scaffold: Vite + React + TS + Tailwind + Framer Motion + Router. CSS variables, three themes, reduced-motion, Settings screen, Netlify config |
| 2 | B | Supabase client, signup/login/logout, protected routes, `profiles` on signup |
| 3 | B | Full schema + migrations + RLS. **Ask it to print every policy** |
| 4 | C | TMDB search, debounced, poster results, add to `movies_cache` + `watchlist_items`, attribution footer |
| 5 | C | Watchlist home (grid, Want/Watched, remove) + Movie Detail (backdrop, metadata, actions) |
| 6 | C | **The rating slider** — its own prompt. Full spec in CLAUDE.md |
| 7 | C | TMDB extras batch: regional-language chips, trailers, cast/director, trending/now-playing, advanced filters, Surprise Me, watch providers |
| 8 | C | Discover/Decide navigation split + loading states, empty states, errors, mobile, keyboard access |
| 9 | C | **Deploy.** Netlify build config, env vars, push, connect, live URL |
| 10 | E | `/ai` function, `mode: pick` — two-tier + cold start + `ai_sessions` logging |
| 11 | E | Pick For Me UI + real-time mood transformation |
| 12 | E | Cinema Bridge + **TMDB validation gate** |
| 13 | E | Decay / Graveyard + "Rescue or bury?" |
| 14 | E | Taste DNA + Blind Spots + Web Share + favorites + reviews + CSV export + Coming Soon page |
| 15 | F | Security audit, fixes, seed data |

### ✅ Block C exit criteria
Must-have flow runs **on the public URL**: sign up → search → add → mark watched → rate. Twice in a row. No console errors. **Do not sleep until this passes.**

---

# PART IV — PHASE 3: TESTING & DEMO
*(Workbook Steps 9–12)*

## 🔒 Security audit — do not skip

Ask Claude Code:
> "Audit every RLS policy in this project. For each table, confirm a logged-in user cannot read or write another user's rows. Show me the policies and any gaps."

Then **test it manually**: two accounts, confirm B cannot see A's watchlist.

## Seed the demo account

⚠️ **Back-date `added_at`** or decay is invisible on stage. Seed ~40 movies with varied dates and 8–10 ratings so Pick For Me has real signal.

## Scenario test (Step 11.1)

> A user signs up, searches "Everything Everywhere All At Once", adds it, marks it watched, rates it 9, then opens Pick For Me saying "brutal day, 90 minutes, alone" and receives one recommendation.

Run end-to-end **twice**. Log every issue in the workbook's bug table.

## QA

All three themes · reduced-motion toggle · **test over a real Google Meet screen share on the presenting machine** — compression behaves differently from local playback.

## Demo script (3 minutes)

| Time | Beat |
|---|---|
| 0:00–0:25 | **Problem.** ~16 minutes a day deciding. Nearly half have taken so long they watched nothing. The watchlist was the fix; it became the problem. |
| 0:25–0:50 | **Beat 1 — The Graveyard.** Seeded account, faded decaying posters. "40 films. Nothing watched." |
| 0:50–1:25 | **Core flow.** Search, add, mark watched, **drag the slider slowly from 2 to 10.** Let it breathe. |
| 1:25–2:15 | **Beat 2 — Pick For Me.** "Brutal day, 90 minutes, alone." App transforms. One card. Read the reason aloud. Show Tier-2 on an empty-match case. |
| 2:15–2:45 | **Beat 3 — Cinema Bridge.** "Show me the Malayalam equivalent of Se7en." |
| 2:45–3:00 | **Close.** Flash Taste DNA and the Coming Soon page. "Next: TV and web series, a conversational assistant. Today: a 40-film graveyard becomes one confident choice in 30 seconds." |

**📌 Record the Loom before the live demo.** It is your insurance policy.

## Submission checklist
- [ ] Live product URL (Netlify)
- [ ] 2–3 minute Loom
- [ ] Pitch deck (provided template)
- [ ] Team details
- [ ] Submitted **via the portal only** — WhatsApp/email submissions are invalid

---

# PART V — GITHUB & RISK

## Workflow
- `main` always deployable. Netlify auto-deploys from it.
- Feature work on `feature/*`, merged via PR. Branch protection: 1 approving review.
- **Build Owner** runs Claude Code · **Integration Owner** reviews PRs · **Fix Contributor** takes `feature/*`
- Solo? Same structure, self-approve. Real history, real story.

⚠️ Never run two Claude Code sessions against the same repo simultaneously.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Claude Pro rate limits** | **High** | Batched prompts, `/clear`, sleep doubles as reset. Escape: Max 5x |
| **Buffer is gone** | **High** | Cut order: watch providers → CSV → reviews → Blind Spots. Cinema Bridge and Group 1 protected |
| Cinema Bridge hallucinates films | Medium | TMDB validation gate, mandatory |
| RLS misconfigured → data leak | Medium | Explicit audit + two-account test |
| Deploy breaks on env vars | Medium | Deploy in Block C |
| Cold-start empty recommendation | Medium | Tier-2 + heuristic + seeded account |
| Slider animation eats hours | Medium | 3 attempts, then ship the plain working version |
| Zoom compression flattens motion | Medium | No grain, no fine particles. Test over a real share |
| Live demo dies | Low | Loom recorded first |
| Scope creep | High | MoSCoW is a contract. Parked means parked |

---

## Open items
- [ ] Team composition and role assignment
- [ ] Logo: single popcorn kernel, mid-pop, in `--accent-warm` on `--bg`
