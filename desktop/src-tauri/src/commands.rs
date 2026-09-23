// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The shell's whole IPC surface, in one file so it can be read as one list.
//!
//! Every command here is reachable **only** from a window at the shell's own
//! origin — `main` before it is navigated to the instance, and `settings`, which
//! never leaves it. The page the engine serves holds no permissions at all
//! (`capabilities/default.json` has no `remote` key), so none of this is
//! callable from it.
//!
//! # The refusal this file exists to hold
//!
//! There is no command that writes configuration. Not a field, not a patch, not
//! a "just the theme". [`create_project`] and [`reset_to_template`] both write
//! files, and both do it by invoking `sovrium init` — the engine's own
//! scaffolder, writing a template it already ships. Neither composes
//! configuration, and neither takes configuration as an argument. That is the
//! line: **the shell can ask the engine to lay down a template; it cannot
//! author a config file**, and adding a command that could would be
//! [ADR-022](../../../docs/architecture/decisions/022-admin-dashboard-operational-data-console.md)
//! D2's runtime config-mutation transport rebuilt in a place nobody is
//! watching for it.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::settings::{self, ProjectRef, Settings};
use crate::sidecar::{self, ShellState, StatePayload};
use crate::windows;

/// A folder name the shell is willing to create.
///
/// The user types this, so it is not hostile in the way a deep link is — but it
/// becomes a path segment, and a path segment that can contain `..` or a
/// separator is a way to write outside the folder the user picked. Refused
/// rather than sanitised: silently renaming what someone typed is how a project
/// ends up somewhere they cannot find.
fn is_safe_folder_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 100
        && name != "."
        && name != ".."
        && !name.starts_with('.')
        && !name.contains(['/', '\\', '\0'])
        && !name.chars().any(char::is_control)
        // Windows reserves these, and a folder named for one cannot be created
        // there — better a clear refusal than a platform-specific failure.
        && !matches!(
            name.to_ascii_uppercase().split('.').next().unwrap_or(""),
            "CON" | "PRN" | "AUX" | "NUL"
                | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
                | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
        )
}

/// Would `init` into this directory be creating a project rather than
/// colliding with one?
fn is_usable_target(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    if !dir.is_dir() {
        return Err("That name is already taken by a file.".into());
    }
    let empty = std::fs::read_dir(dir)
        .map_err(|e| format!("That folder could not be read: {e}"))?
        .next()
        .is_none();
    if empty {
        Ok(())
    } else {
        Err("That folder already has something in it. Pick a new name.".into())
    }
}

// ---------------------------------------------------------------------------
// Reading state
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn shell_snapshot<R: Runtime>(app: AppHandle<R>) -> StatePayload {
    sidecar::snapshot(&app)
}

#[tauri::command]
pub fn shell_logs<R: Runtime>(app: AppHandle<R>) -> Vec<String> {
    let supervisor = app.state::<sidecar::SharedSupervisor>();
    let guard = supervisor.lock().unwrap_or_else(|e| e.into_inner());
    guard.logs()
}

/// The two versions, and whether they agree.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Versions {
    pub shell: String,
    pub engine: Option<String>,
    pub matched: bool,
}

#[tauri::command]
pub async fn shell_versions<R: Runtime>(app: AppHandle<R>) -> Versions {
    let (shell, engine) = sidecar::version_parity(&app).await;
    let matched = engine.as_ref().is_some_and(|e| e == &shell);
    Versions {
        shell,
        engine,
        matched,
    }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn settings_read<R: Runtime>(app: AppHandle<R>) -> Settings {
    settings::load(&app)
}

/// A patch of the settings surface ADR-036 D4 enumerates — and nothing else.
///
/// Each field is optional so the UI can change one thing, and every field is
/// named here explicitly rather than accepting a free-form object: a patch that
/// takes whatever it is given is how a config key eventually arrives in a
/// settings store.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    /// `Some(None)` clears the fixed port back to "let the OS choose".
    #[serde(default, deserialize_with = "double_option::deserialize")]
    pub port: Option<Option<u16>>,
    #[serde(default)]
    pub open_in_browser: Option<bool>,
    #[serde(default)]
    pub check_updates: Option<bool>,
}

/// `Option<Option<T>>` needs a helper to tell "absent" from "present and null".
mod double_option {
    use serde::{Deserialize, Deserializer};

