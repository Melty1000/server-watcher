import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { writeText as tauriWriteText } from "@tauri-apps/plugin-clipboard-manager";
import { sendNotification as tauriSendNotification } from "@tauri-apps/plugin-notification";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import type { ServerWatcherApi } from "./server-watcher-api.js";
import type { ScanResult } from "./models.js";

type TauriNotification = {
  title: string;
  body: string;
  largeBody?: string;
  summary?: string;
  group?: string;
  autoCancel?: boolean;
};

export type TauriServerWatcherDeps = {
  invoke<T>(command: string, payload?: unknown): Promise<T>;
  openUrl(url: string): Promise<void>;
  writeText(text: string): Promise<void>;
  sendNotification(notification: TauriNotification): void | Promise<void>;
};

type InstallOptions = {
  deps?: TauriServerWatcherDeps;
  isTauriRuntime?: () => boolean;
  target?: ServerWatcherTarget;
};

type ServerWatcherTarget = Window &
  typeof globalThis & {
    serverWatcher?: ServerWatcherApi;
  };

const defaultDeps: TauriServerWatcherDeps = {
  invoke: tauriInvoke,
  openUrl: tauriOpenUrl,
  writeText: tauriWriteText,
  sendNotification: tauriSendNotification,
};

export function createTauriServerWatcherApi(
  deps: TauriServerWatcherDeps,
): ServerWatcherApi {
  return {
    scanServers: () => deps.invoke<ScanResult>("scan_servers"),
    async killProcess(pid: number) {
      await deps.invoke<void>("kill_process", { pid });
      return true;
    },
    openUrl: (url: string) => deps.openUrl(url),
    copyText: (text: string) => deps.writeText(text),
    async notify(title: string, body: string) {
      try {
        await deps.sendNotification({
          title,
          body,
          largeBody: body,
          summary: "Local development monitor",
          group: "server-watcher",
          autoCancel: true,
        });
      } catch {
        return;
      }
    },
    hideToTray: () => deps.invoke<void>("hide_to_tray"),
    minimize: () => deps.invoke<void>("minimize_window"),
    toggleMaximize: () => deps.invoke<void>("toggle_maximize"),
  };
}

export function installTauriServerWatcher(options: InstallOptions = {}): boolean {
  const target = options.target ?? window;
  if (target.serverWatcher || !(options.isTauriRuntime ?? isTauriRuntime)()) {
    return false;
  }

  Object.defineProperty(target, "serverWatcher", {
    configurable: true,
    value: createTauriServerWatcherApi(options.deps ?? defaultDeps),
  });

  return true;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}
