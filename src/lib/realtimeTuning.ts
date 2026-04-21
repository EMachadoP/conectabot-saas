export type RealtimePollingChannel = 'messages' | 'inbox';
export type RealtimeVisibilityState = 'visible' | 'hidden' | 'prerender' | 'unloaded';

interface RealtimePollingIntervalOptions {
  channel: RealtimePollingChannel;
  isMobile: boolean;
  visibilityState: RealtimeVisibilityState;
}

const MESSAGE_INTERVALS = {
  desktopVisible: 4000,
  mobileVisible: 8000,
  desktopHidden: 15000,
  mobileHidden: 25000,
} as const;

const INBOX_INTERVALS = {
  visible: 8000,
  hidden: 25000,
} as const;

export function getRealtimePollingInterval({
  channel,
  isMobile,
  visibilityState,
}: RealtimePollingIntervalOptions) {
  const isVisible = visibilityState === 'visible';

  if (channel === 'inbox') {
    return isVisible ? INBOX_INTERVALS.visible : INBOX_INTERVALS.hidden;
  }

  if (isVisible) {
    return isMobile ? MESSAGE_INTERVALS.mobileVisible : MESSAGE_INTERVALS.desktopVisible;
  }

  return isMobile ? MESSAGE_INTERVALS.mobileHidden : MESSAGE_INTERVALS.desktopHidden;
}

export function rememberProcessedId(current: Set<string>, id: string, limit = 100) {
  if (current.has(id)) return current;

  const next = new Set(current);
  next.add(id);

  if (next.size <= limit) return next;

  return new Set([...next].slice(next.size - limit));
}
