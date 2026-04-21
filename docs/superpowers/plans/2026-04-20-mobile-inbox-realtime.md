# Mobile Inbox and Realtime Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve mobile inbox usability and make realtime updates less battery-intensive and more robust.

**Architecture:** Extract realtime tuning into a small tested helper, then wire it into existing Supabase hooks. Keep UI work inside the current shadcn Button and inbox components to avoid broad redesign.

**Tech Stack:** Vite, React 18, TypeScript, shadcn/Radix UI, Supabase realtime, esbuild-backed focused Node tests.

---

### Task 1: Realtime Tuning Helpers

**Files:**
- Create: `scripts/test-realtime-tuning.mjs`
- Create: `src/lib/realtimeTuning.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-realtime-tuning.mjs` with assertions for:
- visible desktop messages interval is `4000`
- visible mobile messages interval is `8000`
- hidden desktop messages interval is `15000`
- hidden mobile messages interval is `25000`
- bounded ID cache preserves only the newest IDs at the configured limit

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-realtime-tuning.mjs`
Expected: FAIL because `src/lib/realtimeTuning.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/realtimeTuning.ts` exporting `getRealtimePollingInterval` and `rememberProcessedId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-realtime-tuning.mjs`
Expected: PASS.

### Task 2: Wire Realtime Hooks

**Files:**
- Modify: `src/hooks/useRealtimeMessages.ts`
- Modify: `src/hooks/useRealtimeInbox.ts`

- [ ] **Step 1: Update message hook state**

Add `connectionStatus` state and request sequencing. Return `connectionStatus` from the hook.

- [ ] **Step 2: Use adaptive polling**

Use `getRealtimePollingInterval` in messages and inbox hooks, passing mobile state from `useIsMobile`.

- [ ] **Step 3: Bound processed message cache**

Use `rememberProcessedId` in `useRealtimeInbox` instead of manually growing/trimming the set.

- [ ] **Step 4: Verify helper tests**

Run: `node scripts/test-realtime-tuning.mjs`
Expected: PASS.

### Task 3: Mobile Inbox UI

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/inbox/ChatHeader.tsx`
- Modify: `src/components/inbox/ChatArea.tsx`
- Modify: `src/components/inbox/ConversationList.tsx`
- Modify: `src/components/inbox/ConversationItem.tsx`
- Modify: `src/pages/Inbox.tsx`

- [ ] **Step 1: Increase touch targets**

Set Button default and icon sizes to at least 44px, using shadcn-compatible `size-*` utilities.

- [ ] **Step 2: Prevent mobile overflow**

Add `min-w-0`, `truncate`, responsive text sizing, and mobile-only hiding for long header action labels.

- [ ] **Step 3: Add swipe back**

Add pointer tracking in `ChatArea` that calls `onBack` after a right swipe threshold on mobile.

- [ ] **Step 4: Surface connection status**

Pass `connectionStatus` from `Inbox.tsx` into `ChatArea` and `ChatHeader`; show a compact text status only when reconnecting or error.

### Task 4: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run: `node scripts/test-realtime-tuning.mjs`
Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 3: Record lint baseline**

Run: `npm run lint`
Expected: FAIL with preexisting repo-wide lint errors unrelated to this change.
