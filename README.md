# 🍿 Popcorn

A movie watchlist that decides what you should watch — search, save, and rate films, then let **Pick For Me** turn an overwhelming list into one confident choice.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Tech stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS v4, Framer Motion, React Router v6
- **Backend:** Supabase (Postgres, auth, Row Level Security)
- **AI:** Anthropic API (Claude), called only from a server-side Netlify Function — the key never reaches the browser
- **Data:** TMDB API
- **Hosting:** Netlify (static site + serverless function)

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/arsiddiquiai/Popcorn_Movie_Watchlist.git
cd Popcorn_Movie_Watchlist
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Where it's used | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser (Supabase client) | Yes |
| `VITE_SUPABASE_ANON_KEY` | Browser (Supabase client) | Yes |
| `VITE_TMDB_API_KEY` | Browser (TMDB search/discover) | Yes |
| `VITE_APP_URL` | Browser (auth email redirect links) | Only if the deployed URL differs from the browser's origin |
| `ANTHROPIC_API_KEY` | Netlify Function only — server-side, never exposed to the client | Yes, to run `netlify dev` locally |

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `TMDB_API_KEY` (unprefixed) are also read by the Netlify Function but fall back to the `VITE_`-prefixed values above, so they don't normally need setting separately.

You'll also need a Supabase project with the schema in `supabase/migrations/` applied (`supabase db push`, or run each migration in the SQL editor in order).

### 3. Run the dev server

```bash
npm run dev
```

This serves the frontend only. The `/ai` endpoint (Pick For Me, Cinema Bridge) is a Netlify Function and won't resolve under plain `npm run dev` — to exercise it locally, use the Netlify CLI instead:

```bash
npx netlify dev
```

### 4. Build

```bash
npm run build
```
