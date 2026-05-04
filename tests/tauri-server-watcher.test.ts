import test from "node:test";
import assert from "node:assert/strict";
import type { ScanResult } from "../src/models.js";
import {
  createTauriServerWatcherApi,
  installTauriServerWatcher,
} from "../src/tauri-server-watcher.js";

const scanResult: ScanResult = {
  scannedAt: 1234,
  listeners: [],
  signals: [],
};

type TestDeps = {
  invoke<T>(command: string, payload?: unknown): Promise<T>;
  openUrl(url: string): Promise<void>;
  writeText(text: string): Promise<void>;
  sendNotification(notification: { title: string; body: string }): void;
};

type TestWindow = Window &
  typeof globalThis & {
    serverWatcher?: {
      scanServers(): Promise<ScanResult>;
    };
  };

function createDeps(): TestDeps & {
  calls: string[];
  args: unknown[];
} {
  const calls: string[] = [];
  const args: unknown[] = [];

  return {
    calls,
    args,
    async invoke<T>(command: string, payload?: unknown): Promise<T> {
      calls.push(command);
      args.push(payload);
      if (command === "scan_servers") return scanResult as T;
      if (command === "kill_process") return undefined as T;
      if (command === "hide_to_tray") return undefined as T;
      if (command === "minimize_window") return undefined as T;
      if (command === "toggle_maximize") return undefined as T;
      throw new Error(`Unexpected command ${command}`);
    },
    async openUrl(url) {
      calls.push("open_url");
      args.push(url);
    },
    async writeText(text) {
      calls.push("write_text");
      args.push(text);
    },
    sendNotification(notification) {
      calls.push("notify");
      args.push(notification);
    },
  };
}

test("createTauriServerWatcherApi maps desktop calls to Tauri commands and plugins", async () => {
  const deps = createDeps();
  const api = createTauriServerWatcherApi(deps);

  assert.equal(await api.scanServers(), scanResult);
  assert.equal(await api.killProcess(42), true);
  await api.hideToTray();
  await api.minimize();
  await api.toggleMaximize();
  await api.openUrl("http://localhost:5173");
  await api.copyText("PID 42");
  await api.notify("Server Watcher", "Port appeared");

  assert.deepEqual(deps.calls, [
    "scan_servers",
    "kill_process",
    "hide_to_tray",
    "minimize_window",
    "toggle_maximize",
    "open_url",
    "write_text",
    "notify",
  ]);
  assert.deepEqual(deps.args, [
    undefined,
    { pid: 42 },
    undefined,
    undefined,
    undefined,
    "http://localhost:5173",
    "PID 42",
    {
      title: "Server Watcher",
      body: "Port appeared",
      largeBody: "Port appeared",
      summary: "Local development monitor",
      group: "server-watcher",
      autoCancel: true,
    },
  ]);
});

test("installTauriServerWatcher installs only in a Tauri runtime without an existing bridge", () => {
  const deps = createDeps();
  const target = {} as TestWindow;

  const installed = installTauriServerWatcher({
    deps,
    isTauriRuntime: () => true,
    target,
  });

  assert.equal(installed, true);
  assert.equal(typeof target.serverWatcher?.scanServers, "function");

  const secondInstall = installTauriServerWatcher({
    deps,
    isTauriRuntime: () => true,
    target,
  });

  assert.equal(secondInstall, false);
});

test("Tauri notification failures are no-ops like unsupported Electron notifications", async () => {
  const deps = createDeps();
  deps.sendNotification = () => {
    throw new Error("Notifications are unavailable");
  };
  const api = createTauriServerWatcherApi(deps);

  await assert.doesNotReject(() => api.notify("Server Watcher", "Port appeared"));
});

test("installTauriServerWatcher leaves browser dev mocks in control outside Tauri", () => {
  const deps = createDeps();
  const target = {} as TestWindow;

  const installed = installTauriServerWatcher({
    deps,
    isTauriRuntime: () => false,
    target,
  });

  assert.equal(installed, false);
  assert.equal("serverWatcher" in target, false);
});
