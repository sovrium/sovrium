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
//!
//! The one file the shell does write on the user's say-so is not a Sovrium
//! configuration at all: it is Claude Desktop's own MCP configuration, into
//! which [`claude_desktop_apply`] puts this project's server entry — a command,
//! its arguments, at most two Sovrium variables — after a dialog showing
//! exactly that entry (ADR-036 A2, `claude_desktop.rs`).

use std::collections::BTreeMap;
use std::sync::Mutex;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::bundle_import;
use crate::claude_desktop::{self, Applied, Plan};
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
    // chose. `new` reads back which file `init --from-url` wrote — `app.json`
    // for a `.json` address, `app.yaml` otherwise — rather than assuming one.
    let project = ProjectRef::new(dir, None);
    open_recorded(&app, project.clone())?;
    Ok(project)
}

// ---------------------------------------------------------------------------
// A bundle link (ADR-036 A1)
// ---------------------------------------------------------------------------

/// The bundle dialog the window should show now, if any. Read on every boot of
/// the window, because the link may have arrived — and the window been
/// navigated back to the shell's chrome — before its listener existed.
#[tauri::command]
pub fn bundle_pending<R: Runtime>(app: AppHandle<R>) -> Option<bundle_import::BundleView> {
    bundle_import::current(&app)
}

/// What an import produced.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleImported {
    /// Registered in the recents, not yet started: the window shows the
    /// password first, then opens it, because opening navigates the window to
    /// the app and would take the password off the screen.
    pub project: ProjectRef,
    /// The admin `--with-demo-data` created, shown once and stored nowhere.
    /// `None` for an app without sign-in.
    pub credentials: Option<bundle_import::Credentials>,
    /// Set when the project was written but its demo data could not be loaded.
    pub warning: Option<String>,
}

/// Import the bundle the dialog is showing into `<parent_dir>/<folder_name>`.
///
/// The archive and its sha256 are the ones held in Rust since the inspection,
/// never values from the frontend, so the bytes imported are the bytes the
/// dialog approved. The import is the engine's:
/// `init --from-bundle <file> <dir> --expect-sha256 <sha256> --with-demo-data`,
/// with the project's own data directory as `SOVRIUM_DATA_DIR` — the one the
/// supervisor will start it with, so the admin and the demo data are there.
///
/// The engine's stdout carries the password and is never put into an error or
/// a log; failures are reported from stderr.
#[tauri::command]
pub async fn bundle_import<R: Runtime>(
    app: AppHandle<R>,
    parent_dir: String,
    folder_name: String,
) -> Result<BundleImported, String> {
    let inspection = bundle_import::ready_inspection(&app)
        .ok_or_else(|| "There is no bundle waiting to be imported.".to_string())?;
    if !is_safe_folder_name(&folder_name) {
        return Err(format!(
            "“{folder_name}” cannot be used as a folder name. Letters, numbers and dashes work best."
        ));
    }
    let file = inspection
        .file
        .clone()
        .filter(|f| bundle_import::is_engine_download(f, &bundle_import::temp_root()))
        .ok_or_else(|| {
            "The downloaded bundle is no longer where Sovrium left it. Open the link again.".to_string()
        })?;

    let dir = PathBuf::from(&parent_dir).join(&folder_name);
    is_usable_target(&dir)?;
    let data_dir = ProjectRef::new(dir.clone(), None).data_dir();

    let (ok, stdout, stderr) = sidecar::run_engine_once_with_env(
        &app,
        vec![
            "init".into(),
            "--from-bundle".into(),
            file.to_string_lossy().into_owned(),
            dir.to_string_lossy().into_owned(),
            "--expect-sha256".into(),
            inspection.sha256.clone(),
            "--with-demo-data".into(),
        ],
        None,
        // The shell's environment minus what would redirect storage: a
        // `DATABASE_URL` in it would refuse the import, or seed that database.
        bundle_import::import_env(
            std::env::vars_os(),
            vec![("SOVRIUM_DATA_DIR".into(), data_dir.into_os_string())],
        ),
    )
    .await?;

    // Detected from the folder: the engine writes `app.yaml` (A1, D5).
    let project = ProjectRef::new(dir, None);
    let written = project.config_path().is_file();
    if !ok && !written {
        // Nothing was written, so the dialog stays and the user can pick
        // another folder or cancel.
        return Err(format!(
            "The project could not be created.\n\n{}",
            bundle_import::engine_error(&stderr)
        ));
    }
    let credentials = bundle_import::parse_credentials(&stdout);
    drop(stdout);
    let warning = (!ok).then(|| bundle_import::engine_error(&stderr));

    bundle_import::finish(&app);
    settings::update(&app, |s| s.open_project(project.clone()))?;
    Ok(BundleImported {
        project,
        credentials,
        warning,
    })
}

