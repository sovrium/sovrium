// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The tray item — what the app is while its window is closed.
//!
//! # Why there is a tray at all
//!
//! A Sovrium project is a running server. Closing the window must not stop it,
//! because the user may be editing the config in another application and
//! watching the change appear — which is the whole loop ADR-036 exists to
//! enable. So the window hides and the tray is what the app becomes: the only
//! affordance left for stopping, reopening and quitting.
//!
//! # Rebuilt rather than mutated
//!
//! Two menu entries depend on state: Pause becomes Resume, and Reveal is dead
//! without a project. Rather than hold handles to individual items and keep them
//! in step, [`refresh`] rebuilds the whole menu from the current snapshot. A
//! menu built from state cannot disagree with it; a menu patched from state can,
//! and the symptom would be a Pause item that stops nothing.

use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Runtime};

use crate::sidecar::{self, ShellState};

/// The tray's id, so it can be found again to have its menu replaced.
const TRAY_ID: &str = "sovrium-main";

/// The macOS menu-bar icon: the brand mark, glyph-only, one ink, on a
/// transparent ground.
///
/// It exists because a template image is masked by its ALPHA channel — AppKit
/// discards the colours and repaints the shape in the menu bar's own foreground
/// colour, which is what makes the icon follow a light or dark bar and invert
/// under the highlight. The app icon therefore cannot serve: since
/// `47ae4601ae` it is the mark on a rounded tile, and the tile IS its alpha, so
/// as a template it rendered as a solid rounded blob with the mark invisible
/// inside it.
///
/// Rendered from `assets/logo/sovrium/mark-outline.svg` — the outlined master,
/// so no font has to resolve — at 72 px square, black on transparent, with the
/// mark's own authored canvas kept rather than re-cropped. 72 is four times the
/// 18 pt slot `tray-icon` pins the height to
/// (`platform_impl/macos/mod.rs`, `let icon_height: f64 = 18.0`), so it
/// downsamples by exactly 4 at 1x and exactly 2 at 2x.
#[cfg(target_os = "macos")]
const TRAY_TEMPLATE_PNG: &[u8] = include_bytes!("../icons/tray-template.png");

const ID_OPEN: &str = "open";
const ID_BROWSER: &str = "browser";
const ID_REVEAL: &str = "reveal";
const ID_TOGGLE: &str = "toggle";
const ID_SETTINGS: &str = "settings";
const ID_UPDATE: &str = "update";
const ID_QUIT: &str = "quit";

/// Build the menu that matches the shell's current state.
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let snapshot = sidecar::snapshot(app);
    let has_project = snapshot.project.is_some();
    let running = matches!(snapshot.state, ShellState::Serving { .. });

    let toggle_label = if running {
        "Pause"
    } else {
        "Resume"
    };

    let open = MenuItem::with_id(app, ID_OPEN, "Open Sovrium", true, None::<&str>)?;
    let browser = MenuItem::with_id(app, ID_BROWSER, "Open in browser", running, None::<&str>)?;
    let reveal = MenuItem::with_id(
        app,
        ID_REVEAL,
        "Reveal project folder",
        has_project,
        None::<&str>,
    )?;
    let toggle = MenuItem::with_id(app, ID_TOGGLE, toggle_label, has_project, None::<&str>)?;
    let settings = MenuItem::with_id(app, ID_SETTINGS, "Settings…", true, None::<&str>)?;
    // Live since S3. The item has three states and `updater::menu_entry` owns
    // all three, so the label and the enabled flag cannot disagree: off in
    // settings (disabled, and it says so rather than greying out silently), an
    // update already known (named), or nothing known (offers a check).
    let (update_label, update_enabled) = crate::updater::menu_entry(
        crate::updater::enabled(app),
        crate::updater::available(app).as_deref(),
    );
    let update = MenuItem::with_id(app, ID_UPDATE, update_label, update_enabled, None::<&str>)?;
    let quit = MenuItem::with_id(app, ID_QUIT, "Quit Sovrium", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &open,
            &browser,
            &PredefinedMenuItem::separator(app)?,
            &reveal,
            &toggle,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &update,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )
}

