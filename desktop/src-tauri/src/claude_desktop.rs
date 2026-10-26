// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! "Connect Claude Desktop": writing this project's entry into Claude Desktop's
//! own MCP configuration file, once per consent.
//!
//! [ADR-036](../../../docs/architecture/decisions/036-desktop-app-local-development-environment.md)
//! amendment A2 is the contract, and every rule below is one of its rules:
//!
//! 1. **Consent, every time.** [`plan`] computes everything the dialog shows —
//!    the path, the exact entry, whether `MCP_CONFIG_WRITE` is in it, the backup
//!    path — and writes nothing. [`apply`] writes only a plan the user saw, and
//!    only if the file is byte-for-byte what it was when they saw it.
//! 2. **A backup first**, beside the original, with its permissions. No backup,
//!    no write. The last [`BACKUPS_KEPT`] are kept and older ones deleted.
//! 3. **One key.** Only `mcpServers["sovrium-<project>"]` is added, replaced or
//!    removed. Every other key keeps its value and its place; only the
//!    indentation may change. The write is atomic: a temporary file, then a
//!    rename.
//! 4. **Unparseable means refused.** A file that is not strict JSON is never
//!    repaired; the caller falls back to the copy-snippet path.
//! 5. **Other servers are read only to be preserved.** That file commonly holds
//!    other servers' tokens. Nothing here logs it, returns any entry but ours,
//!    or sends it anywhere — an error names a line and a column, never content.
//!
//! # This is not a config editor
//!
//! The file written here belongs to the user's AI client, not to their app. It
//! receives a command, its arguments and at most two Sovrium variables, and
//! never a credential. Nothing in this module can reach the project's own
//! configuration file, which stays ADR-036 D2's to be edited only by the user
//! and the AI they connect.
//!
//! # Testable without a real Claude Desktop
//!
//! Every function here takes its paths as arguments. [`config_path_for`] is the
//! only place a real location is derived, and it takes the OS and the home and
//! `%APPDATA%` directories as inputs, so no test reads or writes the
//! `claude_desktop_config.json` of the machine it runs on.

use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value};

/// The file's own name, the same on every OS.
pub const CONFIG_FILE_NAME: &str = "claude_desktop_config.json";

/// What follows the config file's name in a backup's name. Pruning matches on
/// exactly this prefix, so nothing else in the directory is ever deleted.
const BACKUP_INFIX: &str = ".sovrium-backup-";

/// How many backups of one config file are kept (founder ruling, 2026-10-25).
pub const BACKUPS_KEPT: usize = 5;

/// Every entry this shell writes starts with this.
const ENTRY_PREFIX: &str = "sovrium-";

/// The operating systems A2 names a path for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    MacOs,
    Windows,
    Linux,
    Other,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Self::MacOs
        } else if cfg!(target_os = "windows") {
            Self::Windows
        } else if cfg!(target_os = "linux") {
            Self::Linux
        } else {
            Self::Other
        }
    }
}

/// Where Claude Desktop reads its MCP servers from, or `None` when the one-click
/// write is not offered here.
///
/// The paths are Anthropic's, and A2 takes them as given: a path that no longer
/// matches falls back to the snippet and is never a reason to search the disk.
/// Linux has no official build, so the write is offered there only when
/// `~/.config/Claude/` already exists — the folder community builds use.
pub fn config_path_for(os: Os, home: Option<&Path>, appdata: Option<&Path>) -> Option<PathBuf> {
    match os {
        Os::MacOs => home.map(|h| {
            h.join("Library")
                .join("Application Support")
                .join("Claude")
                .join(CONFIG_FILE_NAME)
        }),
        Os::Windows => appdata.map(|a| a.join("Claude").join(CONFIG_FILE_NAME)),
        Os::Linux => home
            .map(|h| h.join(".config").join("Claude"))
            .filter(|dir| dir.is_dir())
            .map(|dir| dir.join(CONFIG_FILE_NAME)),
        Os::Other => None,
    }
}

/// [`config_path_for`] on this machine.
pub fn config_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from);
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    config_path_for(Os::current(), home.as_deref(), appdata.as_deref())
}

// ---------------------------------------------------------------------------
// The entry's name
// ---------------------------------------------------------------------------

/// A project's slug: its name in lower-case ASCII letters and digits, every
/// other run of characters one hyphen. `"My CRM (v2)"` becomes `my-crm-v2`.
/// A name with nothing left in it becomes `project`.
pub fn project_slug(name: &str) -> String {
    let mut slug = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if !slug.is_empty() && !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let mut slug: String = slug.chars().take(48).collect();
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        "project".into()
    } else {
        slug
    }
}