/// Decline the bundle: close the dialog, delete the download, and put the
/// window back on the app it was showing, if one is running.
#[tauri::command]
pub fn bundle_discard<R: Runtime>(app: AppHandle<R>) {
    bundle_import::finish(&app);
    sidecar::return_to_app(&app);
}

/// Open a folder that already holds a Sovrium project.
#[tauri::command]
pub fn open_project<R: Runtime>(app: AppHandle<R>, dir: String) -> Result<ProjectRef, String> {
    let dir = PathBuf::from(dir);
    if !dir.is_dir() {
        return Err("That folder no longer exists.".into());
    }
    // `new` picks the config file the folder actually holds, so a project
    // forked from a `.json` address — or one whose owner prefers `app.yml` —
    // opens on its own file rather than being refused for lacking `app.yaml`.
    let project = ProjectRef::new(dir, None);
    if !project.config_path().is_file() {
        return Err(format!(
            "There is no {} in that folder, so it is not a Sovrium project.",
            settings::CONFIG_FILE_CANDIDATES.join(", ")
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
/// the in-binary manual — `src/docs/guides/connect-desktop-ai.md` and
/// `src/cli/commands/mcp-write.docs.md`; when those pages and this struct
/// disagree, the pages are right and this is stale.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSnippet {
    /// Absolute path of the bundled engine.
    pub command: String,
    pub args: Vec<String>,
    /// Environment the client must set on the server process. Empty unless
    /// "Let my AI edit" is on, or the config is one the engine would not find
    /// on its own — see [`snippet_env`].
    pub env: BTreeMap<String, String>,
    /// The `mcpServers` block, for a client configured by file.
    pub json: String,
    /// The one-line `claude mcp add …` form, for a client configured by CLI.
    pub cli: String,
    pub project_dir: Option<String>,
    /// Whether the bundled engine actually answers `sovrium mcp`, probed rather
    /// than assumed — see [`sidecar::has_mcp_verb`]. The screen shows the
    /// snippet either way, and says plainly when the engine cannot serve it.
    pub available: bool,
    /// Whether "Let my AI edit" is on for the open project — and so whether
    /// `env` carries `MCP_CONFIG_WRITE`. Always `false` when no project is open
    /// or its config is a format an AI may not write.
    pub writes_enabled: bool,
    /// Whether the switch can be turned on at all: a project is open and its
    /// config is `.yaml`, `.yml` or `.json` (ADR-036 D6). `false` for `app.ts`.
    pub writes_supported: bool,
    /// The server's name in both forms: `sovrium-<project>`, so two projects
    /// can be connected side by side (ADR-036 A2 rule 6).
    pub entry_name: String,
    /// Where Claude Desktop's configuration file is on this machine, when the
    /// one-click "Connect Claude Desktop" is offered here at all. `None` on an
    /// OS without a known path, and on Linux without `~/.config/Claude/`.
    pub claude_desktop_path: Option<String>,
    /// Whether the shell has written this project's entry before, so a change
    /// of the switch should offer to write it again.
    pub claude_desktop_connected: bool,
}

/// The config files `sovrium mcp` finds on its own when given only
/// `--project` — `DEFAULT_CONFIG_FILENAMES` in
/// `src/domain/kernel/config-parsing/default-config-files.ts`. `app.json` is
/// deliberately not one of them there, so a project on `app.json` has to name
/// its file to the server.
const ENGINE_DISCOVERED_CONFIG_FILES: [&str; 3] = ["app.yaml", "app.yml", "app.ts"];

/// The environment a client must give `sovrium mcp` for this project.
///
/// - `MCP_CONFIG_WRITE=1` when "Let my AI edit" is on — the engine's switch for
///   its four config-write tools (`mcp-write.docs.md`). It is honoured only
///   alongside an explicit `--project`, which the arguments always carry.
/// - `SOVRIUM_CONFIG_FILE` when the project's config is one the server would
///   not discover by itself (`app.json`), or the server would read a different
///   file from the one the app runs — or none, and serve no write tools.
fn snippet_env(project: Option<&ProjectRef>, writes_enabled: bool) -> BTreeMap<String, String> {
    let mut env = BTreeMap::new();
    if let Some(project) = project {
        if !ENGINE_DISCOVERED_CONFIG_FILES.contains(&project.config_file.as_str()) {
            env.insert("SOVRIUM_CONFIG_FILE".into(), project.config_file.clone());
        }
    }
    if writes_enabled {
        env.insert("MCP_CONFIG_WRITE".into(), "1".into());
    }
    env
}

/// The two snippet forms, built from one command, one argument list and one
/// environment so they cannot drift apart.
///
/// The JSON form carries an `env` object only when there is something in it,
/// so the default snippet stays exactly the block the manual prints. The CLI
/// form passes each variable as `--env KEY=VALUE` after the server name and
/// before `--`: everything after `--` is the server command, passed through
/// untouched, so an option placed there would become an argument to Sovrium.
/// One server entry: `command`, `args`, and `env` only when there is something
/// in it. The snippet and the Claude Desktop write both use this, so the entry
/// written is the entry the snippet shows.
fn server_entry(command: &str, args: &[String], env: &BTreeMap<String, String>) -> serde_json::Value {
    let mut server = serde_json::json!({ "command": command, "args": args });
    if !env.is_empty() {
        let env: serde_json::Map<String, serde_json::Value> = env
            .iter()
            .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
            .collect();
        server["env"] = serde_json::Value::Object(env);
    }
    server
}

fn render_snippet(
    name: &str,
    command: &str,
    args: &[String],
    env: &BTreeMap<String, String>,
) -> Result<(String, String), String> {
    let server = server_entry(command, args, env);
    let json = serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": { name: server }
    }))
    .map_err(|e| e.to_string())?;
    let env_flags: String = env
        .iter()
        .map(|(k, v)| format!(" --env {}", shell_arg(&format!("{k}={v}"))))
        .collect();
    let cli = format!(
        "claude mcp add {}{env_flags} -- {} {}",
        shell_arg(name),
        shell_arg(command),
        args.iter()
            .map(|a| shell_arg(a))
            .collect::<Vec<_>>()
            .join(" ")
    );
    Ok((json, cli))
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
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '.' | '-' | '_' | '~' | ':' | '='));
    if safe && !value.is_empty() {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', r"'\''"))
    }
}

