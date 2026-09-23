// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The two windows, and why there are two.
//!
//! `main` is the app. It shows the shell's own chrome — the gallery, the splash,
//! the error panel — until the engine answers, and is then navigated to
//! `http://127.0.0.1:<port>`, where the page is the user's own app.
//!
//! `settings` is a second, always-local window, and it exists because of that
//! navigation. Once `main` is showing the engine's page, the shell has no
//! surface left: the loopback origin holds **zero** IPC permissions by design
//! (`capabilities/default.json` has no `remote` key), so nothing on that page
//! can reach a command, and it would be wrong if it could. Settings, "connect
//! your AI", the log view and the reset controls therefore live in a window that
//! never leaves the shell's own origin.
//!
//! That split is the security boundary made visible: **the window that can call
//! into Rust is the window the shell wrote**, and the window that shows someone
//! else's page cannot.

use std::path::Path;

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// The label of the settings window. Listed in `capabilities/default.json`
/// alongside `main`; a window absent from that list has no permissions at all.
pub const SETTINGS_LABEL: &str = "settings";

/// Bring the main window forward, creating nothing — it is declared in
/// `tauri.conf.json` and exists for the process's lifetime.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Open the settings window, or focus it if it is already open.
pub fn show_settings<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(SETTINGS_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(
        app,
        SETTINGS_LABEL,
        // The hash is the shell frontend's whole router. One document, one
        // bundle, two entry points.
        WebviewUrl::App("index.html#/settings".into()),
    )
    .title("Sovrium Settings")
    .inner_size(880.0, 660.0)
    .min_inner_size(600.0, 460.0)
    .resizable(true)
    .build();
    if let Err(error) = built {
        log::warn!("the settings window could not be opened: {error}");
    }
}

/// Show a folder (or a file's folder) in the OS file manager.
///
/// This is the whole of "Connect your AI" on the shell's side: reveal the
/// folder, and let the user point their own AI client at it. ADR-036 D2 — the
/// shell never stores, proxies, prompts for or transmits an AI credential, and
/// the connection is between the user's client and the user's own machine.
pub fn reveal<R: Runtime>(app: &AppHandle<R>, path: &Path) {
    use tauri_plugin_opener::OpenerExt;
    if let Err(error) = app.opener().reveal_item_in_dir(path) {
        log::warn!("the folder could not be revealed: {error}");
    }
}
