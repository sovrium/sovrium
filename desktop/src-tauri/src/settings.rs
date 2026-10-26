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
//! browser instead of the window, and whether the shell checks for updates —
//! and, per project, the "Let my AI edit" switch and the name of the entry the
//! shell wrote into Claude Desktop's configuration (ADR-036 A2).
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

/// The config files a project folder may hold, in the order the shell looks for
/// them. The first one present wins.
///
/// The three document formats come first, YAML before JSON, and `app.ts` last:
/// a folder holding both a document and a program is opened on the document,
/// because the document is the one the shell can let an AI edit (ADR-036 D6).
///
/// `app.json` is here although the engine's own implicit lookup skips it
/// (`DEFAULT_CONFIG_FILENAMES` in
/// `src/domain/kernel/config-parsing/default-config-files.ts`), because
/// `sovrium init --from-url` writes `app.json` for a `.json` address and the
/// shell must be able to open what the engine just scaffolded. The asymmetry is
/// safe here and not there: the shell always NAMES the file it found — as
/// `SOVRIUM_CONFIG_FILE` and as the positional argument to `start` — so the
/// engine never has to guess, and the folder is one a person picked or the shell
/// itself created.
pub const CONFIG_FILE_CANDIDATES: [&str; 4] = ["app.yaml", "app.yml", "app.json", "app.ts"];

/// The config file present in `dir`, in [`CONFIG_FILE_CANDIDATES`] order, or
/// `None` when the folder holds none of them.
///
/// A directory or a dangling symlink carrying a candidate's name does not
/// count: only a file the engine could actually read does.
pub fn detect_config_file(dir: &Path) -> Option<&'static str> {
    CONFIG_FILE_CANDIDATES
        .into_iter()
        .find(|name| dir.join(name).is_file())
}

/// Whether the shell may let an AI write this config file.
///
/// ADR-036 D6 admits the document formats only — `.yaml`, `.yml` and `.json` —
/// and the engine's write tools refuse anything else on their own
/// (`mcp-config-write-guards.ts`). A `.ts` config is a program, and editing a
/// program has a failure mode editing a document does not, so a `.ts` project
/// opens and runs normally but its AI-writing switch can never be turned on.
pub fn ai_writes_supported(config_file: &str) -> bool {
    Path::new(config_file)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| matches!(e.to_ascii_lowercase().as_str(), "yaml" | "yml" | "json"))
}

