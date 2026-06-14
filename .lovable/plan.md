## Dark mode — follows device setting

No toggle, no setting. The app picks light or dark from the OS via `prefers-color-scheme`. No JS, no class on `<html>`, no persistence.

### 1. Dark token set in `src/styles.css`

The app already routes color through semantic tokens (`--bg`, `--surface`, `--border`, `--ink`, `--ink-soft`, `--primary`, `--secondary`, `--accent`, `--success`, `--gold`). Add a `@media (prefers-color-scheme: dark)` block that overrides those CSS variables for dark. Brand hues (`--primary` purple, `--accent` red, `--secondary` teal, `--gold`, `--success`) stay recognizable but get slight lightness bumps so they read on a dark surface.

Proposed dark values:

- `--bg: #0b0d12`
- `--surface: #15181f`
- `--border: #262a33`
- `--ink: #f1f3f7`
- `--ink-soft: #9aa3b2`
- `--primary: #8b5cf6` (lifted purple)
- `--secondary: #2dd4bf`
- `--accent: #ff7a80`
- `--success: #9ed64a`
- `--gold: #f5c542`

### 2. Fix the one hardcoded surface: `.tab-bar`

`.tab-bar` uses `rgba(255, 255, 255, 0.95)`. Replace with `color-mix(in oklab, var(--bg) 92%, transparent)` so the bottom nav blurs over the right background in both modes. Keep the `backdrop-filter` blur.

### 3. Sweep hardcoded color classes

Audit and replace ad-hoc Tailwind colors (`bg-white`, `text-black`, `bg-black`, `text-white` outside of `bg-primary`/`bg-accent` pairings, hardcoded `#fff`/`#000`) in:

- `src/components/MatchCard.tsx`, `ChampionPickCard.tsx`, `FeedCard.tsx`, `ReactionBar.tsx`, `NotificationsBell.tsx`, `AvatarPicker.tsx`, `AvatarPromptModal.tsx`, `CommentThread.tsx`, `MatchDiscussionThread.tsx`, `SignInScreen.tsx`
- `src/routes/settings.tsx`, `matches.$matchId.tsx`, `admin.tsx`

Rules:
- `bg-white` on cards/sheets → `bg-surface` (or `bg-bg` for full-page panels).
- `text-black` → `text-ink`. `text-white` stays only where the background is a brand color (`bg-primary`, `bg-accent`) — those pair with white in both modes.
- Borders → `border-border`.
- Soft text → `text-ink-soft`.

shadcn primitives (`dialog`, `drawer`, `sheet`, `alert-dialog`, `chart`, `alert`) already read from semantic tokens and the chart/alert files already have `dark:` variants — leave them alone.

### 4. Meta theme color

`__root.tsx` sets `theme-color: #6d28d9` (purple). Split it into two `<meta name="theme-color">` tags with `media` attributes so the iOS/Android status bar matches:
- light: `#ffffff`
- dark: `#0b0d12`

### 5. Verification

After edits, load `/`, `/my-picks`, `/leaderboard`, `/feed`, `/matches/:id`, `/settings`, `/players/:id` in the preview with the OS in dark mode and confirm: no white cards on dark bg, bottom nav blurs correctly, primary buttons still read white text, LIVE chip and busted-prediction red still pop.

### Out of scope

- No manual light/dark toggle.
- No persisted preference.
- No new theme tokens beyond the dark overrides.
