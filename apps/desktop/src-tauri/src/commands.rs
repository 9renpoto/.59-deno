use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct GreetResponse {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: u64,
}

#[tauri::command]
pub fn greet(name: &str) -> GreetResponse {
    let name = if name.trim().is_empty() {
        "World"
    } else {
        name.trim()
    };
    GreetResponse {
        message: format!("Hello, {}! Welcome to Tauri + Leptos.", name),
    }
}

#[tauri::command]
pub fn health() -> HealthStatus {
    HealthStatus {
        status: "ok".to_string(),
        timestamp: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet_with_name() {
        let res = greet("Alice");
        assert_eq!(res.message, "Hello, Alice! Welcome to Tauri + Leptos.");
    }

    #[test]
    fn test_greet_empty() {
        let res = greet("   ");
        assert_eq!(res.message, "Hello, World! Welcome to Tauri + Leptos.");
    }

    #[test]
    fn test_health() {
        let res = health();
        assert_eq!(res.status, "ok");
    }
}
