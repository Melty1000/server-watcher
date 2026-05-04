use crate::command::hidden_command;

struct KillProcessCommandSpec {
    program: &'static str,
    args: Vec<String>,
}

pub fn kill_process(pid: u32) -> Result<(), Box<dyn std::error::Error>> {
    let spec = kill_process_command_spec(pid);
    let mut command = hidden_command(spec.program);
    command.args(&spec.args);

    let status = command.status()?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to stop process {}", pid).into())
    }
}

fn kill_process_command_spec(pid: u32) -> KillProcessCommandSpec {
    KillProcessCommandSpec {
        program: "taskkill.exe",
        args: vec![
            "/PID".to_string(),
            pid.to_string(),
            "/F".to_string(),
            "/T".to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kill_process_command_forcefully_stops_the_process_tree() {
        let spec = kill_process_command_spec(42);

        assert_eq!(spec.program, "taskkill.exe");
        assert_eq!(
            spec.args,
            vec![
                "/PID".to_string(),
                "42".to_string(),
                "/F".to_string(),
                "/T".to_string()
            ]
        );
    }
}
