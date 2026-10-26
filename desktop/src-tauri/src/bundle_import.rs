// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! `sovrium://new?bundle=<https>`: open a starter app, with its demo data, after
//! ONE consent dialog (ADR-036 A1, "The deep-link flow").
//!
//! # The flow, and who does what
//!
//! 1. [`crate::deeplink`] checks the link's shape (https, length, no
//!    credentials) and calls [`begin`]. Nothing has been fetched.
//! 2. [`begin`] puts the window on the shell's own chrome showing "fetching…",
//!    and runs `sovrium init --from-bundle <url> --inspect`. **The engine**
//!    downloads the bundle into a temporary directory of its own, runs every
//!    check of its import pipeline, and prints one JSON object: host, name,
//!    size, sha256, verdict, demo data, and the downloaded `file`. The shell
//!    fetches nothing and unpacks nothing; it reads that object.
//! 3. The window shows ONE dialog from it ([`BundleView::Ready`]): the host,
//!    the verified / unverified verdict, the app name, the size, "includes demo
//!    data", and a folder picker. A refused bundle shows the reason and offers
//!    no import ([`BundleView::Refused`]).
//! 4. On confirmation, `commands::bundle_import` runs
//!    `init --from-bundle <file> <dir> --expect-sha256 <sha256> --with-demo-data`
//!    with the project's own data directory as `SOVRIUM_DATA_DIR`: the bytes
//!    approved are the bytes written, and the archive is not fetched twice. The
//!    `file` and `sha256` come from the state held HERE, never from the
//!    frontend, so the dialog cannot be made to approve one archive and import
//!    another.
//! 5. On decline, the download is deleted ([`remove_download`]). The engine has
//!    no verb for that, so the shell deletes the directory `--inspect` created —
//!    and only after checking it is one: a `sovrium-bundle-*` directory directly
//!    inside the system temporary directory.
//!
//! # The password
//!
//! `--with-demo-data` prints the new admin's random password once, as the last
//! line of stdout. It is parsed into [`Credentials`], handed to the window, and
//! shown once. It is never stored — not in settings, not in this module's state
//! — and never logged: [`Credentials`]' `Debug` prints no password, and
//! `sidecar::run_engine_once_with_env` returns its output without logging it.
//!
//! # The environment
//!
//! A desktop project is a local SQLite project, but the engine is a child of
//! the shell and would inherit whatever the user's shell environment carries.
//! A `DATABASE_URL` there would make the engine refuse
//! `init --from-bundle … --with-demo-data` outright, and the seed it guards
//! would otherwise target that database. So BOTH engine runs of this flow, the
//! inspection and the import, get [`import_env`]: the shell's environment minus
//! [`STORAGE_REDIRECTS`]. Every other variable passes through — a proxy, a CA
//! bundle, `PATH`, `HOME` — because the download depends on them.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::sidecar;

/// The event the window listens on for the bundle dialog's state.
pub const BUNDLE_EVENT: &str = "sovrium://bundle";

/// The prefix of the temporary directory `init --from-bundle --inspect` keeps
/// the download in (`mkdtemp(join(tmpdir(), 'sovrium-bundle-'))` in the
/// engine's `init-from-bundle.ts`). The shell deletes nothing else.
pub const DOWNLOAD_DIR_PREFIX: &str = "sovrium-bundle-";

/// The variables that point an engine's storage somewhere other than the
/// project: the database (`DATABASE_URL`, which also makes the engine refuse
/// `--with-demo-data`) and the uploads (`STORAGE_PROVIDER`, whose `s3` would
/// send the demo files to a bucket, and `STORAGE_LOCAL_DIRECTORY`, which would
/// move them out of `<data dir>/storage`). Withheld from the bundle flow's
/// engine runs; the `STORAGE_S3_*` settings are inert once the provider is.
pub const STORAGE_REDIRECTS: [&str; 3] = ["DATABASE_URL", "STORAGE_PROVIDER", "STORAGE_LOCAL_DIRECTORY"];

