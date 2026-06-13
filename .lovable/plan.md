**Problem**
- The match detail route file exists, and SSR can render `/matches/fd:537334`.
- But the browser is loading a stale/generated route tree that does **not** include `/matches/$matchId`, so hydration fails with `Expected to find a match below the root match in SPA mode` and the page shows 404/blank.

**Plan**
1. **Regenerate/fix route registration**
   - Do not hand-edit `src/routeTree.gen.ts` as a long-term fix.
   - Touch/fix the route source files so the TanStack route generator picks up `src/routes/matches.$matchId.tsx` correctly in the served route tree.

2. **Avoid fragile colon URLs**
   - Update home-page match-card links to encode match IDs into a URL-safe value, e.g. `fd:537334` → `fd-537334` or encoded form.
   - Update the match detail route to decode that value back to the real database match ID before querying.
   - This removes dependence on special `:` path-param behavior during SSR/client hydration.

3. **Keep card controls working**
   - Preserve the score +/- buttons on upcoming home-page cards so tapping buttons still changes predictions instead of navigating.
   - Keep the rest of the card tappable.

4. **Verify**
   - Open the home page, select a player, tap a finished and upcoming match card.
   - Confirm the URL resolves, the detail page renders predictions/points, and there are no route hydration errors in the browser console.