    pub fn deserialize<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
    where
        D: Deserializer<'de>,
        T: Deserialize<'de>,
    {
        Option::<T>::deserialize(deserializer).map(Some)
    }
}

#[tauri::command]
pub fn settings_write<R: Runtime>(
    app: AppHandle<R>,
    patch: SettingsPatch,
) -> Result<Settings, String> {
    settings::update(&app, |s| {
        if let Some(port) = patch.port {
            s.port = port;
        }
        if let Some(value) = patch.open_in_browser {
            s.open_in_browser = value;
        }
        if let Some(value) = patch.check_updates {
            s.check_updates = value;
        }
    })
    .inspect(|_| {
        // `check_updates` is the one setting the tray renders, and nothing else
        // rebuilds the menu on a settings write — the supervisor's `broadcast`
        // fires on ENGINE state, which a settings change does not touch. Without
        // this the switch would appear to do nothing until the next start or
        // stop, which reads as a broken toggle rather than a deferred one.
        crate::tray::refresh(&app);
    })
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/// Scaffold a project from an embedded template and open it.
///
/// The write is `sovrium init --template <slug> <dir>` — the engine's own
/// scaffolder, laying down a template the engine already ships. The shell
/// composes nothing.
#[tauri::command]
pub async fn create_project<R: Runtime>(
    app: AppHandle<R>,
    parent_dir: String,
    folder_name: String,
    template: String,
) -> Result<ProjectRef, String> {
    if !is_safe_folder_name(&folder_name) {
        return Err(format!(
            "“{folder_name}” cannot be used as a folder name. Letters, numbers and dashes work best."
        ));
    }
    // The same shape a deep link must satisfy. The gallery only ever offers
    // slugs from the bundled catalogue, so this is a backstop rather than the
    // gate — but a backstop on the one argument that reaches a subprocess.
    if crate::deeplink::parse(&format!("sovrium://new?template={template}")).is_err() {
        return Err(format!("“{template}” is not a template name Sovrium recognises."));
    }

    let dir = PathBuf::from(&parent_dir).join(&folder_name);
    is_usable_target(&dir)?;

    let (ok, stdout, stderr) = sidecar::run_engine_once(
        &app,
        vec![
            "init".into(),
            "--template".into(),
            template.clone(),
            dir.to_string_lossy().into_owned(),
        ],
        None,
    )
    .await?;
    if !ok {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("The project could not be created.\n\n{detail}"));
    }

    let project = ProjectRef::new(dir, Some(template));
    open_recorded(&app, project.clone())?;
    Ok(project)
}

/// Scaffold a project from a configuration published at an https address.
///
/// The sibling of [`create_project`], and the same refusal applies: the shell
/// composes nothing and fetches nothing. It hands an address to
/// `sovrium init --from-url`, which owns the retrieval along with every guard
/// that makes it safe — the SSRF check, the 15-second timeout, the 1 MB cap,
/// decoding before writing, and the refusal of a remote `.ts` or a remote
/// `$ref`. A second fetcher here would be a second threat model, and it would
/// be the one nobody reviewed.
///
/// The address passes the same gate a deep link does, because a URL typed into
/// the window and a URL arriving from a web page deserve one answer, not two.
#[tauri::command]
pub async fn create_project_from_url<R: Runtime>(
    app: AppHandle<R>,
    parent_dir: String,
    folder_name: String,
    url: String,
) -> Result<ProjectRef, String> {
    if !is_safe_folder_name(&folder_name) {
        return Err(format!(
            "“{folder_name}” cannot be used as a folder name. Letters, numbers and dashes work best."
        ));
    }
    let (url, _host) = crate::deeplink::parse_config_url(&url).map_err(|r| r.message())?;

    let dir = PathBuf::from(&parent_dir).join(&folder_name);
    is_usable_target(&dir)?;

    let (ok, stdout, stderr) = sidecar::run_engine_once(
        &app,
        vec![
            "init".into(),
            "--from-url".into(),
            url,
            dir.to_string_lossy().into_owned(),
        ],
        None,
    )
    .await?;
    if !ok {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("The project could not be created.\n\n{detail}"));
    }

    // No template: a project forked from an address has nothing to "reset to",
    // and recording one would give the reset button a template the user never
    // chose.
    let project = ProjectRef::new(dir, None);
    open_recorded(&app, project.clone())?;
    Ok(project)
}