/// Whether an entry already in the file is this project's: a Sovrium entry
/// whose `--project` argument is this folder. Such an entry was put there by a
/// snippet the user pasted, or by an earlier write, and is updated rather than
/// duplicated. Only the `args` of the one entry being named are read.
fn entry_points_at(entry: &Value, project_dir: &str) -> bool {
    let Some(args) = entry.get("args").and_then(Value::as_array) else {
        return false;
    };
    args.windows(2)
        .any(|pair| pair[0].as_str() == Some("--project") && pair[1].as_str() == Some(project_dir))
}

/// Whether `name` has the shape of a name this shell writes: `sovrium-`
/// followed by at least one character.
///
/// A plain `"sovrium"` key is the name the copy-paste snippet prints when no
/// project is open, so it is the one a person most likely wrote by hand. It is
/// never this shell's to update or remove, even when its `--project` is this
/// folder: reusing it would overwrite, or on a removal delete, an entry the
/// user wrote themselves.
fn is_shell_entry_name(name: &str) -> bool {
    name.len() > ENTRY_PREFIX.len() && name.starts_with(ENTRY_PREFIX)
}

/// The name this project's entry goes under.
///
/// A name already recorded on the project's settings record is used as is, so a
/// later write updates the same entry (A2 rule 6) — provided it has the shape
/// this shell writes ([`is_shell_entry_name`]); a recorded name of any other
/// shape is ignored, since the settings file is plain JSON a person can edit.
/// Otherwise the first of `sovrium-<slug>`, `sovrium-<slug>-2`, `-3`, … that is
/// neither recorded by another project nor already in the file for a different
/// folder. Only those names are ever reused from the file: an entry under any
/// other key, a hand-written `"sovrium"` included, is left exactly as it is.
pub fn resolve_entry_name(
    recorded: Option<&str>,
    project_name: &str,
    project_dir: &str,
    recorded_by_others: &[String],
    servers_in_file: Option<&Map<String, Value>>,
) -> String {
    if let Some(name) = recorded.filter(|n| is_shell_entry_name(n)) {
        return name.to_string();
    }
    let base = format!("{ENTRY_PREFIX}{}", project_slug(project_name));
    let taken = |candidate: &str| {
        recorded_by_others.iter().any(|n| n == candidate)
            || servers_in_file
                .and_then(|servers| servers.get(candidate))
                .is_some_and(|entry| !entry_points_at(entry, project_dir))
    };
    if !taken(&base) {
        return base;
    }
    (2..)
        .map(|n| format!("{base}-{n}"))
        .find(|candidate| !taken(candidate))
        .unwrap_or(base)
}

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

/// Why a file is refused. Each message names what is wrong and never quotes the
/// file: it may hold other servers' secrets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// Not strict JSON — a syntax error, a comment, a trailing comma.
    Unparseable { line: usize, column: usize },
    /// Valid JSON whose top level is not an object.
    NotAnObject,
    /// `mcpServers` is there and is not an object.
    ServersNotAnObject,
    /// The file exists and could not be read.
    Unreadable(String),
}

impl Refusal {
    pub fn message(&self) -> String {
        match self {
            Self::Unparseable { line, column } => format!(
                "Claude Desktop's configuration file is not valid JSON (line {line}, column {column}), so Sovrium will not change it."
            ),
            Self::NotAnObject => {
                "Claude Desktop's configuration file does not hold a JSON object, so Sovrium will not change it.".into()
            }
            Self::ServersNotAnObject => {
                "The \"mcpServers\" setting in Claude Desktop's configuration file is not an object, so Sovrium will not change it.".into()
            }
            Self::Unreadable(why) => {
                format!("Claude Desktop's configuration file could not be read: {why}")
            }
        }
    }
}

/// The file's top-level object, parsed strictly. `None` bytes — no file — is an
/// empty object.
fn parse(bytes: Option<&[u8]>) -> Result<Map<String, Value>, Refusal> {
    let Some(bytes) = bytes else {
        return Ok(Map::new());
    };
    // serde_json is strict JSON: comments and trailing commas are syntax errors,
    // which is the "never repaired" half of A2 rule 4.
    match serde_json::from_slice::<Value>(bytes) {
        Ok(Value::Object(map)) => Ok(map),
        Ok(_) => Err(Refusal::NotAnObject),
        Err(e) => Err(Refusal::Unparseable {
            line: e.line(),
            column: e.column(),
        }),
    }
}

/// The `mcpServers` object of a parsed file, when it is one. For naming only;
/// [`plan`] does its own, refusing, check.
pub fn servers_of(bytes: Option<&[u8]>) -> Option<Map<String, Value>> {
    parse(bytes)
        .ok()
        .and_then(|mut top| match top.remove("mcpServers") {
            Some(Value::Object(servers)) => Some(servers),
            _ => None,
        })
}

