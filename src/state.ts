import type { AppState, Listener, RecentEvent, ScanResult, Toast } from "./models.js";

export function createInitialState(now = Date.now()): AppState {
  return {
    scan: { scannedAt: now, listeners: [], signals: [] },
    previous: null,
    recentEvents: [],
    selectedId: null,
    query: "",
    paused: false,
    lastError: null,
    toast: null
  };
}

export function mergeScan(state: AppState, next: ScanResult): AppState {
  const previousById = new Map(state.scan.listeners.map((listener) => [listener.id, listener]));
  const listeners = next.listeners.map((listener) => {
    const previous = previousById.get(listener.id);
    return {
      ...listener,
      firstSeen: previous?.firstSeen ?? listener.firstSeen,
      status: previous ? ("listening" as const) : ("new" as const)
    };
  });
  const events = makeRecentEvents(state.scan, next);

  return {
    ...state,
    previous: state.scan,
    scan: { ...next, listeners },
    recentEvents: [...events, ...state.recentEvents].slice(0, 24),
    lastError: null,
    toast: events[0] ? eventToToast(events[0]) : state.toast
  };
}

export function withError(state: AppState, error: unknown): AppState {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    ...state,
    lastError: detail,
    toast: {
      id: `error-${Date.now()}`,
      tone: "danger",
      title: "Scanner failed",
      detail
    }
  };
}

export function filterListeners(listeners: Listener[], query: string): Listener[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listeners;
  return listeners.filter((listener) =>
    [
      listener.port,
      listener.url,
      listener.pid,
      listener.processName,
      listener.executablePath,
      listener.commandLine
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

export function findSelected(state: AppState): Listener | null {
  if (!state.selectedId) return null;
  return state.scan.listeners.find((listener) => listener.id === state.selectedId) ?? null;
}

function eventToToast(event: RecentEvent): Toast {
  return {
    id: event.id,
    tone: event.tone,
    title: event.title,
    detail: event.detail
  };
}

function makeRecentEvents(previous: ScanResult, next: ScanResult): RecentEvent[] {
  const previousIds = new Set(previous.listeners.map((listener) => listener.id));
  const nextIds = new Set(next.listeners.map((listener) => listener.id));
  const events: RecentEvent[] = [];

  for (const listener of next.listeners) {
    if (!previousIds.has(listener.id)) {
      events.push({
        id: `new-${listener.id}-${next.scannedAt}`,
        at: next.scannedAt,
        tone: "success",
        title: `Port ${listener.port} appeared`,
        detail: `${listener.processName} is listening at ${listener.url}`
      });
    }
  }

  for (const listener of previous.listeners) {
    if (!nextIds.has(listener.id)) {
      events.push({
        id: `gone-${listener.id}-${next.scannedAt}`,
        at: next.scannedAt,
        tone: "info",
        title: `Port ${listener.port} disappeared`,
        detail: `${listener.processName} stopped listening`
      });
    }
  }

  return events;
}