/// Create the tray. Called once, from `setup`.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let menu = build_menu(app)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Sovrium")
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(|tray, event| {
            // A left click opens the window on the platforms that report one.
            // macOS shows the menu instead, which is that platform's convention
            // and is left alone.
            if let TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    crate::windows::show_main(tray.app_handle());
                }
            }
        });
    // The icon is chosen per platform, and the split is not cosmetic.
    //
    // macOS gets a TEMPLATE, because a coloured tray icon fights both light and
    // dark menu bars and template rendering is what makes it follow the system.
    // The window icon cannot be the source — see [`TRAY_TEMPLATE_PNG`].
    //
    // Windows and Linux keep the coloured app icon. They have no template
    // concept to opt into: `icon_as_template` is documented "macOS only" and
    // compiles to a discard on every other platform (tray-icon 0.24
    // `lib.rs:451-457`). Their trays also sit on a taskbar or panel whose colour
    // the app does not control and the system does not recolour for it, so a
    // one-ink black glyph would disappear on a dark one.
    #[cfg(target_os = "macos")]
    match tauri::image::Image::from_bytes(TRAY_TEMPLATE_PNG) {
        Ok(icon) => builder = builder.icon(icon).icon_as_template(true),
        // Decoding bytes compiled into the binary cannot fail in practice. It is
        // still handled rather than unwrapped, because a tray with no icon is an
        // invisible tray, and the tray is the only affordance left once the
        // window is closed — the window icon at least occupies the slot.
        Err(error) => {
            log::warn!("the tray template icon could not be decoded: {error}");
            if let Some(icon) = app.default_window_icon().cloned() {
                builder = builder.icon(icon);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)
}

/// Rebuild the tray menu from the current state. Cheap, and called on every
/// state change.
pub fn refresh<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    match build_menu(app) {
        Ok(menu) => {
            let _ = tray.set_menu(Some(menu));
        }
        Err(error) => log::warn!("the tray menu could not be rebuilt: {error}"),
    }
}

fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        ID_OPEN => crate::windows::show_main(app),
        ID_BROWSER => {
            // `origin` rather than a composed `http://127.0.0.1:<port>`: the
            // engine binds one loopback family and the shell discovered which.
            if let ShellState::Serving { origin, .. } = sidecar::snapshot(app).state {
                use tauri_plugin_opener::OpenerExt;
                let _ = app.opener().open_url(format!("{origin}/"), None::<&str>);
            }
        }
        ID_REVEAL => {
            if let Some(project) = sidecar::snapshot(app).project {
                crate::windows::reveal(app, &project.dir);
            }
        }
        ID_TOGGLE => {
            let app = app.clone();
            std::thread::spawn(move || {
                if matches!(sidecar::snapshot(&app).state, ShellState::Serving { .. }) {
                    sidecar::pause(&app);
                } else if let Err(error) = sidecar::resume(&app) {
                    log::warn!("resume from the tray failed: {error}");
                }
            });
        }
        ID_SETTINGS => crate::windows::show_settings(app),
        // Spawns its own thread and re-reads the setting there, so a settings
        // window left open across a change cannot turn a disabled item into a
        // request.
        ID_UPDATE => crate::updater::check_manually(app),
        ID_QUIT => {
            // Stop the engine before the process goes away. `exit` runs
            // `RunEvent::Exit`, and the handler there is what actually stops
            // the sidecar — this is the ordinary quit path, not a second one.
            app.exit(0);
        }
        _ => {}
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::TRAY_TEMPLATE_PNG;

    /// The one property that decides whether a template image works at all: its
    /// ALPHA must be the GLYPH, not a tile.
    ///
    /// Asserted here because the defect it guards is invisible in a diff and
    /// obvious only in a screenshot — the previous icon was a valid PNG, decoded
    /// fine, and rendered as a featureless rounded blob. Any future regeneration
    /// that reaches for the app icon, or flattens this one onto a background,
    /// turns the canvas opaque and fails here instead of shipping.
    #[test]
    fn the_tray_template_is_a_glyph_on_a_transparent_ground() {
        let image = tauri::image::Image::from_bytes(TRAY_TEMPLATE_PNG)
            .expect("the compiled-in tray template must decode as a PNG");

        assert_eq!(
            image.width(),
            image.height(),
            "the menu bar slot is square; a non-square source is scaled by HEIGHT and \
             silently widens the item"
        );

        let alpha: Vec<u8> = image.rgba().chunks_exact(4).map(|pixel| pixel[3]).collect();
        let clear = alpha.iter().filter(|&&a| a < 5).count();
        let opaque = alpha.iter().filter(|&&a| a > 250).count();

        // A filled tile is ~100% opaque. The mark covers roughly a fifth of its
        // own canvas, so the bounds are wide enough to survive a redraw and
        // narrow enough to reject both a tile and an empty canvas.
        assert!(
            clear > alpha.len() / 2,
            "most of a template canvas must be CLEAR — {clear} of {} pixels were, \
             which reads as a filled tile rather than a glyph",
            alpha.len()
        );
        assert!(
            opaque > alpha.len() / 50,
            "the glyph must actually be there — only {opaque} of {} pixels were opaque",
            alpha.len()
        );
    }
}
