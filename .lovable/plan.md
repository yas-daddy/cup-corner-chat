## What we're adding

A small floating pill at the top of the Picks (home) tab that tells the player how many upcoming matches they haven't predicted yet. Tapping it smooth-scrolls down to the first unpredicted upcoming match. Inspired by the "New tweets" / "New posts" pill in social apps.

## Behavior

- Counts every match in the existing `grouped.upcoming` map that the player has no row for in `preds` (i.e. truly unpredicted, not just "new since last visit").
- Pill is hidden when the count is 0, or while the first unpredicted match card is already visible on screen (so it doesn't nag you once you've scrolled to it).
- Tapping the pill smooth-scrolls to that first unpredicted match card and gives it a brief highlight ring so the user sees what they landed on.
- Sticky position just under the header, centered, with a subtle drop shadow — floats over content as the user scrolls, matching the Twitter/Instagram pattern.
- Localized copy (EN + FA), with Farsi digit conversion via the existing `n()` helper.

## Copy

- EN: `"{n} new picks to make ↓"` (singular: `"1 new pick to make ↓"`)
- FA: `"{n} پیش‌بینی جدید ↓"` (singular: `"۱ پیش‌بینی جدید ↓"`)

Two new i18n keys: `new_picks_pill_one`, `new_picks_pill_other`.

## Files touched

1. **`src/components/NewPicksPill.tsx`** (new)
   - Props: `count: number`, `onTap: () => void`.
   - Sticky pill (`sticky top-2 z-30`, self-centered with `mx-auto w-fit`), rounded-full, `bg-primary text-primary-foreground`, soft shadow, scale/opacity transition on mount/unmount.
   - Returns null when `count === 0`.

2. **`src/routes/index.tsx`**
   - Tag each upcoming `MatchCard` wrapper with `data-match-id={m.id}` so we can `scrollIntoView` and apply a highlight class.
   - Compute `unpredictedUpcomingIds` from `grouped.upcoming` + `preds` (memoized; recomputes when either changes, so the count drops as the player makes picks).
   - Track visibility of the first unpredicted card with an `IntersectionObserver` (re-bound when the target id changes) — pill hides when that card is on screen.
   - Render `<NewPicksPill>` directly under `<header>` (above the Results section), wired to a `scrollToFirstUnpredicted()` helper that:
     - `scrollIntoView({ behavior: "smooth", block: "center" })` on the matching `data-match-id` element.
     - Toggles a `ring-2 ring-primary` class on it for ~1.2s for visual confirmation.

3. **`src/lib/i18n.ts`**
   - Add `new_picks_pill_one` and `new_picks_pill_other` to both `EN` and `FA` dictionaries.

## Edge cases

- No upcoming matches at all → count is 0 → pill hidden.
- User makes a pick → `preds` updates → count decrements automatically; pill hides at 0.
- Player not signed in / matches still loading → pill hidden (rendered inside the signed-in branch only).
- RTL (Farsi): arrow flips to `↓` (vertical, direction-agnostic) so no flip logic needed.

## Out of scope

- No "newly added since last visit" tracking (per your answer — counting any unpredicted upcoming match).
- No backend changes, no new tables, no realtime subscription — purely client-side derivation from data the page already loads.
