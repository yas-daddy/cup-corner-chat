## New scoring values

| Component | Old | New |
|---|---|---|
| Correct winner / draw | +5 | **+3** |
| Correct home goals | +1 | +1 |
| Correct away goals | +1 | +1 |
| Correct goal difference (non-draw only) | +3 | **+1** |
| Exact score bonus | — | **+2** |
| **Exact score total** (all stack) | 10 | **8** (3+1+1+1+2) |

Exact score keeps its dedicated branch so the GD non-draw guard never strips a point from a 0–0/0–0 prediction.

## Changes

### 1. Database — single migration
Rewrite the `points` expression in both the `prediction_points` view and `emit_match_finished_activities()` trigger:

```sql
CASE
  WHEN pred_home = home_score AND pred_away = away_score THEN 8
  ELSE
      (CASE WHEN sign(pred_home - pred_away) = sign(home_score - away_score) THEN 3 ELSE 0 END)
    + (CASE WHEN pred_home = home_score THEN 1 ELSE 0 END)
    + (CASE WHEN pred_away = away_score THEN 1 ELSE 0 END)
    + (CASE WHEN sign(pred_home - pred_away) = sign(home_score - away_score)
              AND (pred_home - pred_away) = (home_score - away_score)
              AND (home_score - away_score) <> 0 THEN 1 ELSE 0 END)
END
```

Already-finished matches: existing `feed_activities.points_awarded` rows were written by the trigger with old values. The plan re-emits them by re-running the trigger logic for `status='FINISHED'` matches at the end of the migration (delete old `points_awarded` rows, re-insert with new formula). Leaderboard reads through the view so it updates automatically; the feed cards reflect the new numbers immediately.

### 2. `src/components/ScoringHelpModal.tsx`
- `scoring_row_winner` pts: 5 → **3**
- `scoring_row_gd` pts: 3 → **1**
- Add a new row for the exact-score bonus: `scoring_row_exact_bonus` = **+2**
- Exact score total badge: `n(10)` → `n(8)`

### 3. `src/lib/i18n.ts`
- `scoring_help_sub`: "Bonuses stack. Nail it exactly = **8**." (EN) / "… = ۸." (FA)
- `scoring_row_gd`: "Correct goal difference (non-draws only)" — keep label, value changes in modal
- Add `scoring_row_exact_bonus`: "Exact score bonus" / "پاداش نتیجه دقیق"
- `scoring_example_body` (EN): "You picked 2–1, actual was 2–0. Winner ✓ (+3), home goals ✓ (+1), goal diff ✓ (+1) = +5."
- `scoring_example_body` (FA): mirrored numbers ("(+۳)", "(+۱)", "(+۱)", "= ۵+")

### 4. `src/routes/matches.$matchId.tsx`
The hardcoded preview pills already render `row.points` after the previous fix, so no code change. Double-check no leftover `+8`/`+5`/`+3` literals remain.

### 5. Other UI surfaces
`FeedCard`, `my-picks`, `players.$playerId`, `leaderboard` all read `points` from DB rows — no code change once the migration runs.

## Out of scope
No frontend animation/gold-badge changes. No champion-prediction changes. No notification copy changes (the notification just carries the numeric `points` value).
