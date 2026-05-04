use crate::models::{Listener, ProcessSignal, ScanResult};
use serde::Deserialize;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawListener {
    id: String,
    port: u16,
    protocol: String,
    local_address: String,
    url: String,
    pid: u32,
    process_name: String,
    executable_path: String,
    command_line: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSignal {
    id: String,
    pid: u32,
    process_name: String,
    executable_path: String,
    command_line: String,
    reason: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawScan {
    listeners: Vec<RawListener>,
    signals: Vec<RawSignal>,
}

pub fn scan_servers() -> Result<ScanResult, Box<dyn std::error::Error>> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &scanner_script(),
        ])
        .output()?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string().into());
    }

    let raw: RawScan = serde_json::from_slice(&output.stdout)?;
    let scanned_at = now_ms();

    Ok(ScanResult {
        scanned_at,
        listeners: raw
            .listeners
            .into_iter()
            .map(|item| Listener {
                id: item.id,
                port: item.port,
                protocol: item.protocol,
                local_address: item.local_address,
                url: item.url,
                pid: item.pid,
                process_name: item.process_name,
                executable_path: item.executable_path,
                command_line: item.command_line,
                status: "listening".to_string(),
                first_seen: scanned_at,
                last_seen: scanned_at,
            })
            .collect(),
        signals: raw
            .signals
            .into_iter()
            .map(|item| ProcessSignal {
                id: item.id,
                pid: item.pid,
                process_name: item.process_name,
                executable_path: item.executable_path,
                command_line: item.command_line,
                reason: item.reason,
            })
            .collect(),
    })
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn scanner_script() -> String {
    r#"
$ErrorActionPreference = "Stop"
$connections = Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -gt 0 } | Select-Object LocalAddress, LocalPort, OwningProcess
$processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
$processes = @{}
if ($processIds.Count -gt 0) {
  Get-CimInstance Win32_Process | Where-Object { $processIds -contains $_.ProcessId } | ForEach-Object { $processes[[int]$_.ProcessId] = $_ }
}
$listeners = foreach ($connection in $connections) {
  $ownerPid = [int]$connection.OwningProcess
  $process = $processes[$ownerPid]
  $port = [int]$connection.LocalPort
  $hostName = if ($connection.LocalAddress -eq "::" -or $connection.LocalAddress -eq "0.0.0.0") { "localhost" } else { $connection.LocalAddress }
  [PSCustomObject]@{
    id = "tcp-$port-$ownerPid"
    port = $port
    protocol = "TCP"
    localAddress = [string]$connection.LocalAddress
    url = "http://$hostName`:$port"
    pid = $ownerPid
    processName = if ($process) { [string]$process.Name } else { "Unknown" }
    executablePath = if ($process -and $process.ExecutablePath) { [string]$process.ExecutablePath } else { "" }
    commandLine = if ($process -and $process.CommandLine) { [string]$process.CommandLine } else { "" }
  }
}
$mappedPids = @($listeners | Select-Object -ExpandProperty pid -Unique)
$devNames = @("node.exe", "bun.exe", "deno.exe", "python.exe", "python3.exe", "uvicorn.exe", "cargo.exe", "npm.exe", "pnpm.exe", "yarn.exe")
$devListenerNames = @("node.exe", "bun.exe", "deno.exe", "python.exe", "python3.exe", "uvicorn.exe", "cargo.exe", "npm.exe", "pnpm.exe", "yarn.exe", "postgres.exe", "redis-server.exe", "redis.exe", "dotnet.exe")
$listeners = @($listeners | Where-Object {
  $devListenerNames -contains $_.processName -or
  $_.port -in @(3000, 3001, 4200, 4321, 5000, 5173, 5174, 5432, 6379, 8000, 8080, 8787, 9000)
})
$signals = Get-CimInstance Win32_Process |
  Where-Object { $devNames -contains $_.Name -and $mappedPids -notcontains $_.ProcessId } |
  Select-Object -First 20 |
  ForEach-Object {
    [PSCustomObject]@{
      id = "signal-$($_.ProcessId)"
      pid = [int]$_.ProcessId
      processName = [string]$_.Name
      executablePath = if ($_.ExecutablePath) { [string]$_.ExecutablePath } else { "" }
      commandLine = if ($_.CommandLine) { [string]$_.CommandLine } else { "" }
      reason = "Dev-like process without a mapped listening port"
    }
  }
[PSCustomObject]@{ listeners = @($listeners); signals = @($signals) } | ConvertTo-Json -Depth 6 -Compress
"#
    .to_string()
}
