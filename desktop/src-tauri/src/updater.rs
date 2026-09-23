// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! Checking for a new version of the shell — and the three bounds that make a
//! phone-home compatible with a brand built on not having one.
//!
//! ADR-036 D8 states them, and this module is where each becomes code:
//!
//! 1. **It belongs to the shell only.** The engine binary run outside the shell
//!    checks nothing, and a server deployment is untouched. Nothing here ever
//!    reaches the sidecar's own update path — `SOVRIUM_INSTALL_METHOD=desktop`
//!    is what makes `sovrium update` refuse, and that is set in `sidecar.rs`.
//! 2. **It must be disableable.** [`crate::settings::Settings::check_updates`]
//!    is the switch, and every entry point in this file reads it FIRST. When it
//!    is off, `check()` is not called — not called and ignored, not called and
//!    discarded. The distinction is the whole promise: a request that is made
//!    and then thrown away has already told a server the user is there.
//! 3. **It carries no identity, no telemetry and no configuration content.** It
//!    asks what the latest version is, and that is all it may ever ask. The
//!    plugin sends the current version and the platform triple in the URL, which
//!    is what "what should I download" requires and nothing more; this module
//!    adds no header, no body and no query of its own.
//!
//! # The public key is empty, and that is a safe default rather than an absent one
//!
//! `plugins.updater.pubkey` in `tauri.conf.json` is `""` until the founder
//! generates the Ed25519 key (D8 — key custody is the decision, and a lost key
//! ends updates for every installed copy, so no CI job and no agent generates
//! it). The key is read at **verification** time, so an empty one makes an
//! install FAIL verification rather than skip it. That is the direction to fail
//! in: a build with no key installs nothing, where a build that skipped
//! verification would install anything.
//!
//! The consequence, stated plainly so nobody reads a green button as a working
//! updater: until the key is pasted in, **the check succeeds and the install
//! fails**. Both outcomes reach the user as a dialog, neither blocks launch.
//!
//! # Nothing here is on the boot path
//!
//! [`check_quietly`] is spawned after `setup` returns and only ever logs. A
//! failed, refused, unreachable or absent update must never stop the app from
//! opening — a user whose network is down owns their software just the same.

use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

use crate::settings;

/// The newest version the shell has heard about, if it has heard about one.
///
/// Held so the tray can name it without making a second request. `None` means
/// "nothing known", which is also what an unreachable endpoint leaves behind —
/// the shell never claims to be up to date on the strength of a failed check.
#[derive(Default)]
pub struct Available(pub Mutex<Option<String>>);

/// Read the remembered version, tolerating a poisoned lock for the same reason
/// the supervisor does: a panic elsewhere must not take the tray with it.
pub fn available<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.try_state::<Available>()
        .and_then(|state| state.0.lock().unwrap_or_else(|e| e.into_inner()).clone())
}

fn remember<R: Runtime>(app: &AppHandle<R>, version: Option<String>) {
    if let Some(state) = app.try_state::<Available>() {
        *state.0.lock().unwrap_or_else(|e| e.into_inner()) = version;
    }
}

/// Is the shell allowed to make the request at all?
pub fn enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    settings::load(app).check_updates
}

/// The tray's label for the update item, and whether it may be clicked.
///
/// Returned as data rather than built in `tray.rs` so the three states are
/// stated once and can be tested without a running tray. The disabled label
/// names the reason: an item that is simply greyed out teaches the reader that
/// the feature is broken, when in fact they turned it off.
pub fn menu_entry(enabled: bool, available: Option<&str>) -> (String, bool) {
    match (enabled, available) {
        (false, _) => ("Check for updates (off in Settings)".to_string(), false),
        (true, Some(version)) => (format!("Update to {version}…"), true),
        (true, None) => ("Check for updates…".to_string(), true),
    }
}

