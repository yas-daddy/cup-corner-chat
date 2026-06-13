## Live-aware predictions on `/matches/:id`

Only the match detail page changes. Behavior is purely visual + sorting; no DB changes, no scoring changes.

### 1. LIVE tag on the match header

When `match.status === "LIVE"`, render a `LIVE` chip above the match title, using the same style as the home tab's section heading (uppercase, bold, `text-accent`, small tracking) so it reads identically.

### 2. Red side of a busted prediction

For each prediction row, when the match is `LIVE` and has a current `home_score` / `away_score`:

- If `live_home > pred_home` → render `pred_home` in red (busted side; that exact half can no longer come in).
- If `live_away > pred_away` → render `pred_away` in red.
- If both busted → the whole score chip turns red (exact + result both gone).
- If neither side is exceeded → no change (still alive for exact and result).

Uses the existing semantic `text-destructive` / `bg-destructive/15` tokens so it works in both themes. No copy change, no badge — just color on the digit(s).

### 3. Live ranking of predictions

When `LIVE`, sort `rows` by "closest to current live score" instead of insertion order:

1. Exact match to live score first (`pred_home == live_home && pred_away == live_away`).
2. Then predictions where the result direction still matches the live result (`sign(pred_home - pred_away) == sign(live_home - live_away)`).
3. Within each bucket, ascending by `|pred_home - live_home| + |pred_away - live_away|` (total goal distance).
4. Stable tiebreaker on player display name.

Add a small `text-ink-soft` hint above the list, e.g. "Ranked by closeness to live score", only while `LIVE`. `FINISHED` keeps the existing points-desc sort; `SCHEDULED` / locked-pre-kickoff keep the existing order.

### Out of scope

- No change to `prediction_points`, feed activities, or the home tab.
- No "still possible" math beyond the simple busted-side rule (we don't know minutes remaining).
- No re-fetch loop on this page — it picks up new scores on the next normal navigation / refresh, same as today.

### Technical notes

- All changes live in `src/routes/matches.$matchId.tsx` and the `PredictionRow` component there.
- Compute `live = match.status === "LIVE"` and `liveHome` / `liveAway` once in the page; pass into `PredictionRow` so it can color the score chip.
- Sorting happens in the existing `setRows(...)` LIVE branch (currently the `else` upcoming branch handles LIVE too — split it so LIVE uses the ranking comparator above).
