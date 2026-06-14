## Web Push Notifications

Enable browser/PWA push so players get notified about likes, comments, replies, results, and newly-synced fixtures they haven't predicted yet — even when the app is closed.

### How it works (plain English)
1. The app asks the player for permission to send notifications.
2. Their browser hands us a unique "push subscription" we store in the database against their player ID.
3. Whenever the database creates a new entry in the notifications table, our server sends a push to every device that player has subscribed.
4. When the match-sync job pulls in new fixtures, we also send a one-time "new matches — go make your picks!" push to active subscribers.

### Important caveats (worth knowing upfront)
- **iOS (iPhone/iPad):** Safari only delivers web push if the user **installs the app to their Home Screen first** (Share → Add to Home Screen). We'll show a one-time hint on iOS explaining this.
- **Desktop Chrome/Firefox/Edge, Android Chrome:** Works out of the box once they grant permission.
- Push requires HTTPS — preview and published URLs are fine; localhost dev won't deliver pushes.

### What gets pushed
- **Per-notification (mirrors the bell):** `like`, `comment`, `reply`, `result` — same copy you already render in `NotificationsBell`, deep-linked to the relevant match/feed item.
- **New fixtures synced:** after `/api/public/sync-matches` upserts, detect newly added SCHEDULED matches and send each subscribed player a single "N new matches added — make your picks" push, but only if they have at least one un-predicted upcoming match. De-duplicated so they don't get spammed on every sync.

### Permission UX
- Quiet — don't auto-prompt on first load. Add a small "Enable notifications" button in **Settings** and a soft in-app banner on the Notifications bell sheet ("Get pinged when someone likes your pick"). User taps → native permission prompt → subscribe.
- Show current state (enabled / blocked / not set) in Settings with a disable toggle.

---

## Technical plan

### 1. Database
New migration adds:
- `public.push_subscriptions` — `id`, `player_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`, `last_seen_at`. Open RLS (matches existing pattern).
- `public.push_seen_matches` — `player_id`, `match_id`, `notified_at` — composite PK. Used to skip already-pushed new-fixture alerts.

### 2. VAPID keys
Two new secrets (I'll request via `add_secret` once you approve):
- `VAPID_PUBLIC_KEY` (also exposed as `VITE_VAPID_PUBLIC_KEY` so the client can subscribe)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)

I'll generate the keypair locally and you paste them in.

### 3. Service worker
`public/sw.js` — minimal handler, **no** offline cache (per project's PWA skill: manifest-only + push-only, not full PWA).
- `push` event → `showNotification(title, { body, icon, badge, data: { url } })`
- `notificationclick` → focus or open `data.url`

Registered from a guarded wrapper that only runs in production-like origins (skips Lovable preview / iframes).

### 4. Web app manifest
Add `public/manifest.webmanifest` + head links (name, icons, theme color, `display: standalone`) so iOS Add-to-Home-Screen + push works. Use existing app colors. No offline service worker logic.

### 5. Client subscribe flow
- `src/lib/push.ts` — helpers: `isSupported()`, `getPermissionState()`, `subscribe(playerId)`, `unsubscribe(playerId)`.
- Subscribe calls a new server fn `savePushSubscription` that upserts into `push_subscriptions`.
- Settings page gets a "Notifications" section with toggle + status text + iOS install hint.
- Optional soft banner in `NotificationsBell` sheet header when permission is `default`.

### 6. Sending pushes (server side)
Cloudflare Workers don't support the Node `web-push` library, so use an edge-compatible approach: build VAPID JWT + encrypt payload with **Web Crypto** directly (small helper in `src/lib/webpush.server.ts`, ~150 lines, no native deps). Alternative if I hit issues: `@block65/webcrypto-web-push` (Workers-compatible).

Two trigger paths:

**a) Notifications table → push**
- DB trigger `notify_push_on_notification` on `INSERT` to `public.notifications` calls `net.http_post` to a new route `/api/public/send-push` with `{ notification_id }`.
- Route loads the notification + recipient's subscriptions + actor display name, formats title/body using the same logic as `NotificationsBell`, sends to each endpoint. On `410 Gone`/`404`, deletes the dead subscription.

**b) Sync-matches → "new fixtures" push**
- After the upsert in `sync-matches.ts`, detect rows where `id NOT IN existing` (truly new) with `status='SCHEDULED'` and `kickoff_at > now()`.
- For each subscribed player, find their un-predicted new matches not already in `push_seen_matches`; if ≥1, queue one push ("3 new matches added — tap to make your picks") linking to `/`, then insert rows into `push_seen_matches` to prevent re-notify.
- All sends fire-and-forget with `Promise.allSettled`; sync response unchanged.

### 7. Files touched / created

```text
supabase migration              # push_subscriptions + push_seen_matches + trigger
public/sw.js                    # push + notificationclick
public/manifest.webmanifest     # PWA manifest
src/routes/__root.tsx           # manifest <link>, theme-color, SW register
src/lib/push.ts                 # client subscribe/unsubscribe helpers
src/lib/push.functions.ts       # savePushSubscription / removePushSubscription server fns
src/lib/webpush.server.ts       # VAPID JWT + payload encryption (Web Crypto)
src/routes/api/public/send-push.ts             # called by DB trigger
src/routes/api/public/sync-matches.ts          # add new-fixture push dispatch
src/routes/settings.tsx                        # notifications toggle UI
src/components/NotificationsBell.tsx           # optional soft prompt banner
src/lib/i18n.ts                                # new strings (en + fa)
```

### 8. Out of scope (ask if you want any of these)
- Offline support / full PWA caching (the project's skill explicitly says manifest-only + push unless you ask for offline).
- Email or SMS fallbacks.
- Per-event notification preferences (mute likes, mute comments etc.) — easy to add later; first pass is all-on with a single master toggle.
- Native iOS/Android apps via Capacitor.

### Questions before I build
1. Are you happy generating + handing me the VAPID keypair via the secrets prompt (I'll generate, you paste)?
2. Confirm the "new fixtures" push goes to **everyone** subscribed (not just users who've logged in recently)?
3. Should the master toggle live in Settings only, or also a one-time soft prompt the first time they open the Notifications bell?
