// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The Sovrium desktop shell.
//!
//! The shell does not reimplement Sovrium. It supervises the existing binary as
//! a sidecar process and shows what that binary serves — so every capability
//! the desktop app has is a capability the binary already had, and a user who
//! later moves the project to a server runs the same binary on the same config.
//!
//! # The modules, and what each one owns
//!
//! | Module           | Owns                                                              |
//! | ---------------- | ----------------------------------------------------------------- |
//! | [`sidecar`]      | Spawn, port discovery, health, crash backoff, per-OS stop         |
//! | [`settings`]     | Machine-local settings and the project record                     |
//! | [`tray`]         | The tray item — what the app is while its window is closed        |
//! | [`deeplink`]     | `sovrium://` parsing, refusal, and the confirmation dialog        |
//! | [`nav_guard`]    | Where the window may go, and where everything else goes instead   |
//! | [`windows`]      | The two windows, and why the settings one is separate             |
//! | [`commands`]     | The whole IPC surface, in one readable list                       |
//! | [`updater`]      | Checking for a new shell, and the bounds on that request          |
//! | [`smoke`]        | The headless self-test CI runs against a built bundle             |
//!
//! # Two refusals hold throughout, and neither is a matter of scope
//!
//! * **No configuration editor.** Not a field, not a form, not a textarea. The
//!   shell reveals a folder and copies an MCP snippet; the user's own AI edits
//!   the file. The shell is right there and already knows the path, which is
//!   exactly why the refusal has to be written down rather than assumed.
//! * **No AI credential, ever.** The shell does not store, proxy, prompt for or
//!   transmit one, and ships no model. The connection is between the user's AI
//!   client and the user's own machine.

pub mod commands;
pub mod deeplink;
pub mod nav_guard;
pub mod settings;
pub mod sidecar;
pub mod smoke;
pub mod tray;
pub mod updater;
pub mod windows;

use std::sync::{Arc, Mutex};

use tauri::{Manager, RunEvent, WindowEvent};

