## Fix

Remove the +3 "correct goal difference" bonus when the actual match ended in a draw. Reasoning: on a draw the GD is 0, so anyone who predicted any draw scoreline would auto-collect +3 on top of the +5 winner bonus, which double-rewards the same signal.

Exact-score predictions are unaffected because they take the dedicated `THEN 10` branch in both SQL paths.

### What changes

Add the extra guard `AND (m.home_score - m.away_score) <> 0` to the GD CASE in two places:

1. `prediction_points` view's `points` expression.
2. `emit_match_finished_activities()` trigger function.

So the GD clause becomes:

```sql
CASE WHEN sign(pred_home - pred_away) = sign(home_score - away_score)
       AND (pred_home - pred_away) = (home_score - away_score)
       AND (home_score - away_score) <> 0
     THEN 3 ELSE 0 END
```

### Effect

- Draw predicted, draw happened, exact match (e.g. 0–0 / 0–0) → still **10** (exact branch).
- Draw predicted, draw happened, not exact (e.g. 1–1 / 0–0) → **5** (winner only).
- Non-draw with correct winner + correct margin → unchanged (+5 winner, +3 GD, +1 per correct goal).

Leaderboard refreshes automatically because it reads through the view. No frontend changes. No feed backfill.

### Scoring help modal copy

Tighten the row label so the rule is obvious:

- EN: `scoring_row_gd` → "Correct goal difference (non-draw, winner correct)"
- FA: same intent — "تفاضل گل درست (مسابقه بدون تساوی)"

Example line stays as-is (uses a non-draw example).
