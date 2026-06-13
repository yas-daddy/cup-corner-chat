# Karim — the AI roast bot

A built-in AI "player" called **Karim** (🤖 avatar) does two things:

1. **Roasts losers.** Whenever a match finishes and a player gets **0 points** on their pick, Karim posts a short, savage comment on that player's prediction thread.
2. **Daily wrap.** Every day at **09:00 UTC**, Karim publishes a single feed post recapping the previous 24h: who scored the most, top movers, current leaderboard top-3, and a one-liner about the day.

Karim is rendered exactly like a normal player but with a permanent **"AI" pill** next to the name everywhere their avatar appears (feed cards, comments). The avatar slot shows the 🤖 emoji.

## Behavior rules

- **Tone:** ~1–2 sentences, blunt, funny, roasty. No emojis other than the avatar. No insults about people, only about the pick.
- **Language:** matches the actor's last-used locale isn't tracked, so Karim posts in **English** for v1.
- **Roast trigger:** fires only on `feed_activities.kind = 'points_awarded'` with `points = 0`. Idempotent — one roast per (player, match).
- **Daily wrap:** one post per UTC day. If a day has zero finished matches and zero new picks, Karim skips it.
- Karim never roasts itself, never comments on its own posts, and is excluded from the leaderboard.

## Identity & UI

- Seed one row in `players` with a fixed UUID and `display_name = 'Karim'`, `avatar = '🤖'`. Constant `KARIM_ID` exported from `src/lib/bot.ts`.
- New small `<AiTag />` component (rounded "AI" pill). Shown in:
  - `FeedCard` header when `actor.id === KARIM_ID`
  - `CommentThread` + `MatchDiscussionThread` comment rows when `comment.player_id === KARIM_ID`
- `FeedCard` gets a new branch for `kind = 'daily_summary'`: no match block, just Karim's text body inside the card.
- Leaderboard query filters out `KARIM_ID`.

## Data model

Add to `public.feed_activities`:
- `body text` — used only by `daily_summary` posts (null for others)
- extend the kind check constraint to allow `'daily_summary'`

No new tables for the roast trigger guard — uniqueness is enforced by adding a partial unique index on `comments(target_type, target_id, player_id) WHERE player_id = KARIM_ID`, so a second roast attempt is a no-op.

## Server pieces

All AI calls go through Lovable AI Gateway (`google/gemini-3-flash-preview`) from server-only TanStack code.

1. **`src/lib/karim.server.ts`** — provider helper + two functions:
   - `roastPrediction({ playerName, homeTeam, awayTeam, predHome, predAway, finalHome, finalAway })` → short string
   - `writeDailySummary({ topScorers, topMovers, leaderboardTop3, finishedMatches, newPicks })` → short string
2. **`src/routes/api/public/karim-roast.ts`** (POST) — called by a Postgres trigger via `pg_net` whenever a new `feed_activities` row lands with `kind='points_awarded' AND points=0`. Validates `apikey` header against the anon key, generates the roast, inserts into `comments` as Karim (admin client) using `target_type='prediction'`, `target_id = playerId::matchId`. Idempotent thanks to the partial unique index.
3. **`src/routes/api/public/karim-daily.ts`** (POST) — called by `pg_cron` at `0 9 * * *`. Aggregates the previous UTC day's `feed_activities` + `prediction_points` + leaderboard top 3, generates the summary, inserts one `feed_activities` row with `kind='daily_summary'`, `actor_id=KARIM_ID`, `match_id=''` (sentinel — see below), `body=<summary>`.

Both endpoints live under `/api/public/*` so they bypass auth at the edge; both still verify the `apikey` header matches the project's anon/publishable key before doing any work.

### `match_id` for daily summaries

`feed_activities.match_id` is currently `text NOT NULL`. We'll relax it to nullable in the same migration so `daily_summary` rows don't need a fake match.

## Database migration

- `ALTER TABLE feed_activities ALTER COLUMN match_id DROP NOT NULL`
- Drop and recreate the `kind` check constraint to include `'daily_summary'`
- `ALTER TABLE feed_activities ADD COLUMN body text`
- Partial unique index on comments for Karim roasts (described above)
- Insert Karim's `players` row (fixed UUID)
- Trigger `notify_karim_on_zero_points`: AFTER INSERT on `feed_activities` WHEN `NEW.kind='points_awarded' AND NEW.points=0` → `pg_net.http_post` to `/api/public/karim-roast`
- `cron.schedule('karim-daily-summary', '0 9 * * *', ...)` → `pg_net.http_post` to `/api/public/karim-daily`
- Enable `pg_net` and `pg_cron` if not already enabled

The stable URL `https://project--bdd50858-c6d6-4698-b754-84bbaed5dc0b.lovable.app` is used for both pg_net calls so they keep working across renames.

## Frontend touches

- `src/lib/bot.ts` — `KARIM_ID`, `isKarim(id)` helper
- `src/components/AiTag.tsx` — small "AI" pill
- `src/components/FeedCard.tsx` — render `kind='daily_summary'` branch + AI tag
- `src/components/CommentThread.tsx` + `MatchDiscussionThread.tsx` — AI tag next to Karim's comments
- `src/routes/leaderboard.tsx` — exclude `KARIM_ID`
- `src/lib/i18n.ts` — `ai_tag` ("AI"), `karim_daily_title` ("Daily wrap")
- `src/integrations/supabase/types.ts` — add `body` and nullable `match_id` to `feed_activities`

## Out of scope

- No Farsi roasts for v1 (the model is fine at it, but we'd need per-recipient language metadata).
- No reactions/comments from Karim on its own daily post.
- No per-player opt-out of being roasted.
- No mid-match live commentary.
- No "hype" comments on exact scores or correct results — strictly 0-point roasts as you asked.
