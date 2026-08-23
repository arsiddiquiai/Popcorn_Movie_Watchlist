/**
 * Seeds realistic demo data for ONE designated demo account.
 *
 *   node --env-file=.env scripts/seed-demo.mjs --email <addr> --password <pw>            # DRY RUN
 *   node --env-file=.env scripts/seed-demo.mjs --email <addr> --password <pw> --commit   # writes
 *   ... --commit --reset    # also clears that account's existing watchlist/ratings first
 *
 * Safety properties:
 *  - Signs in as the demo account and writes through the anon key, so every
 *    statement runs under that user's own RLS policies. It is structurally
 *    incapable of touching another user's rows.
 *  - Dry run performs TMDB reads only and writes nothing.
 *  - movies_cache is shared reference data: rows are upserted from real TMDB
 *    responses only, never invented.
 */
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1] }
const COMMIT = argv.includes('--commit')
const RESET = argv.includes('--reset')
const EMAIL = arg('--email')
const PASSWORD = arg('--password')

if (!EMAIL || !PASSWORD) {
  console.error('Refusing to run: --email and --password are required so the target account is explicit.')
  process.exit(1)
}

const TMDB = process.env.VITE_TMDB_API_KEY
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

// score/tags only apply to `watched`. daysAgo drives added_at (and therefore decay).
const PLAN = [
  // ---- watched + rated: deliberate 1-10 spread, mixed reason_tags ----
  { id: 496243, want: 'Parasite',                      status: 'watched', daysAgo: 200, score: 10, tags: ['Story', 'Mood'] },
  { id: 273481, want: 'Sicario',                       status: 'watched', daysAgo: 180, score: 9,  tags: ['Mood', 'Pacing'] },
  { id: 575351, want: 'Kumbalangi Nights',             status: 'watched', daysAgo: 165, score: 9,  tags: ['Story', 'Performance'] },
  { id: 598,    want: 'City of God',                   status: 'watched', daysAgo: 150, score: 9,  tags: ['Story', 'Pacing'] },
  { id: 129,    want: 'Spirited Away',                 status: 'watched', daysAgo: 140, score: 8,  tags: ['Visuals', 'Mood'] },
  { id: 244786, want: 'Whiplash',                      status: 'watched', daysAgo: 130, score: 8,  tags: ['Performance', 'Pacing'] },
  { id: 20453,  want: '3 Idiots',                      status: 'watched', daysAgo: 120, score: 7,  tags: ['Story'] },
  { id: 194,    want: 'Amélie',                        status: 'watched', daysAgo: 110, score: 7,  tags: ['Visuals', 'Mood'] },
  { id: 335984, want: 'Blade Runner 2049',             status: 'watched', daysAgo: 100, score: 6,  tags: ['Visuals'] },
  { id: 396535, want: 'Train to Busan',                status: 'watched', daysAgo: 90,  score: 6,  tags: ['Pacing'] },
  { id: 438631, want: 'Dune',                          status: 'watched', daysAgo: 80,  score: 5,  tags: ['Visuals'] },
  { id: 637,    want: 'Life Is Beautiful',             status: 'watched', daysAgo: 70,  score: 4,  tags: ['Story'] },
  { id: 104,    want: 'Run Lola Run',                  status: 'watched', daysAgo: 60,  score: 3,  tags: ['Pacing'] },
  { id: 146,    want: 'Crouching Tiger, Hidden Dragon',status: 'watched', daysAgo: 50,  score: 2,  tags: ['Pacing'] },
  { id: 17473,  want: 'The Room',                      status: 'watched', daysAgo: 40,  score: 1,  tags: ['Story', 'Performance'] },

  // ---- want, FRESH (decay 0) ----
  { id: 545611, want: 'Everything Everywhere All at Once', status: 'want', daysAgo: 1 },
  { id: 872585, want: 'Oppenheimer',                   status: 'want', daysAgo: 2 },
  { id: 666277, want: 'Past Lives',                    status: 'want', daysAgo: 3 },
  { id: 508883, want: 'The Boy and the Heron',         status: 'want', daysAgo: 4 },
  { id: 940721, want: 'Godzilla Minus One',            status: 'want', daysAgo: 5 },
  { id: 915935, want: 'Anatomy of a Fall',             status: 'want', daysAgo: 6 },

  // ---- want, ~20 days (decay ~0.24-0.46) ----
  { id: 706872, want: 'Drishyam 2',                    status: 'want', daysAgo: 18 },
  { id: 534780, want: 'Andhadhun',                     status: 'want', daysAgo: 20 },
  { id: 290098, want: 'The Handmaiden',                status: 'want', daysAgo: 22 },
  { id: 11423,  want: 'Memories of Murder',            status: 'want', daysAgo: 25 },
  { id: 743563, want: 'Vikram',                        status: 'want', daysAgo: 28 },

  // ---- want, 30-60 days (decay 0.5-1.0) ----
  { id: 117691, want: 'Gangs of Wasseypur',            status: 'want', daysAgo: 38 },
  { id: 432011, want: 'Super Deluxe',                  status: 'want', daysAgo: 42 },
  { id: 60243,  want: 'A Separation',                  status: 'want', daysAgo: 48 },
  { id: 843,    want: 'In the Mood for Love',          status: 'want', daysAgo: 52 },
  { id: 1417,   want: "Pan's Labyrinth",               status: 'want', daysAgo: 56 },

  // ---- want, 60+ days (decay 1.0 -> rescue-or-bury prompt) ----
  { id: 564704, want: 'Jallikattu',                    status: 'want', daysAgo: 75 },
  { id: 19666,  want: 'Lagaan',                        status: 'want', daysAgo: 95 },
  { id: 346,    want: 'Seven Samurai',                 status: 'want', daysAgo: 120 },
  { id: 11216,  want: 'Cinema Paradiso',               status: 'want', daysAgo: 150 },
  { id: 490,    want: 'The Seventh Seal',              status: 'want', daysAgo: 180 },
  { id: 387,    want: 'Das Boot',                      status: 'want', daysAgo: 210 },
  { id: 406,    want: 'La Haine',                      status: 'want', daysAgo: 240 },

  // ---- dropped ----
  { id: 577922, want: 'Tenet',                         status: 'dropped', daysAgo: 300 },
  { id: 10196,  want: 'The Last Airbender',            status: 'dropped', daysAgo: 320 },
]