/// Open a folder that already holds a Sovrium project.
#[tauri::command]
pub fn open_project<R: Runtime>(app: AppHandle<R>, dir: String) -> Result<ProjectRef, String> {
    let dir = PathBuf::from(dir);
    if !dir.is_dir() {
        return Err("That folder no longer exists.".into());
    }
    let project = ProjectRef::new(dir, None);
    if !project.config_path().exists() {
        return Err(format!(
            "There is no {} in that folder, so it is not a Sovrium project.",
            project.config_file
        ));
    }
    open_recorded(&app, project.clone())?;
    Ok(project)
}

fn open_recorded<R: Runtime>(app: &AppHandle<R>, project: ProjectRef) -> Result<(), String> {
    settings::update(app, |s| s.open_project(project.clone()))?;
    let app = app.clone();
    // Off the IPC thread: `start` stops whatever is running first, and that
    // waits on a process.
    std::thread::spawn(move || {
        if let Err(message) = sidecar::start(&app, project) {
            log::warn!("the engine could not be started: {message}");
        }
    });
    Ok(())
}

#[tauri::command]
pub fn forget_project<R: Runtime>(app: AppHandle<R>, dir: String) -> Result<Settings, String> {
    settings::update(&app, |s| s.forget_project(Path::new(&dir)))
}

#[tauri::command]
pub fn restart_engine<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    std::thread::spawn(move || {
        if let Err(message) = sidecar::resume(&app) {
            log::warn!("restart failed: {message}");
        }
    });
    Ok(())
}

#[tauri::command]
pub fn pause_engine<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || sidecar::pause(&app));
}

#[tauri::command]
pub fn reveal_project<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let project = sidecar::snapshot(&app)
        .project
        .ok_or_else(|| "No project is open.".to_string())?;
    windows::reveal(&app, &project.dir);
    Ok(())
}

#[tauri::command]
pub fn reveal_settings_folder<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let dir = settings::config_dir(&app)
        .ok_or_else(|| "This machine has no application settings folder.".to_string())?;
    let _ = std::fs::create_dir_all(&dir);
    windows::reveal(&app, &dir);
    Ok(())
}

#[tauri::command]
pub fn open_app_in_browser<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let ShellState::Serving { origin, .. } = sidecar::snapshot(&app).state else {
        return Err("Sovrium is not running yet.".into());
    };
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(format!("{origin}/"), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_settings_window<R: Runtime>(app: AppHandle<R>) {
    windows::show_settings(&app);
}

// ---------------------------------------------------------------------------
// Connect your AI
// ---------------------------------------------------------------------------

/// Everything the "Connect your AI" screen needs, in the two forms clients take.
///
/// Every published client reads the same two values — a command and its
/// arguments — so both forms are built from one pair here rather than being
/// written twice in the frontend. The source of truth for the client syntax is
/// the published article `apps/website/content/docs/en/mcp-config.md`; when that
/// page and this struct disagree, the page is right and this is stale.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSnippet {
    /// Absolute path of the bundled engine.
    pub command: String,
    pub args: Vec<String>,
    /// The `mcpServers` block, for a client configured by file.
    pub json: String,
    /// The one-line `claude mcp add …` form, for a client configured by CLI.
    pub cli: String,
    pub project_dir: Option<String>,
    /// Whether the bundled engine actually answers `sovrium mcp`, probed rather
    /// than assumed — see [`sidecar::has_mcp_verb`]. The screen shows the
    /// snippet either way, and says plainly when the engine cannot serve it.
    pub available: bool,
}

/// Quote a path for a shell one-liner, but only when it needs it.
///
/// A path with a space in it — `/Applications/Sovrium.app/…` does not have one,
/// but `~/My Projects/crm` very much does — pasted unquoted becomes two
/// arguments and the client registers a command that cannot run. Quoting
/// unconditionally would be safe too, and noisier to read; this quotes what
/// needs quoting and leaves the common case clean.
fn shell_arg(value: &str) -> String {
    let safe = value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '.' | '-' | '_' | '~' | ':'));
    if safe && !value.is_empty() {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', r"'\''"))
    }
}

