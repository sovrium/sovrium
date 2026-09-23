// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

// Windows: a GUI subsystem binary, so launching the app does not open a console
// window behind it. Debug builds keep the console, because that is where the
// sidecar's stderr and the log plugin's output are read during development.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Everything lives in the library — see `lib.rs` for why this file is a shim.
fn main() {
    sovrium_desktop_lib::run()
}
