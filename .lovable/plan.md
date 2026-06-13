# Unified comments & reactions per prediction

Today there are three disconnected comment threads for any given pick:
- Feed card → `target_type = 'activity'`, keyed by the random `feed_activities.id`
- Match page prediction row → `target_type = 'prediction'`, keyed by `playerId::matchId`
- Match discussion → `target_type = 'match'`, keyed by `matchId`

So a comment Taha leaves on Yasin's feed card is invisible on the match page, and vice versa. We'll collapse this to one canonical thread per (player, match) plus the match-wide discussion that aggregates them.

## Behavior after the change

- Every feed card that represents a specific pick ("made a pick", "updated pick", "exact score", "correct result", "no points") shares one thread with that player's prediction row on the match page. Same comments, same reactions, same count.
- The match page's "Match discussion" shows a merged view: all comments left on the match itself **plus** all comments left on any prediction for that match, sorted by time, each row labeled with whose pick it was on (or "On the match" for match-level ones). New comments typed into the match discussion box are still saved as match-level.
- Notification triggers keep working unchanged — `notify_on_comment` / `notify_on_reaction` already handle `prediction` and `activity` target types; we just stop using `activity` going forward.

## Changes

### Frontend
- `src/components/FeedCard.tsx`: switch `ReactionBar` and `CommentThread` from `targetType="activity"` + `activity.id` to `targetType="prediction"` + `predictionTargetId(activity.actor_id, activity.match_id)`. Drop the `useComments("activity", …)` call.
- `src/lib/social.ts`: add `useMatchDiscussion(matchId)` that loads + realtime-subscribes to comments where `target_type='match' AND target_id=matchId` **union** `target_type='prediction' AND target_id LIKE '%::matchId'`, returning each row with its `target_type` and (for predictions) the resolved `player_id`.
- New `src/components/MatchDiscussionThread.tsx`: renders that merged feed (with a small "on <name>'s pick" label per prediction comment), and a composer that posts new comments as `target_type='match'`. Replaces the `CommentThread targetType="match"` block in `src/routes/matches.$matchId.tsx`.
- `src/lib/social.ts` `fetchMatchCommentCounts`: unchanged in behavior (already sums match + prediction comments).

### Data migration (one-off backfill)
Migrate existing `comments`/`reactions` rows with `target_type='activity'` to the new prediction key so historical conversations don't vanish:

```text
UPDATE comments c
SET target_type='prediction',
    target_id = fa.actor_id || '::' || fa.match_id
FROM feed_activities fa
WHERE c.target_type='activity' AND c.target_id = fa.id::text;

-- same for reactions, with ON CONFLICT cleanup for the (target,player) uniqueness
```

Reactions have a unique-per-player constraint, so the migration de-dupes by keeping the most recent row per `(target_type, target_id, player_id)` before the update.

## Out of scope
- No schema change to `comments`/`reactions` (target_type stays a free text column).
- No edit to notification triggers — they already cover `prediction` targets.
- Match-level composer still posts match-level comments; we are not forcing all new comments into a prediction thread.
