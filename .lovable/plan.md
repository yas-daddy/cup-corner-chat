
## Overview

Add a social layer on top of the existing predictor:
1. New "Feed" tab (second from left in bottom nav) with continuous activity cards
2. Like/dislike/comment on each feed activity
3. Per-prediction like + comment counts in the match detail page
4. Per-match general comments section at the bottom of match detail
5. Comment count badge on home-page MatchCards (only when > 0)

## Database

Three new tables in `public` (open RLS to match existing app style, since identity is the stored `players.id`, no auth):

- `feed_activities`
  - `id uuid pk`
  - `kind text` — `"prediction_created"`, `"prediction_updated"`, `"points_awarded"`
  - `actor_id uuid` → players.id
  - `match_id text` → matches.id
  - `pred_home int`, `pred_away int` (snapshot)
  - `points int null`, `is_exact bool null`, `is_correct_result bool null`
  - `created_at timestamptz default now()`

- `reactions`
  - `id uuid pk`
  - `target_type text` — `"activity"` | `"prediction"`
  - `target_id text` (activity uuid or `playerId:matchId` for prediction)
  - `player_id uuid` → players.id
  - `value smallint` — `1` like, `-1` dislike
  - unique `(target_type, target_id, player_id)`

- `comments`
  - `id uuid pk`
  - `target_type text` — `"activity"` | `"prediction"` | `"match"`
  - `target_id text`
  - `player_id uuid` → players.id
  - `body text` (validated 1..500 chars client-side)
  - `created_at timestamptz default now()`

Grants + ENABLE RLS + open policies (consistent with current tables).

Population of `feed_activities`:
- Insert from the client when a prediction is created/updated (mirrors `MatchCard` save and admin upsert flow).
- Insert one `points_awarded` activity per row when scoring runs. Easiest: extend the existing scoring server function/path that writes `prediction_points` to also insert activities. If scoring is done outside server functions, add a Postgres trigger on `prediction_points` insert/update.

(Plan step will verify by reading the scoring code before writing the migration; if a trigger is cleaner, add it in the same migration.)

## Feed route (`/feed`)

New file `src/routes/feed.tsx`. Reverse-chronological list, paginated (limit 50, load-more).

Card layout:
- Big card, avatar + display name (link to `/players/$playerId`)
- Match line: `🇲🇦 Morocco vs 🇫🇷 France` (flags from existing helpers)
- Body varies by `kind`:
  - prediction_created/updated → `predicted 2 - 1`
  - points_awarded → `final 2 - 1 · +8 ⭐` (gold) or `+3 ✓` (success) or `+0` (muted)
- Footer row: like / dislike / comment counts + buttons
- Tapping card body → navigates to `/matches/$matchId`
- Comment button toggles inline comment composer + recent comments list (last 3, "view all" → match page)

Hook up bottom nav: add `{ to: "/feed", label: t("feed"), Icon: Rss }` as second item in `src/components/BottomNav.tsx`. Add `feed` translation key.

## Match detail page additions (`src/routes/matches.$matchId.tsx`)

For each prediction row (existing list):
- Right side: small like button with count + comment count link
- Tapping comment count expands inline thread (composer + list)
- `target_type = "prediction"`, `target_id = "{playerId}:{matchId}"`

Bottom of page: new "Match discussion" section
- `target_type = "match"`, `target_id = matchId`
- List all comments (newest first) + composer at top
- Header shows total comment count

## Home page MatchCard badge

In `src/components/MatchCard.tsx`:
- Fetch comment counts in batch from the home page (parent passes `commentCount` prop to avoid N queries)
- Render small bubble bottom-right of card when count > 0: `💬 {n}`
- Counts = sum of comments where `target_type='match' AND target_id=match.id` plus comments on any prediction for that match (single aggregated query in the home loader)

Home page (`src/routes/index.tsx`) batches one query: `select target_id, count(*) ... where target_type in ('match','prediction') and target_id like ...` and builds a per-match map.

## Reactions/comments helpers

New `src/lib/social.ts`:
- `toggleReaction({ targetType, targetId, value })` — upsert on unique key, delete if same value clicked again
- `addComment({ targetType, targetId, body })` — Zod-validate length, trim
- `useReactionCounts(targets)` and `useComments(targetType, targetId)` hooks with realtime subscription (Supabase channel) so feed updates live

## Realtime

Subscribe via `supabase.channel` to `feed_activities`, `reactions`, `comments` inserts so the feed and threads update without refresh.

## Verification

- Migrate, then make picks as two players (god mode) → feed shows prediction activities
- Trigger scoring on a finished match → `points_awarded` activities appear with correct +points
- Like + comment on feed cards → counts update; reflected on match detail
- Add a match-level comment → appears in match discussion; home card shows badge with count
- Set count to 0 → badge hidden
- RTL (fa) layout sanity check on feed and comment threads

## Files touched

- New: `src/routes/feed.tsx`, `src/lib/social.ts`, `src/components/FeedCard.tsx`, `src/components/CommentThread.tsx`, `src/components/ReactionBar.tsx`
- Edit: `src/components/BottomNav.tsx`, `src/components/MatchCard.tsx`, `src/routes/index.tsx`, `src/routes/matches.$matchId.tsx`, `src/lib/i18n.ts` (add "feed", "like", "dislike", "comments", "write_a_comment", "match_discussion"), `src/lib/types.ts`
- Migration: `feed_activities`, `reactions`, `comments` + grants + RLS + (optional) scoring trigger
- Possibly edit the scoring server function to insert `points_awarded` activities if no trigger
