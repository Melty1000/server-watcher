import test from "node:test";
import assert from "node:assert/strict";
import {
  formatEventNotification,
  formatKillNotification,
} from "../src/notifications.js";
import type { RecentEvent } from "../src/models.js";

test("formatEventNotification brands Windows notifications with app identity", () => {
  const event: RecentEvent = {
    id: "new-tcp-5173-42",
    at: 1000,
    tone: "success",
    title: "Port 5173 appeared",
    detail: "node.exe is listening at http://localhost:5173",
  };

  assert.deepEqual(formatEventNotification(event), {
    title: "Server Watcher",
    body: "Port 5173 appeared\nnode.exe is listening at http://localhost:5173",
  });
});

test("formatKillNotification describes the force-stopped process", () => {
  assert.deepEqual(formatKillNotification(28416), {
    title: "Server Watcher",
    body: "Process stopped\nPID 28416 was force-stopped by Server Watcher.",
  });
});
