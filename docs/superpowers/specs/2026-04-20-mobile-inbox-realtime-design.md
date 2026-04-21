# Mobile Inbox and Realtime Reliability Design

## Goal

Improve the mobile inbox/chat experience and reduce realtime polling cost without changing the desktop workflow or backend contracts.

## Scope

- Increase practical touch targets in shared buttons and critical mobile chat controls.
- Reduce mobile overflow risk in the conversation list and chat header.
- Add a simple mobile swipe-back gesture from chat to conversation list.
- Make realtime polling adaptive for mobile and hidden tabs.
- Expose a lightweight connection status from message realtime subscriptions.
- Bound processed message ID memory for inbox deduplication.
- Prevent stale fetch responses from applying after rapid conversation switches.

## Architecture

Shared realtime tuning rules live in `src/lib/realtimeTuning.ts` so interval selection and bounded ID cache behavior can be tested outside React. `useRealtimeMessages` and `useRealtimeInbox` consume those helpers while keeping Supabase access inside the hooks. Mobile-only UI changes stay in existing inbox components and reuse the current shadcn/Radix component system.

## UI Behavior

The shared `Button` component uses 44px minimum dimensions for default and icon sizes. Small buttons remain available for dense desktop surfaces, but mobile chat header actions are converted to 44px icon/touch targets and long text actions are hidden on mobile. Header identity text uses `min-w-0` and `truncate` so narrow screens do not push action buttons off-screen.

The mobile chat view supports a horizontal right swipe starting from normal content to return to the conversation list. The gesture only runs when `isMobile` and `onBack` are present, and it uses a threshold high enough to avoid accidental triggers during vertical message scrolling.

## Realtime Behavior

Messages poll every 4s on visible desktop, 8s on visible mobile, 15s on hidden desktop, and 25s on hidden mobile. Inbox polling keeps the existing 8s visible and 25s hidden cadence but also routes through the shared helper for clarity and future tuning.

`useRealtimeMessages` returns `connectionStatus` as `connecting`, `connected`, `reconnecting`, or `error`. It sets reconnecting on Supabase channel errors and attempts a delayed fetch. Fetches are guarded by an incrementing request sequence and conversation ID check so older responses cannot overwrite the active conversation after fast switches.

`useRealtimeInbox` keeps the processed message ID set bounded with a deterministic helper. The cache is trimmed after inserts so memory cannot grow indefinitely.

## Testing

Add a focused Node script under `scripts/test-realtime-tuning.mjs` that compiles and imports `src/lib/realtimeTuning.ts` with esbuild, then asserts polling intervals and bounded ID cache behavior. Use a red-green cycle for the helper module. Final verification uses:

- `node scripts/test-realtime-tuning.mjs`
- `npm run build`

`npm run lint` is not a completion gate for this change because the clean worktree baseline already fails with unrelated repo-wide lint errors.
