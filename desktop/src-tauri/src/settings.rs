// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! Machine-local settings: which project is open, on what port, and how the
//! shell behaves on this machine.
//!
//! # The line this module must never cross
//!
//! ADR-036 D4 enumerates the settings surface rather than describing it, and the
//! reason is that a described scope drifts toward the next plausible field. What
//! is held here is: the project to open, the port, whether to open in the
//! browser instead of the window, and whether the shell checks for updates.
//!
//! What is NOT held here is anything belonging to the app the sidecar serves —
//! no table, no page, no field, no automation, no theme, no env value of the
//! app's own. The test is mechanical: **a setting's value must never become part
//! of the config file.** Every field below turns into an environment variable or
//! into shell chrome, and the config file is untouched by all of them. That is
//! what keeps a project authored here runnable unchanged in Docker, on a server
//! and in CI (ADR-036 D3).
//!
//! # Where the data dir goes, and why it is inside the project
//!
//! `SOVRIUM_DATA_DIR` is set to `<project>/.sovrium` — which is the engine's own
//! default (`DEFAULT_DATA_DIR` in `src/domain/models/process-env/data-dir.ts`),
//! not a location the shell invented. Four reasons, in the order they matter:
//!
//! 1. **The same folder is the same app from anywhere.** ADR-036 D1 promises
//!    that a user who moves to a server "runs the same binary with the same
//!    config". If the shell hid the database under the OS app-data directory, a
//!    `sovrium start app.yaml` in that folder would find an EMPTY database —
//!    silently a different app, with no error to explain it.
//! 2. **The commit hazard is already handled by the engine.** `sovrium init`
//!    writes a `.gitignore` whose first entry is `.sovrium/`, so the usual
//!    argument for hiding runtime state (a user runs `git init` and commits a
//!    SQLite file) does not apply here.
//! 3. **Moving the folder keeps the data.** Any app-data location has to be
//!    keyed by something — a path hash orphans the database the moment the user
//!    drags the folder, which is a data-loss-shaped bug with no UI able to
//!    explain it.
//! 4. **No mapping to keep correct.** There is no project-id → data-dir table
//!    for the shell to get wrong, because the project folder IS the key.
//!
//! It is nevertheless set **explicitly**, as an absolute path, rather than left
//! to the default: the engine resolves `./.sovrium` against `process.cwd()`, and
//! the shell should not depend on cwd inheritance being what it assumes.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_store::StoreExt;

/// File name of the settings store inside Tauri's `app_config_dir`.
const STORE_FILE: &str = "settings.json";

/// The single key the store holds. One key rather than a key per field so a
/// partial write can never leave the shell with a project but no port.
const STORE_KEY: &str = "settings";

/// The config file a project uses when nothing says otherwise.
///
/// YAML rather than TypeScript, per ADR-036 D3: it is the format a
/// non-technical person can read, and the format an AI edits most safely,
/// because a `.ts` config is a program and editing a program has a failure mode
/// that editing a document does not.
pub const DEFAULT_CONFIG_FILE: &str = "app.yaml";

/// A project the shell knows about.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRef {
    /// Absolute path of the project folder. This is the identity of a project;
    /// there is no separate id, for the reason given in the module docs.
    pub dir: PathBuf,
    /// The config file within `dir`. Relative, a bare file name.
    #[serde(default = "default_config_file")]
    pub config_file: String,
    /// Display name. The folder's own name unless the user is told otherwise.
    #[serde(default)]
    pub name: String,
    /// The template slug this project was scaffolded from, when it was.
    /// Carried so "Reset to template" knows what to reset TO.
    #[serde(default)]
    pub template: Option<String>,
}

fn default_config_file() -> String {
    DEFAULT_CONFIG_FILE.to_string()
}

impl ProjectRef {
    /// Build a reference to a project folder, naming it after the folder.
    pub fn new(dir: PathBuf, template: Option<String>) -> Self {
        let name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Sovrium project")
            .to_string();
        Self {
            dir,
            config_file: DEFAULT_CONFIG_FILE.to_string(),
            name,
            template,
        }
    }

    /// The engine data directory for this project — see the module docs for why
    /// it is in the project rather than in the OS app-data dir.
    pub fn data_dir(&self) -> PathBuf {
        self.dir.join(".sovrium")
    }

    /// The lock file the engine writes once it is listening. The lock dir
    /// defaults to the data dir, and the shell does not set `SOVRIUM_LOCK_DIR`,
    /// so this is where it lands.
    pub fn lock_file(&self) -> PathBuf {
        self.data_dir().join("lock")
    }

    /// The machine-readable status channel of ADR-036 D5.
    ///
    /// This file is an E1 contract and does **not** exist on `main` yet. Every
    /// reader of it here treats absence as "no information", never as an error
    /// — the shell degrades to the process state and the lock file, which do
    /// exist today.
    pub fn status_file(&self) -> PathBuf {
        self.data_dir().join("status.json")
    }

    /// Absolute path of the config file.
    pub fn config_path(&self) -> PathBuf {
        self.dir.join(&self.config_file)
    }
}

