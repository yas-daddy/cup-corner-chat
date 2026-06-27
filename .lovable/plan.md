## Plan: Redesign the home Daily Quiz card

### Context
The `QuizCard` on `/` is currently a plain bordered row: surface background, primary/15 icon, title, status line, and a chevron. It does not visibly communicate whether today is "ready to play" or "already done". The nearby `ChampionPickCard` uses a richer gradient-card style that the quiz card can align with.

### Goal
Make the quiz card the most eye-catching home action when questions are available, and make the "done" state immediately reassuring with a ✅.

### Implementation
1. **State-driven styling in `src/routes/index.tsx` (`QuizCard`)**
   - `done` (answered === total): success-themed card.
     - Background: subtle success gradient or `bg-success/10` to `surface`.
     - Icon circle: `bg-success/20` with `CheckCircle2` in `success`.
     - Right badge: green pill with a ✅.
     - Copy: "Done — back tomorrow".
   - `available` (questions loaded and not done): primary-purple CTA card.
     - Background: primary gradient/tint (`from-primary/10 via-surface to-surface` with primary/20 border tint).
     - Icon circle: `bg-primary/20` with `Brain` or `Sparkles` in primary.
     - Right badge: primary pill showing remaining count, e.g. "3 to play" or "1 left".
     - Chevron stays, but more prominent.
   - `loading` / `no questions`: keep a neutral, low-contrast variant (surface, muted text) so it doesn't compete for attention.

2. **Add visual treats**
   - Increase icon container size slightly (40px → 44px) to match the champion card.
   - Add a subtle progress indicator: "{answered}/{total} answered" in the done state, or "{remaining} left" in the available state.
   - Use `bg-gradient-to-br` and a tinted border (`border-primary/30` / `border-success/30`) to lift the card off the page.

3. **i18n updates**
   - Add/confirm keys:
     - `quiz_card_done` — "Done — back tomorrow"
     - `quiz_card_play` — "Play today's {n} questions"
     - `quiz_card_left` — "{n} left"
     - `quiz_card_answered` — "{n}/{total} answered"
   - Provide Persian equivalents in `src/lib/i18n.ts`.

4. **RTL / theming**
   - Keep `dir={dir}` on the card contents.
   - Use semantic tokens (`primary`, `success`, `surface`, `ink`) so both light and the deep-black dark theme look correct.

### Out of scope
- No changes to the quiz game page itself (`/games/quiz` or `/quiz`).
- No schema or backend changes; the existing `/api/public/quiz-today` response is enough.
- No new dependencies.