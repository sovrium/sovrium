// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The headless self-test a CI job runs against a **built** bundle.
//!
//! # What this exists to catch, and why nothing else catches it
//!
//! `cargo check`, `cargo test` and `desktop:check` all run against the crate.
//! None of them runs the artefact a user downloads, and the two defects that
//! matter most only exist in that artefact:
//!
//! * **The sidecar is not where the shell looks for it.** `engine_path()` and
//!   `tauri_plugin_shell`'s sidecar resolution both derive a path from
//!   `current_exe()`. Whether the bundler actually put `sovrium` there is a
//!   property of the bundle, and a wrong answer presents as an app that opens
//!   and then does nothing.
//! * **The sidecar cannot execute.** On macOS an unsigned or wrongly-entitled
//!   nested Mach-O is killed by the kernel at launch rather than failing with a
//!   message — again, an app that opens and does nothing.
//!
//! So the check has to be: take the bundle, point it at an empty folder, and see
//! whether a real Sovrium instance ends up answering HTTP.
//!
//! # The shape, and why it holds rather than exiting immediately
//!
//! `SOVRIUM_DESKTOP_SMOKE=1` turns the shell into a one-shot: scaffold a project
//! with the bundled engine, start it, wait for `Serving`, write a machine-
//! readable report, then **hold** until a sentinel file appears (or the hold
//! deadline passes) and exit 0.
//!
//! The hold is the load-bearing part. Without it the shell would be its own
//! judge — it would report healthy on the strength of its own probe and vanish,
//! and the CI script would have nothing left to inspect. With it, the script
//! reads the lock file, makes its own HTTP request on both loopback families,
//! and only then writes the sentinel. The shell's verdict and the script's
//! verdict are independent, which is the whole point of a smoke test.
//!
//! Stopping is a **file**, not a signal, because Windows has no SIGTERM and this
//! code has to be one path on three operating systems.
//!
//! # The two refusals this module keeps
//!
//! It writes nothing outside its own run directory, and it never touches the
//! user's real settings store: the CI script isolates `HOME`/`APPDATA` before
//! launching, and the project is scaffolded by the engine's own `init`. There is
//! no configuration authored here either — the same refusal `commands.rs` holds.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Runtime};

use crate::settings::ProjectRef;
use crate::sidecar::{self, ShellState};

/// Turns the shell into a one-shot self-test. Anything other than `1` is off.
const VAR_ENABLED: &str = "SOVRIUM_DESKTOP_SMOKE";
/// The run directory. Required — the run refuses rather than guessing a path it
/// would then write into.
const VAR_DIR: &str = "SOVRIUM_DESKTOP_SMOKE_DIR";
/// Which bundled template to scaffold.
const VAR_TEMPLATE: &str = "SOVRIUM_DESKTOP_SMOKE_TEMPLATE";
/// How long the engine gets to answer.
const VAR_TIMEOUT_MS: &str = "SOVRIUM_DESKTOP_SMOKE_TIMEOUT_MS";
/// How long to hold once healthy, waiting for the caller's sentinel.
const VAR_HOLD_MS: &str = "SOVRIUM_DESKTOP_SMOKE_HOLD_MS";

/// The smallest template that still boots a real server.
const DEFAULT_TEMPLATE: &str = "hello-world";
const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const DEFAULT_HOLD_MS: u64 = 60_000;

/// How often the run re-reads the shell's state while waiting.
const POLL: Duration = Duration::from_millis(200);

/// One configured smoke run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmokeConfig {
    /// The run directory. Everything this module writes is inside it.
    pub dir: PathBuf,
    pub template: String,
    pub timeout: Duration,
    pub hold: Duration,
}

impl SmokeConfig {
    /// Where the engine scaffolds the project. A child of the run directory
    /// rather than the run directory itself, because `sovrium init` refuses a
    /// non-empty folder and the report lands beside it.
    pub fn project_dir(&self) -> PathBuf {
        self.dir.join("project")
    }

    /// The verdict, written before the hold begins so it survives any later
    /// failure — including the caller giving up and killing the process.
    pub fn report_path(&self) -> PathBuf {
        self.dir.join("smoke-report.json")
    }

