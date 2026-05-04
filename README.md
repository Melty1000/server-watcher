# Server Watcher

Server Watcher is a Windows desktop app by Melty1000 for watching local development servers.

## Development

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm install
npm run check
npm test
cargo check --manifest-path src-tauri/Cargo.toml
npm run dev
```

## Build

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run build
npm run dist:tauri
```

`npm run build` verifies and builds the shared React/Vite frontend.
`npm run dist:tauri` builds the Windows Tauri executable and installer.

Build artifacts are written under:

```text
src-tauri\target\release\
src-tauri\target\release\bundle\nsis\
```

## Behavior

- Active Listeners shows confirmed TCP listening ports.
- Process Signals shows dev-like processes that are not mapped to a listening port.
- Search filters by port, URL, PID, process name, executable path, and command line.
- Kill actions require selecting an item and confirming in the inspector.
- Notifications are enabled for listener changes when permission is granted.
- Minimize to tray hides the main window and keeps Server Watcher available from the tray.