/// Everything the shell remembers between launches.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// The one project open in v1. Recents exist; multiple *running* projects do
    /// not — switching is stop-then-respawn, so there is exactly one sidecar.
    #[serde(default)]
    pub active_project: Option<ProjectRef>,
    /// Most-recently-opened first, `active_project` included, capped at
    /// [`MAX_RECENTS`].
    #[serde(default)]
    pub recents: Vec<ProjectRef>,
    /// A fixed port, when the user has asked for one. `None` means the shell
    /// passes `PORT=0` and reads the port the OS actually handed out back from
    /// the lock file — which is the only spelling that cannot race another
    /// process for a port the shell probed but had not yet claimed.
    #[serde(default)]
    pub port: Option<u16>,
    /// Show the app in the user's default browser instead of in this window.
    /// The Linux fallback, and a preference anywhere.
    #[serde(default)]
    pub open_in_browser: bool,
    /// Whether the shell checks for its own updates.
    ///
    /// ADR-036 D8 requires this to be disableable in so many words: the updater
    /// is the first outbound request a default Sovrium install makes, and a
    /// brand built on "no central dependency" owes the user the switch.
    #[serde(default = "default_true")]
    pub check_updates: bool,
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            active_project: None,
            recents: Vec::new(),
            port: None,
            open_in_browser: false,
            check_updates: true,
        }
    }
}

/// How many projects the recents list keeps.
const MAX_RECENTS: usize = 10;

impl Settings {
    /// Record a project as opened: it becomes active and moves to the front of
    /// recents, de-duplicated by folder path.
    pub fn open_project(&mut self, project: ProjectRef) {
        self.recents.retain(|r| r.dir != project.dir);
        self.recents.insert(0, project.clone());
        self.recents.truncate(MAX_RECENTS);
        self.active_project = Some(project);
    }

    /// Drop a project from recents (and from active, if it was active).
    pub fn forget_project(&mut self, dir: &Path) {
        self.recents.retain(|r| r.dir != dir);
        if self
            .active_project
            .as_ref()
            .is_some_and(|p| p.dir.as_path() == dir)
        {
            self.active_project = None;
        }
    }
}

/// Read the settings.
///
/// A store that is missing, empty or unparseable yields [`Settings::default`]
/// rather than an error. The shell must open on a machine whose settings file a
/// half-finished write or a manual edit has corrupted; refusing to start over a
/// remembered *preference* would be the worse failure.
pub fn load<R: Runtime>(app: &AppHandle<R>) -> Settings {
    let Ok(store) = app.store(STORE_FILE) else {
        return Settings::default();
    };
    store
        .get(STORE_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

/// Write the settings, flushing to disk immediately.
///
/// The flush is deliberate: the store's own cadence is lazy, and the state that
/// matters most here — which project is open — is read by the NEXT launch,
/// which may follow a crash rather than a clean exit.
pub fn save<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|e| e.to_string())
}

/// Mutate the settings and persist the result in one step.
pub fn update<R: Runtime, F: FnOnce(&mut Settings)>(
    app: &AppHandle<R>,
    mutate: F,
) -> Result<Settings, String> {
    let mut settings = load(app);
    mutate(&mut settings);
    save(app, &settings)?;
    Ok(settings)
}

/// The directory Tauri gives this app for its own configuration.
///
/// Surfaced so the settings UI can reveal it — a user debugging a stuck shell
/// should be able to find and delete this file without being told a path over
/// a support channel.
pub fn config_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(path: &str) -> ProjectRef {
        ProjectRef::new(PathBuf::from(path), None)
    }

    #[test]
    fn names_a_project_after_its_folder() {
        let p = project("/tmp/my-crm");
        assert_eq!(p.name, "my-crm");
        assert_eq!(p.config_file, DEFAULT_CONFIG_FILE);
    }

    #[test]
    fn puts_the_data_dir_inside_the_project() {
        // Not a taste: the engine's own default is `./.sovrium`, and matching it
        // is what makes `sovrium start app.yaml` in that folder the SAME app.
        let p = project("/tmp/my-crm");
        assert_eq!(p.data_dir(), PathBuf::from("/tmp/my-crm/.sovrium"));
        assert_eq!(p.lock_file(), PathBuf::from("/tmp/my-crm/.sovrium/lock"));
        assert_eq!(
            p.status_file(),
            PathBuf::from("/tmp/my-crm/.sovrium/status.json")
        );
        assert_eq!(p.config_path(), PathBuf::from("/tmp/my-crm/app.yaml"));
    }

    #[test]
    fn opening_a_project_moves_it_to_the_front_without_duplicating() {
        let mut s = Settings::default();
        s.open_project(project("/a"));
        s.open_project(project("/b"));
        s.open_project(project("/a"));

        assert_eq!(s.recents.len(), 2);
        assert_eq!(s.recents[0].dir, PathBuf::from("/a"));
        assert_eq!(s.active_project.as_ref().unwrap().dir, PathBuf::from("/a"));
    }

    #[test]
    fn recents_are_capped() {
        let mut s = Settings::default();
        for i in 0..(MAX_RECENTS + 5) {
            s.open_project(project(&format!("/p{i}")));
        }
        assert_eq!(s.recents.len(), MAX_RECENTS);
    }

    #[test]
    fn forgetting_the_active_project_clears_active() {
        let mut s = Settings::default();
        s.open_project(project("/a"));
        s.forget_project(Path::new("/a"));
        assert!(s.active_project.is_none());
        assert!(s.recents.is_empty());
    }

    #[test]
    fn defaults_are_the_conservative_ones() {
        let s = Settings::default();
        assert!(s.port.is_none(), "an unset port means PORT=0, not a guess");
        assert!(!s.open_in_browser);
        assert!(s.check_updates);
    }

    #[test]
    fn a_settings_file_missing_every_field_still_decodes() {
        // The shell must open against a settings file written by an older build
        // or truncated by a crash. Every field carries a serde default for this.
        let s: Settings = serde_json::from_str("{}").expect("empty object decodes");
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn a_project_record_without_a_config_file_defaults_to_yaml() {
        let p: ProjectRef = serde_json::from_str(r#"{"dir":"/tmp/x"}"#).expect("decodes");
        assert_eq!(p.config_file, DEFAULT_CONFIG_FILE);
    }
}
