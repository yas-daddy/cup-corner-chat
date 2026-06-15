## Problem

Every 10-minute sync upserts every match row. For Canada–Bosnia (`fd:537333`) the upstream score occasionally flaps (null or different value, then back to 1-1). Each flap fires the `matches_emit_finished` DB trigger, which:

1. Deletes all `points_awarded` feed activities for the match.
2. Re-inserts them with new ids.
3. Each new activity triggers `notify_on_result` → new `notifications` row → push to the player.

Result: 72 duplicate "result" notifications for that one match, and the feed shows the same award again and again. Other matches don't flap, so they stayed quiet.

## Fix (two layers, defense in depth)

### 1. Sync layer — don't write unchanged rows, and never downgrade a FINISHED row

In `src/routes/api/public/sync-matches.ts`:

- Fetch the existing row's full canonical fields (status, scores, kickoff, teams, codes, stage, group) along with the id.
- For each upstream row, **skip the upsert** when nothing material has changed. Only include rows in the `upsert` payload where a tracked field actually differs.
- **Never overwrite a FINISHED match** with a non-FINISHED status or with null scores. If the existing row is `status='FINISHED'` and the upstream returns `SCHEDULED`/`LIVE` or null scores, keep the stored row as-is. (Once a match is finished in our DB, only an explicit admin re-score should change it.)
- Keep `last_synced_at` updates out of the trigger's path — either don't bump it when nothing else changed, or bump it via a separate lightweight update that doesn't pass through `emit_match_finished_activities`. Simplest: only update `last_synced_at` on the rows we already had to write.

### 2. Trigger layer — make the trigger idempotent

Migration: replace `public.emit_match_finished_activities()` so it:

- Still fires `AFTER UPDATE` on `matches`.
- Only proceeds when `NEW.status='FINISHED'` AND scores are non-null AND `(OLD.status, OLD.home_score, OLD.away_score) IS DISTINCT FROM (NEW.status, NEW.home_score, NEW.away_score)` — keep existing guard.
- **Before deleting/re-inserting, check whether the existing `points_awarded` rows for this match already match the new scores.** If every existing row already has `home_score=NEW.home_score` and `away_score=NEW.away_score` and the per-player point computation matches, do nothing. This makes the trigger a no-op for "flap and back" cases.
- Also: never insert a `points_awarded` row that would be byte-identical to one we just deleted — easier path is the pre-check above, so we never delete in the first place.

This guarantees that even if a future sync bug causes a write, no new feed/notification spam is produced when the answer is unchanged.

### 3. Clean up the existing damage for `fd:537333`

Data fix (single migration / insert tool):

- Delete duplicate `notifications` for `match_id='fd:537333'` keeping the earliest per `(recipient_id, kind)`.
- Delete duplicate `feed_activities` of kind `points_awarded` for the same match keeping the earliest per `actor_id`.
- Spot-check other finished matches and apply the same dedupe if any have >1 `points_awarded` row per actor.

No new push will be sent for the cleanup itself (we're deleting, not inserting).

## Out of scope

- No change to the scoring formula.
- No change to the cron schedule.
- No change to Karim — roasts are already disabled.

## Files / artifacts

- Edit: `src/routes/api/public/sync-matches.ts` (diff-aware upsert + FINISHED guard).
- New migration: replace `emit_match_finished_activities` with idempotent version.
- New data cleanup via insert tool: dedupe `notifications` + `feed_activities` for affected matches.

## How to verify after shipping

1. Manually hit `/api/public/sync-matches` twice in a row → second call writes 0 rows (response `synced: 0` for unchanged matches).
2. Confirm no new `feed_activities` rows appear for `fd:537333` and no new `notifications` rows.
3. Wait one cron cycle, recheck `SELECT COUNT(*) FROM notifications WHERE match_id='fd:537333' AND kind='result'` — stays flat.