function decayLevel(days) {
  if (days <= 7) return 0
  if (days <= 30) return ((days - 7) / 23) * 0.5
  if (days <= 60) return 0.5 + ((days - 30) / 30) * 0.5
  return 1
}
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

console.log(`mode: ${COMMIT ? (RESET ? 'COMMIT + RESET' : 'COMMIT (additive)') : 'DRY RUN (no writes)'}`)
console.log(`target account: ${EMAIL}\n`)

const { data: s, error: authErr } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authErr) { console.error('sign-in failed:', authErr.message); process.exit(1) }
const ME = s.session.user.id
console.log(`signed in as user_id ${ME}`)

const before = {
  watchlist: (await db.from('watchlist_items').select('id', { count: 'exact', head: true }).eq('user_id', ME)).count,
  ratings: (await db.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', ME)).count,
}
console.log(`existing on this account -> watchlist_items: ${before.watchlist}, ratings: ${before.ratings}\n`)

console.log('resolving every tmdb_id against TMDB (verifying the id is the film intended)...')
const resolved = []
let mismatches = 0
// TMDB intermittently resets connections — same failure tmdbGetJson() retries
// for in api/ai.ts. Retry a few times with a short backoff rather than dying.
async function tmdbGet(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      if (res.status === 404) return res
    } catch { /* connection reset - retry */ }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }
  return null
}