/// The user asked. Check, and say what happened either way.
///
/// Every outcome ends in a dialog, including "you are up to date" — a menu item
/// that silently does nothing is indistinguishable from one that is broken, and
/// this one is clicked precisely when somebody is unsure.
pub fn check_manually<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    // A thread, because `blocking_show` must not run on the main thread and
    // everything after the dialog waits on the user.
    std::thread::spawn(move || {
        if !enabled(&app) {
            // Reachable only if the tray and the settings disagree — a window
            // left open across a settings change. Refuse rather than check:
            // rule 2 above is about the request, not about the button.
            notify(
                &app,
                MessageDialogKind::Info,
                "Update checks are off",
                "Sovrium is not checking for updates. You can turn that back on in Settings.",
            );
            return;
        }

        match fetch(&app) {
            Ok(Some((version, update))) => {
                remember(&app, Some(version.clone()));
                let install = app
                    .dialog()
                    .message(format!(
                        "Sovrium {version} is available.\n\n\
                         Installing stops the app you are running and restarts Sovrium. \
                         Your project folder is not touched."
                    ))
                    .title("An update is available")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::OkCancelCustom(
                        "Install and restart".into(),
                        "Not now".into(),
                    ))
                    .blocking_show();
                if install {
                    install_now(&app, update);
                }
            }
            Ok(None) => {
                remember(&app, None);
                notify(
                    &app,
                    MessageDialogKind::Info,
                    "Sovrium is up to date",
                    "You are running the newest version.",
                );
            }
            Err(message) => {
                // Deliberately NOT remembered as "up to date": a failed check
                // knows nothing, and claiming otherwise is how a user sits on a
                // stale build believing they checked.
                notify(
                    &app,
                    MessageDialogKind::Warning,
                    "Sovrium could not check for updates",
                    &format!("{message}\n\nThis does not affect the app you are running."),
                );
            }
        }
    });
}

/// The launch-time check: gated, off the boot path, and silent.
///
/// It exists so the tray can say "Update to v…" without the user having to go
/// looking. It shows no dialog and blocks nothing — a shell that interrupted a
/// launch to talk about itself would be the behaviour the three bounds exist to
/// prevent.
pub fn check_quietly<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    std::thread::spawn(move || {
        if !enabled(&app) {
            log::info!("update checks are off in settings; not contacting the update endpoint");
            return;
        }
        match fetch(&app) {
            Ok(Some((version, _))) => {
                log::info!("an update is available: {version}");
                remember(&app, Some(version));
                crate::tray::refresh(&app);
            }
            Ok(None) => log::info!("no update available"),
            Err(message) => log::warn!("the update check failed: {message}"),
        }
    });
}

/// One request, with the plugin's own error text preserved.
///
/// Returns the version separately from the handle because the handle is
/// consumed by the install and the version is what every message says.
type Pending = (String, tauri_plugin_updater::Update);

fn fetch<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Pending>, String> {
    let updater = app
        .updater()
        .map_err(|error| format!("The updater is not configured: {error}"))?;
    match tauri::async_runtime::block_on(updater.check()) {
        Ok(Some(update)) => Ok(Some((update.version.clone(), update))),
        Ok(None) => Ok(None),
        Err(error) => Err(format!("{error}")),
    }
}

/// Download, install, restart.
///
/// The sidecar is stopped FIRST, and on every platform rather than only where it
/// is strictly required. On Windows a running `sovrium.exe` holds its own file
/// open and the installer cannot replace it (the NSIS pre-install hook in
/// `windows/hooks.nsh` is the backstop for the case where the shell is not the
/// one installing). Everywhere else the reason is smaller but real: the process
/// this shell supervises should not outlive the shell that was supervising it.
fn install_now<R: Runtime>(app: &AppHandle<R>, update: tauri_plugin_updater::Update) {
    crate::sidecar::stop(app);
    match tauri::async_runtime::block_on(update.download_and_install(|_, _| {}, || {})) {
        Ok(()) => {
            log::info!("update installed; restarting");
            app.restart();
        }
        Err(error) => notify(
            app,
            MessageDialogKind::Error,
            "The update could not be installed",
            &format!(
                "{error}\n\nSovrium is unchanged. You can download the newest version from sovrium.com."
            ),
        ),
    }
}

fn notify<R: Runtime>(app: &AppHandle<R>, kind: MessageDialogKind, title: &str, body: &str) {
    app.dialog()
        .message(body)
        .title(title)
        .kind(kind)
        .buttons(MessageDialogButtons::Ok)
        .blocking_show();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_disabled_check_says_why_rather_than_greying_out() {
        let (label, enabled) = menu_entry(false, None);
        assert!(!enabled);
        assert!(
            label.contains("Settings"),
            "the label must point at the switch the user flipped: {label}"
        );
    }

    #[test]
    fn a_known_update_is_named_in_the_menu() {
        let (label, enabled) = menu_entry(true, Some("0.26.0"));
        assert!(enabled);
        assert_eq!(label, "Update to 0.26.0…");
    }

    #[test]
    fn nothing_known_offers_a_check() {
        let (label, enabled) = menu_entry(true, None);
        assert!(enabled);
        assert_eq!(label, "Check for updates…");
    }

    #[test]
    fn a_known_update_is_ignored_while_checks_are_off() {
        // The setting wins over a version remembered from before it was turned
        // off — otherwise the tray keeps advertising an update the user has
        // asked the shell to stop looking for.
        let (label, enabled) = menu_entry(false, Some("0.26.0"));
        assert!(!enabled);
        assert!(!label.contains("0.26.0"), "{label}");
    }
}