/// Build and run the shell.
///
/// Kept in the library rather than in `main.rs` so that the Windows binary can
/// stay a three-line shim — a bin and a lib of the same name collide there, and
/// the shim is what lets the lib keep the crate's own name.
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // FIRST, and this ordering is the one thing in this file that is not
    // cosmetic. `single-instance` is the plugin that decides whether this
    // process lives at all: a second launch must hand its arguments to the
    // running instance and exit. Registering it after a plugin that allocates a
    // resource means the doomed second process allocates it first — most
    // visibly a `store` file handle and a log file, both of which the surviving
    // instance already holds.
    //
    // It sits in a `cfg` BLOCK rather than as an attribute on a chained call,
    // because a `#[cfg]` attribute cannot be applied to a method call in a
    // builder chain — that is a parse error, not a no-op. Splitting the chain
    // here is what keeps a future mobile target compiling against a plugin that
    // has no mobile implementation.
    //
    // The callback is where a second launch's argv arrives — and on Windows and
    // Linux, a deep link IS an argv entry of that second launch. Argv and deep
    // links are therefore one attack surface, which is why both go through the
    // same parser and the same confirmation dialog.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            windows::show_main(app);
            if let Some(link) = deeplink::link_in_argv(argv) {
                deeplink::handle(app, link);
            }
        }));
    }

    builder
        // Deep links, second: the plugin's own registration has to happen after
        // single-instance so that `sovrium://` opens the running window instead
        // of a second one. Every URL it delivers is untrusted input — the
        // handler allowlists the scheme's one verb, accepts https targets only,
        // and always confirms with a dialog. A deep link never runs anything on
        // its own.
        .plugin(tauri_plugin_deep_link::init())
        // Where this window may navigate. Registered as a plugin because
        // `tauri::Builder` has no app-wide `on_navigation` — see nav_guard.rs.
        .plugin(nav_guard::init())
        // Spawns the sidecar (`externalBin` in tauri.conf.json). No shell
        // permission is granted to the webview — the scope in
        // capabilities/default.json is empty, and the sidecar is launched from
        // Rust.
        .plugin(tauri_plugin_shell::init())
        // Machine-local settings only: which project is open, the port, whether
        // updates are checked. Never configuration of the app the sidecar
        // serves — that lives in the config file and nowhere else.
        .plugin(tauri_plugin_store::Builder::default().build())
        // External links leave for the user's default browser rather than
        // navigating this window, which may only ever be at the loopback
        // origin.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // `Info`, not the default. The default is `Trace` in a debug build,
        // where `tao` and `wry` narrate every `viewDidMoveToWindow` — which
        // buries the shell's own lines in a dev run and, in a release build,
        // fills a user's log file with window-manager callbacks nobody reading
        // it is looking for.
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // The updater is the shell's, never the engine's, and it is the first
        // outbound request a default Sovrium install makes. Three bounds hold
        // it: it belongs to the shell only (a server deployment is untouched),
        // it must be disableable in settings, and it carries no identity, no
        // telemetry and no configuration content.
        //
        // It requires a `plugins.updater` block in tauri.conf.json — `pubkey`
        // has no serde default, so WITHOUT one this plugin panics the process
        // at launch with "invalid type: null, expected struct Config". That is
        // invisible to `cargo check` and to `desktop:check`; only running the
        // app finds it.
        //
        // **`pubkey` is deliberately empty, and S3 fills it.** Empty does not
        // mean unsigned: the key is read only at verification time
        // (`tauri-plugin-updater/src/updater.rs`), so an empty one makes every
        // update FAIL verification rather than skip it — the safe direction
        // while the Ed25519 key does not yet exist. Nothing calls `check()`
        // today and the tray's "Check for updates" item is disabled, so the
        // path is unreachable either way.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage::<sidecar::SharedSupervisor>(Arc::new(Mutex::new(sidecar::Supervisor::default())))
        .manage(nav_guard::LoopbackPort::default())
        .manage(updater::Available::default())
        .invoke_handler(tauri::generate_handler![
            commands::shell_snapshot,
            commands::shell_logs,
            commands::shell_versions,
            commands::settings_read,
            commands::settings_write,
            commands::create_project,
            commands::create_project_from_url,
            commands::open_project,
            commands::forget_project,
            commands::restart_engine,
            commands::pause_engine,
            commands::reveal_project,
            commands::reveal_settings_folder,
            commands::open_app_in_browser,
            commands::open_settings_window,
            commands::mcp_snippet,
            commands::undo_availability,
            commands::undo_restore,
            commands::reset_to_template,
            commands::validate_config,
        ])
        .setup(setup)
        .on_window_event(|window, event| {
            // Closing the main window hides it instead of stopping the app. A
            // Sovrium project is a running server, and the user may be editing
            // its config in another application and watching the change appear
            // — which is the whole loop this product exists for. The tray is
            // what the app becomes, and Quit is how it ends.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("the Sovrium shell failed to start")
        .run(|app, event| {
            // The one place the engine is guaranteed to be stopped. Quit from
            // the tray, ⌘Q, a system logout and a crash-free `exit(0)` all
            // arrive here, so there is one stop path rather than one per
            // entry point — and an orphaned `sovrium start` holding a port is
            // exactly what a second launch would then fail against.
            if matches!(event, RunEvent::Exit) {
                sidecar::stop(app);
            }
        });
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();

    // Capture where the shell's own chrome lives, once. The answer differs by
    // platform and by build (`tauri://localhost`, `http://tauri.localhost`,
    // `http://localhost:1420`), and re-deriving it later is how the shell would
    // fail to find its way home on exactly one OS.
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(url) = window.url() {
            app.manage(sidecar::ShellUrl(url));
        }
    }

    // The headless self-test, and it returns EARLY rather than folding itself
    // into the ordinary boot. Everything below this point exists to make the
    // shell usable by a person — a tray, a deep-link listener, a remembered
    // project — and a CI run has none of those things to be usable by. Running
    // them anyway would put a tray icon and an argv parser between the test and
    // the one thing it is measuring, which is whether the BUNDLED engine runs.
    //
    // The window is hidden for the same reason: the self-test asserts nothing
    // about rendering, and a headless runner is exactly where a webview is
    // least dependable.
    if let Some(config) = smoke::config() {
        log::info!("SOVRIUM_DESKTOP_SMOKE is set; running the self-test in {:?}", config.dir);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
        smoke::spawn(&handle, config);
        return Ok(());
    }

    tray::init(&handle)?;

    // A deep link can be the reason this process exists, on the platforms that
    // deliver one through argv rather than through an event.
    if let Some(link) = deeplink::link_in_argv(std::env::args().skip(1)) {
        deeplink::handle(&handle, link);
    }
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        let for_links = handle.clone();
        app.deep_link().on_open_url(move |event| {
            for url in event.urls() {
                deeplink::handle(&for_links, url.to_string());
            }
        });
    }

    // Reopen whatever was open last. A desktop app that forgets which project
    // it was running is a launcher, and the user would have to re-pick a folder
    // every morning.
    if let Some(project) = settings::load(&handle).active_project {
        if project.config_path().exists() {
            let for_boot = handle.clone();
            std::thread::spawn(move || {
                if let Err(message) = sidecar::start(&for_boot, project) {
                    log::warn!("the last project could not be reopened: {message}");
                }
            });
        } else {
            log::info!("the last project's config file is gone; starting on the gallery");
        }
    }

    // Version parity, per ADR-036's "two runtimes to keep in step". A warning
    // in the log and a line in the settings window — never a block, because the
    // two halves ship as one installer and a mismatch means something unusual
    // happened, not that the app should refuse to open.
    let for_versions = handle.clone();
    tauri::async_runtime::spawn(async move {
        let _ = sidecar::version_parity(&for_versions).await;
    });

    // Off the boot path by construction — `check_quietly` spawns its own thread
    // and returns, it reads `settings.check_updates` before contacting anything,
    // and its only outcome is a log line plus a tray label. A network that is
    // down, an endpoint that 404s and a manifest that does not parse all leave
    // the app opening exactly as it would have (ADR-036 D8).
    updater::check_quietly(&handle);

    Ok(())
}