/// What both the snippet and the Claude Desktop entry are built from, for one
/// project (or none): the command, its arguments, the environment, and the
/// switch's two states.
struct ServerInputs {
    command: String,
    args: Vec<String>,
    env: BTreeMap<String, String>,
    writes_enabled: bool,
    writes_supported: bool,
}

fn server_inputs(project: Option<&ProjectRef>, settings: &Settings) -> ServerInputs {
    // The switch is read from the settings store, not from the supervisor's
    // copy of the project: that copy is taken when the engine starts and does
    // not see a toggle made since.
    let writes_supported = project.is_some_and(ProjectRef::ai_writes_supported);
    let writes_enabled = writes_supported
        && project.is_some_and(|p| settings.project(&p.dir).is_some_and(|known| known.ai_writes));
    let command = sidecar::engine_path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "sovrium".into());
    let project_arg = project
        .map(|p| p.dir.to_string_lossy().into_owned())
        .unwrap_or_else(|| "<your project folder>".into());
    let args = vec!["mcp".to_string(), "--project".to_string(), project_arg];
    let env = snippet_env(project, writes_enabled);
    ServerInputs {
        command,
        args,
        env,
        writes_enabled,
        writes_supported,
    }
}

/// The name this project's server goes under, in the snippet and in Claude
/// Desktop's file — see [`claude_desktop::resolve_entry_name`]. `servers` is
/// the `mcpServers` object of Claude Desktop's file, when it could be read.
fn entry_name_for(
    project: Option<&ProjectRef>,
    settings: &Settings,
    servers: Option<&serde_json::Map<String, serde_json::Value>>,
) -> String {
    let Some(project) = project else {
        return "sovrium".into();
    };
    let recorded = settings
        .project(&project.dir)
        .and_then(|p| p.mcp_entry_name.as_deref());
    claude_desktop::resolve_entry_name(
        recorded,
        &project.name,
        &project.dir.to_string_lossy(),
        &settings.mcp_entry_names_except(&project.dir),
        servers,
    )
}

