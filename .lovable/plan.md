## Fix

In `src/routes/matches.$matchId.tsx` (match details page), the per-player rows in the finished-match list still render hardcoded `+8` / `+3` based on `is_exact` / `is_correct_result`. The DB already returns the correct `row.points` from `prediction_points`.

Update the points badge (around lines 298–310) to mirror the My Picks / Feed treatment:

- `is_exact` → gold pill, `+{row.points} ⭐` (will be 10)
- `points > 0` (any partial) → green pill, `+{row.points}` with the check icon
- otherwise → muted `+0`

No other changes — match card on the home tab (`src/components/MatchCard.tsx`) has no hardcoded scoring numbers (already verified).
