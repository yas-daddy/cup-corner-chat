## New scoring system

| Component | Points |
|---|---|
| Correct winner / draw | +5 |
| Correct home goals | +1 |
| Correct away goals | +1 |
| Correct goal difference **and** correct winner | +3 |
| Exact score (all of the above stack) | **10** |

Rules:
- "Correct winner" = same sign of (home − away).
- GD bonus only applies when the winner is also correct (so picking the right margin in the wrong direction gives nothing extra).
- A draw prediction that matches a real draw counts as "correct winner" (+5), and matching either goal count adds +1 each. If both goal counts match it's exact = 10.

## Where the scoring lives

The formula is in two places in the database and must be updated together:

1. `prediction_points` view (drives the leaderboard + per-player stats).
2. `emit_match_finished_activities()` trigger function (writes `points` / `is_exact` / `is_correct_result` onto `feed_activities` when a match finishes).

`is_exact` keeps its current meaning (pred == actual). `is_correct_result` keeps its current meaning (correct winner / draw). The leaderboard's "correct results" and "exact scores" counters stay meaningful.

## Migration

Single migration that:

1. Replaces the `prediction_points` view's `points` expression with:
   ```
   (CASE WHEN sign(pred_home - pred_away) = sign(home_score - away_score) THEN 5 ELSE 0 END)
   + (CASE WHEN pred_home = home_score THEN 1 ELSE 0 END)
   + (CASE WHEN pred_away = away_score THEN 1 ELSE 0 END)
   + (CASE WHEN sign(pred_home - pred_away) = sign(home_score - away_score)
              AND (pred_home - pred_away) = (home_score - away_score) THEN 3 ELSE 0 END)
   ```
   gated by `status = 'FINISHED'` and non-null scores, same as today.
2. Replaces `emit_match_finished_activities()` with the same formula so future finishes write the new numbers.

No data backfill of `feed_activities` — existing "points awarded" cards keep their old values (per your answer). The leaderboard refreshes the instant the view changes because it reads through the view.

## Frontend changes

### 1. Leaderboard help icon (`src/routes/leaderboard.tsx`)

- Add a small `?` (HelpCircle) icon button in the top-right of the header, next to the title.
- Tapping opens a bottom-sheet modal (matches `ChampionPromptModal` styling) showing the table above, plus one example: "Predicted 2–1, actual 2–0 → +5 (winner) +1 (home) = **+6**". Brief, no walls of text.
- New component: `src/components/ScoringHelpModal.tsx`.
- New i18n keys (EN + FA): `scoring_help_title`, `scoring_row_winner`, `scoring_row_home`, `scoring_row_away`, `scoring_row_gd`, `scoring_row_exact`, `scoring_example_label`, `scoring_close`. Remove/replace the old `scoring_body` string.

### 2. Feed cards (`src/components/FeedCard.tsx`)

Reduce to 3 scenarios for `points_awarded`:
- **Exact** (`is_exact`): "nailed the exact score! **+10**" with the gold treatment that already exists.
- **Correct (any other >0 points)** (`points > 0 && !is_exact`): "predicted correctly **+{points}**" — single message regardless of which sub-bonuses were hit. No breakdown.
- **Zero** (`points === 0`): keep the existing "scored zero on this one" line (Karim's roast trigger continues to fire off this).

Update i18n strings accordingly (`activity_exact`, `activity_correct`, `activity_no_points`) — drop any "+3" / "+8" hardcoded copy.

### 3. My Picks + Player profile (`src/routes/my-picks.tsx`, `src/routes/players.$playerId.tsx`)

- Pick row badge: show `+{r.points}` for any `points > 0` (gold pill when `is_exact`, green pill otherwise). No tooltip, no breakdown — just the number, as requested.
- Replace the hardcoded `+8` / `+3` strings with `+{n(r.points)}`.
- Stats tiles ("correct results", "exact scores") stay; their counts are still meaningful.

### 4. i18n cleanup (`src/lib/i18n.ts`)

- `notif_result_exact` → "You nailed the exact score! +10"
- `notif_result_correct` → "You got points on this one! +{points}" (parametrized — or keep static "You got points on this one." if simpler)
- Update the FA mirror strings.

## Out of scope

- No new "why did I get these points?" explainer on match cards or pick rows.
- No backfill of historical `feed_activities` rows.
- No push-notification re-send for already-finished matches.
- No changes to the champion bonus or to Karim's roast logic.

## Technical notes

- The view replacement uses `CREATE OR REPLACE VIEW`. If column types/order change Postgres rejects it; the shape here is identical so it's safe.
- `emit_match_finished_activities()` already deletes prior `points_awarded` rows for a match before re-inserting on score change, so if a finished match is corrected via God Mode after the migration, that match's feed card *will* reflect new scoring — which is the desired behavior.
- All scoring constants live in SQL; the frontend just renders `r.points`. No magic numbers duplicated in TS.
