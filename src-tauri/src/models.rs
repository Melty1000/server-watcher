use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listener {
    pub id: String,
    pub port: u16,
    pub protocol: String,
    pub local_address: String,
    pub url: String,
    pub pid: u32,
    pub process_name: String,
    pub executable_path: String,
    pub command_line: String,
    pub status: String,
    pub first_seen: i64,
    pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessSignal {
    pub id: String,
    pub pid: u32,
    pub process_name: String,
    pub executable_path: String,
    pub command_line: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub scanned_at: i64,
    pub listeners: Vec<Listener>,
    pub signals: Vec<ProcessSignal>,
}
