## Leaderboard → add "Chart" tab with historical score lines

### UX
- On `/leaderboard`, add a segmented toggle at the top: **Leaderboard** | **Chart** (styled like the existing rounded pill buttons; persist choice in component state, not URL).
- Chart view shows one line per player (top 8 by current total points, Karim excluded), colored distinctly.
- X axis: tournament days that had ≥1 finished match (label e.g. "Jun 12"). Y axis: cumulative total points at end of that day.
- Each line ends with the player's avatar rendered as a small round image (24px) with a 2px ring in the line's color, positioned at the line's last point on the right edge.
- No legend. Tapping/clicking a line (or its end avatar) highlights it and shows a small floating label with the player's name + current points; tapping elsewhere dismisses.
- Empty state if no finished matches yet: "Chart will appear after the first match finishes."

### Data
Compute client-side from existing tables — no schema changes:
1. Fetch `leaderboard` (already used) → take top 8 non-Karim by `total_points`.
2. For those 8 player ids, fetch `feed_activities` where `kind='points_awarded'` and `actor_id IN (...)`, joined/lookup with `matches.kickoff_at` to get the match day. `feed_activities.points` already holds the awarded points per player per match.
3. Group by day (UTC date of `kickoff_at`, formatted in user's locale via existing `i18n`), accumulate per player to produce a running total series. Only include days with ≥1 finished match.
4. Ensure every player has a value for every included day (carry forward previous total if no points that day) so lines stay continuous.

### Implementation
- New component `src/components/LeaderboardChart.tsx` using **Recharts** (already common; install if missing via `bun add recharts`). Use `<LineChart>` with `<Line dot={false}>` per player and a custom right-edge avatar overlay rendered as absolutely-positioned divs computed from the chart's last-point coordinates (via Recharts' `<Customized>` or by reading the last `<Line>`'s computed points through a ref-less approach using `ResponsiveContainer` + a `Customized` component that receives `xAxisMap`/`yAxisMap`).
- Colors: a fixed palette of 8 distinct, theme-aware hues defined in `src/styles.css` as CSS vars (`--chart-1` … `--chart-8`) so they work in light + dark.
- Tap-to-reveal: track `activePlayerId` state; dim other lines (`strokeOpacity: 0.25`) and show a small floating chip near the avatar with name + total. Tap background to clear.
- Modify `src/routes/leaderboard.tsx` to host the toggle and conditionally render the list or `<LeaderboardChart players={top8} />`.

### Out of scope
- No new DB tables, triggers, or migrations.
- No changes to scoring logic, Karim, notifications, or sync.
- Karim stays hidden from chart (same filter as list).
