// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! Where this window is allowed to go, and where everything else goes instead.
//!
//! # Two mechanisms, one boundary
//!
//! The page the sidecar serves is the user's own app, but it is still a page
//! this shell did not write, rendered inside a process that can spawn binaries.
//! Two independent things keep that safe, and it is worth naming both because
//! each covers what the other cannot:
//!
//! 1. **The capability file.** `capabilities/default.json` has no `remote` key,
//!    so a page loaded from `http://127.0.0.1:<port>` gets **zero** IPC
//!    permissions. It cannot call a command, open a dialog, read the store or
//!    spawn anything, because none of those are granted to a remote origin. That
//!    is the boundary; this module is not.
//! 2. **This guard.** It stops the window *reaching* an origin that is neither
//!    the shell's own bundle nor the running instance — an external link in the
//!    user's app, a redirect, a phishing page — and sends it to the user's
//!    default browser instead, where it belongs and where the OS security model
//!    applies.
//!
//! A link the guard refuses is not an error. It is a link, and the user gets it
//! in their browser.
//!
//! # Why it is a plugin
//!
//! `tauri::Builder` has no app-wide `on_navigation`; the hook lives on
//! `WebviewWindowBuilder` (per window, and therefore absent for a window
//! declared in `tauri.conf.json`) and on `tauri::plugin::Builder` (app-wide, for
//! every webview however it was created). Registering it as a plugin is what
//! makes the guard unconditional rather than a property of one construction
//! path — a window added later cannot forget it.

use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;

use tauri::plugin::TauriPlugin;
use tauri::{Manager, Runtime, Url, Webview};
use tauri_plugin_opener::OpenerExt;

/// The port the sidecar is currently listening on, or `0` for "nothing is
/// running".
///
/// Shared rather than read back from the supervisor because the guard runs on
/// the navigation path: it must never block on a lock another thread holds
/// while it waits for a process, and an atomic cannot deadlock.
#[derive(Debug, Clone, Default)]
pub struct LoopbackPort(Arc<AtomicU16>);

impl LoopbackPort {
    pub fn set(&self, port: u16) {
        self.0.store(port, Ordering::SeqCst);
    }

    pub fn clear(&self) {
        self.0.store(0, Ordering::SeqCst);
    }

    pub fn get(&self) -> Option<u16> {
        match self.0.load(Ordering::SeqCst) {
            0 => None,
            p => Some(p),
        }
    }
}

/// The loopback hosts the shell will show. An app served on `127.0.0.1` may
/// legitimately link to itself as `localhost`, and vice versa.
const LOOPBACK_HOSTS: [&str; 3] = ["127.0.0.1", "localhost", "[::1]"];

/// Is this a URL the shell's own bundle serves?
///
/// Three spellings, because Tauri's custom protocol differs by platform and by
/// build: `tauri://localhost` (macOS/Linux release), `http://tauri.localhost`
/// (Windows release), and `http://localhost:1420` (the Vite dev server). The
/// dev entry is admitted only in a dev build — shipping it would make a
/// release trust whatever is listening on 1420 on the user's machine.
fn is_shell_origin(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "asset" => true,
        "http" | "https" => {
            let host = url.host_str().unwrap_or_default();
            if host == "tauri.localhost" || host == "asset.localhost" {
                return true;
            }
            tauri::is_dev() && LOOPBACK_HOSTS.contains(&host) && url.port() == Some(1420)
        }
        _ => false,
    }
}

/// Is this the instance the shell is supervising right now?
fn is_running_instance(url: &Url, port: Option<u16>) -> bool {
    let Some(port) = port else { return false };
    if url.scheme() != "http" {
        // Even for loopback: an `https` origin on the same port is a different
        // origin to the browser, and the engine does not serve one.
        return false;
    }
    let host = url.host_str().unwrap_or_default();
    LOOPBACK_HOSTS.contains(&host) && url.port() == Some(port)
}

