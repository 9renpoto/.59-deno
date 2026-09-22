# Desktop Application Template

Desktop application template built with [Tauri v2](https://tauri.app/) and
[Leptos](https://leptos.dev/).

## Structure

- `src-tauri/`: Rust backend for native window management and desktop IPC
  commands.
- `src-frontend/`: Rust frontend using Leptos compiled to WASM for client-side
  rendering.

## Prerequisites

- [Rust](https://www.rust-lang.org/) (edition 2021 or later)
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [Trunk](https://trunkrs.dev/) for bundling WASM: `cargo install trunk`
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites):
  `cargo install cargo-tauri`

## Development

Run `cargo check` or tests across the workspace:

```sh
cd apps/desktop
cargo check --workspace
cargo test --workspace
```

Or via Deno tasks from the workspace root:

```sh
deno task --cwd apps/desktop check
deno task --cwd apps/desktop test
```

To launch the desktop application in dev mode:

```sh
cd apps/desktop
cargo tauri dev
```
