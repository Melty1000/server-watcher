import type { RecentEvent } from "./models.js";

export type AppNotification = {
  title: string;
  body: string;
};

export function formatEventNotification(event: RecentEvent): AppNotification {
  return {
    title: "Server Watcher",
    body: `${event.title}\n${event.detail}`,
  };
}

export function formatKillNotification(pid: number): AppNotification {
  return {
    title: "Server Watcher",
    body: `Process stopped\nPID ${pid} was force-stopped by Server Watcher.`,
  };
}