#[tauri::command]
pub async fn mcp_snippet<R: Runtime>(app: AppHandle<R>) -> Result<McpSnippet, String> {
    let project_dir = sidecar::snapshot(&app)
        .project
        .map(|p| p.dir.to_string_lossy().into_owned());
    let command = sidecar::engine_path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "sovrium".into());
    let project_arg = project_dir
        .clone()
        .unwrap_or_else(|| "<your project folder>".into());
    let args = vec!["mcp".to_string(), "--project".to_string(), project_arg];
    let json = serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": {
            "sovrium": { "command": command, "args": args }
        }
    }))
    .map_err(|e| e.to_string())?;
    // `--` is required by `claude mcp add`: everything after it is the server
    // command, passed through untouched.
    let cli = format!(
        "claude mcp add sovrium -- {} {}",
        shell_arg(&command),
        args.iter()
            .map(|a| shell_arg(a))
            .collect::<Vec<_>>()
            .join(" ")
    );
    let available = sidecar::has_mcp_verb(&app).await;
    Ok(McpSnippet {
        command,
        args,
        json,
        cli,
        project_dir,
        available,
    })
}

// ---------------------------------------------------------------------------
// Undo and reset
// ---------------------------------------------------------------------------

/// What the undo affordance can offer right now.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoAvailability {
    pub available: bool,
    /// How many accepted configurations the engine has kept.
    pub snapshots: usize,
    /// The instant a restore would go back to, ISO-8601, or `None` when there is
    /// nowhere to go. Formatted by the frontend, not here: the directory names
    /// are UTC and only the webview knows the user's locale and offset.
    pub target: Option<String>,
}

/// One snapshot directory's instant, recovered from its name.
///
/// `config-snapshot-history.ts` names a snapshot
/// `<ISO with : and . replaced by ->-<configHash>`, because `:` is illegal on
/// Windows. Putting the two characters back is what makes the name a date again.
/// Anything that does not match the exact shape returns `None` rather than a
/// guess — a wrong timestamp on an undo button is worse than no timestamp, since
/// it is the only thing telling the user which change they are about to lose.
fn snapshot_instant(name: &str) -> Option<String> {
    let stamp = &name[..name.find('Z')? + 1];
    let b = stamp.as_bytes();
    if b.len() != 24 || b[10] != b'T' || b[23] != b'Z' {
        return None;
    }
    let sep_positions = [4, 7, 13, 16, 19];
    if sep_positions.iter().any(|&i| b[i] != b'-') {
        return None;
    }
    if (0..24).any(|i| !sep_positions.contains(&i) && i != 10 && i != 23 && !b[i].is_ascii_digit()) {
        return None;
    }
    Some(format!(
        "{}:{}:{}.{}Z",
        &stamp[..13],
        &stamp[14..16],
        &stamp[17..19],
        &stamp[20..23]
    ))
}

/// Every snapshot this project has, oldest first.
///
/// Lexical order IS chronological — the engine chose fixed-width names for
/// exactly this — so no `stat` call and no parsing is needed to sort them.
fn snapshot_names(project: &ProjectRef) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(project.data_dir().join("history")) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    names.sort();
    names
}

/// Is there a configuration to go back to?
///
/// The newest snapshot is the configuration that is RUNNING — the engine writes
/// one for every config it accepts, the current one included — so undo needs
/// two: a restore with one snapshot on disk would put the file back exactly as
/// it already is and report success, which is the most confusing thing an undo
/// can do.
#[tauri::command]
pub fn undo_availability<R: Runtime>(app: AppHandle<R>) -> UndoAvailability {
    let names = sidecar::snapshot(&app)
        .project
        .map(|p| snapshot_names(&p))
        .unwrap_or_default();
    let previous = if names.len() >= 2 {
        names.get(names.len() - 2)
    } else {
        None
    };
    UndoAvailability {
        available: previous.is_some(),
        snapshots: names.len(),
        target: previous.and_then(|n| snapshot_instant(n)),
    }
}

/// Copy one snapshot tree over the project.
///
/// Walks only directories it opened itself, so no name from the tree is ever
/// joined onto the destination as text — traversal is impossible by
/// construction rather than by a check that could be got wrong. Symlinks are
/// skipped outright: a link inside a snapshot is the one shape that could still
/// write outside the project, and a snapshot has no legitimate use for one.
fn restore_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let source = entry.path();
        let destination = to.join(entry.file_name());
        if std::fs::symlink_metadata(&source)?.is_symlink() {
            log::warn!("skipping a symlink in the config history: {}", source.display());
            continue;
        }
        if source.is_dir() {
            std::fs::create_dir_all(&destination)?;
            restore_tree(&source, &destination)?;
        } else {
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&source, &destination)?;
        }
    }
    Ok(())
}