/// The whole environment of a bundle-flow engine run: `parent` (the shell's
/// own, `std::env::vars_os()`) without [`STORAGE_REDIRECTS`], then `extra`.
///
/// Names are compared ignoring ASCII case, because Windows environment names
/// are case-insensitive and `Database_Url` there IS `DATABASE_URL`. An `extra`
/// entry replaces a parent one of the same name.
pub fn import_env<I>(parent: I, extra: Vec<(OsString, OsString)>) -> Vec<(OsString, OsString)>
where
    I: IntoIterator<Item = (OsString, OsString)>,
{
    let same = |a: &OsString, b: &str| a.to_str().is_some_and(|a| a.eq_ignore_ascii_case(b));
    let withheld = |name: &OsString| {
        STORAGE_REDIRECTS.iter().any(|r| same(name, r))
            || extra.iter().any(|(k, _)| k.to_str().is_some_and(|k| same(name, k)))
    };
    let mut env: Vec<(OsString, OsString)> = parent.into_iter().filter(|(k, _)| !withheld(k)).collect();
    env.extend(extra);
    env
}

/// The longest app name or refusal reason the dialog shows.
const MAX_SHOWN_CHARS: usize = 300;

/// The engine's publisher verdict, in its own spelling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    Verified,
    Unverified,
    Refused,
}

/// What `init --from-bundle --inspect` prints, as far as the shell reads it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Inspection {
    /// The host the archive was finally downloaded from; `null` for a file.
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub sha256: String,
    pub verdict: Verdict,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub contains_demo_data: bool,
    #[serde(default)]
    pub file: Option<PathBuf>,
}

/// What the inspection came to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InspectOutcome {
    /// Every check passed; `file` and `sha256` are present and well-formed.
    Ready(Inspection),
    /// Refused by the engine, or the engine could not be read. A sentence.
    Refused(String),
}

/// What the window shows. The tag is `kind`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum BundleView {
    /// The engine is downloading and checking.
    Fetching { host: String },
    /// The one consent dialog.
    Ready {
        /// Where the archive was downloaded from, after redirects.
        host: String,
        /// The host the link named, when it differs from `host`: a short link
        /// that redirected to a storage service.
        link_host: Option<String>,
        name: String,
        size: u64,
        verdict: Verdict,
        contains_demo_data: bool,
        /// A folder name to pre-fill, derived from the app name.
        folder_suggestion: String,
    },
    /// Nothing can be imported; `reason` says why.
    Refused { host: String, reason: String },
}

/// The admin `--with-demo-data` created. Shown once, stored nowhere.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

impl std::fmt::Debug for Credentials {
    /// Never the password: a `{:?}` in a log line must not be how it leaks.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Credentials")
            .field("email", &self.email)
            .field("password", &"<redacted>")
            .finish()
    }
}

/// Control characters out, length bounded. The engine is ours, but the app
/// name and a refusal reason quote the bundle, and the bundle is a stranger's.
pub fn shown(text: &str, max: usize) -> String {
    let cleaned: String = text
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect::<String>()
        .trim()
        .to_string();
    if cleaned.chars().count() > max {
        format!("{}…", cleaned.chars().take(max).collect::<String>())
    } else {
        cleaned
    }
}

/// The last line of `text` that looks like a JSON object.
fn last_json_line(text: &str) -> Option<&str> {
    text.lines()
        .map(str::trim)
        .rev()
        .find(|line| line.starts_with('{') && line.ends_with('}'))
}

/// The sentence an engine failure comes down to: its last `Error:` line, else
/// its last line, without the prefix.
pub fn engine_error(stderr: &str) -> String {
    let lines: Vec<&str> = stderr
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    let line = lines
        .iter()
        .rev()
        .find(|l| l.starts_with("Error:"))
        .or(lines.last())
        .copied()
        .unwrap_or("");
    let line = line.strip_prefix("Error:").unwrap_or(line).trim();
    if line.is_empty() {
        "The Sovrium engine stopped without saying why.".into()
    } else {
        shown(line, MAX_SHOWN_CHARS)
    }
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit())
}

