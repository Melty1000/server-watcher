import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installDevServerWatcherMock } from "./dev-server-watcher";
import { installTauriServerWatcher } from "./tauri-server-watcher";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");

installTauriServerWatcher();
installDevServerWatcherMock();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
