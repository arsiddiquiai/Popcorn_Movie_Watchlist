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
feedback         id · user_id(nullable) · message · contact_email(nullable) · created_at
user_api_keys    id · user_id · provider(anthropic|openai|gemini) · encrypted_key · model_pref · created_at
share_links      token(pk, opaque) · user_id · created_at
tv_cache         tmdb_id(pk) · name · poster_path · backdrop_path · first_air_year ·
                 episode_run_minutes · genres(text[]) · overview · tmdb_rating ·
                 original_language · trailer_key · credits(jsonb)
tv_watchlist_items  id · user_id · tmdb_id · status(want|watched|dropped) · added_at · watched_at
tv_ratings       id · user_id · tmdb_id · score(int 1-10) · reason_tags(text[]) ·
                 review_text · created_at
```

RLS: users access only their own rows in `profiles`, `watchlist_items`, `ratings`, `ai_sessions`, `feedback`, `user_api_keys`, `share_links`, `tv_watchlist_items`, `tv_ratings`.
`movies_cache` is shared reference data, readable by any authenticated user; writable (insert-only) by any
authenticated user, bounded by shape CHECK constraints — no client can update or delete an existing row.
**Favorites are derived** (`score >= 9`) — do not add a favorites column or table.

`feedback` is write-only (insert only) from the client — no select policy for authenticated. On account deletion,
`user_id` is set to null (`on delete set null`) rather than the row being removed, so product feedback isn't lost.

`user_api_keys` is write-mostly: insert/delete under normal RLS, plus a narrow select policy scoped to
`id/provider/model_pref/created_at` only (for the Settings "key saved" indicator) — `encrypted_key` is not a
granted column for `authenticated` at all, at the Postgres column-privilege level, so no client query can ever
return it, including the row's own owner. Only the server, via the service-role key, reads and decrypts it, at the
moment a request actually needs it. On account deletion this table cascades (`on delete cascade`).

`share_links` maps an opaque token to a `user_id` — nothing else. It has normal owner-scoped RLS
(select/insert/delete) for the authenticated user who created it, but the public `/w/{token}` page never queries it
through that RLS at all: `api/share.ts`'s GET handler reads it (and the sharer's `watchlist_items`/`movies_cache`
rows, and their display name via `auth.admin.getUserById`) through the service-role client, since an anonymous
visitor has no session for any RLS policy to key off. `anon` has no grants on this table whatsoever. On account
deletion this table cascades (`on delete cascade`) — see Public share links below for the full design.

`tv_cache`/`tv_watchlist_items`/`tv_ratings` are fully parallel to `movies_cache`/`watchlist_items`/`ratings` —
same shapes, same RLS shapes — rather than a shared schema with a media-type column. See TV shows below for why.

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
| Settings | — | Themes, reduced motion, export, BYOK provider key, danger-zone account deletion |
| Feedback | — | Free-text form → `feedback` table + email notification |
| Privacy / Terms | — | Static legal pages, footer-linked |
| Account Deleted | — | Post-deletion confirmation, outside auth entirely |
| Public Share (`/w/{token}`) | — | No login required — a visitor's view of someone else's live want-list, with a signup CTA |
| My TV List (`/tv`) | Both | v1 TV/anime home — search, watchlist, rating. Reached from the You tab, no TabBar slot |
| TV Detail (`/tv/{tmdbId}`) | Both | Standalone from Movie Detail — metadata, trailer, cast, mark watched, rating slider (reused from Movie Detail) |

---

## AI architecture

**One serverless function, `/ai`** (Vercel `api/ai.ts`, primary; `netlify/functions/ai.ts` kept as a fallback),
routed by a `mode` parameter. One deploy, one env var, one debugging surface.

**Bring Your Own Key (BYOK), multi-provider.** `pick`/`bridge`/`taste` route their single forced-tool-call through
`server/providers/` — a provider-neutral adapter interface (`server/providers/types.ts`) with implementations for
Anthropic, OpenAI, and Gemini. Before each of those calls, `server/byok.ts` checks for a saved personal key
(`user_api_keys`, decrypted server-side via the service-role key); if present, that provider/key is tried first. On
ANY failure — bad key, rate limit, provider outage — the request falls back to the shared Anthropic key
automatically and returns a `byok_notice` string the UI can surface; the request itself never fails because of a
bad personal key. `mode: assistant` is **out of scope** for this — its `tool_choice: "auto"` multi-turn loop doesn't
map onto the same one-forced-tool-call interface, so it stays on the shared Anthropic key only.

Keys are encrypted at rest with AES-256-GCM (`server/crypto.ts`, `BYOK_ENCRYPTION_KEY` server secret, no database
counterpart) and are never readable by the client once saved — see the Data model section above.

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

## Account deletion

`api/delete-account.ts` — a real server-side operation using the Supabase service-role key
(`SUPABASE_SERVICE_ROLE_KEY`, server-only), since deleting `auth.users` is only possible through the admin API; no
RLS policy can grant a user that.

Deletes `ratings` → `watchlist_items` → `ai_sessions` → `user_api_keys` explicitly and in order (each checked
before proceeding), anonymizes `feedback` (`user_id` and `contact_email` both → null — a real bug caught by testing
live: clearing only `user_id` left a directly-identifying personal email address readable in the table), deletes
`profiles`, and deletes the `auth.users` row
**last**, only once every prior step has succeeded. `movies_cache` is never touched (shared reference data, not
user-owned). Every user-owned table also carries `on delete cascade` (or, for `feedback`, `on delete set null`) as
a backstop — the explicit ordered deletes are the primary path; the cascade is what catches anything a manual step
might miss, not the other way around. See that file's own header comment for the full failure-mode reasoning.

On success the client calls `supabase.auth.signOut()` and redirects to `/account-deleted` (outside `ProtectedLayout`
— by then there's no session left to guard) via Settings → Danger zone, which requires typing `DELETE` to confirm.

---

## Public share links

`/w/{token}` — no login required, deliberately outside `ProtectedLayout` and `AuthGate`, same reasoning as
`/reset-password` and `/account-deleted`: there's no session to guard, and for an anonymous visitor there never was
one.

**Live, not a snapshot.** The public page always reflects the sharer's *current* `status='want'` list, read fresh
on every view — chosen over capturing a frozen list of `tmdb_id`s at share time because it needs nothing extra
stored (`share_links` only maps token → `user_id`) and reuses the exact same watchlist query shape the rest of the
app already has. The trade-off: the linked page can drift from a watchlist-card image generated earlier from the
same account, since that image's own poster selection (top-rated, falling back to want) is a different, unchanged
selection rule — a recipient who taps through may see a different set than the picture showed.

**Token:** `crypto.randomBytes(18)`, base64url-encoded — opaque, unguessable, never sequential or derived from the
row id or a timestamp. Generated server-side (`api/share.ts`'s POST, authenticated); one token per user, reused on
every subsequent share rather than proliferating new links.

**What the public GET ever returns:** a display name (from auth's own `user_metadata.display_name`, the same field
set at signup — never a possibly-unsynced `profiles` column, and never the account's email) or `null` (the client
renders "Someone"), plus the want-list's `tmdb_id`/`title`/`poster_path`/`release_year`. Nothing else — no `user_id`,
no ratings, no watched list, no other `profiles` column. An unknown/invalid token returns a 404 with a friendly
`{error, code: 'not_found'}` shape, rendered as a plain "this link isn't around any more" state, never a raw error
page.

**Signup-triggered import.** Visiting `/w/{token}` and clicking "Sign up to save this list" stores the token in
`sessionStorage` (survives navigating around before completing signup; cleared on tab close). `AuthProvider`'s
`onAuthStateChange` listener imports every film on `SIGNED_IN` by calling the existing `addToWatchlist()` per
`tmdb_id` — which already treats an existing want/watched row as "leave it alone" and revives a previously-dropped
one, so "don't duplicate or overwrite existing rows" needs no separate logic. Best-effort: one film failing to
import doesn't roll back the rest. Safe to fire on every `SIGNED_IN` event (including an ordinary session restore
for a returning user) since it's a no-op whenever there's no pending token.

---

## TV shows, web series & anime

v1 scope, agreed before building: search + watchlist + rating only, whole-series granularity (no per-episode
tracking). Pick For Me, Cinema Bridge, and Taste DNA stay movies-only for now — added later if this lands well.

**Fully parallel tables, not a shared schema.** `watchlist_items.tmdb_id` and `ratings.tmdb_id` both carry a real
foreign key to `movies_cache(tmdb_id)` — a live constraint on tables already holding real users' data. TMDB's movie
and TV id spaces are separate and can collide numerically, so making those existing columns TV-aware would mean
altering or dropping that FK (Postgres can't express "references table A OR table B" in one constraint) — a real
change to tables the live app depends on every day. `tv_cache`/`tv_watchlist_items`/`tv_ratings` mirror their movie
equivalents exactly instead: same shapes, same RLS shapes, zero `ALTER` statements against anything that already
existed. The cost is some duplicated schema and application code (`lib/tvWatchlist.ts`, `lib/tvRatings.ts`,
`TvDetail.tsx`, `TvWatchlist.tsx` alongside their movie equivalents) — judged worth it for a feature this size to
carry zero risk to the movie tables real users already depend on.

**`RatingPanel` is shared, not duplicated** — it gained three optional injectable persistence props
(`saveScoreFn`/`saveReasonTagsFn`/`saveReviewTextFn`, defaulting to `lib/ratings`' movie functions) rather than a
`TvRatingPanel` fork, since `TvRating` is structurally identical to `Rating` (same columns) and the change is
purely additive — every existing call site keeps its exact behaviour with zero changes. `TvDetail.tsx` passes
`lib/tvRatings`' equivalents instead. `ReviewNote` got the same treatment (`onSave`, defaulting to
`saveReviewText`).

**`TvDetail`/`TvWatchlist` are standalone routes, not generalized from `MovieDetail`/`Watchlist`.** Those two are
exercised by every current user every day; a bug introduced while generalizing them for TV would put that at risk
for a brand-new, low-traffic screen that doesn't need to share their code to work. Deliberately simpler for v1: no
`ReactivePoster` reuse (plain poster header instead), no shared-element `layoutId` transition into the detail
screen, no swipe gestures or long-press action sheet on the watchlist grid. `posterLayoutId()` (`lib/sharedElement.ts`)
did gain an optional `mediaType` parameter (default `'movie'`, so every existing call site is unaffected) against
the day a TV search card wants the transition too — not yet wired up anywhere.

**Entry point:** a "My TV List" link on the You tab, not a `TabBar` slot (fixed at 5 items by design) and not a
Movies/TV toggle on `Search.tsx` (too much interacting effect logic there — debounce, browse-mode, Discover
filters — to risk changing for a first cut of TV support). `/tv` carries its own lightweight search box
(`searchTvShows`) alongside the Want/Watched grid, so TV discovery and TV watchlist management live in one place
for v1 rather than needing a second route.

---

## Feedback & operational email

`api/feedback.ts` inserts into `feedback` and sends a notification via `server/email.ts` (Resend,
`RESEND_API_KEY` / `MY_NOTIFICATION_EMAIL`, server-only) inline in the same request — a saved-but-unnotified
submission is still a success for the user. `api/ai.ts` alerts the same way on a genuine unexpected fault (an
Anthropic `APIError` or an unhandled throw — **not** a 429/504, which are operational noise), throttled to one
alert per error shape per hour. That throttle is per warm serverless instance, not global — documented as a known
limitation in `server/email.ts` rather than assumed away.

---

## Scope discipline

**Must:** auth · search · watchlist · mark watched · rating slider · movie detail · Pick For Me · Discover/Decide split · themes · regional-language discovery · trending.

**Should:** trailers · cast/director · filters · Surprise Me · Cinema Bridge · mood transformation · decay/Graveyard · Taste DNA + Blind Spots · why-chips · Web Share · reduced motion · AI Movie Assistant (30 messages/day cap) · public share links (`/w/{token}`, live want-list, opaque server-generated token — see `share_links` migration and `api/share.ts`; moved off Parked when explicitly requested, not built speculatively) · TV shows/web series/anime (`/tv`, `/tv/{tmdbId}`, fully parallel `tv_*` tables — see TV shows above; v1 scope is search/watchlist/rating only, moved off Parked as part of the post-launch roadmap agreed with the project owner).

**Could (cut in this order if hours slip):** watch providers → CSV export → reviews → Blind Spots.

**Parked — do not build. Surface on the Coming Soon page instead:**
social feed / following · Duo Match · PDF export.

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