/// Read what `init --from-bundle --inspect` printed.
///
/// Fails closed: anything other than a well-formed, non-refused report with a
/// sha256 and a file reads as Refused, so a malformed answer can never become
/// an import button.
pub fn read_inspection(ok: bool, stdout: &str, stderr: &str) -> InspectOutcome {
    let report =
        last_json_line(stdout).and_then(|line| serde_json::from_str::<Inspection>(line).ok());
    match report {
        Some(report) if report.verdict == Verdict::Refused => InspectOutcome::Refused(
            report
                .reason
                .as_deref()
                .map(|r| shown(r, MAX_SHOWN_CHARS))
                .filter(|r| !r.is_empty())
                .unwrap_or_else(|| "Sovrium refused this bundle.".into()),
        ),
        Some(report) if ok && is_sha256(&report.sha256) && report.file.is_some() => {
            InspectOutcome::Ready(report)
        }
        _ if !ok => InspectOutcome::Refused(engine_error(stderr)),
        _ => InspectOutcome::Refused(
            "Sovrium could not read what its engine said about this bundle, so it will not open it."
                .into(),
        ),
    }
}

/// The dialog for an inspection that passed. `link_host` is the host the link
/// itself named.
pub fn ready_view(inspection: &Inspection, link_host: &str) -> BundleView {
    let host = inspection
        .host
        .as_deref()
        .map(|h| shown(h, 255))
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| link_host.to_string());
    let name = shown(&inspection.name, MAX_SHOWN_CHARS);
    BundleView::Ready {
        link_host: (host != link_host).then(|| link_host.to_string()),
        host,
        folder_suggestion: crate::claude_desktop::project_slug(&name),
        name,
        size: inspection.size,
        verdict: inspection.verdict,
        contains_demo_data: inspection.contains_demo_data,
    }
}

/// The credentials line `--with-demo-data` prints last, if it printed one.
///
/// An app with no `auth` gets no admin and prints no such line; that is `None`,
/// not an error.
pub fn parse_credentials(stdout: &str) -> Option<Credentials> {
    let line = stdout.lines().map(str::trim).rfind(|l| !l.is_empty())?;
    let credentials: Credentials = serde_json::from_str(line).ok()?;
    let usable = !credentials.email.is_empty()
        && !credentials.password.is_empty()
        && !credentials.email.chars().any(char::is_control)
        && !credentials.password.chars().any(char::is_control);
    usable.then_some(credentials)
}

/// Whether `file` is a download `--inspect` kept: a file directly inside a
/// `sovrium-bundle-*` directory that is itself directly inside `temp_root`.
///
/// Checked before the path is handed back to the engine and before anything is
/// deleted, so neither can be pointed elsewhere.
pub fn is_engine_download(file: &Path, temp_root: &Path) -> bool {
    let Some(dir) = file.parent() else {
        return false;
    };
    let named = dir
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.len() > DOWNLOAD_DIR_PREFIX.len() && n.starts_with(DOWNLOAD_DIR_PREFIX));
    // `symlink_metadata`: a symlink named like ours is not ours.
    let real_dir = std::fs::symlink_metadata(dir).is_ok_and(|m| m.is_dir());
    let real_file = std::fs::symlink_metadata(file).is_ok_and(|m| m.is_file());
    let inside = match (
        dir.parent().map(Path::canonicalize),
        temp_root.canonicalize(),
    ) {
        (Some(Ok(parent)), Ok(root)) => parent == root,
        _ => false,
    };
    named && real_dir && real_file && inside
}