/// The `mcpServers` object of Claude Desktop's file, for naming only. Any
/// failure to read or parse it is "nothing known"; the write itself refuses
/// on its own terms.
fn claude_desktop_servers(path: Option<&Path>) -> Option<serde_json::Map<String, serde_json::Value>> {
    let path = claude_desktop::resolve_target(path?);
    let bytes = claude_desktop::read(&path).ok()??;
    claude_desktop::servers_of(Some(&bytes))
}

#[tauri::command]
pub async fn mcp_snippet<R: Runtime>(app: AppHandle<R>) -> Result<McpSnippet, String> {
    let project = sidecar::snapshot(&app).project;
    let project_dir = project
        .as_ref()
        .map(|p| p.dir.to_string_lossy().into_owned());
    let settings = settings::load(&app);
    let inputs = server_inputs(project.as_ref(), &settings);
    let claude_desktop_path = claude_desktop::config_path();
    let entry_name = entry_name_for(
        project.as_ref(),
        &settings,
        claude_desktop_servers(claude_desktop_path.as_deref()).as_ref(),
    );
    let (json, cli) = render_snippet(&entry_name, &inputs.command, &inputs.args, &inputs.env)?;
    let available = sidecar::has_mcp_verb(&app).await;
    let claude_desktop_connected = project.as_ref().is_some_and(|p| {
        settings
            .project(&p.dir)
            .is_some_and(|known| known.mcp_entry_name.is_some())
    });
    Ok(McpSnippet {
        command: inputs.command,
        args: inputs.args,
        env: inputs.env,
        json,
        cli,
        project_dir,
        available,
        writes_enabled: inputs.writes_enabled,
        writes_supported: inputs.writes_supported,
        entry_name,
        claude_desktop_path: project
            .as_ref()
            .and(claude_desktop_path)
            .map(|p| p.to_string_lossy().into_owned()),
        claude_desktop_connected,
    })
}

// ---------------------------------------------------------------------------
// Connect Claude Desktop (ADR-036 A2)
// ---------------------------------------------------------------------------

/// Add (or replace) this project's entry, or take it out.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientWriteAction {
    Connect,
    Remove,
}

/// The one write the user was last shown, waiting for their answer.
///
/// Held here, not sent back by the frontend, so a confirmation can only ever
/// apply the exact plan its dialog displayed — path, entry and backup name
/// included — and the frontend never holds the rest of the file.
struct PendingWrite {
    plan: Plan,
    project_dir: PathBuf,
    action: ClientWriteAction,
}