for (const row of PLAN) {
  const res = await tmdbGet(`https://api.themoviedb.org/3/movie/${row.id}?api_key=${TMDB}&append_to_response=videos`)
  if (!res || !res.ok) { console.log(`  ** ${row.id} ${row.want}: NOT FOUND ON TMDB (${res ? res.status : 'network'}) **`); mismatches++; continue }
  const d = await res.json()
  const norm = (t) => t.normalize('NFD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const ok = norm(d.title).includes(norm(row.want)) || norm(row.want).includes(norm(d.title)) ||
             norm(d.original_title ?? '').includes(norm(row.want))
  if (!ok) { console.log(`  ** MISMATCH id=${row.id}: expected "${row.want}", TMDB says "${d.title}" **`); mismatches++ }
  resolved.push({ ...row, d })
}
console.log(`resolved ${resolved.length}/${PLAN.length}, ${mismatches} mismatch(es)\n`)

const langs = {}
for (const r of resolved) langs[r.d.original_language] = (langs[r.d.original_language] ?? 0) + 1
console.log('language spread:', JSON.stringify(langs))
const buckets = { 'fresh (0)': 0, 'light (0-0.5)': 0, 'heavy (0.5-1)': 0, 'graveyard (1.0)': 0 }
for (const r of resolved.filter((x) => x.status === 'want')) {
  const l = decayLevel(r.daysAgo)
  if (l === 0) buckets['fresh (0)']++
  else if (l < 0.5) buckets['light (0-0.5)']++
  else if (l < 1) buckets['heavy (0.5-1)']++
  else buckets['graveyard (1.0)']++
}
console.log('want-tab decay buckets:', JSON.stringify(buckets))
const scores = resolved.filter((r) => r.score).map((r) => r.score).sort((a, b) => a - b)
console.log(`ratings: ${scores.length} scores -> [${scores.join(', ')}]`)
console.log(`statuses: want=${resolved.filter(r=>r.status==='want').length} watched=${resolved.filter(r=>r.status==='watched').length} dropped=${resolved.filter(r=>r.status==='dropped').length}`)

if (mismatches > 0) {
  console.log('\nRefusing to write while any id is unverified. Fix the PLAN entries above first.')
  process.exit(1)
}

if (!COMMIT) {
  console.log('\nDRY RUN complete — nothing was written. Re-run with --commit to apply.')
  await db.auth.signOut()
  process.exit(0)
}

if (RESET) {
  console.log('\n--reset: clearing this account\'s ratings and watchlist_items (its own rows only)')
  const r1 = await db.from('ratings').delete({ count: 'exact' }).eq('user_id', ME)
  const r2 = await db.from('watchlist_items').delete({ count: 'exact' }).eq('user_id', ME)
  console.log(`  deleted ratings=${r1.count} watchlist_items=${r2.count}`)
}

console.log('\nupserting movies_cache from real TMDB payloads...')
const cacheRows = resolved.map(({ d }) => {
  const tr = (d.videos?.results ?? []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer')
  return {
    tmdb_id: d.id,
    title: d.title,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    release_year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    runtime_minutes: d.runtime,
    genres: (d.genres ?? []).map((g) => g.name),
    overview: d.overview,
    tmdb_rating: d.vote_average,
    original_language: d.original_language,
    trailer_key: (tr.find((v) => v.official) ?? tr[0])?.key ?? null,
    credits: null,
  }
})
const { error: cacheErr } = await db.from('movies_cache').upsert(cacheRows)
if (cacheErr) { console.error('movies_cache upsert failed:', cacheErr.message); process.exit(1) }
console.log(`  ${cacheRows.length} rows upserted`)

console.log('upserting watchlist_items...')
const items = resolved.map((r) => ({
  user_id: ME,
  tmdb_id: r.id,
  status: r.status,
  added_at: iso(r.daysAgo),
  watched_at: r.status === 'watched' ? iso(Math.max(0, r.daysAgo - 5)) : null,
}))
const { error: wErr } = await db.from('watchlist_items').upsert(items, { onConflict: 'user_id,tmdb_id' })
if (wErr) { console.error('watchlist_items upsert failed:', wErr.message); process.exit(1) }
console.log(`  ${items.length} rows upserted`)

console.log('upserting ratings...')
const ratings = resolved.filter((r) => r.score).map((r) => ({
  user_id: ME,
  tmdb_id: r.id,
  score: r.score,
  reason_tags: r.tags,
  created_at: iso(Math.max(0, r.daysAgo - 5)),
}))
const { error: rErr } = await db.from('ratings').upsert(ratings, { onConflict: 'user_id,tmdb_id' })
if (rErr) { console.error('ratings upsert failed:', rErr.message); process.exit(1) }
console.log(`  ${ratings.length} rows upserted`)

const after = {
  watchlist: (await db.from('watchlist_items').select('id', { count: 'exact', head: true }).eq('user_id', ME)).count,
  ratings: (await db.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', ME)).count,
}
console.log(`\nfinal -> watchlist_items: ${after.watchlist}, ratings: ${after.ratings}`)
await db.auth.signOut()
console.log('done')