/// Read the file, telling "absent" apart from "unreadable".
pub fn read(path: &Path) -> Result<Option<Vec<u8>>, Refusal> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(Refusal::Unreadable(e.kind().to_string())),
    }
}

/// The file actually written: a symlinked config is written through to its
/// target, so a user who keeps it in a dotfiles repository keeps the link.
pub fn resolve_target(path: &Path) -> PathBuf {
    let is_link = fs::symlink_metadata(path).is_ok_and(|m| m.file_type().is_symlink());
    if is_link {
        fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
    } else {
        path.to_path_buf()
    }
}

// ---------------------------------------------------------------------------
// Planning the write
// ---------------------------------------------------------------------------

/// What a write would do, computed without writing anything.
#[derive(Debug, Clone)]
pub struct Plan {
    /// The file that would be written.
    pub path: PathBuf,
    pub entry_name: String,
    /// The entry as it would be written, or `None` for a removal.
    pub entry: Option<Value>,
    /// Whether the file exists now. A missing file is created, and needs no backup.
    pub file_exists: bool,
    /// Where the backup would go; `None` when there is no file to back up.
    pub backup_path: Option<PathBuf>,
    /// Whether our entry is in the file now.
    pub already_present: bool,
    /// Whether the write would leave our entry exactly as it is — or, for a
    /// removal, whether there is nothing to remove.
    pub unchanged: bool,
    /// The complete new file. Never returned to the frontend: it holds every
    /// other server's entry.
    contents: String,
    /// Identifies the file as it was read and the write as it was shown, so a
    /// confirmation cannot apply to a file that has changed since.
    pub fingerprint: String,
}

impl Plan {
    /// The entry exactly as the dialog shows it: `{ "<name>": { … } }`.
    pub fn entry_preview(&self) -> String {
        let mut shown = Map::new();
        if let Some(entry) = &self.entry {
            shown.insert(self.entry_name.clone(), entry.clone());
        }
        serde_json::to_string_pretty(&Value::Object(shown)).unwrap_or_default()
    }

    /// Whether the entry carries `MCP_CONFIG_WRITE`.
    pub fn writes_enabled(&self) -> bool {
        self.entry
            .as_ref()
            .and_then(|e| e.get("env"))
            .and_then(|env| env.get("MCP_CONFIG_WRITE"))
            .is_some()
    }
}

/// `YYYYMMDDTHHMMSS.mmmZ`, UTC. The ISO 8601 basic form: no `:`, which Windows
/// cannot store in a file name, and fixed-width, so names sort in time order.
pub fn backup_stamp(at: SystemTime) -> String {
    let since = at.duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = since.as_secs();
    let days = i64::try_from(secs / 86_400).unwrap_or(0);
    let rem = secs % 86_400;
    // Howard Hinnant's civil-from-days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}{month:02}{day:02}T{:02}{:02}{:02}.{:03}Z",
        rem / 3_600,
        (rem % 3_600) / 60,
        rem % 60,
        since.subsec_millis()
    )
}

/// The backup's path for a config file at `path`.
pub fn backup_path(path: &Path, stamp: &str) -> PathBuf {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| CONFIG_FILE_NAME.into());
    path.with_file_name(format!("{name}{BACKUP_INFIX}{stamp}"))
}

fn fingerprint(original: Option<&[u8]>, entry_name: &str, contents: &str) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    original.hash(&mut hasher);
    entry_name.hash(&mut hasher);
    contents.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Compute the write: upsert `entry` under `entry_name` (or remove it, for
/// `None`), carrying every other key over unchanged in value and order.
pub fn plan(
    path: &Path,
    original: Option<&[u8]>,
    entry_name: &str,
    entry: Option<Value>,
    stamp: &str,
) -> Result<Plan, Refusal> {
    let mut top = parse(original)?;
    let current = match top.get("mcpServers") {
        None => None,
        Some(Value::Object(servers)) => servers.get(entry_name).cloned(),
        Some(_) => return Err(Refusal::ServersNotAnObject),
    };
    let already_present = current.is_some();
    let unchanged = current == entry;

    match &entry {
        Some(value) => {
            let servers = top
                .entry("mcpServers")
                .or_insert_with(|| Value::Object(Map::new()));
            if let Value::Object(servers) = servers {
                servers.insert(entry_name.to_string(), value.clone());
            }
        }
        None => {
            if let Some(Value::Object(servers)) = top.get_mut("mcpServers") {
                // `shift_remove`, not `remove`: the latter swaps the last entry
                // into the hole, which would reorder another server.
                servers.shift_remove(entry_name);
            }
        }
    }

    let mut contents =
        serde_json::to_string_pretty(&Value::Object(top)).map_err(|_| Refusal::NotAnObject)?;
    contents.push('\n');
    Ok(Plan {
        path: path.to_path_buf(),
        entry_name: entry_name.to_string(),
        file_exists: original.is_some(),
        backup_path: original.map(|_| backup_path(path, stamp)),
        already_present,
        unchanged,
        fingerprint: fingerprint(original, entry_name, &contents),
        contents,
        entry,
    })
}

// ---------------------------------------------------------------------------
// Applying it
// ---------------------------------------------------------------------------

/// What [`apply`] did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Applied {
    /// The file was written; `backup` is `None` when it was created.
    Written { backup: Option<PathBuf> },
    /// The entry was already exactly this; nothing was written.
    Unchanged,
    /// The file is not what it was when the user confirmed. Nothing was written;
    /// the dialog starts again.
    Changed,
}