#[derive(Default)]
pub struct PendingClientWrite(Mutex<Option<PendingWrite>>);

/// Everything the consent dialog shows (A2 rule 1), or why there is no dialog.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ClaudeDesktopPreview {
    Ready {
        /// The file that will be written.
        path: String,
        entry_name: String,
        /// The entry exactly as it will be written, `{ "<name>": { … } }`;
        /// empty braces for a removal.
        entry: String,
        /// Whether the entry carries `MCP_CONFIG_WRITE`.
        writes_enabled: bool,
        file_exists: bool,
        /// Where the original will be copied first; `None` when there is no
        /// file yet.
        backup_path: Option<String>,
        /// Whether this project's entry is in the file now.
        already_present: bool,
        /// Whether confirming would change nothing.
        unchanged: bool,
        /// Passed back to [`claude_desktop_apply`].
        fingerprint: String,
    },
    /// The file is not one the shell will touch (A2 rule 4). `fallback` is the
    /// copy-snippet block to add by hand instead.
    Refused { reason: String, fallback: String },
}

/// Compute a write to Claude Desktop's configuration and hold it for
/// confirmation. Writes nothing.
///
/// `Connect` acts on the open project. `Remove` acts on `dir`, or on the open
/// project when `dir` is absent; it is offered when a project is removed and
/// never performed automatically (A2 rule 8).
#[tauri::command]
pub fn claude_desktop_preview<R: Runtime>(
    app: AppHandle<R>,
    action: ClientWriteAction,
    dir: Option<String>,
) -> Result<ClaudeDesktopPreview, String> {
    let path = claude_desktop::config_path()
        .ok_or_else(|| "Claude Desktop's configuration file has no known place on this computer.".to_string())?;
    let settings = settings::load(&app);
    let project = match (action, dir) {
        (ClientWriteAction::Remove, Some(dir)) => settings
            .project(Path::new(&dir))
            .cloned()
            .ok_or_else(|| "That project is not one Sovrium knows.".to_string())?,
        _ => sidecar::snapshot(&app)
            .project
            .ok_or_else(|| "No project is open.".to_string())?,
    };
    let inputs = server_inputs(Some(&project), &settings);
    let (fallback, _) = render_snippet(
        &entry_name_for(Some(&project), &settings, None),
        &inputs.command,
        &inputs.args,
        &inputs.env,
    )?;

    let target = claude_desktop::resolve_target(&path);
    let refuse = |r: claude_desktop::Refusal| ClaudeDesktopPreview::Refused {
        reason: r.message(),
        fallback: fallback.clone(),
    };
    let original = match claude_desktop::read(&target) {
        Ok(bytes) => bytes,
        Err(r) => return Ok(refuse(r)),
    };
    let servers = claude_desktop::servers_of(original.as_deref());
    let entry_name = entry_name_for(Some(&project), &settings, servers.as_ref());
    let entry = match action {
        ClientWriteAction::Connect => Some(server_entry(&inputs.command, &inputs.args, &inputs.env)),
        ClientWriteAction::Remove => None,
    };
    let stamp = claude_desktop::backup_stamp(std::time::SystemTime::now());
    let plan = match claude_desktop::plan(&target, original.as_deref(), &entry_name, entry, &stamp) {
        Ok(plan) => plan,
        Err(r) => return Ok(refuse(r)),
    };

    let preview = ClaudeDesktopPreview::Ready {
        path: plan.path.to_string_lossy().into_owned(),
        entry_name: plan.entry_name.clone(),
        entry: plan.entry_preview(),
        writes_enabled: plan.writes_enabled(),
        file_exists: plan.file_exists,
        backup_path: plan
            .backup_path
            .as_ref()
            .map(|p| p.to_string_lossy().into_owned()),
        already_present: plan.already_present,
        unchanged: plan.unchanged,
        fingerprint: plan.fingerprint.clone(),
    };
    let pending = app.state::<PendingClientWrite>();
    *pending.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(PendingWrite {
        plan,
        project_dir: project.dir,
        action,
    });
    Ok(preview)
}

