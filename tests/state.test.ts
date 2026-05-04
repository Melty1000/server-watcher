import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, filterListeners, mergeScan } from "../src/state.js";
import type { Listener } from "../src/models.js";

function listener(port: number, pid: number, processName = "node.exe"): Listener {
  return {
    id: `tcp-${port}-${pid}`,
    port,
    protocol: "TCP",
    localAddress: "127.0.0.1",
    url: `http://localhost:${port}`,
    pid,
    processName,
    executablePath: `C:\\Tools\\${processName}`,
    commandLine: `${processName} dev`,
    status: "listening",
    firstSeen: 1000,
    lastSeen: 1000
  };
}

test("mergeScan marks a first-time listener as new", () => {
  const merged = mergeScan(createInitialState(900), {
    scannedAt: 1000,
    listeners: [listener(3000, 10)],
    signals: []
  });

  assert.equal(merged.scan.listeners[0].status, "new");
  assert.equal(merged.recentEvents[0].title, "Port 3000 appeared");
});

test("mergeScan records disappeared listeners", () => {
  const state = mergeScan(createInitialState(900), {
    scannedAt: 1000,
    listeners: [listener(5173, 20)],
    signals: []
  });
  const merged = mergeScan(state, { scannedAt: 2000, listeners: [], signals: [] });

  assert.equal(merged.recentEvents[0].title, "Port 5173 disappeared");
});

test("filterListeners searches port, process, URL, and command text", () => {
  const listeners = [listener(3000, 10), listener(5432, 99, "postgres.exe")];

  assert.deepEqual(filterListeners(listeners, "3000").map((item) => item.port), [3000]);
  assert.deepEqual(filterListeners(listeners, "postgres").map((item) => item.port), [5432]);
  assert.deepEqual(filterListeners(listeners, "localhost:3000").map((item) => item.port), [3000]);
});