/// Delete a download `--inspect` kept, with its directory. Returns whether it
/// did; a path that is not [`is_engine_download`] is left alone.
pub fn remove_download(file: &Path, temp_root: &Path) -> bool {
    if !is_engine_download(file, temp_root) {
        return false;
    }
    file.parent()
        .is_some_and(|dir| std::fs::remove_dir_all(dir).is_ok())
}

/// The system temporary directory, as the engine sees it: both read `TMPDIR`
/// (`TEMP` on Windows), and the sidecar inherits the shell's environment.
pub fn temp_root() -> PathBuf {
    std::env::temp_dir()
}

fn discard(inspection: Option<Inspection>) {
    let Some(file) = inspection.and_then(|i| i.file) else {
        return;
    };
    if !remove_download(&file, &temp_root()) {
        log::warn!("a bundle download was not deleted, as it is not where Sovrium expected it");
    }
}

// ---------------------------------------------------------------------------
// The state the window reads
// ---------------------------------------------------------------------------

#[derive(Default)]
struct Slot {
    /// Bumped by every link, so an inspection that finishes after a newer link
    /// arrived is thrown away rather than shown.
    generation: u64,
    view: Option<BundleView>,
    /// The passed inspection behind a [`BundleView::Ready`]. The import reads
    /// `file` and `sha256` from here, never from the frontend.
    inspection: Option<Inspection>,
}

/// The bundle dialog's state, held in Rust so a reload of the window (the
/// shell navigates it back to its own chrome) finds it again.
#[derive(Default)]
pub struct PendingBundle(Mutex<Slot>);

fn emit<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit(BUNDLE_EVENT, current(app));
}

/// What the window should show now, if anything.
pub fn current<R: Runtime>(app: &AppHandle<R>) -> Option<BundleView> {
    let state = app.state::<PendingBundle>();
    let slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    slot.view.clone()
}

/// The inspection behind the dialog, for the import. `None` unless the dialog
/// is showing a [`BundleView::Ready`].
pub fn ready_inspection<R: Runtime>(app: &AppHandle<R>) -> Option<Inspection> {
    let state = app.state::<PendingBundle>();
    let slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    slot.inspection.clone()
}

/// Close the dialog and delete its download — on a decline, and once an import
/// has used it.
pub fn finish<R: Runtime>(app: &AppHandle<R>) {
    let taken = {
        let state = app.state::<PendingBundle>();
        let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
        slot.view = None;
        slot.inspection.take()
    };
    discard(taken);
    emit(app);
}