/// What a confirmation did.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ClaudeDesktopApplied {
    /// Written. Claude Desktop reads the file at launch, so it must be
    /// restarted (A2 rule 9).
    Written { backup_path: Option<String> },
    /// The entry was already exactly this; nothing was written.
    Unchanged,
    /// The file, or the write, is not the one the dialog showed. Nothing was
    /// written; ask for a new preview and show the dialog again.
    Changed,
}

/// Apply the write the user just confirmed — and only that one.
#[tauri::command]
pub fn claude_desktop_apply<R: Runtime>(
    app: AppHandle<R>,
    fingerprint: String,
) -> Result<ClaudeDesktopApplied, String> {
    let pending = app
        .state::<PendingClientWrite>()
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    let Some(pending) = pending.filter(|p| p.plan.fingerprint == fingerprint) else {
        return Ok(ClaudeDesktopApplied::Changed);
    };
    let outcome = claude_desktop::apply(&pending.plan)?;
    if outcome != Applied::Changed {
        let name = match pending.action {
            ClientWriteAction::Connect => Some(pending.plan.entry_name.clone()),
            ClientWriteAction::Remove => None,
        };
        settings::update(&app, |s| s.set_mcp_entry_name(&pending.project_dir, name))?;
    }
    Ok(match outcome {
        Applied::Written { backup } => ClaudeDesktopApplied::Written {
            backup_path: backup.map(|p| p.to_string_lossy().into_owned()),
        },
        Applied::Unchanged => ClaudeDesktopApplied::Unchanged,
        Applied::Changed => ClaudeDesktopApplied::Changed,
    })
}

