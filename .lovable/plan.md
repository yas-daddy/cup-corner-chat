# Notifications Center

A bell icon sits on the top‑right of the home tab next to the title, with an unread count badge. Tapping it opens a slide‑in panel listing recent notifications; tapping any item navigates to the relevant match. Opening the panel marks everything as read.

## What triggers a notification

For the current player, generate a notification when:

1. **Like on my pick** — someone reacts (value = 1 or −1) on `prediction` target `{me}::{matchId}`.
2. **Like on my win/result** — someone reacts on a `points_awarded` feed activity whose `actor_id = me`.
3. **Comment on my pick** — comment on `prediction` target `{me}::{matchId}`.
4. **Comment on my win/result** — comment on `activity` target where that activity's `actor_id = me`.
5. **Reply in a thread I'm in** — new comment on a `target_id` where I have previously commented (and I'm not the new author and not already covered by 3/4).
6. **Result for a match I predicted** — a `points_awarded` activity is created with `actor_id = me` (covers both points and zero‑point cases).

Self‑actions never notify (skip when `actor_id = recipient`).

## Data model

New table `public.notifications`:

- `recipient_id` (player), `actor_id` (player, nullable for system), `kind` (enum text: `like`, `comment`, `reply`, `result`), `target_type` (`prediction` | `activity` | `match`), `target_id`, `match_id`, `points` (nullable int for result), `read_at` (nullable timestamptz).

RLS open like existing social tables (matches project pattern). Realtime enabled on the table.

Database triggers do the fan‑out:

- `reactions AFTER INSERT` → resolve recipient (`prediction` → split target_id; `activity` → look up `feed_activities.actor_id`) and insert one notification.
- `comments AFTER INSERT` → insert one notification to the target owner (kinds 3/4), plus one `reply` notification per distinct prior commenter of the same `(target_type,target_id)` excluding the new author and the owner.
- `feed_activities AFTER INSERT` where `kind = 'points_awarded'` → insert `result` notification to `actor_id` with `points` populated.

## UI

`src/components/NotificationsBell.tsx`:

- Button with `Bell` icon and badge (count of `read_at IS NULL`, capped "9+").
- Loads latest 30 notifications for `player.id` and subscribes to realtime inserts (channel name suffixed with random id, matching existing pattern in `social.ts`).
- Opens a right‑side sheet (reuse `@/components/ui/sheet`) listing items: actor avatar + name, localized sentence, relative time. Tapping an item navigates to `/matches/$matchId` and closes the sheet.
- On open, calls `update notifications set read_at = now() where recipient_id = me and read_at is null` and clears the badge.

Wire the bell into the home header in `src/routes/index.tsx` (top‑right of the existing header row). Add i18n strings for each notification kind in `src/lib/i18n.ts`.

## Out of scope

No push/email notifications, no per‑kind mute settings, no pagination beyond the latest 30, no notifications for edits/deletes of reactions or comments.

## Technical details

- Migration creates the table with `GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, anon; GRANT ALL ... TO service_role;` and `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`.
- Triggers are `SECURITY DEFINER` with `search_path = public` and use `ON CONFLICT DO NOTHING` against a unique index on `(recipient_id, kind, target_type, target_id, actor_id, coalesce(points, -1))` to keep things idempotent.
- Resolving the recipient for `activity` reactions/comments joins `feed_activities` by `target_id::uuid`.
- The reply fan‑out uses `SELECT DISTINCT player_id FROM comments WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND player_id <> NEW.player_id`.
