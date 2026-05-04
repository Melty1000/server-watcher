export type ListenerStatus = "listening" | "new" | "killed" | "failed";

export interface Listener {
  id: string;
  port: number;
  protocol: "TCP";
  localAddress: string;
  url: string;
  pid: number;
  processName: string;
  executablePath: string;
  commandLine: string;
  status: ListenerStatus;
  firstSeen: number;
  lastSeen: number;
}

export interface ProcessSignal {
  id: string;
  pid: number;
  processName: string;
  executablePath: string;
  commandLine: string;
  reason: string;
}

export interface ScanResult {
  scannedAt: number;
  listeners: Listener[];
  signals: ProcessSignal[];
}

export interface RecentEvent {
  id: string;
  at: number;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  detail: string;
}

export interface Toast {
  id: string;
  tone: RecentEvent["tone"];
  title: string;
  detail: string;
}

export interface AppState {
  scan: ScanResult;
  previous: ScanResult | null;
  recentEvents: RecentEvent[];
  selectedId: string | null;
  query: string;
  paused: boolean;
  lastError: string | null;
  toast: Toast | null;
}