    /// The caller's "you may go now". A file, not a signal: Windows has no
    /// SIGTERM, and one mechanism on three operating systems is worth more here
    /// than the tidiest one on two.
    pub fn quit_path(&self) -> PathBuf {
        self.dir.join("quit")
    }
}

/// Read the configuration out of a variable lookup.
///
/// Takes the lookup as an argument rather than calling `std::env::var` so the
/// parsing is testable without mutating process state — which is a data race
/// between parallel tests, and is `unsafe` in newer editions for that reason.
pub fn config_from<F>(var: F) -> Option<SmokeConfig>
where
    F: Fn(&str) -> Option<String>,
{
    if var(VAR_ENABLED).as_deref() != Some("1") {
        return None;
    }
    // A run with no directory is refused rather than defaulted. The alternative
    // is a temp-dir guess, and a self-test that writes somewhere the caller did
    // not name is how a CI job passes while inspecting the wrong folder.
    let dir = var(VAR_DIR).filter(|d| !d.is_empty()).map(PathBuf::from)?;
    Some(SmokeConfig {
        dir,
        template: var(VAR_TEMPLATE)
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| DEFAULT_TEMPLATE.to_string()),
        timeout: millis(var(VAR_TIMEOUT_MS), DEFAULT_TIMEOUT_MS),
        hold: millis(var(VAR_HOLD_MS), DEFAULT_HOLD_MS),
    })
}

/// Parse a millisecond budget, falling back on anything unparseable.
///
/// A malformed budget takes the default rather than failing the run: the value
/// is an operator convenience, and refusing to start over a typo in a timeout
/// would turn a slow test into no test.
fn millis(raw: Option<String>, fallback: u64) -> Duration {
    Duration::from_millis(
        raw.and_then(|v| v.trim().parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(fallback),
    )
}

/// Read the configuration from the real environment.
pub fn config() -> Option<SmokeConfig> {
    config_from(|name| std::env::var(name).ok())
}

/// What the run writes to `smoke-report.json`.
///
/// Serialized camelCase because the reader is a Bun script, and a report nobody
/// can parse without a mapping table is a report that gets read by eye.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeReport {
    pub ok: bool,
    pub template: String,
    pub project_dir: String,
    /// The port the shell believes the engine is on. `0` when it never got one.
    pub port: u16,
    /// The origin the shell would point a window at — carries the loopback
    /// FAMILY, which is the part a caller cannot guess.
    pub origin: String,
    pub elapsed_ms: u128,
    /// One sentence, present only on failure.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<String>,
    /// The last lines of engine output, which on a failure are usually the
    /// actual answer.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tail: Vec<String>,
}

/// Start the run on its own thread.
///
/// A plain OS thread rather than an async task: the body blocks on an engine
/// subprocess and then polls for up to a couple of minutes, and parking a tokio
/// worker for that long is how the rest of the shell stops answering.
pub fn spawn<R: Runtime>(app: &AppHandle<R>, config: SmokeConfig) {
    let handle = app.clone();
    std::thread::spawn(move || {
        let code = match execute(&handle, &config) {
            Ok(report) => {
                log::info!(
                    "smoke: serving at {} after {} ms",
                    report.origin,
                    report.elapsed_ms
                );
                write_report(&config, &report);
                announce(&report);
                hold(&config);
                0
            }
            Err(report) => {
                log::warn!(
                    "smoke: FAILED — {}",
                    report.failure.as_deref().unwrap_or("no reason recorded")
                );
                write_report(&config, &report);
                announce(&report);
                1
            }
        };
        handle.exit(code);
    });
}

