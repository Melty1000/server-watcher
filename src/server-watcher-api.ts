import type { ScanResult } from "./models.js";

export interface ServerWatcherApi {
  scanServers(): Promise<ScanResult>;
  killProcess(pid: number): Promise<boolean>;
  openUrl(url: string): Promise<void>;
  copyText(text: string): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  hideToTray(): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

declare global {
  interface Window {
    serverWatcher: ServerWatcherApi;
  }
}
