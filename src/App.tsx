import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ChevronDown,
  CircleHelp,
  Copy,
  ExternalLink,
  Minus,
  MonitorUp,
  Pause,
  Play,
  RefreshCw,
  Square,
  X,
  Zap,
} from "lucide-react";
import appIconUrl from "./assets/server-watcher-icon.png";
import type {
  AppState,
  Listener,
  ProcessSignal,
  RecentEvent,
  Toast,
} from "./models";
import { formatEventNotification, formatKillNotification } from "./notifications";
import {
  createInitialState,
  filterListeners,
  mergeScan,
  withError,
} from "./state";

type SelectedItem = Listener | ProcessSignal;

export default function App() {
  const [state, setState] = useState(() => createInitialState());
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef<AppState>(state);
  const devSelectionAppliedRef = useRef(false);
  const devSelectedId = getDevSelectedId();

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const scan = useCallback(
    async ({ notifyChanges = false } = {}) => {
      const current = stateRef.current;
      if (current.paused) return;

      try {
        const before = current.recentEvents.length;
        const previousToastId = current.toast?.id;
        const result = await window.serverWatcher.scanServers();
        let next = mergeScan(stateRef.current, result);
        if (
          devSelectedId &&
          !devSelectionAppliedRef.current &&
          !next.selectedId &&
          next.scan.listeners.some((listener) => listener.id === devSelectedId)
        ) {
          devSelectionAppliedRef.current = true;
          next = { ...next, selectedId: devSelectedId };
        }
        commit(next);

        if (next.toast && next.toast.id !== previousToastId) {
          scheduleToastClear(next.toast.id, commit, stateRef);
        }

        if (notifyChanges && next.recentEvents.length > before) {
          const event = next.recentEvents[0];
          const notification = formatEventNotification(event);
          await window.serverWatcher.notify(notification.title, notification.body);
        }
      } catch (error) {
        const next = withError(stateRef.current, error);
        commit(next);
        if (next.toast) scheduleToastClear(next.toast.id, commit, stateRef);
      }
    },
    [commit, devSelectedId],
  );

  useEffect(() => {
    void scan();
    const interval = window.setInterval(
      () => void scan({ notifyChanges: true }),
      2500,
    );
    return () => window.clearInterval(interval);
  }, [scan]);

  const listeners = useMemo(
    () => filterListeners(state.scan.listeners, state.query),
    [state.query, state.scan.listeners],
  );
  const selected = findSelectedItem(state);

  function updateState(next: AppState) {
    commit(next);
  }

  async function killSelected(pid: number) {
    const toast: Toast = {
      id: `kill-${pid}-${Date.now()}`,
      tone: "danger",
      title: "Process stopped",
      detail: `PID ${pid} was stopped`,
    };

    await window.serverWatcher.killProcess(pid);
    const notification = formatKillNotification(pid);
    await window.serverWatcher.notify(notification.title, notification.body);
    const next = { ...stateRef.current, selectedId: null, toast };
    commit(next);
    scheduleToastClear(toast.id, commit, stateRef);
    await scan();
  }

  async function refreshNow() {
    setRefreshing(true);
    try {
      await scan();
    } finally {
      window.setTimeout(() => setRefreshing(false), 220);
    }
  }

  const scanStatus = state.paused ? "Paused" : "Monitoring";
  const listenerCountLabel = `${listeners.length} ${listeners.length === 1 ? "listener" : "listeners"}`;
  const lastScanLabel = `Last scan ${formatClock(state.scan.scannedAt)}`;

  const renderMainContent = () => (
    <main className="main-scroll">
      <section className="instrument">
        <div className="instrument-main">
          <section className="hero" aria-label="Current server status">
            <div className="hero-count">
              <span className="live-dot" />
              <div>
                <strong>{listeners.length} Listening</strong>
                <span>Active Listeners</span>
              </div>
            </div>
            <button
              className="tray-button"
              type="button"
              onClick={() => void window.serverWatcher.hideToTray()}
            >
              <MonitorUp size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>Tray</span>
              <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </section>

          <section className="recent-terminal" aria-label="Recent Changes">
            <div className="terminal-head">
              <strong>Recent Changes</strong>
              <span>{state.paused ? "Paused" : "Now"}</span>
            </div>
            <div className="terminal-body">
              {renderRecentTerminal(state.recentEvents)}
            </div>
          </section>

          {state.lastError ? (
            <p className="error-banner">{state.lastError}</p>
          ) : null}

          <label className="search">
            <span>Find port, process, URL</span>
            <input
              value={state.query}
              onChange={(event) =>
                updateState({
                  ...stateRef.current,
                  query: event.target.value,
                })
              }
              placeholder="Find port, process, URL"
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="content-scroll">
        <section className="panel listeners-panel">
          <div className="section-heading listeners-heading">
            <h2>Active Listeners</h2>
            <span>{listeners.length}</span>
          </div>
          <div className="listener-list">
            {listeners.length
              ? listeners.map((listener) => (
                  <ListenerRow
                    key={listener.id}
                    listener={listener}
                    selectedId={state.selectedId}
                    onSelect={(id) =>
                      updateState({ ...stateRef.current, selectedId: id })
                    }
                  />
                ))
              : renderEmpty()}
          </div>
        </section>

        <section className="panel signals-panel">
          <div className="section-heading">
            <h2>
              <Zap size={18} strokeWidth={1.9} aria-hidden="true" />
              Process Signals
            </h2>
            <span>{state.scan.signals.length}</span>
          </div>
          <div className="signal-list">
            {state.scan.signals.length ? (
              state.scan.signals.map((signal) => (
                <SignalRow
                  key={signal.id}
                  signal={signal}
                  selectedId={state.selectedId}
                  onSelect={(id) =>
                    updateState({ ...stateRef.current, selectedId: id })
                  }
                />
              ))
            ) : (
              <p className="muted compact">No unmapped dev-like processes.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );

  return (
    <section className="shell">
      <header className="titlebar">
        <div className="title-drag" title="Drag window">
          <span className="app-mark">
            <img src={appIconUrl} alt="" aria-hidden="true" />
          </span>
          <strong>Server Watcher</strong>
        </div>
        <div className="window-controls" aria-label="Window controls">
          <button
            className="window-control minimize"
            type="button"
            onClick={() => void window.serverWatcher.minimize()}
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus size={15} strokeWidth={1.8} />
          </button>
          <button
            className="window-control maximize"
            type="button"
            onClick={() => void window.serverWatcher.toggleMaximize()}
            title="Maximize"
            aria-label="Maximize"
          >
            <Square size={13} strokeWidth={1.8} />
          </button>
          <button
            className="window-control close"
            type="button"
            onClick={() => void window.serverWatcher.hideToTray()}
            title="Close to tray"
            aria-label="Close to tray"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {renderMainContent()}

      <footer className="bottombar">
        <button
          className={`settings-button ${state.paused ? "paused" : ""}`}
          type="button"
          onClick={() =>
            updateState({
              ...stateRef.current,
              paused: !stateRef.current.paused,
            })
          }
          title={state.paused ? "Resume" : "Pause"}
          aria-label={state.paused ? "Resume monitoring" : "Pause monitoring"}
          aria-pressed={state.paused}
        >
          {state.paused ? (
            <Play size={16} strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <Pause size={16} strokeWidth={1.9} aria-hidden="true" />
          )}
        </button>
        <div className="status-cluster" aria-live="polite">
          <strong>{scanStatus}</strong>
          <span>{listenerCountLabel}</span>
          <span>{lastScanLabel}</span>
        </div>
        <button
          className={`refresh-link ${refreshing ? "refreshing" : ""}`}
          type="button"
          onClick={() => void refreshNow()}
          disabled={refreshing}
        >
          <RefreshCw size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>{refreshing ? "Refreshing" : "Refresh"}</span>
        </button>
      </footer>

      <aside
        className={`inspector ${selected ? "open" : ""}`}
        aria-hidden={selected ? "false" : "true"}
      >
        {selected ? (
          <Inspector
            item={selected}
            onClose={() =>
              updateState({ ...stateRef.current, selectedId: null })
            }
            onKill={(pid) => void killSelected(pid)}
          />
        ) : null}
      </aside>

      {state.toast ? <ToastView toast={state.toast} /> : null}
    </section>
  );
}

function getDevSelectedId(): string | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(window.location.search).get("selected");
}

function ListenerRow({
  listener,
  selectedId,
  onSelect,
}: {
  listener: Listener;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const confidence = confidenceFor(listener);
  const selected = selectedId === listener.id ? "selected" : "";

  return (
    <article
      className={`listener ${listener.status === "new" ? "is-new" : ""} ${selected} ${confidence.tone}`}
      onClick={() => onSelect(listener.id)}
    >
      <div className="port-block">
        <strong>{listener.port}</strong>
        <span>{listener.protocol}</span>
      </div>
      <div className="listener-main">
        <div className="listener-identity">
          <span className="small-dot" />
          <strong>{displayName(listener)}</strong>
        </div>
        <span>{listener.processName}</span>
        <code>{listener.url.replace("http://", "")}</code>
      </div>
      <div className="listener-meta">
        <span>PID {listener.pid}</span>
        <strong className={`confidence ${confidence.tone}`}>
          {confidence.label}
        </strong>
      </div>
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        <button
          className="open-action"
          type="button"
          onClick={() => void window.serverWatcher.openUrl(listener.url)}
        >
          <ExternalLink size={16} strokeWidth={1.9} aria-hidden="true" />
          Open
        </button>
        <button
          className="copy-action"
          type="button"
          onClick={() =>
            void window.serverWatcher.copyText(
              `${listener.url} PID ${listener.pid} ${listener.processName}`,
            )
          }
        >
          <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
          Copy
        </button>
        <button
          type="button"
          className="danger kill-action"
          onClick={() => onSelect(listener.id)}
        >
          <X size={17} strokeWidth={1.9} aria-hidden="true" />
          Kill
        </button>
      </div>
    </article>
  );
}

function SignalRow({
  signal,
  selectedId,
  onSelect,
}: {
  signal: ProcessSignal;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = selectedId === signal.id ? "selected" : "";
  return (
    <article
      className={`signal ${selected}`}
      onClick={() => onSelect(signal.id)}
    >
      <div>
        <strong>{signal.processName}</strong>
        <small>
          {signal.commandLine || signal.executablePath || "No command details"}
        </small>
      </div>
      <span>PID {signal.pid}</span>
      <CircleHelp
        className="signal-help"
        size={17}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </article>
  );
}

function Inspector({
  item,
  onClose,
  onKill,
}: {
  item: SelectedItem;
  onClose: () => void;
  onKill: (pid: number) => void;
}) {
  const isListener = "port" in item;
  const summary = getInspectorSummary(item);
  const copyDetails = getCopyDetails(item);
  const confidence = isListener ? confidenceFor(item) : null;
  const killSectionId = `kill-confirm-${item.pid}`;

  function reviewKill() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(killSectionId)?.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div className="inspector-stack">
      <div className="inspector-header">
        <div>
          <p className="eyebrow">
            {isListener ? "Listener detail" : "Process signal"}
          </p>
          <h2>{isListener ? `Port ${item.port}` : item.processName}</h2>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <section
        className="inspector-summary"
        aria-label="Selected process status"
      >
        <span className={`summary-dot ${summary.tone}`} />
        <div>
          <strong>{summary.status}</strong>
          <span>{summary.detail}</span>
        </div>
        <code>PID {item.pid}</code>
      </section>

      <div className="inspector-quick-actions" aria-label="Quick actions">
        {isListener ? (
          <button
            className="inspector-action primary"
            type="button"
            onClick={() => void window.serverWatcher.openUrl(item.url)}
          >
            <ExternalLink size={15} strokeWidth={1.9} aria-hidden="true" />
            Open URL
          </button>
        ) : null}
        <button
          className="inspector-action"
          type="button"
          onClick={() => void window.serverWatcher.copyText(copyDetails)}
        >
          <Copy size={15} strokeWidth={1.9} aria-hidden="true" />
          Copy Details
        </button>
        <button
          className="inspector-action danger"
          type="button"
          onClick={reviewKill}
        >
          <X size={15} strokeWidth={1.9} aria-hidden="true" />
          Kill
        </button>
      </div>

      <div className="kill-confirm" id={killSectionId}>
        <strong>Kill process?</strong>
        <p>
          This will force-stop PID {item.pid}. Confirm only if you recognize the
          process.
        </p>
        <button
          className="danger solid"
          type="button"
          onClick={() => onKill(item.pid)}
        >
          Kill PID {item.pid}
        </button>
      </div>

      {isListener ? (
        <section className="inspector-section">
          <h3>Connection</h3>
          <dl className="detail-grid">
            <DetailRow label="URL" value={item.url} />
            <DetailRow
              label="Address"
              value={item.localAddress || "localhost"}
            />
            <DetailRow label="Protocol" value={item.protocol} />
          </dl>
        </section>
      ) : null}

      <section className="inspector-section">
        <h3>Process</h3>
        <dl className="detail-grid">
          <DetailRow label="Name" value={item.processName} />
          <DetailRow label="PID" value={String(item.pid)} />
          <DetailRow
            label="Path"
            value={item.executablePath || "Unavailable"}
          />
        </dl>
      </section>

      {"firstSeen" in item ? (
        <section className="inspector-section compact-section">
          <h3>Lifecycle</h3>
          <dl className="detail-grid">
            <DetailRow
              label="First seen"
              value={formatRelativeOrClock(item.firstSeen)}
            />
            <DetailRow
              label="Last seen"
              value={formatRelativeOrClock(item.lastSeen)}
            />
          </dl>
        </section>
      ) : null}

      <section className="inspector-section">
        <h3>Command</h3>
        <dl className="detail-grid command-grid">
          <DetailRow label="Line" value={item.commandLine || "Unavailable"} />
        </dl>
      </section>

      <section className="inspector-note">
        <strong>
          {isListener ? `${confidence?.label} match` : "Signal explanation"}
        </strong>
        <p>{getConfidenceExplanation(item)}</p>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  return (
    <aside className={`toast ${toast.tone}`} role="status">
      <strong>{toast.title}</strong>
      <span>{toast.detail}</span>
    </aside>
  );
}

function renderRecentTerminal(events: RecentEvent[]) {
  if (!events.length) {
    return (
      <>
        <p className="terminal-line info">
          <span className="terminal-prompt">i</span>
          <span className="terminal-text">Waiting for local port changes</span>
        </p>
        <p className="terminal-line info">
          <span className="terminal-prompt">0</span>
          <span className="terminal-text">No changes yet</span>
        </p>
      </>
    );
  }

  return events.slice(0, 4).map((event) => (
    <p className={`terminal-line ${event.tone}`} key={event.id}>
      <span className="terminal-prompt">
        {event.tone === "danger" ? "!" : ">"}
      </span>
      <span className="terminal-text">
        <time>{formatClock(event.at)}</time>
        <strong>{event.title}</strong>
        <span>{formatTerminalDetail(event.detail)}</span>
      </span>
    </p>
  ));
}

function formatTerminalDetail(value: string): string {
  return value
    .replace(" is listening at http://", " at ")
    .replace(" is listening at ", " at ")
    .replace(" stopped listening", " stopped")
    .replace("http://", "");
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeOrClock(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (elapsed < minute) return "Just now";
  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute));
    return `${minutes} min ago`;
  }
  if (elapsed < 24 * hour) {
    const hours = Math.max(1, Math.round(elapsed / hour));
    return `${hours} hr ago`;
  }
  return formatClock(timestamp);
}

function getInspectorSummary(item: SelectedItem): {
  status: string;
  tone: "high" | "medium" | "warning";
  detail: string;
} {
  if ("port" in item) {
    const confidence = confidenceFor(item);
    return {
      status: "Listening",
      tone: confidence.tone,
      detail: `${confidence.label} on ${item.url.replace("http://", "")}`,
    };
  }

  return {
    status: "Unmapped signal",
    tone: "warning",
    detail: item.reason,
  };
}

function getConfidenceExplanation(item: SelectedItem): string {
  if (!("port" in item)) return item.reason;

  const confidence = confidenceFor(item);
  if (confidence.tone === "high") {
    return "Server Watcher matched this listening socket to a known local development process.";
  }

  return "Server Watcher found a listening socket, but the process identity is less specific.";
}

function getCopyDetails(item: SelectedItem): string {
  const fields = [
    "port" in item ? `URL: ${item.url}` : null,
    `Process: ${item.processName}`,
    `PID: ${item.pid}`,
    `Path: ${item.executablePath || "Unavailable"}`,
    `Command: ${item.commandLine || "Unavailable"}`,
  ];

  return fields.filter(Boolean).join("\n");
}

function displayName(listener: Listener): string {
  const process = listener.processName.toLowerCase();
  if (process.includes("postgres")) return "PostgreSQL";
  if (process.includes("redis")) return "Redis";
  if (process.includes("node")) return "Vite";
  if (process.includes("python")) return "Python";
  if (process.includes("service")) return "Service";
  return listener.processName.replace(/\.exe$/i, "");
}

function confidenceFor(listener: Listener): {
  label: string;
  tone: "high" | "medium";
} {
  const process = listener.processName.toLowerCase();
  if (process.includes("redis") || process.includes("unknown")) {
    return { label: "Medium confidence", tone: "medium" };
  }
  return { label: "High confidence", tone: "high" };
}

function renderEmpty() {
  return (
    <div className="empty">
      <strong>No active listeners</strong>
      <span>Server Watcher is still monitoring.</span>
    </div>
  );
}

function findSelectedItem(state: AppState): SelectedItem | null {
  if (!state.selectedId) return null;
  return (
    state.scan.listeners.find((listener) => listener.id === state.selectedId) ??
    state.scan.signals.find((signal) => signal.id === state.selectedId) ??
    null
  );
}

function scheduleToastClear(
  id: string,
  commit: (state: AppState) => void,
  stateRef: RefObject<AppState>,
) {
  window.setTimeout(() => {
    if (stateRef.current.toast?.id === id) {
      commit({ ...stateRef.current, toast: null });
    }
  }, 3600);
}
