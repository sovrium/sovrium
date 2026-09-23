// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

// Tauri's build script. It parses `tauri.conf.json`, generates the context the
// runtime reads, and — on Windows — embeds the version resources and the
// manifest. Running it is not optional: `tauri::generate_context!()` in lib.rs
// consumes what it writes.

fn main() {
    tauri_build::build()
}