/// A project the shell knows about.
///
/// `Serialize` is written by hand (below) so the wire form can carry
/// `aiWritesSupported`, which is DERIVED from `config_file` on every
/// serialisation rather than stored: a stored copy could disagree with the file
/// it describes, and the UI would then offer a switch the engine refuses.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
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
    /// "Let my AI edit": whether the "Connect your AI" snippet switches on the
    /// engine's config-write tools for this project (`MCP_CONFIG_WRITE=1`).
    ///
    /// Off by default, per project, and never honoured for a config format an
    /// AI may not write — read it through [`ProjectRef::ai_writes_enabled`].
    /// It passes the module's test: the value becomes an environment variable
    /// in a client's MCP entry, never a key in the config file. A config that
    /// could authorise its own editing would be authorising itself.
    #[serde(default)]
    pub ai_writes: bool,
    /// The name this project's entry has in Claude Desktop's MCP configuration
    /// (`sovrium-<slug>`, with a numeric suffix if another project had it),
    /// recorded at the first write so later writes update the same entry
    /// (ADR-036 A2 rule 6). `None` until the shell has written one.
    ///
    /// It passes the module's test too: it names a key in the AI client's own
    /// file, and never reaches the project's config file.
    #[serde(default)]
    pub mcp_entry_name: Option<String>,
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
        let config_file = detect_config_file(&dir)
            .unwrap_or(DEFAULT_CONFIG_FILE)
            .to_string();
        Self {
            dir,
            config_file,
            name,
            template,
            ai_writes: false,
            mcp_entry_name: None,
        }
    }

    /// The switch as the engine will see it: on only when the user turned it on
    /// AND the config is a format an AI may write. A record that says "on" for
    /// an `app.ts` project — its file was swapped after the switch was set —
    /// reads as off.
    pub fn ai_writes_enabled(&self) -> bool {
        self.ai_writes && self.ai_writes_supported()
    }

    /// Whether this project's config is a format an AI may write — see
    /// [`ai_writes_supported`].
    pub fn ai_writes_supported(&self) -> bool {
        ai_writes_supported(&self.config_file)
    }

    /// Re-point a remembered project at the config file its folder holds NOW,
    /// when the recorded one is gone.
    ///
    /// Repairs records written before the shell detected the file — a project
    /// forked from a `.json` address was recorded as `app.yaml` and then could
    /// not be reopened — and a project whose file the user renamed. A record
    /// whose file still exists is never touched, and neither is one whose folder
    /// holds no candidate at all: the "no config here" refusal is still the
    /// right answer for that folder, and it should name what was recorded.
    pub fn refresh_config_file(&mut self) -> bool {
        if self.config_path().is_file() {
            return false;
        }
        match detect_config_file(&self.dir) {
            Some(found) if found != self.config_file => {
                self.config_file = found.to_string();
                true
            }
            _ => false,
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

/// The wire and storage form of a [`ProjectRef`]: its fields, plus the derived
/// `aiWritesSupported`. Storing the derived value is harmless — it is ignored
/// on the way back in, since serde skips unknown fields.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRefWire<'a> {
    dir: &'a Path,
    config_file: &'a str,
    name: &'a str,
    template: &'a Option<String>,
    ai_writes: bool,
    ai_writes_supported: bool,
    mcp_entry_name: &'a Option<String>,
}

impl Serialize for ProjectRef {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        ProjectRefWire {
            dir: &self.dir,
            config_file: &self.config_file,
            name: &self.name,
            template: &self.template,
            ai_writes: self.ai_writes,
            ai_writes_supported: self.ai_writes_supported(),
            mcp_entry_name: &self.mcp_entry_name,
        }
        .serialize(serializer)
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
    ///
    /// The "Let my AI edit" switch and the Claude Desktop entry name survive a
    /// reopen: a freshly built [`ProjectRef`] carries neither, so the
    /// remembered values for the same folder are carried over rather than
    /// silently reset.
    pub fn open_project(&mut self, mut project: ProjectRef) {
        if let Some(known) = self.project(&project.dir) {
            project.ai_writes = known.ai_writes;
            project.mcp_entry_name = known.mcp_entry_name.clone();
        }
        self.recents.retain(|r| r.dir != project.dir);
        self.recents.insert(0, project.clone());
        self.recents.truncate(MAX_RECENTS);
        self.active_project = Some(project);
    }

    /// The remembered record for a project folder: the active project first,
    /// then recents.
    pub fn project(&self, dir: &Path) -> Option<&ProjectRef> {
        self.active_project
            .iter()
            .chain(self.recents.iter())
            .find(|p| p.dir.as_path() == dir)
    }

    /// Turn "Let my AI edit" on or off for one project folder.
    ///
    /// Turning it on is refused for a config an AI may not write (`app.ts`),
    /// and for a folder the shell does not remember. Turning it off is always
    /// allowed. Both the active record and the recents entry are updated, so
    /// the value cannot depend on which list a later read consults.
    pub fn set_ai_writes(&mut self, dir: &Path, enabled: bool) -> Result<(), String> {
        let Some(known) = self.project(dir) else {
            return Err("That project is not open.".into());
        };
        if enabled && !known.ai_writes_supported() {
            return Err(format!(
                "Your AI cannot edit {}: only .yaml, .yml and .json configurations can be edited this way.",
                known.config_file
            ));
        }
        for project in self
            .recents
            .iter_mut()
            .chain(self.active_project.iter_mut())
            .filter(|p| p.dir.as_path() == dir)
        {
            project.ai_writes = enabled;
        }
        Ok(())
    }

    /// Record (or, with `None`, clear) the name of a project's Claude Desktop
    /// entry, on the active record and the recents entry alike.
    pub fn set_mcp_entry_name(&mut self, dir: &Path, name: Option<String>) {
        for project in self
            .recents
            .iter_mut()
            .chain(self.active_project.iter_mut())
            .filter(|p| p.dir.as_path() == dir)
        {
            project.mcp_entry_name = name.clone();
        }
    }

    /// The Claude Desktop entry names recorded by every project except `dir`.
    pub fn mcp_entry_names_except(&self, dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = self
            .active_project
            .iter()
            .chain(self.recents.iter())
            .filter(|p| p.dir.as_path() != dir)
            .filter_map(|p| p.mcp_entry_name.clone())
            .collect();
        names.sort();
        names.dedup();
        names
    }

    /// Re-detect the config file of every remembered project whose recorded
    /// file has gone — see [`ProjectRef::refresh_config_file`]. In memory only;
    /// the next save persists it.
    pub fn refresh_config_files(&mut self) {
        for project in self
            .recents
            .iter_mut()
            .chain(self.active_project.iter_mut())
        {
            project.refresh_config_file();
        }
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
    let mut settings: Settings = store
        .get(STORE_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();
    settings.refresh_config_files();
    settings
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

    /// A fresh, empty folder under the system temp dir, unique per test.
    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sov-settings-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_each_config_format_on_its_own() {
        for name in CONFIG_FILE_CANDIDATES {
            let dir = scratch(&format!("one-{name}"));
            std::fs::write(dir.join(name), "name: x").unwrap();
            assert_eq!(detect_config_file(&dir), Some(name), "{name}");
            assert_eq!(ProjectRef::new(dir.clone(), None).config_file, name);
            std::fs::remove_dir_all(&dir).ok();
        }
    }

    #[test]
    fn detection_prefers_yaml_then_yml_then_json_then_ts() {
        let dir = scratch("order");
        for name in ["app.ts", "app.json", "app.yml", "app.yaml"] {
            std::fs::write(dir.join(name), "x").unwrap();
        }
        assert_eq!(detect_config_file(&dir), Some("app.yaml"));
        std::fs::remove_file(dir.join("app.yaml")).unwrap();
        assert_eq!(detect_config_file(&dir), Some("app.yml"));
        std::fs::remove_file(dir.join("app.yml")).unwrap();
        assert_eq!(detect_config_file(&dir), Some("app.json"));
        std::fs::remove_file(dir.join("app.json")).unwrap();
        assert_eq!(detect_config_file(&dir), Some("app.ts"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_folder_with_no_config_detects_nothing_and_a_directory_does_not_count() {
        let dir = scratch("none");
        assert_eq!(detect_config_file(&dir), None);
        // A directory named like a config is not a config the engine can read.
        std::fs::create_dir_all(dir.join("app.yaml")).unwrap();
        assert_eq!(detect_config_file(&dir), None);
        // Nothing found: the record still names the default, so the refusal
        // can say what was looked for.
        assert_eq!(
            ProjectRef::new(dir.clone(), None).config_file,
            DEFAULT_CONFIG_FILE
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_project_forked_from_a_json_address_opens_on_app_json() {
        // The bug this detection fixes: `init --from-url …/x.json` writes
        // `app.json`, and a shell that recorded `app.yaml` then refused to open
        // the folder it had just created.
        let dir = scratch("from-url-json");
        std::fs::write(dir.join("app.json"), "{}").unwrap();
        let p = ProjectRef::new(dir.clone(), None);
        assert_eq!(p.config_file, "app.json");
        assert!(p.config_path().is_file());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn only_document_formats_admit_ai_writes() {
        assert!(ai_writes_supported("app.yaml"));
        assert!(ai_writes_supported("app.yml"));
        assert!(ai_writes_supported("app.json"));
        assert!(ai_writes_supported("APP.YAML"));
        assert!(!ai_writes_supported("app.ts"));
        assert!(!ai_writes_supported("app"));
        assert!(!ai_writes_supported(""));
    }

    #[test]
    fn the_wire_form_carries_whether_ai_writes_are_possible() {
        let dir = scratch("wire");
        std::fs::write(dir.join("app.ts"), "export default {}").unwrap();
        let ts = ProjectRef::new(dir.clone(), None);
        let value = serde_json::to_value(&ts).unwrap();
        assert_eq!(value["configFile"], "app.ts");
        assert_eq!(value["aiWritesSupported"], false);

        let yaml = project("/tmp/nowhere");
        assert_eq!(
            serde_json::to_value(&yaml).unwrap()["aiWritesSupported"],
            true
        );

        // Derived on the way out, ignored on the way in: a stale stored value
        // can never outvote the file name.
        let back: ProjectRef = serde_json::from_str(
            r#"{"dir":"/tmp/x","configFile":"app.ts","aiWritesSupported":true}"#,
        )
        .unwrap();
        assert!(!back.ai_writes_supported());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_stale_record_is_repointed_at_the_file_the_folder_holds_now() {
        let dir = scratch("refresh");
        std::fs::write(dir.join("app.json"), "{}").unwrap();
        // What an older shell recorded for a `.json` fork.
        let mut s: Settings = serde_json::from_value(serde_json::json!({
            "activeProject": { "dir": dir, "configFile": "app.yaml" },
            "recents": [{ "dir": dir, "configFile": "app.yaml" }],
        }))
        .unwrap();
        s.refresh_config_files();
        assert_eq!(s.active_project.as_ref().unwrap().config_file, "app.json");
        assert_eq!(s.recents[0].config_file, "app.json");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_record_whose_file_exists_or_whose_folder_is_empty_is_left_alone() {
        let dir = scratch("refresh-keep");
        std::fs::write(dir.join("app.yml"), "name: x").unwrap();
        std::fs::write(dir.join("app.yaml"), "name: x").unwrap();
        let mut kept: ProjectRef =
            serde_json::from_value(serde_json::json!({ "dir": dir, "configFile": "app.yml" }))
                .unwrap();
        assert!(!kept.refresh_config_file(), "the recorded file exists");
        assert_eq!(kept.config_file, "app.yml");

        let empty = scratch("refresh-empty");
        let mut gone: ProjectRef =
            serde_json::from_value(serde_json::json!({ "dir": empty, "configFile": "app.yaml" }))
                .unwrap();
        assert!(!gone.refresh_config_file());
        assert_eq!(gone.config_file, "app.yaml");
        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&empty).ok();
    }

    #[test]
    fn let_my_ai_edit_is_off_by_default_and_for_old_records() {
        assert!(!project("/tmp/a").ai_writes);
        let old: ProjectRef = serde_json::from_str(r#"{"dir":"/tmp/x"}"#).unwrap();
        assert!(!old.ai_writes);
        assert!(!old.ai_writes_enabled());
    }

    #[test]
    fn let_my_ai_edit_is_set_per_project_and_survives_a_reopen() {
        let mut s = Settings::default();
        s.open_project(project("/a"));
        s.open_project(project("/b"));
        s.set_ai_writes(Path::new("/b"), true).unwrap();
        assert!(s.active_project.as_ref().unwrap().ai_writes_enabled());
        assert!(s.project(Path::new("/b")).unwrap().ai_writes);
        assert!(
            !s.project(Path::new("/a")).unwrap().ai_writes,
            "per project"
        );

        // Reopening builds a fresh record, which must not reset the switch.
        s.open_project(project("/a"));
        s.open_project(project("/b"));
        assert!(s.active_project.as_ref().unwrap().ai_writes);
        assert!(s.recents[0].ai_writes);

        s.set_ai_writes(Path::new("/b"), false).unwrap();
        assert!(!s.active_project.as_ref().unwrap().ai_writes);
        assert!(!s.recents[0].ai_writes);
    }

    #[test]
    fn let_my_ai_edit_cannot_be_turned_on_for_a_typescript_config() {
        let dir = scratch("ts-switch");
        std::fs::write(dir.join("app.ts"), "export default {}").unwrap();
        let mut s = Settings::default();
        s.open_project(ProjectRef::new(dir.clone(), None));
        assert!(s.set_ai_writes(&dir, true).is_err());
        assert!(!s.active_project.as_ref().unwrap().ai_writes);
        // Off is always allowed.
        assert!(s.set_ai_writes(&dir, false).is_ok());

        // A stale "on" for a project whose file became `.ts` reads as off.
        let mut swapped = s.active_project.clone().unwrap();
        swapped.ai_writes = true;
        assert!(!swapped.ai_writes_enabled());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn let_my_ai_edit_refuses_a_folder_the_shell_does_not_know() {
        let mut s = Settings::default();
        assert!(s.set_ai_writes(Path::new("/nowhere"), true).is_err());
    }

    #[test]
    fn a_project_record_without_a_config_file_defaults_to_yaml() {
        let p: ProjectRef = serde_json::from_str(r#"{"dir":"/tmp/x"}"#).expect("decodes");
        assert_eq!(p.config_file, DEFAULT_CONFIG_FILE);
    }

    #[test]
    fn the_claude_desktop_entry_name_is_recorded_per_project_and_survives_a_reopen() {
        let mut s = Settings::default();
        s.open_project(project("/tmp/crm"));
        s.open_project(project("/tmp/blog"));
        assert_eq!(s.project(Path::new("/tmp/crm")).unwrap().mcp_entry_name, None);

        s.set_mcp_entry_name(Path::new("/tmp/crm"), Some("sovrium-crm".into()));
        s.open_project(project("/tmp/crm"));
        assert_eq!(
            s.active_project.as_ref().unwrap().mcp_entry_name.as_deref(),
            Some("sovrium-crm")
        );
        assert_eq!(s.mcp_entry_names_except(Path::new("/tmp/blog")), ["sovrium-crm"]);
        assert!(s.mcp_entry_names_except(Path::new("/tmp/crm")).is_empty());

        s.set_mcp_entry_name(Path::new("/tmp/crm"), None);
        assert_eq!(s.project(Path::new("/tmp/crm")).unwrap().mcp_entry_name, None);
    }
}