/// Start the flow for a link whose shape has been checked.
pub fn begin<R: Runtime>(app: &AppHandle<R>, url: String, link_host: String) {
    let (generation, previous) = {
        let state = app.state::<PendingBundle>();
        let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
        slot.generation += 1;
        slot.view = Some(BundleView::Fetching {
            host: link_host.clone(),
        });
        (slot.generation, slot.inspection.take())
    };
    // A second link replaces a first one still on screen; its download goes.
    discard(previous);
    sidecar::show_shell(app);
    emit(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = match sidecar::run_engine_once_with_env(
            &app,
            vec![
                "init".into(),
                "--from-bundle".into(),
                url,
                "--inspect".into(),
            ],
            None,
            import_env(std::env::vars_os(), Vec::new()),
        )
        .await
        {
            Ok((ok, stdout, stderr)) => read_inspection(ok, &stdout, &stderr),
            Err(message) => InspectOutcome::Refused(message),
        };
        let stale = {
            let state = app.state::<PendingBundle>();
            let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
            if slot.generation != generation {
                Some(outcome)
            } else {
                match outcome {
                    InspectOutcome::Ready(inspection) => {
                        slot.view = Some(ready_view(&inspection, &link_host));
                        slot.inspection = Some(inspection);
                    }
                    InspectOutcome::Refused(reason) => {
                        log::info!("a bundle link was refused");
                        slot.view = Some(BundleView::Refused {
                            host: link_host.clone(),
                            reason,
                        });
                    }
                }
                None
            }
        };
        match stale {
            Some(InspectOutcome::Ready(inspection)) => discard(Some(inspection)),
            Some(InspectOutcome::Refused(_)) => {}
            None => emit(&app),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHA: &str = "119d9c2fd8fe2c418f7425f506aef1b4438b4eb4f1b76b721a42084ea6284c6a";

    fn pairs(list: &[(&str, &str)]) -> Vec<(OsString, OsString)> {
        list.iter().map(|(k, v)| ((*k).into(), (*v).into())).collect()
    }

    fn lookup<'a>(env: &'a [(OsString, OsString)], name: &str) -> Vec<&'a str> {
        env.iter()
            .filter(|(k, _)| k.to_str().is_some_and(|k| k.eq_ignore_ascii_case(name)))
            .map(|(_, v)| v.to_str().unwrap())
            .collect()
    }

    #[test]
    fn the_import_env_withholds_every_storage_redirect_and_keeps_the_rest() {
        let parent = pairs(&[
            ("DATABASE_URL", "postgres://me@db.internal/prod"),
            ("STORAGE_PROVIDER", "s3"),
            ("STORAGE_LOCAL_DIRECTORY", "/elsewhere"),
            ("HOME", "/Users/me"),
            ("PATH", "/usr/bin"),
            ("HTTPS_PROXY", "http://proxy.test:3128"),
        ]);
        let env = import_env(parent, Vec::new());
        for withheld in STORAGE_REDIRECTS {
            assert!(lookup(&env, withheld).is_empty(), "{withheld} must not reach the engine");
        }
        // The download needs the rest: a proxy, a home, a PATH.
        assert_eq!(lookup(&env, "HOME"), ["/Users/me"]);
        assert_eq!(lookup(&env, "PATH"), ["/usr/bin"]);
        assert_eq!(lookup(&env, "HTTPS_PROXY"), ["http://proxy.test:3128"]);
    }

    #[test]
    fn the_import_env_withholds_a_redirect_whatever_its_case() {
        // Windows environment names are case-insensitive.
        let env = import_env(pairs(&[("Database_Url", "postgres://x/y")]), Vec::new());
        assert!(env.is_empty());
    }

    #[test]
    fn the_import_env_puts_the_project_data_dir_last_and_once() {
        let env = import_env(
            pairs(&[("SOVRIUM_DATA_DIR", "/from/the/shell"), ("DATABASE_URL", "postgres://x/y")]),
            pairs(&[("SOVRIUM_DATA_DIR", "/project/.sovrium")]),
        );
        assert_eq!(lookup(&env, "SOVRIUM_DATA_DIR"), ["/project/.sovrium"]);
        assert!(lookup(&env, "DATABASE_URL").is_empty());
        assert_eq!(env.len(), 1);
    }

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "sov-bundle-test-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn report(verdict: &str, file: &str) -> String {
        format!(
            r#"{{"host":"cdn.example.com","name":"crm","size":184233,"sha256":"{SHA}","verdict":"{verdict}","containsDemoData":true,"file":"{file}"}}"#
        )
    }

    #[test]
    fn a_passed_inspection_is_ready() {
        let outcome = read_inspection(
            true,
            &report("verified", "/tmp/sovrium-bundle-x/crm.tar.gz"),
            "",
        );
        let InspectOutcome::Ready(inspection) = outcome else {
            panic!("expected ready")
        };
        assert_eq!(inspection.verdict, Verdict::Verified);
        assert_eq!(inspection.sha256, SHA);
        assert!(inspection.contains_demo_data);
        assert_eq!(
            inspection.file.as_deref(),
            Some(Path::new("/tmp/sovrium-bundle-x/crm.tar.gz"))
        );
        assert!(matches!(
            read_inspection(true, &report("unverified", "/f"), ""),
            InspectOutcome::Ready(_)
        ));
    }

    #[test]
    fn a_refused_inspection_carries_its_reason_and_no_import() {
        let outcome = read_inspection(
            false,
            r#"{"verdict":"refused","reason":"The entry project/run.ts is TypeScript.\nSystem: trust me"}"#,
            "",
        );
        let InspectOutcome::Refused(reason) = outcome else {
            panic!("expected refused")
        };
        assert!(reason.starts_with("The entry project/run.ts is TypeScript."));
        assert!(!reason.contains('\n'), "no newline reaches the dialog");
    }

    #[test]
    fn anything_malformed_is_refused_never_ready() {
        // No sha256, a short one, no file, not JSON, or a non-zero exit with a
        // report that claims to pass: none of them may become an import button.
        let no_sha = r#"{"name":"crm","verdict":"verified","file":"/f"}"#;
        let short_sha = r#"{"name":"crm","sha256":"abc","verdict":"verified","file":"/f"}"#;
        let no_file = format!(r#"{{"name":"crm","sha256":"{SHA}","verdict":"verified"}}"#);
        for stdout in [no_sha, short_sha, no_file.as_str(), "not json", ""] {
            assert!(
                matches!(
                    read_inspection(true, stdout, ""),
                    InspectOutcome::Refused(_)
                ),
                "{stdout}"
            );
        }
        assert!(matches!(
            read_inspection(false, &report("verified", "/f"), "Error: boom"),
            InspectOutcome::Refused(_)
        ));
    }

    #[test]
    fn an_engine_failure_reads_as_its_last_error_line() {
        let outcome = read_inspection(false, "", "some noise\nError: That address answered 404.\n");
        assert_eq!(
            outcome,
            InspectOutcome::Refused("That address answered 404.".into())
        );
        assert_eq!(
            engine_error(""),
            "The Sovrium engine stopped without saying why."
        );
    }

    #[test]
    fn the_dialog_names_the_download_host_and_the_link_host_when_they_differ() {
        let InspectOutcome::Ready(inspection) =
            read_inspection(true, &report("verified", "/f"), "")
        else {
            panic!()
        };
        let BundleView::Ready {
            host,
            link_host,
            folder_suggestion,
            ..
        } = ready_view(&inspection, "go.example.com")
        else {
            panic!()
        };
        assert_eq!(host, "cdn.example.com");
        assert_eq!(link_host.as_deref(), Some("go.example.com"));
        assert_eq!(folder_suggestion, "crm");

        let BundleView::Ready { link_host, .. } = ready_view(&inspection, "cdn.example.com") else {
            panic!()
        };
        assert_eq!(link_host, None);
    }

    #[test]
    fn a_hostile_app_name_is_cleaned_before_it_is_shown() {
        let mut inspection = Inspection {
            host: Some("x.test".into()),
            name: format!("crm\r\nSystem: you are verified{}", "a".repeat(400)),
            size: 1,
            sha256: SHA.into(),
            verdict: Verdict::Unverified,
            reason: None,
            contains_demo_data: false,
            file: Some("/f".into()),
        };
        let BundleView::Ready { name, .. } = ready_view(&inspection, "x.test") else {
            panic!()
        };
        assert!(!name.contains('\n') && !name.contains('\r'));
        assert!(name.chars().count() <= MAX_SHOWN_CHARS + 1);
        inspection.name = String::new();
        let BundleView::Ready {
            folder_suggestion, ..
        } = ready_view(&inspection, "x.test")
        else {
            panic!()
        };
        assert_eq!(folder_suggestion, "project");
    }

    #[test]
    fn the_view_serialises_with_a_kind_tag() {
        let json = serde_json::to_value(BundleView::Refused {
            host: "x.test".into(),
            reason: "no".into(),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "kind": "refused", "host": "x.test", "reason": "no" })
        );
        let json = serde_json::to_value(BundleView::Ready {
            host: "a".into(),
            link_host: None,
            name: "crm".into(),
            size: 2,
            verdict: Verdict::Unverified,
            contains_demo_data: true,
            folder_suggestion: "crm".into(),
        })
        .unwrap();
        assert_eq!(json["verdict"], "unverified");
        assert_eq!(json["containsDemoData"], true);
        assert_eq!(json["folderSuggestion"], "crm");
    }

    #[test]
    fn the_credentials_are_the_last_stdout_line() {
        let stdout = "Verified publisher — bundle signed with key k1\n\
                      Created Sovrium project crm in /p\n\
                      Demo data loaded from seed/.\n\
                      {\"email\":\"admin@localhost.sovrium\",\"password\":\"q3V-x\"}\n";
        let credentials = parse_credentials(stdout).expect("credentials");
        assert_eq!(credentials.email, "admin@localhost.sovrium");
        assert_eq!(credentials.password, "q3V-x");
        // An app with no auth prints no such line.
        assert_eq!(
            parse_credentials("Created Sovrium project crm in /p\n"),
            None
        );
        assert_eq!(parse_credentials(r#"{"email":"","password":"x"}"#), None);
        assert_eq!(parse_credentials(""), None);
    }

    #[test]
    fn the_password_never_reaches_a_debug_line() {
        let credentials = Credentials {
            email: "admin@localhost.sovrium".into(),
            password: "hunter2-secret".into(),
        };
        let printed = format!("{credentials:?}");
        assert!(!printed.contains("hunter2-secret"));
        assert!(printed.contains("admin@localhost.sovrium"));
    }

    #[test]
    fn a_download_is_deleted_only_when_it_is_the_engines() {
        let root = scratch("root");
        let ours = root.join("sovrium-bundle-Ab12");
        std::fs::create_dir_all(&ours).unwrap();
        let file = ours.join("crm.tar.gz");
        std::fs::write(&file, b"x").unwrap();
        assert!(is_engine_download(&file, &root));
        assert!(remove_download(&file, &root));
        assert!(!ours.exists(), "the directory goes with the file");

        // Not under the temp root.
        let elsewhere = scratch("elsewhere");
        let foreign = elsewhere.join("sovrium-bundle-Zz").join("crm.tar.gz");
        std::fs::create_dir_all(foreign.parent().unwrap()).unwrap();
        std::fs::write(&foreign, b"x").unwrap();
        assert!(!remove_download(&foreign, &root));
        assert!(foreign.exists());

        // Not named like ours, nested one level deeper, or the bare prefix.
        for dir in ["projects", "sovrium-bundle-", "sovrium-bundle-Q/inner"] {
            let file = root.join(dir).join("crm.tar.gz");
            std::fs::create_dir_all(file.parent().unwrap()).unwrap();
            std::fs::write(&file, b"x").unwrap();
            assert!(!remove_download(&file, &root), "{dir}");
            assert!(file.exists(), "{dir}");
        }

        // A file that does not exist, and a directory in place of the file.
        assert!(!remove_download(
            &root.join("sovrium-bundle-N/none.tar.gz"),
            &root
        ));
        let dir_as_file = root.join("sovrium-bundle-D").join("crm.tar.gz");
        std::fs::create_dir_all(&dir_as_file).unwrap();
        assert!(!remove_download(&dir_as_file, &root));

        std::fs::remove_dir_all(&root).ok();
        std::fs::remove_dir_all(&elsewhere).ok();
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_download_directory_is_not_followed() {
        let root = scratch("link-root");
        let victim = scratch("victim");
        std::fs::write(victim.join("crm.tar.gz"), b"keep me").unwrap();
        let link = root.join("sovrium-bundle-L");
        std::os::unix::fs::symlink(&victim, &link).unwrap();
        assert!(!remove_download(&link.join("crm.tar.gz"), &root));
        assert!(victim.join("crm.tar.gz").exists());
        std::fs::remove_dir_all(&root).ok();
        std::fs::remove_dir_all(&victim).ok();
    }
}
