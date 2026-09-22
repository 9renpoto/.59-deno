use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["__TAURI__", "core"], js_name = invoke, catch)]
    async fn tauri_invoke(cmd: &str, args: JsValue) -> Result<JsValue, JsValue>;
}

#[derive(Serialize)]
struct GreetArgs<'a> {
    name: &'a str,
}

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct GreetResponse {
    pub message: String,
}

pub async fn invoke_greet(name: &str) -> String {
    let args = match serde_wasm_bindgen::to_value(&GreetArgs { name }) {
        Ok(v) => v,
        Err(_) => return format!("Hello, {}!", name),
    };

    match tauri_invoke("greet", args).await {
        Ok(js_val) => {
            if let Ok(res) = serde_wasm_bindgen::from_value::<GreetResponse>(js_val) {
                res.message
            } else {
                format!("Hello, {}! (from Leptos Web)", name)
            }
        }
        Err(_) => {
            format!("Hello, {}! Welcome to Leptos (Web Mode).", name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet_response_deserialization() {
        let json = r#"{"message":"Hello, Rust!"}"#;
        let res: GreetResponse = serde_json::from_str(json).unwrap();
        assert_eq!(res.message, "Hello, Rust!");
    }
}