/// The navigation decision, as a pure function so it can be tested without a
/// webview, a window, or a running Tauri app.
///
/// `true` lets the window navigate; `false` cancels it (and the caller hands the
/// URL to the browser).
pub fn may_navigate(url: &Url, serving_port: Option<u16>) -> bool {
    is_shell_origin(url) || is_running_instance(url, serving_port)
}

/// Should a refused URL be offered to the user's browser?
///
/// Only `http(s)`. A refused `file:`, `javascript:` or `data:` URL is dropped in
/// silence: handing an arbitrary scheme to the OS opener is a way to launch a
/// local handler from a remote page, which is the thing the guard exists to
/// stop — not a thing it should delegate.
pub fn may_hand_to_browser(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

/// The guard, as an app-wide plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("sovrium-nav-guard")
        .on_navigation(|webview: &Webview<R>, url: &Url| {
            let port = webview
                .try_state::<LoopbackPort>()
                .and_then(|state| state.get());
            if may_navigate(url, port) {
                return true;
            }
            if may_hand_to_browser(url) {
                let _ = webview
                    .app_handle()
                    .opener()
                    .open_url(url.to_string(), None::<&str>);
            }
            log::info!("navigation refused, handed to the browser: {}", url.scheme());
            false
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).expect("test url parses")
    }

    #[test]
    fn allows_the_shell_bundle() {
        assert!(may_navigate(&url("tauri://localhost/index.html"), None));
        assert!(may_navigate(&url("http://tauri.localhost/index.html"), None));
    }

    #[test]
    fn allows_the_running_instance_on_either_loopback_spelling() {
        assert!(may_navigate(&url("http://127.0.0.1:4321/"), Some(4321)));
        assert!(may_navigate(&url("http://localhost:4321/records"), Some(4321)));
    }

    #[test]
    fn refuses_a_loopback_port_that_is_not_the_one_we_spawned() {
        // Another local server — a different app, a dev tool, or something
        // hostile that got a port — is not this instance.
        assert!(!may_navigate(&url("http://127.0.0.1:9999/"), Some(4321)));
        assert!(!may_navigate(&url("http://127.0.0.1:4321/"), None));
    }

    #[test]
    fn refuses_the_public_internet() {
        assert!(!may_navigate(&url("https://example.com/"), Some(4321)));
        assert!(!may_navigate(&url("http://example.com/"), Some(4321)));
    }

    #[test]
    fn refuses_a_host_that_only_looks_like_loopback() {
        for hostile in [
            "http://127.0.0.1.evil.test:4321/",
            "http://localhost.evil.test:4321/",
            "http://evil.test:4321/#127.0.0.1",
            "http://user@evil.test:4321/",
        ] {
            assert!(!may_navigate(&url(hostile), Some(4321)), "{hostile}");
        }
    }

    #[test]
    fn refuses_https_on_the_instance_port() {
        // A different origin to the webview, and not something the engine
        // serves — so allowing it would only ever admit an impostor.
        assert!(!may_navigate(&url("https://127.0.0.1:4321/"), Some(4321)));
    }

    #[test]
    fn only_http_urls_are_handed_to_the_browser() {
        assert!(may_hand_to_browser(&url("https://example.com/")));
        assert!(may_hand_to_browser(&url("http://example.com/")));
        assert!(!may_hand_to_browser(&url("file:///etc/passwd")));
        assert!(!may_hand_to_browser(&url("data:text/html,<h1>x</h1>")));
        assert!(!may_hand_to_browser(&url("javascript:alert(1)")));
    }

    #[test]
    fn the_dev_server_is_admitted_only_in_a_dev_build() {
        // The assertion tracks the build it runs in rather than asserting one
        // truth for both, because `cargo test` is a dev build and a release
        // bundle is not — and the property that matters is that the two differ.
        assert_eq!(
            may_navigate(&url("http://localhost:1420/"), None),
            tauri::is_dev()
        );
    }
}