/// Scaffold, start, and wait for a healthy instance.
fn execute<R: Runtime>(
    app: &AppHandle<R>,
    config: &SmokeConfig,
) -> Result<SmokeReport, SmokeReport> {
    let started = Instant::now();
    let project_dir = config.project_dir();
    let fail = |message: String, tail: Vec<String>| SmokeReport {
        ok: false,
        template: config.template.clone(),
        project_dir: project_dir.to_string_lossy().into_owned(),
        port: 0,
        origin: String::new(),
        elapsed_ms: started.elapsed().as_millis(),
        failure: Some(message),
        tail,
    };

    if let Err(error) = std::fs::create_dir_all(&config.dir) {
        return Err(fail(format!("the run directory is unusable: {error}"), vec![]));
    }

    // The engine's own scaffolder, exactly as `create_project` uses it. The
    // shell does not author a config file here any more than it does anywhere
    // else — and using `init` is also what makes this a real test of the
    // sidecar: if the bundled engine cannot run, this is where it shows.
    let init = tauri::async_runtime::block_on(sidecar::run_engine_once(
        app,
        vec![
            "init".into(),
            "--template".into(),
            config.template.clone(),
            project_dir.to_string_lossy().into_owned(),
        ],
        None,
    ));
    match init {
        Err(error) => return Err(fail(format!("the bundled engine did not run: {error}"), vec![])),
        Ok((false, stdout, stderr)) => {
            let detail = if stderr.is_empty() { stdout } else { stderr };
            return Err(fail(
                format!("`sovrium init --template {}` failed", config.template),
                detail.lines().map(str::to_string).collect(),
            ));
        }
        Ok((true, _, _)) => {}
    }

    let project = ProjectRef::new(project_dir.clone(), Some(config.template.clone()));
    if let Err(error) = sidecar::start(app, project) {
        return Err(fail(format!("the engine could not be started: {error}"), vec![]));
    }

    let deadline = Instant::now() + config.timeout;
    loop {
        match sidecar::snapshot(app).state {
            ShellState::Serving { port, origin } => {
                return Ok(SmokeReport {
                    ok: true,
                    template: config.template.clone(),
                    project_dir: project_dir.to_string_lossy().into_owned(),
                    port,
                    origin,
                    elapsed_ms: started.elapsed().as_millis(),
                    failure: None,
                    tail: vec![],
                })
            }
            // The supervisor already gave up and already knows why. Reporting
            // its message beats waiting out a timeout that would say nothing.
            ShellState::Failed { message, tail } => return Err(fail(message, tail)),
            _ => {}
        }
        if Instant::now() >= deadline {
            let tail = sidecar::snapshot(app)
                .project
                .map(|_| Vec::new())
                .unwrap_or_default();
            return Err(fail(
                format!(
                    "the engine did not answer within {} ms",
                    config.timeout.as_millis()
                ),
                tail,
            ));
        }
        std::thread::sleep(POLL);
    }
}

/// Wait for the caller's sentinel, or for the hold deadline.
///
/// The deadline exits 0 rather than 1: by this point the shell has done its
/// whole job and written a passing report. A caller that never wrote the
/// sentinel has its own timeout, and that is where the failure belongs — making
/// the hold fatal here would turn one timeout into two verdicts that can
/// disagree.
fn hold(config: &SmokeConfig) {
    let quit = config.quit_path();
    let deadline = Instant::now() + config.hold;
    while Instant::now() < deadline {
        if quit.exists() {
            log::info!("smoke: quit sentinel seen; stopping");
            return;
        }
        std::thread::sleep(POLL);
    }
    log::info!(
        "smoke: no quit sentinel after {} ms; stopping anyway",
        config.hold.as_millis()
    );
}

/// Write the verdict where the caller will look for it.
fn write_report(config: &SmokeConfig, report: &SmokeReport) {
    let path = config.report_path();
    match serde_json::to_string_pretty(report) {
        Ok(json) => {
            if let Err(error) = std::fs::write(&path, format!("{json}\n")) {
                log::warn!("smoke: the report could not be written to {path:?}: {error}");
            }
        }
        Err(error) => log::warn!("smoke: the report could not be serialized: {error}"),
    }
}

/// One line on stdout, so a CI log shows the verdict without opening a file.
fn announce(report: &SmokeReport) {
    if report.ok {
        println!(
            "SOVRIUM_DESKTOP_SMOKE_OK origin={} port={} elapsedMs={}",
            report.origin, report.port, report.elapsed_ms
        );
    } else {
        println!(
            "SOVRIUM_DESKTOP_SMOKE_FAIL reason={}",
            report.failure.as_deref().unwrap_or("unknown")
        );
    }
}

