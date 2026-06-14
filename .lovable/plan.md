## Goal
Replace the boring "👥 N" predictors badge on every `MatchCard` with a stacked row of up to 3 player avatars and a `+X` overflow indicator when more than 3 players predicted.

## Changes

### 1. `src/lib/social.ts`
Replace `fetchMatchPredictionCounts` with `fetchMatchPredictionPreviews(matchIds)` that returns:
```
Record<matchId, { count: number; avatars: { id: string; avatar: string|null; display_name: string }[] }>
```
- One query into `predictions` filtered by `matchIds` returning `match_id, player_id`.
- One query into `players` for the unique player_ids returning `id, avatar, display_name`.
- For each match, randomly shuffle its predictors and slice the first 3, then attach player info.

### 2. `src/routes/index.tsx`
- Rename state `predictionCounts` → `predictionPreviews` with the new shape.
- Call `fetchMatchPredictionPreviews` instead of `fetchMatchPredictionCounts`.
- Pass `predictionPreview={predictionPreviews[m.id]}` to every `<MatchCard>` (all three call sites: results, live, upcoming).

### 3. `src/components/MatchCard.tsx`
- Replace `predictionCount?: number` prop with `predictionPreview?: { count: number; avatars: {...}[] }`.
- In the bottom-right floating badge (currently the `<Users />` + number block), render instead:
  - A horizontal stack of up to 3 small `<Avatar size={20} />` (from `@/components/AvatarPicker`) with a slight negative margin overlap (e.g. `-ml-1.5` on items after the first) and a thin `ring-1 ring-surface` for separation.
  - If `count > avatars.length`, append a small pill `+{count - avatars.length}` matching the same height as avatars.
  - If `count === avatars.length` (and count > 0), no `+X` shown.
  - Hide the whole block when `count === 0` (preserve the existing `commentCount` half — keep the comments icon separate so it still shows when there are comments but no predictions).
- Apply to all match states (upcoming, live, results) — no scope restriction.

### 4. Visual
- Avatar circles `size={20}`, `text-sm`, `border border-border bg-surface`, overlapped via negative margin, wrapped in a container with `bg-surface/95` rounded-full pill so they read on top of the card. RTL handled by relying on flex direction inherited from the card's `dir`.

## Out of scope
- No DB schema changes.
- No changes to comment-count behavior or other badges.
- No realtime updates beyond the existing one-shot fetch on home mount.