/// Put the previous accepted configuration back.
///
/// There is no engine API for this and deliberately so: a restore is a file
/// copy, and `--watch` serves the result through the ordinary reload path. So
/// the shell needs no privileged channel — it writes the same bytes a person
/// with a file manager would, and the engine cannot tell the difference.
///
/// Returns the instant restored, so the notice can name what the user went back
/// to rather than saying only that something happened.
#[tauri::command]
pub fn undo_restore<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let project = sidecar::snapshot(&app)
        .project
        .ok_or_else(|| "No project is open.".to_string())?;
    let names = snapshot_names(&project);
    if names.len() < 2 {
        return Err(
            "There is no earlier version to go back to — Sovrium has only recorded the \
             configuration that is running now."
                .into(),
        );
    }
    let target = &names[names.len() - 2];
    let from = project.data_dir().join("history").join(target);
    restore_tree(&from, &project.dir)
        .map_err(|e| format!("The earlier version could not be put back: {e}"))?;
    Ok(snapshot_instant(target).unwrap_or_else(|| target.clone()))
}

/// Lay the template down over the project again.
///
/// `--force` clobbers exactly one file — `app.yaml` — and the engine's `init`
/// never clobbers `.gitignore`, `.env.example` or `public/`. The user's data is
/// in `.sovrium/` and is untouched. That is a narrow enough blast radius to
/// offer, and the frontend still confirms it, because the one file it does
/// replace is the file the user has been editing.
#[tauri::command]
pub async fn reset_to_template<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let project = sidecar::snapshot(&app)
        .project
        .ok_or_else(|| "No project is open.".to_string())?;
    let template = project.template.clone().ok_or_else(|| {
        "This project was not created from a template, so there is nothing to reset it to."
            .to_string()
    })?;

    let (ok, stdout, stderr) = sidecar::run_engine_once(
        &app,
        vec![
            "init".into(),
            "--force".into(),
            "--template".into(),
            template,
            project.dir.to_string_lossy().into_owned(),
        ],
        None,
    )
    .await?;
    if !ok {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("The project could not be reset.\n\n{detail}"));
    }
    // `--watch` picks the rewritten file up on its own; no restart is needed,
    // and forcing one would take the app down for a change the watcher handles.
    Ok(())
}

/// Ask the engine whether the current config is valid.
///
/// Prefers `validate --json` (ADR-036 D5, engine phase E1) and falls back to the
/// prose form, which ships today. The fallback is why the return type is a
/// string rather than a findings array: the shell shows what the engine said,
/// and does not reimplement a parser for a format that is about to be replaced.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub ok: bool,
    pub structured: bool,
    pub output: String,
}