/// Write a plan the user confirmed.
///
/// The file is read again first: if it is not the file the plan was computed
/// from, nothing is written (A2 rule 3). Then, in this order, each step refusing
/// on failure: the backup, the atomic write, the pruning. Nothing touches the
/// original before the backup exists.
pub fn apply(plan: &Plan) -> Result<Applied, String> {
    let now = read(&plan.path).map_err(|r| r.message())?;
    let replanned = fingerprint(now.as_deref(), &plan.entry_name, &plan.contents);
    if replanned != plan.fingerprint {
        return Ok(Applied::Changed);
    }
    if plan.unchanged {
        return Ok(Applied::Unchanged);
    }
    let permissions = fs::metadata(&plan.path).ok().map(|m| m.permissions());

    let backup = match (&now, &plan.backup_path) {
        (Some(bytes), Some(backup)) => {
            write_new(backup, bytes, permissions.as_ref()).map_err(|e| {
                format!("The backup could not be written, so nothing was changed: {e}")
            })?;
            Some(backup.clone())
        }
        _ => None,
    };

    if let Some(parent) = plan.path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("The folder could not be created: {e}"))?;
    }
    write_atomic(&plan.path, plan.contents.as_bytes(), permissions.as_ref())
        .map_err(|e| format!("Claude Desktop's configuration file could not be written: {e}"))?;

    // The write has succeeded; a failure to prune leaves an extra backup, which
    // is not worth reporting the write as failed for.
    if let Err(e) = prune_backups(&plan.path, BACKUPS_KEPT) {
        log::warn!(
            "could not prune old Claude Desktop config backups: {}",
            e.kind()
        );
    }
    Ok(Applied::Written { backup })
}

/// The mode a new file gets when there is no original to copy it from: the
/// file may hold other servers' tokens once Claude Desktop or the user adds
/// them, so owner-only.
#[cfg(unix)]
const NEW_FILE_MODE: u32 = 0o600;

/// Create `path`, failing if it exists, holding `bytes`, with `permissions`.
///
/// On Unix the mode is set at creation, not after, so there is no instant at
/// which a copy of a file full of tokens is readable by anyone the original
/// was not.
fn write_new(
    path: &Path,
    bytes: &[u8],
    permissions: Option<&fs::Permissions>,
) -> std::io::Result<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        options.mode(permissions.map_or(NEW_FILE_MODE, |p| p.mode() & 0o7777));
    }
    let mut file = options.open(path)?;
    let written = file.write_all(bytes).and_then(|()| file.sync_all());
    if let Err(e) = written {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(e);
    }
    drop(file);
    // The creation mode is filtered by the umask; this makes it exact.
    if let Some(p) = permissions {
        fs::set_permissions(path, p.clone())?;
    }
    Ok(())
}

/// Replace `path` with `bytes` atomically: a temporary file beside it, then a
/// rename, so a crash leaves either the old file or the new one, never half.
fn write_atomic(
    path: &Path,
    bytes: &[u8],
    permissions: Option<&fs::Permissions>,
) -> std::io::Result<()> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| CONFIG_FILE_NAME.into());
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = path.with_file_name(format!(
        ".{name}.sovrium-tmp-{}-{nanos}",
        std::process::id()
    ));
    write_new(&temp, bytes, permissions)?;
    fs::rename(&temp, path).inspect_err(|_| {
        let _ = fs::remove_file(&temp);
    })
}