/// Turn "Let my AI edit" on or off for the open project, and answer with the
/// settings as stored.
///
/// The shell writes no configuration here either: the switch changes what the
/// "Connect your AI" snippet tells a client to set in its OWN environment.
/// Nothing reaches the config file, and nothing reaches the running engine —
/// the write tools belong to the `sovrium mcp` process the client spawns, so a
/// client already connected keeps what it had until the user pastes the new
/// snippet, or confirms the rewrite of its Claude Desktop entry the screen then
/// offers, and restarts it.
#[tauri::command]
pub fn set_ai_writes<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<Settings, String> {
    let project = sidecar::snapshot(&app)
        .project
        .ok_or_else(|| "No project is open.".to_string())?;
    let mut outcome = Ok(());
    let settings = settings::update(&app, |s| {
        outcome = s.set_ai_writes(&project.dir, enabled);
    })?;
    outcome.map(|()| settings)
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

    fn args_for(dir: &str) -> Vec<String> {
        vec!["mcp".into(), "--project".into(), dir.into()]
    }

    fn yaml_project() -> ProjectRef {
        // A folder that does not exist: detection falls back to `app.yaml`.
        ProjectRef::new(PathBuf::from("/Users/me/apps/crm"), None)
    }

    #[test]
    fn the_default_snippet_is_exactly_the_block_the_manual_prints() {
        // `connect-desktop-ai.md`: no `env` key at all until writing is on.
        let env = snippet_env(Some(&yaml_project()), false);
        assert!(env.is_empty());
        let (json, cli) =
            render_snippet("sovrium-crm", "sovrium", &args_for("/Users/me/apps/crm"), &env).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "mcpServers": { "sovrium-crm": {
                "command": "sovrium",
                "args": ["mcp", "--project", "/Users/me/apps/crm"],
            }}})
        );
        assert_eq!(cli, "claude mcp add sovrium-crm -- sovrium mcp --project /Users/me/apps/crm");
    }

    #[test]
    fn let_my_ai_edit_adds_the_write_switch_to_both_forms() {
        // `mcp-write.docs.md`: `"env": { "MCP_CONFIG_WRITE": "1" }` beside an
        // explicit `--project`.
        let env = snippet_env(Some(&yaml_project()), true);
        let (json, cli) =
            render_snippet("sovrium-crm", "sovrium", &args_for("/Users/me/apps/crm"), &env).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "mcpServers": { "sovrium-crm": {
                "command": "sovrium",
                "args": ["mcp", "--project", "/Users/me/apps/crm"],
                "env": { "MCP_CONFIG_WRITE": "1" },
            }}})
        );
        assert_eq!(
            cli,
            "claude mcp add sovrium-crm --env MCP_CONFIG_WRITE=1 -- sovrium mcp --project /Users/me/apps/crm"
        );
        // The option must sit before `--`, or it is passed to Sovrium.
        let dashdash = cli.find(" -- ").unwrap();
        assert!(cli.find("--env").unwrap() < dashdash);
    }

    #[test]
    fn a_json_project_names_its_file_to_the_server() {
        // `sovrium mcp --project` does not discover `app.json` on its own, so
        // without this the server would read nothing and serve no write tools.
        let dir = std::env::temp_dir().join(format!("sov-snippet-json-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("app.json"), "{}").unwrap();
        let project = ProjectRef::new(dir.clone(), None);

        let reads = snippet_env(Some(&project), false);
        assert_eq!(reads.get("SOVRIUM_CONFIG_FILE").map(String::as_str), Some("app.json"));
        assert!(!reads.contains_key("MCP_CONFIG_WRITE"));

        let writes = snippet_env(Some(&project), true);
        let (_, cli) = render_snippet("sovrium-p", "sovrium", &args_for("/p"), &writes).unwrap();
        assert_eq!(
            cli,
            "claude mcp add sovrium-p --env MCP_CONFIG_WRITE=1 --env SOVRIUM_CONFIG_FILE=app.json -- sovrium mcp --project /p"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn no_open_project_means_no_environment() {
        assert!(snippet_env(None, false).is_empty());
        assert_eq!(
            snippet_env(None, true).get("MCP_CONFIG_WRITE").map(String::as_str),
            Some("1"),
            "the caller gates the switch; this only renders it"
        );
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

    #[test]
    fn the_snippet_and_the_claude_desktop_entry_are_the_same_server() {
        let env = snippet_env(Some(&yaml_project()), true);
        let args = args_for("/Users/me/apps/crm");
        let (json, _) = render_snippet("sovrium-crm", "sovrium", &args, &env).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["mcpServers"]["sovrium-crm"], server_entry("sovrium", &args, &env));
        // No `env` key at all while it would be empty.
        assert!(server_entry("sovrium", &args, &BTreeMap::new()).get("env").is_none());
    }

    #[test]
    fn two_projects_get_two_names_in_both_forms() {
        let mut settings = Settings::default();
        settings.open_project(ProjectRef::new(PathBuf::from("/Users/me/work/crm"), None));
        settings.set_mcp_entry_name(Path::new("/Users/me/work/crm"), Some("sovrium-crm".into()));
        let other = ProjectRef::new(PathBuf::from("/Users/me/home/crm"), None);
        settings.open_project(other.clone());

        let name = entry_name_for(Some(&other), &settings, None);
        assert_eq!(name, "sovrium-crm-2");
        let (json, cli) = render_snippet(&name, "sovrium", &args_for("/Users/me/home/crm"), &BTreeMap::new()).unwrap();
        assert!(json.contains("\"sovrium-crm-2\""));
        assert!(cli.starts_with("claude mcp add sovrium-crm-2 -- "));
        // No project open: the generic name the manual prints.
        assert_eq!(entry_name_for(None, &settings, None), "sovrium");
    }
}