#[tauri::command]
pub async fn validate_config<R: Runtime>(app: AppHandle<R>) -> Result<ValidationReport, String> {
    let project = sidecar::snapshot(&app)
        .project
        .ok_or_else(|| "No project is open.".to_string())?;
    let config = project.config_file.clone();
    let dir = project.dir.clone();

    let structured = sidecar::run_engine_once(
        &app,
        vec!["validate".into(), config.clone(), "--json".into()],
        Some(dir.clone()),
    )
    .await;
    if let Ok((ok, stdout, _)) = &structured {
        if stdout.starts_with('{') || stdout.starts_with('[') {
            return Ok(ValidationReport {
                ok: *ok,
                structured: true,
                output: stdout.clone(),
            });
        }
    }

    let (ok, stdout, stderr) =
        sidecar::run_engine_once(&app, vec!["validate".into(), config], Some(dir)).await?;
    Ok(ValidationReport {
        ok,
        structured: false,
        output: if stderr.is_empty() { stdout } else { stderr },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_ordinary_folder_names() {
        for name in ["my-crm", "Sales 2026", "projet_client", "a"] {
            assert!(is_safe_folder_name(name), "{name}");
        }
    }

    #[test]
    fn refuses_a_name_that_could_escape_the_chosen_folder() {
        for name in ["..", ".", "../evil", "a/b", "a\\b", "", ".hidden"] {
            assert!(!is_safe_folder_name(name), "{name}");
        }
    }

    #[test]
    fn refuses_windows_reserved_names_on_every_platform() {
        // Refused everywhere rather than only on Windows: a project folder
        // created on macOS may be synced to a machine that cannot open it.
        for name in ["CON", "con", "NUL", "aux.yaml", "COM1", "lpt9.txt"] {
            assert!(!is_safe_folder_name(name), "{name}");
        }
        assert!(is_safe_folder_name("console"));
    }

    #[test]
    fn refuses_control_characters_and_overlong_names() {
        assert!(!is_safe_folder_name("a\nb"));
        assert!(!is_safe_folder_name("a\0b"));
        assert!(!is_safe_folder_name(&"a".repeat(101)));
    }

    #[test]
    fn an_absent_or_empty_target_is_usable_and_a_full_one_is_not() {
        let base = std::env::temp_dir().join(format!("sov-target-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        assert!(is_usable_target(&base.join("nope")).is_ok());

        std::fs::create_dir_all(&base).unwrap();
        assert!(is_usable_target(&base).is_ok(), "an empty folder is fine");

        std::fs::write(base.join("app.yaml"), "name: x").unwrap();
        assert!(
            is_usable_target(&base).is_err(),
            "a folder with a config in it must not be scaffolded over"
        );
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn a_settings_patch_can_clear_the_port_and_can_leave_it_alone() {
        // `Some(None)` means "back to letting the OS choose"; absent means
        // "do not touch". Collapsing the two would make the port unclearable.
        let clear: SettingsPatch = serde_json::from_str(r#"{"port":null}"#).unwrap();
        assert_eq!(clear.port, Some(None));

        let untouched: SettingsPatch = serde_json::from_str(r#"{"openInBrowser":true}"#).unwrap();
        assert_eq!(untouched.port, None);
        assert_eq!(untouched.open_in_browser, Some(true));

        let set: SettingsPatch = serde_json::from_str(r#"{"port":4321}"#).unwrap();
        assert_eq!(set.port, Some(Some(4321)));
    }

    #[test]
    fn a_settings_patch_carries_nothing_from_the_app_config() {
        // ADR-036 D4 enumerates the settings surface. If this test needs a new
        // field, read that decision before adding one — the question is whether
        // the value could ever end up in the config file.
        let patch: SettingsPatch =
            serde_json::from_str(r#"{"port":1,"openInBrowser":true,"checkUpdates":false,"tables":[]}"#)
                .unwrap();
        assert_eq!(patch.port, Some(Some(1)));
        assert_eq!(patch.check_updates, Some(false));
        // `tables` is ignored, not stored. serde's default is to skip unknown
        // fields, and this asserts we have not turned that off.
    }

    #[test]
    fn a_snapshot_name_becomes_the_instant_it_was_taken() {
        // The exact spelling `config-snapshot-history.ts` produces: an ISO
        // string with `:` and `.` replaced by `-`, then the config hash.
        assert_eq!(
            snapshot_instant("2026-09-22T23-49-01-123Z-abc123def").as_deref(),
            Some("2026-09-22T23:49:01.123Z")
        );
    }

    #[test]
    fn a_snapshot_name_that_is_not_a_date_yields_nothing() {
        // A wrong timestamp on the undo button is worse than none: it is the
        // only thing telling the user which change they are about to lose.
        for name in [
            "not-a-snapshot",
            "2026-09-22-23-49-01-123Z-hash", // no `T`
            "2026-09-2XT23-49-01-123Z-hash", // not all digits
            "2026-09-22T23:49:01.123Z-hash", // the un-escaped form, which Windows cannot store
            "Z",
            "",
        ] {
            assert_eq!(snapshot_instant(name), None, "{name} must not parse");
        }
    }

    #[test]
    fn a_path_with_a_space_is_quoted_for_the_shell_one_liner() {
        // Unquoted, `~/My Projects/crm` becomes two arguments and the client
        // registers a command that cannot run.
        assert_eq!(shell_arg("/Applications/Sovrium.app/sovrium"), "/Applications/Sovrium.app/sovrium");
        assert_eq!(shell_arg("/Users/me/My Projects/crm"), "'/Users/me/My Projects/crm'");
        assert_eq!(shell_arg("mcp"), "mcp");
        assert_eq!(shell_arg("--project"), "--project");
        // The placeholder shown before a project is open.
        assert_eq!(shell_arg("<your project folder>"), "'<your project folder>'");
        // A single quote inside a single-quoted string has to be closed,
        // escaped and reopened, or the rest of the command line is inside the
        // user's path.
        assert_eq!(shell_arg("/Users/o'brien/app"), r"'/Users/o'\''brien/app'");
    }
}