/// Delete all but the newest `keep` backups of the config file at `path`.
/// Only files named `<config file>.sovrium-backup-*` are considered.
pub fn prune_backups(path: &Path, keep: usize) -> std::io::Result<()> {
    let Some(dir) = path.parent() else {
        return Ok(());
    };
    let prefix = format!(
        "{}{BACKUP_INFIX}",
        path.file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_default()
    );
    let mut backups: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter(|e| e.file_name().to_string_lossy().starts_with(&prefix))
        .map(|e| e.path())
        .collect();
    // Fixed-width UTC stamps: name order is time order. Newest first.
    backups.sort();
    backups.reverse();
    for old in backups.into_iter().skip(keep) {
        fs::remove_file(old)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "sov-claude-desktop-{tag}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn ours(write: bool) -> Value {
        let mut entry = json!({ "command": "/Applications/Sovrium.app/sovrium", "args": ["mcp", "--project", "/Users/me/crm"] });
        if write {
            entry["env"] = json!({ "MCP_CONFIG_WRITE": "1" });
        }
        entry
    }

    fn written(path: &Path) -> Value {
        serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
    }

    const POPULATED: &str = r#"{
    "globalShortcut": "Ctrl+Space",
    "mcpServers": {
        "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "ghp_secret\u00e9", "RATE": 1.5, "N": 12345678901234 } },
        "filesystem": { "command": "npx", "args": ["fs", "/Users/me"] }
    },
    "zLast": [1, 2, { "deep": null }]
}"#;

    #[test]
    fn the_path_is_anthropics_on_each_os() {
        let home = Path::new("/Users/me");
        assert_eq!(
            config_path_for(Os::MacOs, Some(home), None).unwrap(),
            Path::new("/Users/me/Library/Application Support/Claude/claude_desktop_config.json")
        );
        assert_eq!(
            config_path_for(
                Os::Windows,
                Some(home),
                Some(Path::new("C:/Users/me/AppData/Roaming"))
            )
            .unwrap(),
            Path::new("C:/Users/me/AppData/Roaming/Claude/claude_desktop_config.json")
        );
        assert_eq!(config_path_for(Os::Windows, Some(home), None), None);
        assert_eq!(config_path_for(Os::Other, Some(home), None), None);
    }

    #[test]
    fn linux_is_offered_only_when_the_claude_folder_exists() {
        let home = scratch("linux");
        assert_eq!(
            config_path_for(Os::Linux, Some(&home), None),
            None,
            "absent → not offered"
        );
        fs::create_dir_all(home.join(".config/Claude")).unwrap();
        assert_eq!(
            config_path_for(Os::Linux, Some(&home), None).unwrap(),
            home.join(".config/Claude/claude_desktop_config.json")
        );
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn a_slug_is_lowercase_ascii_and_hyphens() {
        assert_eq!(project_slug("my-crm"), "my-crm");
        assert_eq!(project_slug("My CRM (v2)"), "my-crm-v2");
        assert_eq!(project_slug("  --Café__Menu--  "), "caf-menu");
        assert_eq!(project_slug("日本"), "project");
        assert_eq!(project_slug(""), "project");
    }

    #[test]
    fn a_recorded_name_is_kept_and_a_collision_takes_a_suffix() {
        assert_eq!(
            resolve_entry_name(Some("sovrium-crm-2"), "crm", "/a", &[], None),
            "sovrium-crm-2"
        );
        assert_eq!(
            resolve_entry_name(None, "crm", "/a", &[], None),
            "sovrium-crm"
        );
        // Another project already holds the name.
        let others = vec!["sovrium-crm".to_string(), "sovrium-crm-2".to_string()];
        assert_eq!(
            resolve_entry_name(None, "crm", "/a", &others, None),
            "sovrium-crm-3"
        );
        // The file holds the name for a different folder…
        let servers =
            json!({ "sovrium-crm": { "command": "sovrium", "args": ["mcp", "--project", "/b"] } });
        let servers = servers.as_object().unwrap();
        assert_eq!(
            resolve_entry_name(None, "crm", "/a", &[], Some(servers)),
            "sovrium-crm-2"
        );
        // …or for this one, pasted from the snippet: reuse it rather than duplicate it.
        assert_eq!(
            resolve_entry_name(None, "crm", "/b", &[], Some(servers)),
            "sovrium-crm"
        );
    }

    #[test]
    fn a_hand_written_sovrium_entry_for_this_folder_is_never_reused() {
        // The snippet prints a plain `"sovrium"` key when no project is open, so
        // that is the entry a person writes by hand and points at a folder. It
        // is theirs: the shell takes its own `sovrium-<slug>` name beside it.
        let servers = json!({
            "sovrium": { "command": "sovrium", "args": ["mcp", "--project", "/a"] }
        });
        let servers = servers.as_object().unwrap();
        assert_eq!(
            resolve_entry_name(None, "crm", "/a", &[], Some(servers)),
            "sovrium-crm"
        );
        // A settings record naming it — the file is plain JSON a person can
        // edit — is ignored too, so neither a connect nor a removal can reach it.
        assert_eq!(
            resolve_entry_name(Some("sovrium"), "crm", "/a", &[], Some(servers)),
            "sovrium-crm"
        );
        assert_eq!(
            resolve_entry_name(Some("my-server"), "crm", "/a", &[], None),
            "sovrium-crm"
        );
        assert_eq!(
            resolve_entry_name(Some("sovrium-"), "crm", "/a", &[], None),
            "sovrium-crm"
        );
    }

    #[test]
    fn connecting_leaves_a_hand_written_sovrium_entry_byte_for_byte() {
        let dir = scratch("hand-written");
        let path = dir.join(CONFIG_FILE_NAME);
        let hand_written = json!({
            "command": "/usr/local/bin/sovrium",
            "args": ["mcp", "--project", "/a"],
            "env": { "X": "1" }
        });
        let original =
            serde_json::to_vec_pretty(&json!({ "mcpServers": { "sovrium": hand_written } })).unwrap();
        fs::write(&path, &original).unwrap();
        let servers = servers_of(Some(&original)).unwrap();
        let name = resolve_entry_name(None, "crm", "/a", &[], Some(&servers));
        assert_eq!(name, "sovrium-crm");

        let connect =
            plan(&path, Some(&original), &name, Some(ours(false)), "20261025T120000.000Z").unwrap();
        assert!(!connect.already_present);
        apply(&connect).unwrap();
        let after = written(&path);
        assert_eq!(after["mcpServers"]["sovrium"], hand_written);
        assert_eq!(after["mcpServers"]["sovrium-crm"], ours(false));

        // A removal of this project's entry takes only its own.
        let now = fs::read(&path).unwrap();
        let remove = plan(&path, Some(&now), &name, None, "20261025T120001.000Z").unwrap();
        apply(&remove).unwrap();
        let after = written(&path);
        assert_eq!(after["mcpServers"]["sovrium"], hand_written);
        assert!(after["mcpServers"].get("sovrium-crm").is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_absent_file_is_created_holding_only_our_entry() {
        let dir = scratch("absent");
        let path = dir.join(CONFIG_FILE_NAME);
        let plan = plan(
            &path,
            None,
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(!plan.file_exists);
        assert_eq!(plan.backup_path, None, "nothing to back up");
        assert_eq!(apply(&plan).unwrap(), Applied::Written { backup: None });
        assert_eq!(
            written(&path),
            json!({ "mcpServers": { "sovrium-crm": ours(false) } })
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_empty_object_gains_mcp_servers() {
        let dir = scratch("empty");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, "{}").unwrap();
        let plan = plan(
            &path,
            Some(b"{}"),
            "sovrium-crm",
            Some(ours(true)),
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(plan.writes_enabled());
        assert!(matches!(
            apply(&plan).unwrap(),
            Applied::Written { backup: Some(_) }
        ));
        assert_eq!(
            written(&path),
            json!({ "mcpServers": { "sovrium-crm": ours(true) } })
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_populated_file_keeps_every_other_key_in_value_and_order() {
        let dir = scratch("populated");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, POPULATED).unwrap();
        let before: Value = serde_json::from_str(POPULATED).unwrap();
        let plan = plan(
            &path,
            Some(POPULATED.as_bytes()),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(!plan.already_present);
        apply(&plan).unwrap();
        let after = written(&path);

        // Values: every other server and top-level key, unchanged.
        for key in ["globalShortcut", "zLast"] {
            assert_eq!(after[key], before[key]);
        }
        for server in ["github", "filesystem"] {
            assert_eq!(after["mcpServers"][server], before["mcpServers"][server]);
        }
        // And the serialised form of each other server is byte-identical.
        let raw = |v: &Value, s: &str| serde_json::to_string(&v["mcpServers"][s]).unwrap();
        assert_eq!(raw(&after, "github"), raw(&before, "github"));
        // Order: the top level and the servers keep their places; ours goes last.
        let keys = |v: &Value| v.as_object().unwrap().keys().cloned().collect::<Vec<_>>();
        assert_eq!(keys(&after), ["globalShortcut", "mcpServers", "zLast"]);
        assert_eq!(
            keys(&after["mcpServers"]),
            ["github", "filesystem", "sovrium-crm"]
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn replacing_our_entry_keeps_its_place_and_the_others_untouched() {
        let dir = scratch("replace");
        let path = dir.join(CONFIG_FILE_NAME);
        let original = json!({ "mcpServers": { "a": { "command": "a" }, "sovrium-crm": ours(false), "z": { "command": "z" } } });
        let text = serde_json::to_string(&original).unwrap();
        fs::write(&path, &text).unwrap();
        let plan = plan(
            &path,
            Some(text.as_bytes()),
            "sovrium-crm",
            Some(ours(true)),
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(plan.already_present && !plan.unchanged);
        apply(&plan).unwrap();
        let after = written(&path);
        let keys: Vec<_> = after["mcpServers"]
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        assert_eq!(keys, ["a", "sovrium-crm", "z"]);
        assert_eq!(after["mcpServers"]["sovrium-crm"], ours(true));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_write_switch_is_in_the_entry_only_when_on() {
        let off = plan(Path::new("/x"), None, "sovrium-crm", Some(ours(false)), "s").unwrap();
        assert!(!off.writes_enabled());
        assert!(!off.entry_preview().contains("MCP_CONFIG_WRITE"));
        let on = plan(Path::new("/x"), None, "sovrium-crm", Some(ours(true)), "s").unwrap();
        assert!(on.writes_enabled());
        assert!(on.entry_preview().contains("\"MCP_CONFIG_WRITE\": \"1\""));
    }

    #[test]
    fn the_preview_shows_our_entry_and_nothing_else() {
        let plan = plan(
            Path::new("/x"),
            Some(POPULATED.as_bytes()),
            "sovrium-crm",
            Some(ours(false)),
            "s",
        )
        .unwrap();
        let shown = plan.entry_preview();
        assert!(shown.contains("sovrium-crm"));
        for secret in ["github", "ghp_secret", "filesystem", "globalShortcut"] {
            assert!(!shown.contains(secret), "{secret} leaked into the preview");
        }
    }

    #[test]
    fn a_non_object_mcp_servers_is_refused() {
        for text in [
            r#"{"mcpServers": []}"#,
            r#"{"mcpServers": "x"}"#,
            r#"{"mcpServers": null}"#,
        ] {
            assert_eq!(
                plan(
                    Path::new("/x"),
                    Some(text.as_bytes()),
                    "sovrium-crm",
                    Some(ours(false)),
                    "s"
                )
                .unwrap_err(),
                Refusal::ServersNotAnObject,
                "{text}"
            );
        }
        assert_eq!(
            plan(
                Path::new("/x"),
                Some(b"[1]"),
                "sovrium-crm",
                Some(ours(false)),
                "s"
            )
            .unwrap_err(),
            Refusal::NotAnObject
        );
    }

    #[test]
    fn malformed_json_is_refused_and_never_repaired() {
        let dir = scratch("malformed");
        let path = dir.join(CONFIG_FILE_NAME);
        for text in [
            "{ \"mcpServers\": {}, }",         // trailing comma
            "// mine\n{ \"mcpServers\": {} }", // comment
            "{ \"mcpServers\": { \"a\": ",     // truncated
            "",                                // empty file
        ] {
            fs::write(&path, text).unwrap();
            let refusal = plan(
                &path,
                Some(text.as_bytes()),
                "sovrium-crm",
                Some(ours(false)),
                "s",
            )
            .unwrap_err();
            assert!(
                matches!(refusal, Refusal::Unparseable { .. }),
                "{text:?} → {refusal:?}"
            );
            assert!(
                !refusal.message().contains("mcpServers"),
                "the message quotes nothing from the file"
            );
            assert_eq!(fs::read_to_string(&path).unwrap(), text, "untouched");
        }
        let backups = fs::read_dir(&dir).unwrap().count();
        assert_eq!(backups, 1, "no backup, no temp file");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_file_changed_after_consent_is_not_written() {
        let dir = scratch("changed");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, "{}").unwrap();
        let plan = plan(
            &path,
            Some(b"{}"),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        fs::write(&path, r#"{"mcpServers":{"new":{"command":"n"}}}"#).unwrap();
        assert_eq!(apply(&plan).unwrap(), Applied::Changed);
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            r#"{"mcpServers":{"new":{"command":"n"}}}"#
        );
        assert_eq!(
            fs::read_dir(&dir).unwrap().count(),
            1,
            "no backup written either"
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_identical_entry_writes_nothing() {
        let dir = scratch("unchanged");
        let path = dir.join(CONFIG_FILE_NAME);
        let text = serde_json::to_string(&json!({ "mcpServers": { "sovrium-crm": ours(false) } }))
            .unwrap();
        fs::write(&path, &text).unwrap();
        let plan = plan(
            &path,
            Some(text.as_bytes()),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(plan.unchanged);
        assert_eq!(apply(&plan).unwrap(), Applied::Unchanged);
        assert_eq!(fs::read_to_string(&path).unwrap(), text);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn removal_takes_only_our_entry_out() {
        let dir = scratch("remove");
        let path = dir.join(CONFIG_FILE_NAME);
        let text = serde_json::to_string(&json!({ "mcpServers": { "a": { "command": "a" }, "sovrium-crm": ours(true), "z": { "command": "z" } } })).unwrap();
        fs::write(&path, &text).unwrap();
        let plan = plan(
            &path,
            Some(text.as_bytes()),
            "sovrium-crm",
            None,
            "20261025T120000.000Z",
        )
        .unwrap();
        assert!(plan.already_present && !plan.unchanged);
        assert!(matches!(
            apply(&plan).unwrap(),
            Applied::Written { backup: Some(_) }
        ));
        let keys: Vec<_> = written(&path)["mcpServers"]
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        assert_eq!(keys, ["a", "z"]);
        // Nothing to remove is a no-op.
        let again = super::plan(
            &path,
            Some(&fs::read(&path).unwrap()),
            "sovrium-crm",
            None,
            "s",
        )
        .unwrap();
        assert!(again.unchanged);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_backup_holds_the_original_with_its_permissions() {
        let dir = scratch("backup");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, POPULATED).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap();
        }
        let plan = plan(
            &path,
            Some(POPULATED.as_bytes()),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        let expected = dir.join("claude_desktop_config.json.sovrium-backup-20261025T120000.000Z");
        assert_eq!(plan.backup_path.as_deref(), Some(expected.as_path()));
        assert_eq!(
            apply(&plan).unwrap(),
            Applied::Written {
                backup: Some(expected.clone())
            }
        );
        assert_eq!(
            fs::read_to_string(&expected).unwrap(),
            POPULATED,
            "byte for byte"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&expected).unwrap().permissions().mode() & 0o777,
                0o640
            );
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o640,
                "the new file keeps them too"
            );
        }
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_backup_that_cannot_be_written_stops_the_write() {
        let dir = scratch("nobackup");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, "{}").unwrap();
        let plan = plan(
            &path,
            Some(b"{}"),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        // A directory squatting on the backup's name makes the backup fail.
        fs::create_dir(plan.backup_path.as_ref().unwrap()).unwrap();
        assert!(apply(&plan).unwrap_err().contains("backup"));
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "{}",
            "the original is untouched"
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn backups_are_pruned_to_the_last_five_and_nothing_else_is_touched() {
        let dir = scratch("prune");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, "{}").unwrap();
        for second in 0..7 {
            let stamp = format!("20261025T1200{second:02}.000Z");
            fs::write(backup_path(&path, &stamp), "{}").unwrap();
        }
        fs::write(
            dir.join("unrelated.json.sovrium-backup-20200101T000000.000Z"),
            "x",
        )
        .unwrap();
        fs::write(dir.join("notes.txt"), "x").unwrap();

        let plan = plan(
            &path,
            Some(b"{}"),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120100.000Z",
        )
        .unwrap();
        apply(&plan).unwrap();

        let mut backups: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.starts_with("claude_desktop_config.json.sovrium-backup-"))
            .collect();
        backups.sort();
        assert_eq!(
            backups,
            [
                "claude_desktop_config.json.sovrium-backup-20261025T120003.000Z",
                "claude_desktop_config.json.sovrium-backup-20261025T120004.000Z",
                "claude_desktop_config.json.sovrium-backup-20261025T120005.000Z",
                "claude_desktop_config.json.sovrium-backup-20261025T120006.000Z",
                "claude_desktop_config.json.sovrium-backup-20261025T120100.000Z",
            ]
        );
        assert!(dir
            .join("unrelated.json.sovrium-backup-20200101T000000.000Z")
            .exists());
        assert!(dir.join("notes.txt").exists());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_stamp_is_utc_basic_iso() {
        assert_eq!(backup_stamp(UNIX_EPOCH), "19700101T000000.000Z");
        // 2026-10-25T14:30:12.345Z
        let at = UNIX_EPOCH + std::time::Duration::from_millis(1_792_938_612_345);
        assert_eq!(backup_stamp(at), "20261025T143012.345Z");
        // A leap day.
        let leap = UNIX_EPOCH + std::time::Duration::from_secs(1_709_164_800);
        assert_eq!(backup_stamp(leap), "20240229T000000.000Z");
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_config_is_written_through_to_its_target() {
        let dir = scratch("symlink");
        let target = dir.join("dotfiles.json");
        fs::write(&target, "{}").unwrap();
        let link = dir.join(CONFIG_FILE_NAME);
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let resolved = resolve_target(&link);
        assert_eq!(resolved, fs::canonicalize(&target).unwrap());
        let plan = plan(
            &resolved,
            Some(b"{}"),
            "sovrium-crm",
            Some(ours(false)),
            "20261025T120000.000Z",
        )
        .unwrap();
        apply(&plan).unwrap();
        assert!(
            fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink(),
            "the link survives"
        );
        assert_eq!(written(&link)["mcpServers"]["sovrium-crm"], ours(false));
        fs::remove_dir_all(&dir).ok();
    }
}
