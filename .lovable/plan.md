## Live-aware predictions on `/matches/:id`

When a match is `LIVE` and has a current score, treat that score as a "snapshot" and surface what it means for each player's pick. No backend or DB changes — purely frontend.

### Scope
- File: `src/routes/matches.$matchId.tsx`
- Only applies when `match.status === "LIVE"` and both `home_score` / `away_score` are present. `SCHEDULED`, `FINISHED`, and locked-but-no-score states render exactly as today.

### 1. Busted-side cue (red digit)
For each prediction `(pred_home, pred_away)` vs. live `(live_home, live_away)`:
- **Home digit goes red** when `live_away > pred_away` — away has already scored more than predicted, so `pred_away` (and therefore the exact score) can never come true.
- **Away digit goes red** when `live_home > pred_home` — same logic mirrored.
- Both red when both sides are busted (exact dead; whether correct-result is still alive is handled by the badge below).
- Implementation: split the existing `{n(pred_home)} - {n(pred_away)}` pill into two spans and conditionally add `text-destructive` to the busted side. No strikethrough, no extra icons.

### 2. Projected-points ranking
Sort rows by what they'd score **if the match ended at the current live score**, using the existing scoring rules:
- 8 if `pred_home === live_home && pred_away === live_away` (exact)
- 3 if `sign(pred_home − pred_away) === sign(live_home − live_away)` (correct result, incl. draw)
- 0 otherwise

Tie-break inside each tier by closeness: `|pred_home − live_home| + |pred_away − live_away|` ascending, then `display_name` for stability.

### 3. Projected-points badge
Next to each prediction pill, mirror the finished-match badge but flagged as a live projection:
- Exact-possible (would-be 8): gold pill `+8 ⭐ live`
- Correct-result-possible (would-be 3): green pill `+3 live`
- Dead (would-be 0): muted pill `+0 live`

The "live" suffix (or a small "live" dot) makes clear this is a projection, not awarded points. Existing `finished` branch is unchanged.

### Out of scope
- No realtime subscription added; the page already refetches on mount, and live scores update on the existing 10-min sync. (Happy to add a Realtime listener on `matches` in a follow-up if you want sub-10-min updates without a refresh.)
- No changes to feed, notifications, points table, or `/players/:id`.
- No copy translations beyond the short "live" suffix (will use `t("live")` which already exists).
