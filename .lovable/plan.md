# Debounce prediction feed posts

## Problem

Every save on a pick fires the `emit_prediction_activity` trigger, so the feed fills with `prediction_created` followed by a string of `prediction_updated` rows while a player is still tapping the score adjuster.

## Approach

Stop posting on save. Track what was last announced on the prediction row, and have a 1-minute scheduled job post a single feed entry once the pick has been stable for ≥60 seconds.

## Changes

### 1. Database

- Drop the existing per-write trigger that calls `emit_prediction_activity`.
- Add columns to `predictions`:
  - `last_emitted_home int`
  - `last_emitted_away int`
  - `last_emitted_at timestamptz`
- Backfill these columns from the most recent existing `prediction_created`/`prediction_updated` row per `(player_id, match_id)` so we don't re-announce old picks.
- Cleanup pass: for each `(actor_id, match_id)`, keep only the newest `prediction_created`/`prediction_updated` row in `feed_activities` and delete the rest.

### 2. Scheduled emitter route

New public route `src/routes/api/public/hooks/emit-pending-predictions.ts` that, when POSTed, runs server-side (admin client) and:

- Selects predictions where `updated_at <= now() - interval '60 seconds'` AND (`last_emitted_at IS NULL` OR `last_emitted_home <> pred_home` OR `last_emitted_away <> pred_away`).
- For each row, inserts one `feed_activities` row:
  - `kind = 'prediction_created'` if `last_emitted_at IS NULL`, else `'prediction_updated'`.
  - Same `actor_id`, `match_id`, `pred_home`, `pred_away` shape the trigger used.
- Updates the prediction with `last_emitted_home/away = pred_home/away`, `last_emitted_at = now()`.

### 3. Cron

Schedule via `pg_cron` + `pg_net` every minute, hitting the route with the project's anon `apikey` header (consistent with the existing Karim hooks).

## Behavior notes

- A player tweaking the score saves several times in <60s → only one feed row fires the next minute, reflecting the final score.
- If they come back the next day and change it, that's a separate ≥60s-stable window and produces one `prediction_updated`.
- Lock-time enforcement and notifications continue to work unchanged (we only stop the activity-emit trigger; `enforce_prediction_lock` and the result/notification flow are untouched).

## Out of scope

- No change to how predictions themselves are saved from the client (still immediate).
- No change to `points_awarded`, comments, reactions, Karim, or any other feed kinds.
- Granularity is ~1 minute (pg_cron minimum); a pick could surface 60–~110s after the final save.