/// Is this path inside the run directory?
///
/// Used by the caller-facing docs and by the tests below to state the one
/// containment rule this module keeps: nothing is written outside `dir`.
pub fn is_inside(dir: &Path, path: &Path) -> bool {
    path.starts_with(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |name| {
            pairs
                .iter()
                .find(|(k, _)| *k == name)
                .map(|(_, v)| (*v).to_string())
        }
    }

    #[test]
    fn is_off_unless_explicitly_enabled() {
        assert_eq!(config_from(vars(&[])), None);
        assert_eq!(
            config_from(vars(&[(VAR_DIR, "/tmp/run")])),
            None,
            "a directory alone must not arm the self-test"
        );
        assert_eq!(
            config_from(vars(&[(VAR_ENABLED, "true"), (VAR_DIR, "/tmp/run")])),
            None,
            "only the exact value 1 arms it — `true` is a different variable's spelling"
        );
    }

    #[test]
    fn refuses_to_guess_a_run_directory() {
        // The alternative is a temp-dir default, which would have the shell
        // writing somewhere the caller never named.
        assert_eq!(config_from(vars(&[(VAR_ENABLED, "1")])), None);
        assert_eq!(config_from(vars(&[(VAR_ENABLED, "1"), (VAR_DIR, "")])), None);
    }

    #[test]
    fn defaults_are_the_documented_ones() {
        let c = config_from(vars(&[(VAR_ENABLED, "1"), (VAR_DIR, "/tmp/run")])).expect("armed");
        assert_eq!(c.template, DEFAULT_TEMPLATE);
        assert_eq!(c.timeout, Duration::from_millis(DEFAULT_TIMEOUT_MS));
        assert_eq!(c.hold, Duration::from_millis(DEFAULT_HOLD_MS));
    }

    #[test]
    fn budgets_fall_back_rather_than_refusing() {
        let c = config_from(vars(&[
            (VAR_ENABLED, "1"),
            (VAR_DIR, "/tmp/run"),
            (VAR_TIMEOUT_MS, "not-a-number"),
            (VAR_HOLD_MS, "0"),
        ]))
        .expect("armed");
        assert_eq!(c.timeout, Duration::from_millis(DEFAULT_TIMEOUT_MS));
        assert_eq!(
            c.hold,
            Duration::from_millis(DEFAULT_HOLD_MS),
            "zero would mean no hold at all, which defeats the independent check"
        );
    }

    #[test]
    fn budgets_are_honoured_when_they_parse() {
        let c = config_from(vars(&[
            (VAR_ENABLED, "1"),
            (VAR_DIR, "/tmp/run"),
            (VAR_TIMEOUT_MS, "5000"),
            (VAR_HOLD_MS, "1500"),
        ]))
        .expect("armed");
        assert_eq!(c.timeout, Duration::from_millis(5_000));
        assert_eq!(c.hold, Duration::from_millis(1_500));
    }

    #[test]
    fn every_path_it_writes_is_inside_the_run_directory() {
        let c = config_from(vars(&[(VAR_ENABLED, "1"), (VAR_DIR, "/tmp/run")])).expect("armed");
        for path in [c.project_dir(), c.report_path(), c.quit_path()] {
            assert!(is_inside(&c.dir, &path), "{path:?} escaped the run directory");
        }
        assert_eq!(c.project_dir(), PathBuf::from("/tmp/run/project"));
        assert_eq!(c.report_path(), PathBuf::from("/tmp/run/smoke-report.json"));
        assert_eq!(c.quit_path(), PathBuf::from("/tmp/run/quit"));
    }

    #[test]
    fn a_passing_report_serializes_without_the_failure_keys() {
        let report = SmokeReport {
            ok: true,
            template: "hello-world".into(),
            project_dir: "/tmp/run/project".into(),
            port: 5173,
            origin: "http://[::1]:5173".into(),
            elapsed_ms: 1234,
            failure: None,
            tail: vec![],
        };
        let json = serde_json::to_string(&report).expect("serializes");
        assert!(json.contains(r#""ok":true"#));
        assert!(json.contains(r#""origin":"http://[::1]:5173""#));
        assert!(
            !json.contains("failure") && !json.contains("tail"),
            "a passing report must not carry empty failure fields: {json}"
        );
    }
}
