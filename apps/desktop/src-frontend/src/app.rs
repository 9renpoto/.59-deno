use crate::tauri_ipc::invoke_greet;
use leptos::prelude::*;

#[component]
pub fn App() -> impl IntoView {
    let (count, set_count) = signal(0);
    let (name, set_name) = signal(String::new());
    let (greet_msg, set_greet_msg) = signal(String::new());

    let on_greet = move |_| {
        let current_name = name.get();
        leptos::task::spawn_local(async move {
            let res = invoke_greet(&current_name).await;
            set_greet_msg.set(res);
        });
    };

    view! {
        <main class="app-container">
            <header>
                <h1>"Desktop Template Application"</h1>
                <p class="subtitle">"Powered by Tauri & Leptos"</p>
            </header>

            <section class="card counter-section">
                <h2>"Counter Component"</h2>
                <div class="button-group">
                    <button on:click=move |_| set_count.update(|n| *n -= 1)>"-"</button>
                    <span>"Count: " {count}</span>
                    <button on:click=move |_| set_count.update(|n| *n += 1)>"+"</button>
                </div>
            </section>

            <section class="card greet-section">
                <h2>"Tauri Command Invocation"</h2>
                <div class="button-group">
                    <input
                        type="text"
                        placeholder="Enter your name..."
                        prop:value=name
                        on:input=move |ev| set_name.set(event_target_value(&ev))
                    />
                    <button on:click=on_greet>"Greet"</button>
                </div>
                {move || {
                    let msg = greet_msg.get();
                    if !msg.is_empty() {
                        view! { <p class="result-message">{msg}</p> }.into_any()
                    } else {
                        view! { <span/> }.into_any()
                    }
                }}
            </section>
        </main>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_initial_state() {
        let (count, _) = signal(0);
        assert_eq!(count.get(), 0);
    }
}
