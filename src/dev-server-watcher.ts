import type { ServerWatcherApi } from "./server-watcher-api";
import type { Listener, ProcessSignal, ScanResult } from "./models";

const createdAt = Date.now() - 1000 * 60 * 11;
const killedPids = new Set<number>();

const mockListeners: Listener[] = [
  {
    id: "tcp-5177-28416",
    port: 5177,
    protocol: "TCP",
    localAddress: "127.0.0.1",
    url: "http://localhost:5177",
    pid: 28416,
    processName: "node.exe",
    executablePath: "C:\\Projects\\Server Watcher\\node_modules\\.bin\\vite.cmd",
    commandLine: "npm run dev:web -- --port 5177",
    status: "listening",
    firstSeen: createdAt,
    lastSeen: createdAt
  },
  {
    id: "tcp-5432-11320",
    port: 5432,
    protocol: "TCP",
    localAddress: "0.0.0.0",
    url: "http://localhost:5432",
    pid: 11320,
    processName: "postgres.exe",
    executablePath: "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe",
    commandLine: "\"C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe\" -D \"E:\\data\\pg16\"",
    status: "listening",
    firstSeen: createdAt - 1000 * 60 * 42,
    lastSeen: createdAt
  },
  {
    id: "tcp-8787-20648",
    port: 8787,
    protocol: "TCP",
    localAddress: "::",
    url: "http://localhost:8787",
    pid: 20648,
    processName: "wrangler.exe",
    executablePath: "C:\\Users\\Melty1000\\AppData\\Roaming\\npm\\wrangler.cmd",
    commandLine: "wrangler dev --local --port 8787",
    status: "listening",
    firstSeen: createdAt - 1000 * 60 * 3,
    lastSeen: createdAt
  }
];

const mockSignals: ProcessSignal[] = [
  {
    id: "signal-19384",
    pid: 19384,
    processName: "python.exe",
    executablePath: "E:\\.venvs\\tools\\Scripts\\python.exe",
    commandLine: "python -m uvicorn api.main:app --reload",
    reason: "Dev-like process without a mapped listening port"
  }
];

export function installDevServerWatcherMock() {
  if (!import.meta.env.DEV || window.serverWatcher) return;

  const api: ServerWatcherApi = {
    async scanServers(): Promise<ScanResult> {
      const scannedAt = Date.now();
      return {
        scannedAt,
        listeners: mockListeners
          .filter((listener) => !killedPids.has(listener.pid))
          .map((listener, index) => ({
            ...listener,
            status: "listening",
            lastSeen: scannedAt - index * 45_000
          })),
        signals: mockSignals.filter((signal) => !killedPids.has(signal.pid))
      };
    },
    async killProcess(pid: number): Promise<boolean> {
      killedPids.add(pid);
      return true;
    },
    async openUrl(url: string): Promise<void> {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    async copyText(text: string): Promise<void> {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }
    },
    async notify(): Promise<void> {
      return;
    },
    async hideToTray(): Promise<void> {
      return;
    },
    async minimize(): Promise<void> {
      return;
    },
    async toggleMaximize(): Promise<void> {
      return;
    }
  };

  Object.defineProperty(window, "serverWatcher", {
    configurable: true,
    value: api
  });
}
