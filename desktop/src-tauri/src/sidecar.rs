// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! The sidecar supervisor: spawn the Sovrium binary, find out what port it got,
//! prove it is answering, and stop it without leaving an orphan.
//!
//! # What the shell adds, and what it must not
//!
//! ADR-036 D1: "The shell does not reimplement Sovrium. It supervises the
//! existing binary as a sidecar process and shows what that binary serves."
//! Everything in this file is process management and a health probe. There is
//! no request proxy, no config parsing, no database access and no second
//! implementation of anything the engine does.
//!
//! # Three contracts this code depends on
//!
//! Two of them ship today and one does not, and the difference decides how each
//! is read:
//!
//! * **The lock file** (`<dataDir>/lock`, JSON `{pid, port, configHash,
//!   configPath}`) ships today. It is how the shell learns which port the OS
//!   handed out when it passed `PORT=0`.
//! * **`SIGTERM` → exit 0 within about a second** ships today
//!   (`installShutdownHandlers`), and is why the stop path signals before it
//!   kills.
//! * **`status.json`** (ADR-036 D5) does **not** ship yet. Every read of it here
//!   treats absence as "no information" and falls back to the process state. A
//!   status channel that is trusted when it is missing is worse than none.
//!
//! The environment the shell sets — `SOVRIUM_PROJECT_DIR`,
//! `SOVRIUM_CONFIG_FILE`, `SOVRIUM_INSTALL_METHOD`,
//! `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE` — is the D3 contract. Today's engine
//! ignores the variables it does not know, so setting them early costs nothing
//! and means the shell does not need a second release to start honouring them.

use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, Shutdown, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::nav_guard::LoopbackPort;
use crate::settings::{self, ProjectRef};

/// How many crashes in a row the shell will restart through before it stops and
/// shows the user what happened.
///
/// Three, because a crash loop that restarts forever is indistinguishable from a
/// working app that is briefly unavailable — it hides the error it is supposed
/// to surface, and it burns a CPU doing it.
pub const MAX_RESTART_ATTEMPTS: u32 = 3;

/// Lines of engine output the shell keeps for the log view and for the tail it
/// shows on an error screen.
const LOG_CAPACITY: usize = 500;

/// Longest single line kept. A runaway log line must not become a runaway
/// allocation, and nothing useful to a user lives past this.
const LOG_LINE_MAX: usize = 2000;

/// How long to wait for the engine to write its lock file and answer.
const BOOT_TIMEOUT: Duration = Duration::from_secs(45);

/// How long a stopping engine is given to exit on its own before it is killed.
///
/// The engine's own shutdown budget is a 5 s watchdog, but the common path —
/// cron disposed, socket drained, listeners stopped — completes in well under a
/// second. Two seconds is generous for the common path and short enough that
/// quitting the app never feels stuck.
const STOP_GRACE: Duration = Duration::from_secs(2);

/// The event name the frontend listens on for state changes.
pub const STATE_EVENT: &str = "sovrium://state";

/// What the shell is doing, as the frontend sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ShellState {
    /// No project chosen yet — the first-run gallery.
    Idle,
    /// Spawned, waiting for a port and a healthy answer.
    Starting,
    /// Answering on `port`, at `origin`.
    ///
    /// `origin` carries the address FAMILY as well as the port, because the
    /// engine binds one or the other and the shell must not guess: measured on
    /// macOS 2026-09-22, `sovrium start` listens on `[::1]` only, so
    /// `http://127.0.0.1:<port>` refuses the connection outright. Deriving the
    /// URL from the address that actually answered is what makes the window
    /// find the app on a machine whose loopback resolves differently.
    Serving { port: u16, origin: String },
    /// Crashed, and about to be restarted. `attempt` counts from 1.
    Restarting { attempt: u32 },
    /// Stopped by the user from the tray.
    Paused,
    /// Stopped trying. `message` is one sentence; `tail` is the last lines of
    /// engine output, which is usually the actual answer.
    Failed { message: String, tail: Vec<String> },
}

/// The full snapshot handed to the frontend on every change.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatePayload {
    pub state: ShellState,
    pub project: Option<ProjectRef>,
    /// The engine's own `status.json`, when it exists. `None` today — see the
    /// module docs.
    pub engine: Option<EngineStatus>,
}

/// The ADR-036 D5 status channel, as far as the shell reads it.
///
/// Every field is optional and every unknown field is ignored, because this
/// file is written by a binary that ships on a different cadence from the
/// shell: a newer engine must be readable by an older shell, and an older
/// engine (one that writes no such file at all) must not break a newer shell.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub config_hash: Option<String>,
    #[serde(default)]
    pub last_reload: Option<serde_json::Value>,
}

/// The lock file the engine writes once it is listening.
#[derive(Debug, Clone, Deserialize)]
struct LockFile {
    pid: u32,
    #[serde(default)]
    port: Option<u16>,
}

/// Read `<dataDir>/status.json`, or `None` if it is absent or unreadable.
pub fn read_engine_status(project: &ProjectRef) -> Option<EngineStatus> {
    let raw = std::fs::read_to_string(project.status_file()).ok()?;
    serde_json::from_str(&raw).ok()
}

/// One supervised engine, and everything the shell remembers about it.
pub struct Supervisor {
    child: Option<CommandChild>,
    pid: Option<u32>,
    exited: Arc<AtomicBool>,
    /// Bumped on every spawn. Every background task captures the generation it
    /// was started for and does nothing once it no longer matches — which is
    /// how a crash watcher for a process the user already replaced stops being
    /// able to restart it.
    generation: u64,
    state: ShellState,
    project: Option<ProjectRef>,
    log: VecDeque<String>,
    attempts: u32,
    /// Set for the duration of a deliberate stop, so the exit that follows is
    /// not read as a crash.
    stopping: bool,
}

impl Default for Supervisor {
    fn default() -> Self {
        Self {
            child: None,
            pid: None,
            exited: Arc::new(AtomicBool::new(true)),
            generation: 0,
            state: ShellState::Idle,
            project: None,
            log: VecDeque::with_capacity(LOG_CAPACITY),
            attempts: 0,
            stopping: false,
        }
    }
}

impl Supervisor {
    fn push_log(&mut self, stream: &str, line: String) {
        let trimmed: String = line.chars().take(LOG_LINE_MAX).collect();
        if self.log.len() == LOG_CAPACITY {
            self.log.pop_front();
        }
        self.log.push_back(format!("[{stream}] {trimmed}"));
    }

    /// The last `n` log lines, oldest first.
    pub fn tail(&self, n: usize) -> Vec<String> {
        let skip = self.log.len().saturating_sub(n);
        self.log.iter().skip(skip).cloned().collect()
    }

    pub fn logs(&self) -> Vec<String> {
        self.log.iter().cloned().collect()
    }

    pub fn state(&self) -> ShellState {
        self.state.clone()
    }

    pub fn project(&self) -> Option<ProjectRef> {
        self.project.clone()
    }

    pub fn is_running(&self) -> bool {
        self.child.is_some() && !self.exited.load(Ordering::SeqCst)
    }
}

/// The managed state handle.
pub type SharedSupervisor = Arc<Mutex<Supervisor>>;

/// Read the supervisor, tolerating a poisoned lock.
///
/// A panic in one command must not make the shell permanently unable to report
/// its own state — the error screen is exactly when the lock matters most.
fn lock(supervisor: &SharedSupervisor) -> std::sync::MutexGuard<'_, Supervisor> {
    supervisor.lock().unwrap_or_else(|e| e.into_inner())
}

/// The current snapshot, for the frontend and for the tray.
pub fn snapshot<R: Runtime>(app: &AppHandle<R>) -> StatePayload {
    let supervisor = app.state::<SharedSupervisor>();
    let guard = lock(&supervisor);
    let project = guard.project();
    StatePayload {
        state: guard.state(),
        engine: project.as_ref().and_then(read_engine_status),
        project,
    }
}

fn set_state<R: Runtime>(app: &AppHandle<R>, state: ShellState) {
    {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        if guard.state == state {
            return;
        }
        guard.state = state;
    }
    broadcast(app);
}

/// Tell the frontend what changed.
///
/// `emit` reaches every webview, including `main` while it is showing the page
/// the engine serves. That page cannot receive it: listening requires
/// `core:event:allow-listen`, and `capabilities/default.json` grants a remote
/// origin nothing at all. The payload names a local path, so this is worth
/// knowing rather than assuming — if a `remote` block is ever added to that
/// file, this emit starts leaking it.
fn broadcast<R: Runtime>(app: &AppHandle<R>) {
    let payload = snapshot(app);
    let _ = app.emit(STATE_EVENT, payload);
    crate::tray::refresh(app);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/// The environment one supervised engine runs with.
///
/// Built as a plain map, and returned rather than applied, so the whole thing is
/// testable without spawning anything — the env is the part of this file most
/// likely to be silently wrong, and the part a running process hides best.
pub fn engine_env(project: &ProjectRef, port: Option<u16>) -> Vec<(String, String)> {
    vec![
        // `0` means "let the OS choose", and the shell reads back what it chose
        // from the lock file. Probing for a free port and then passing it is the
        // spelling with a race in it: another process can take the port between
        // the probe and the bind.
        ("PORT".into(), port.unwrap_or(0).to_string()),
        // Explicit and absolute even though this IS the engine's default — the
        // default is resolved against `process.cwd()`, and the shell should not
        // depend on cwd inheritance being what it assumes. See `settings.rs`
        // for why the data dir lives inside the project.
        (
            "SOVRIUM_DATA_DIR".into(),
            project.data_dir().to_string_lossy().into_owned(),
        ),
        // --- ADR-036 D3 contract. Not honoured by the engine on `main` yet;
        // an engine that does not know a variable ignores it, so setting them
        // now means the shell needs no second release to start honouring them.
        (
            "SOVRIUM_PROJECT_DIR".into(),
            project.dir.to_string_lossy().into_owned(),
        ),
        ("SOVRIUM_CONFIG_FILE".into(), project.config_file.clone()),
        // `sovrium update` must refuse and the update nag must be suppressed:
        // a self-updating shell and a self-updating binary inside it would
        // fight, and the shell owns the update (D8).
        ("SOVRIUM_INSTALL_METHOD".into(), "desktop".into()),
        // Windows has no SIGTERM. The stop path closes stdin there, and this is
        // what makes that a clean exit rather than a broken pipe.
        ("SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE".into(), "1".into()),
    ]
}

/// The arguments for `sovrium start`.
pub fn start_args(project: &ProjectRef) -> Vec<String> {
    vec![
        "start".into(),
        project.config_file.clone(),
        // `--watch` is the whole product: the user's AI edits the file and the
        // change appears. Without it the desktop app is a launcher.
        "--watch".into(),
    ]
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/// The loopback addresses a Sovrium instance might have bound, in probe order.
///
/// IPv6 first because that is what the engine actually binds on macOS today:
/// `Bun.serve` with the default `localhost` hostname resolves to `::1` there, so
/// an IPv4-only probe finds nothing and an IPv4 URL is refused. Both are tried
/// because the answer is a property of the machine's resolver, not of Sovrium —
/// a Linux container or a Windows host may well answer on `127.0.0.1` instead,
/// and a shell that hard-codes either family is broken on half of them.
const LOOPBACK_ADDRS: [IpAddr; 2] = [
    IpAddr::V6(Ipv6Addr::LOCALHOST),
    IpAddr::V4(Ipv4Addr::LOCALHOST),
];

/// Turn a bound address into the origin a webview should be pointed at.
///
/// An IPv6 literal needs its brackets — `http://::1:5173/` is not a URL, and the
/// missing brackets are the kind of mistake that only shows up on the platform
/// that binds IPv6.
pub fn origin_for(addr: IpAddr, port: u16) -> String {
    match addr {
        IpAddr::V4(v4) => format!("http://{v4}:{port}"),
        IpAddr::V6(v6) => format!("http://[{v6}]:{port}"),
    }
}

/// Ask one address whether it is answering HTTP.
///
/// Hand-rolled over a `TcpStream` rather than through an HTTP client: the target
/// is always loopback and always plaintext, so a client would buy TLS, redirects,
/// proxies, a connection pool and a dependency for a single request that must
/// not do any of those things.
///
/// **Any HTTP status line counts as healthy**, not only `200`. The probe's
/// question is "is a Sovrium server listening and answering on this port", and
/// `/api/health` is today registered ahead of the API auth guards — but the
/// shell must not break on the day that changes, and a `401` proves a server is
/// there just as well as a `200` does.
fn probe_addr(addr: IpAddr, port: u16, timeout: Duration) -> bool {
    let socket = SocketAddr::new(addr, port);
    let Ok(mut stream) = TcpStream::connect_timeout(&socket, timeout) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    let host = match addr {
        IpAddr::V4(v4) => v4.to_string(),
        IpAddr::V6(v6) => format!("[{v6}]"),
    };
    let request = format!(
        "GET /api/health HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\nUser-Agent: sovrium-desktop\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut head = [0u8; 16];
    let read = stream.read(&mut head).unwrap_or(0);
    let _ = stream.shutdown(Shutdown::Both);
    read >= 8 && head.starts_with(b"HTTP/1.")
}

/// Find which loopback address the instance answers on, if any.
pub fn probe_http(port: u16, timeout: Duration) -> Option<IpAddr> {
    LOOPBACK_ADDRS
        .into_iter()
        .find(|addr| probe_addr(*addr, port, timeout))
}

/// Read the lock file and decide whether it describes the process we spawned.
///
/// Two acceptance rules, in order of strength:
///
/// 1. **The pid matches.** This is the real proof, and the common case.
/// 2. **The file was written after we spawned.** A fallback for the day the
///    engine's reported pid stops being the pid the OS gave us — a re-exec, a
///    wrapper, a platform quirk. It is weaker, so it only ever produces a
///    *candidate* port: the health probe still has to answer before the shell
///    calls anything serving.
///
/// A stale lock from a previous run fails both, which is the case that matters:
/// showing a window pointed at a dead port is the failure this function exists
/// to prevent.
fn read_lock_port(lock_path: &Path, our_pid: u32, spawned_at: SystemTime) -> Option<u16> {
    let raw = std::fs::read_to_string(lock_path).ok()?;
    let parsed: LockFile = serde_json::from_str(&raw).ok()?;
    let port = parsed.port?;
    if port == 0 {
        return None;
    }
    if parsed.pid == our_pid {
        return Some(port);
    }
    let modified = std::fs::metadata(lock_path).ok()?.modified().ok()?;
    (modified >= spawned_at).then_some(port)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/// Start (or restart) the engine for `project`.
///
/// Stops whatever is running first — there is exactly one sidecar, and
/// switching project is stop-then-respawn, so this is the only entry point.
pub fn start<R: Runtime>(app: &AppHandle<R>, project: ProjectRef) -> Result<(), String> {
    stop(app);
    {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        guard.project = Some(project.clone());
        guard.attempts = 0;
    }
    spawn_engine(app, project)
}

fn spawn_engine<R: Runtime>(app: &AppHandle<R>, project: ProjectRef) -> Result<(), String> {
    let settings = settings::load(app);
    let env = engine_env(&project, settings.port);
    let args = start_args(&project);

    let command = app
        .shell()
        .sidecar("sovrium")
        .map_err(|e| format!("The Sovrium engine could not be located: {e}"))?
        .current_dir(&project.dir)
        .args(&args)
        .envs(env.into_iter().collect::<std::collections::HashMap<_, _>>());

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("The Sovrium engine could not be started: {e}"))?;

    let pid = child.pid();
    let spawned_at = SystemTime::now();
    let exited = Arc::new(AtomicBool::new(false));
    let generation = {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        guard.generation += 1;
        guard.child = Some(child);
        guard.pid = Some(pid);
        guard.exited = exited.clone();
        guard.stopping = false;
        guard.state = ShellState::Starting;
        guard.generation
    };
    broadcast(app);

    // Pump the engine's output into the ring buffer, and notice the exit.
    let app_for_pump = app.clone();
    let exited_for_pump = exited.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    record(&app_for_pump, generation, "out", bytes);
                }
                CommandEvent::Stderr(bytes) => {
                    record(&app_for_pump, generation, "err", bytes);
                }
                CommandEvent::Error(message) => {
                    record(&app_for_pump, generation, "err", message.into_bytes());
                }
                CommandEvent::Terminated(payload) => {
                    exited_for_pump.store(true, Ordering::SeqCst);
                    handle_exit(&app_for_pump, generation, payload.code);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for a port, then for an answer. On its own thread because both waits
    // are blocking and neither may hold the supervisor lock.
    let app_for_wait = app.clone();
    let lock_path = project.lock_file();
    std::thread::spawn(move || {
        await_healthy(&app_for_wait, generation, pid, lock_path, spawned_at);
    });

    Ok(())
}

fn record<R: Runtime>(app: &AppHandle<R>, generation: u64, stream: &str, bytes: Vec<u8>) {
    let line = String::from_utf8_lossy(&bytes).trim_end().to_string();
    if line.is_empty() {
        return;
    }
    let supervisor = app.state::<SharedSupervisor>();
    let mut guard = lock(&supervisor);
    if guard.generation != generation {
        return;
    }
    guard.push_log(stream, line);
}

/// Block until the instance answers, or give up and say so.
fn await_healthy<R: Runtime>(
    app: &AppHandle<R>,
    generation: u64,
    pid: u32,
    lock_path: PathBuf,
    spawned_at: SystemTime,
) {
    let deadline = Instant::now() + BOOT_TIMEOUT;
    let mut port: Option<u16> = None;
    while Instant::now() < deadline {
        {
            let supervisor = app.state::<SharedSupervisor>();
            let guard = lock(&supervisor);
            if guard.generation != generation {
                return; // superseded — a newer spawn owns the window now
            }
            if guard.exited.load(Ordering::SeqCst) {
                return; // the exit handler owns the outcome
            }
        }
        if port.is_none() {
            port = read_lock_port(&lock_path, pid, spawned_at);
        }
        if let Some(p) = port {
            if let Some(addr) = probe_http(p, Duration::from_secs(3)) {
                become_serving(app, generation, p, addr);
                return;
            }
        }
        std::thread::sleep(Duration::from_millis(150));
    }

    let tail = {
        let supervisor = app.state::<SharedSupervisor>();
        let guard = lock(&supervisor);
        if guard.generation != generation {
            return;
        }
        guard.tail(25)
    };
    set_state(
        app,
        ShellState::Failed {
            message: match port {
                Some(p) => format!(
                    "Sovrium started on port {p} but never answered. The log below is what it said."
                ),
                None => "Sovrium did not finish starting. The log below is what it said.".into(),
            },
            tail,
        },
    );
    show_shell(app);
}

fn become_serving<R: Runtime>(app: &AppHandle<R>, generation: u64, port: u16, addr: IpAddr) {
    let origin = origin_for(addr, port);
    {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        if guard.generation != generation {
            return;
        }
        guard.attempts = 0;
        guard.state = ShellState::Serving {
            port,
            origin: origin.clone(),
        };
    }
    app.state::<LoopbackPort>().set(port);
    broadcast(app);
    show_app(app, &origin);
}

/// A crash, or a clean exit we did not ask for.
fn handle_exit<R: Runtime>(app: &AppHandle<R>, generation: u64, code: Option<i32>) {
    let (project, attempt, stopping) = {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        if guard.generation != generation {
            return;
        }
        if guard.stopping {
            return; // we asked for this
        }
        guard.attempts += 1;
        (guard.project.clone(), guard.attempts, guard.stopping)
    };
    if stopping {
        return;
    }
    app.state::<LoopbackPort>().clear();

    let Some(project) = project else { return };

    if attempt > MAX_RESTART_ATTEMPTS {
        let tail = {
            let supervisor = app.state::<SharedSupervisor>();
            let guard = lock(&supervisor);
            guard.tail(25)
        };
        set_state(
            app,
            ShellState::Failed {
                message: format!(
                    "Sovrium stopped {MAX_RESTART_ATTEMPTS} times in a row{}. The log below is what it said the last time.",
                    code.map(|c| format!(" (exit code {c})")).unwrap_or_default()
                ),
                tail,
            },
        );
        show_shell(app);
        return;
    }

    set_state(app, ShellState::Restarting { attempt });
    show_shell(app);

    // Back off 1 s, 2 s, 4 s. A restart that is instant turns a config the
    // engine refuses into a spin, and gives the user no window in which to read
    // the reason.
    let delay = Duration::from_secs(1u64 << (attempt.saturating_sub(1)).min(4));
    let app_for_retry = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        {
            let supervisor = app_for_retry.state::<SharedSupervisor>();
            let guard = lock(&supervisor);
            if guard.generation != generation {
                return;
            }
        }
        if let Err(message) = spawn_engine(&app_for_retry, project) {
            set_state(
                &app_for_retry,
                ShellState::Failed {
                    message,
                    tail: Vec::new(),
                },
            );
        }
    });
}

/// Stop the engine: ask, then wait, then insist.
///
/// Per-OS, because the two platforms have different words for "please stop":
///
/// * **Unix** — `SIGTERM`, which the engine handles: it disposes the cron
///   scheduler, drains in-flight requests, stops the listeners, flushes
///   telemetry and exits 0, having already unlinked its lock file. Then
///   `SIGKILL` if it is still there after [`STOP_GRACE`].
/// * **Windows** — there is no SIGTERM. Dropping the child closes its stdin,
///   which `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE=1` turns into the same clean exit.
///   Then `taskkill /T /F`, with `/T` because a console process can leave a
///   process tree behind where a signal would not.
///
/// Idempotent, and safe to call when nothing is running.
pub fn stop<R: Runtime>(app: &AppHandle<R>) {
    let (child, pid, exited) = {
        let supervisor = app.state::<SharedSupervisor>();
        let mut guard = lock(&supervisor);
        guard.stopping = true;
        let child = guard.child.take();
        let pid = guard.pid.take();
        (child, pid, guard.exited.clone())
    };
    app.state::<LoopbackPort>().clear();

    let (Some(child), Some(pid)) = (child, pid) else {
        return;
    };
    terminate(child, pid, &exited);

    let supervisor = app.state::<SharedSupervisor>();
    let mut guard = lock(&supervisor);
    guard.stopping = false;
    drop(guard);
}

#[cfg(unix)]
fn terminate(child: CommandChild, pid: u32, exited: &Arc<AtomicBool>) {
    // SAFETY: `kill` with a pid we spawned and a signal number. The pid cannot
    // have been recycled onto another process here, because this shell still
    // holds the child handle — the OS does not reuse a pid whose exit status
    // has not been reaped.
    unsafe {
        libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
    if wait_for_exit(exited, STOP_GRACE) {
        return;
    }
    log::warn!("the engine did not stop within the grace period; killing pid {pid}");
    let _ = child.kill();
}

#[cfg(windows)]
fn terminate(child: CommandChild, pid: u32, exited: &Arc<AtomicBool>) {
    // Dropping the child drops its stdin pipe, and a closed stdin is what
    // `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE=1` turns into a clean exit. This is the
    // only way to close it: `CommandChild` exposes `write` but no way to close
    // the writer short of dropping the value.
    drop(child);
    if wait_for_exit(exited, STOP_GRACE) {
        return;
    }
    log::warn!("the engine did not stop within the grace period; killing pid {pid}");
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status();
}

/// Poll the exit flag rather than sleeping the whole grace period: a clean stop
/// takes well under a second, and quitting the app should feel like quitting.
fn wait_for_exit(exited: &Arc<AtomicBool>, grace: Duration) -> bool {
    let deadline = Instant::now() + grace;
    while Instant::now() < deadline {
        if exited.load(Ordering::SeqCst) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    exited.load(Ordering::SeqCst)
}

/// Stop, and mark the state as a deliberate pause rather than a failure.
pub fn pause<R: Runtime>(app: &AppHandle<R>) {
    stop(app);
    set_state(app, ShellState::Paused);
    show_shell(app);
}

/// Start the active project again after a pause or a failure.
pub fn resume<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let project = {
        let supervisor = app.state::<SharedSupervisor>();
        let guard = lock(&supervisor);
        guard.project.clone()
    }
    .or_else(|| settings::load(app).active_project)
    .ok_or_else(|| "No project is open.".to_string())?;
    start(app, project)
}

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/// The URL the shell's own chrome lives at, captured once at startup.
///
/// Captured rather than derived, because the answer differs by platform and by
/// build (`tauri://localhost`, `http://tauri.localhost`, `http://localhost:1420`)
/// and re-deriving it is how the shell would fail to find its way home on
/// exactly one OS.
#[derive(Debug, Clone)]
pub struct ShellUrl(pub tauri::Url);

/// Point the main window at the running app — or at the user's browser, if that
/// is what they asked for.
fn show_app<R: Runtime>(app: &AppHandle<R>, origin: &str) {
    let url = format!("{origin}/");
    if settings::load(app).open_in_browser {
        use tauri_plugin_opener::OpenerExt;
        let _ = app.opener().open_url(url, None::<&str>);
        return;
    }
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(parsed) = tauri::Url::parse(&url) {
        let _ = window.navigate(parsed);
    }
}

/// Point the main window back at the shell's own chrome.
pub fn show_shell<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(home) = app.try_state::<ShellUrl>() else {
        return;
    };
    // Only navigate if we are away: re-navigating a page the user is already on
    // would throw away whatever they had typed into the gallery.
    let away = window
        .url()
        .map(|current| current.origin() != home.0.origin())
        .unwrap_or(true);
    if away {
        let _ = window.navigate(home.0.clone());
    }
}

// ---------------------------------------------------------------------------
// One-shot engine invocations
// ---------------------------------------------------------------------------

/// Run the engine once and collect its output — `init`, `--version`, `validate`.
///
/// Distinct from the supervised path on purpose: these are short, they are not
/// restarted, and they have no lock file, no port and no health probe.
pub async fn run_engine_once<R: Runtime>(
    app: &AppHandle<R>,
    args: Vec<String>,
    cwd: Option<PathBuf>,
) -> Result<(bool, String, String), String> {
    let mut command = app
        .shell()
        .sidecar("sovrium")
        .map_err(|e| format!("The Sovrium engine could not be located: {e}"))?
        .args(&args);
    if let Some(dir) = cwd {
        command = command.current_dir(dir);
    }
    let output = command
        .output()
        .await
        .map_err(|e| format!("The Sovrium engine could not be run: {e}"))?;
    Ok((
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).trim().to_string(),
        String::from_utf8_lossy(&output.stderr).trim().to_string(),
    ))
}

/// Absolute path of the bundled engine, for the "connect your AI" snippet.
///
/// Mirrors `relative_command_path` in `tauri-plugin-shell`: the bundler copies
/// `sovrium-<triple>` next to the shell's own executable, WITHOUT the triple,
/// and adds `.exe` on Windows. Reproduced rather than imported because the
/// plugin resolves the path privately and hands back only a `Command` — and the
/// snippet needs the path as text, to be pasted into a file the shell does not
/// own. If a Tauri release ever changes where a sidecar lands, this is the line
/// that has to move with it.
pub fn engine_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let mut path = dir.join("sovrium");
    if cfg!(windows) {
        path.set_extension("exe");
    }
    Some(path)
}

/// Remembers the answer to [`has_mcp_verb`] for the life of the process.
///
/// Only a probe that actually RAN is recorded. A probe that could not spawn the
/// engine teaches nothing about the engine, and caching its answer would make a
/// transient failure permanent for the session.
static MCP_VERB: OnceLock<bool> = OnceLock::new();

/// Does the bundled engine understand `sovrium mcp`?
///
/// Asked rather than assumed, and asked of `--help` rather than of `mcp` itself.
/// The verb ships today (ADR-036 D6, engine phase E3) and the sidecar travels in
/// the same installer as this shell, so "assume yes" would be right almost
/// always — but almost always is the wrong bar here. A user whose engine half
/// was replaced by hand, or whose update reached one half only, would be told
/// their AI is connected when it is not, and an assistant that believes it is
/// connected reports success on edits that never happened. That is the single
/// failure mode this design cannot absorb, so the answer is read off the binary
/// that is actually installed.
///
/// `--help` and not `mcp --help`: the help listing is a stable, side-effect-free
/// surface, while invoking the verb on an engine that does not know it is an
/// error path whose shape is not pinned anywhere. Exit status is ignored for the
/// same reason — the evidence is the line, not the code.
pub async fn has_mcp_verb<R: Runtime>(app: &AppHandle<R>) -> bool {
    if let Some(known) = MCP_VERB.get() {
        return *known;
    }
    let Ok((_, stdout, stderr)) = run_engine_once(app, vec!["--help".into()], None).await else {
        return false;
    };
    let listed = format!("{stdout}\n{stderr}")
        .lines()
        .any(|line| line.trim_start().starts_with("sovrium mcp"));
    let _ = MCP_VERB.set(listed);
    listed
}

/// Compare the engine's version with the shell's, and say so if they differ.
///
/// A warning, never a block. The two halves ship as one installer, so a
/// mismatch means something unusual happened — a partially applied update, a
/// hand-swapped sidecar — and the useful response is a line in the log and a
/// note in the settings window, not a refusal to start the app the user came
/// for. Returns `(shell_version, engine_version)`.
pub async fn version_parity<R: Runtime>(app: &AppHandle<R>) -> (String, Option<String>) {
    let shell = env!("CARGO_PKG_VERSION").to_string();
    let engine = run_engine_once(app, vec!["--version".into()], None)
        .await
        .ok()
        .and_then(|(ok, stdout, _)| ok.then_some(stdout))
        .map(|v| parse_version(&v));
    if let Some(engine_version) = &engine {
        if engine_version != &shell {
            log::warn!(
                "version mismatch: the shell is {shell}, the engine is {engine_version}. \
                 They ship together, so this usually means an update was applied to one half only."
            );
        }
    }
    (shell, engine)
}

/// Pull a bare version out of whatever `--version` prints.
///
/// The engine's banner has changed shape before and will again; taking the last
/// whitespace-separated token of the first line survives `0.25.0`,
/// `sovrium 0.25.0` and `Sovrium v0.25.0` alike.
pub fn parse_version(raw: &str) -> String {
    raw.lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .next_back()
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> ProjectRef {
        ProjectRef::new(PathBuf::from("/tmp/demo"), Some("crm".into()))
    }

    fn env_map(port: Option<u16>) -> std::collections::HashMap<String, String> {
        engine_env(&project(), port).into_iter().collect()
    }

    #[test]
    fn an_unset_port_becomes_zero_not_a_guess() {
        // Passing a port the shell probed for is the spelling with a race in
        // it; `0` plus a read-back from the lock file has none.
        assert_eq!(env_map(None)["PORT"], "0");
        assert_eq!(env_map(Some(4321))["PORT"], "4321");
    }

    #[test]
    fn the_whole_desktop_env_contract_is_set() {
        let env = env_map(None);
        assert_eq!(env["SOVRIUM_DATA_DIR"], "/tmp/demo/.sovrium");
        assert_eq!(env["SOVRIUM_PROJECT_DIR"], "/tmp/demo");
        assert_eq!(env["SOVRIUM_CONFIG_FILE"], "app.yaml");
        assert_eq!(env["SOVRIUM_INSTALL_METHOD"], "desktop");
        assert_eq!(env["SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE"], "1");
    }

    #[test]
    fn the_env_carries_no_ai_credential_and_no_config() {
        // ADR-036 D2: the shell never stores, proxies, prompts for or transmits
        // an AI credential, and no configuration of the app enters the
        // environment. Asserted as a shape rather than trusted as a habit.
        let env = env_map(None);
        for key in env.keys() {
            let upper = key.to_uppercase();
            assert!(
                !upper.contains("API_KEY")
                    && !upper.contains("TOKEN")
                    && !upper.contains("SECRET")
                    && !upper.contains("ANTHROPIC")
                    && !upper.contains("OPENAI"),
                "{key} must not be in the engine environment"
            );
        }
        assert_eq!(env.len(), 6, "every variable is accounted for above");
    }

    #[test]
    fn start_args_watch() {
        assert_eq!(
            start_args(&project()),
            vec!["start".to_string(), "app.yaml".to_string(), "--watch".to_string()]
        );
    }

    #[test]
    fn the_log_ring_is_bounded_in_both_directions() {
        let mut s = Supervisor::default();
        for i in 0..(LOG_CAPACITY + 50) {
            s.push_log("out", format!("line {i}"));
        }
        assert_eq!(s.logs().len(), LOG_CAPACITY);
        assert!(s.logs()[0].contains(&format!("line {}", 50)));

        s.push_log("err", "x".repeat(LOG_LINE_MAX * 3));
        let last = s.logs().last().cloned().unwrap();
        assert!(last.len() <= LOG_LINE_MAX + 8, "a runaway line is truncated");
    }

    #[test]
    fn tail_asks_for_more_than_exists_without_panicking() {
        let mut s = Supervisor::default();
        s.push_log("out", "only one".into());
        assert_eq!(s.tail(25).len(), 1);
        assert!(Supervisor::default().tail(25).is_empty());
    }

    fn write_lock(dir: &Path, body: &str) -> PathBuf {
        let path = dir.join("lock");
        std::fs::write(&path, body).expect("write lock");
        path
    }

    #[test]
    fn a_lock_file_for_our_pid_yields_its_port() {
        let dir = std::env::temp_dir().join(format!("sov-lock-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = write_lock(
            &dir,
            r#"{"pid":4242,"port":5123,"configHash":"abc","configPath":"/x/app.yaml"}"#,
        );
        assert_eq!(
            read_lock_port(&path, 4242, SystemTime::now() + Duration::from_secs(60)),
            Some(5123)
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_stale_lock_from_another_run_is_refused() {
        // The failure this prevents: showing a window pointed at a dead port
        // because a previous run left its lock file behind.
        let dir = std::env::temp_dir().join(format!("sov-stale-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = write_lock(&dir, r#"{"pid":1,"port":5123,"configHash":"a","configPath":"x"}"#);
        let in_the_future = SystemTime::now() + Duration::from_secs(3600);
        assert_eq!(read_lock_port(&path, 4242, in_the_future), None);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_lock_written_after_we_spawned_is_accepted_even_on_a_pid_mismatch() {
        let dir = std::env::temp_dir().join(format!("sov-mtime-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = write_lock(&dir, r#"{"pid":1,"port":5123,"configHash":"a","configPath":"x"}"#);
        let long_ago = SystemTime::UNIX_EPOCH;
        assert_eq!(read_lock_port(&path, 4242, long_ago), Some(5123));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_lock_without_a_port_is_not_ready() {
        let dir = std::env::temp_dir().join(format!("sov-noport-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for body in [
            r#"{"pid":4242,"configHash":"a","configPath":"x"}"#,
            r#"{"pid":4242,"port":0,"configHash":"a","configPath":"x"}"#,
            "not json at all",
        ] {
            let path = write_lock(&dir, body);
            assert_eq!(read_lock_port(&path, 4242, SystemTime::UNIX_EPOCH), None, "{body}");
        }
        assert_eq!(
            read_lock_port(&dir.join("absent"), 4242, SystemTime::UNIX_EPOCH),
            None
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn probing_a_port_nothing_listens_on_finds_nothing_and_is_fast() {
        let started = Instant::now();
        // Port 1 is privileged and unbound; the connect fails immediately on
        // both families.
        assert_eq!(probe_http(1, Duration::from_millis(400)), None);
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn an_ipv6_origin_carries_its_brackets() {
        // `http://::1:5173/` is not a URL. The missing brackets are the kind of
        // mistake that only appears on the platform that binds IPv6 — which is
        // macOS, where the engine measurably does.
        assert_eq!(
            origin_for(IpAddr::V6(Ipv6Addr::LOCALHOST), 5173),
            "http://[::1]:5173"
        );
        assert_eq!(
            origin_for(IpAddr::V4(Ipv4Addr::LOCALHOST), 5173),
            "http://127.0.0.1:5173"
        );
    }

    #[test]
    fn an_ipv6_origin_parses_to_a_host_the_navigation_guard_admits() {
        // The two halves have to agree: the guard matches on `Url::host_str`,
        // which serialises an IPv6 literal WITH its brackets, and its allow-list
        // has to carry the same spelling.
        let origin = origin_for(IpAddr::V6(Ipv6Addr::LOCALHOST), 5173);
        let url = tauri::Url::parse(&format!("{origin}/")).expect("parses");
        assert_eq!(url.host_str(), Some("[::1]"));
        assert!(crate::nav_guard::may_navigate(&url, Some(5173)));
    }

    #[test]
    fn the_probe_finds_a_listener_on_either_family() {
        use std::net::TcpListener;
        // A bare TCP listener answers the connect but not with HTTP, so the
        // probe must refuse it — proving the probe checks for a Sovrium server
        // rather than for an open port.
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming().take(2) {
                drop(stream);
            }
        });
        assert_eq!(probe_http(port, Duration::from_millis(500)), None);
    }

    #[test]
    fn version_parsing_survives_every_banner_shape_the_engine_has_had() {
        assert_eq!(parse_version("0.25.0"), "0.25.0");
        assert_eq!(parse_version("sovrium 0.25.0"), "0.25.0");
        assert_eq!(parse_version("Sovrium v0.25.0"), "0.25.0");
        assert_eq!(parse_version("Sovrium v0.25.0\nsomething else"), "0.25.0");
        assert_eq!(parse_version(""), "");
    }

    #[test]
    fn an_engine_status_file_from_a_newer_engine_still_decodes() {
        // The shell and the engine ship on one installer but are built by two
        // toolchains and evolve separately; an unknown field must be ignored
        // rather than failing the read.
        let status: EngineStatus = serde_json::from_str(
            r#"{"state":"serving","port":5123,"configHash":"abc","somethingNew":{"a":1}}"#,
        )
        .expect("decodes");
        assert_eq!(status.state.as_deref(), Some("serving"));
        assert_eq!(status.port, Some(5123));

        let empty: EngineStatus = serde_json::from_str("{}").expect("decodes");
        assert_eq!(empty.state, None);
    }

    #[test]
    fn shell_states_round_trip_as_tagged_json() {
        // The frontend switches on `kind`; a rename here is a silent blank
        // screen there, so pin the wire shape.
        let json = serde_json::to_string(&ShellState::Serving {
            port: 5123,
            origin: "http://[::1]:5123".into(),
        })
        .unwrap();
        assert_eq!(
            json,
            r#"{"kind":"serving","port":5123,"origin":"http://[::1]:5123"}"#
        );
        assert_eq!(
            serde_json::to_string(&ShellState::Restarting { attempt: 2 }).unwrap(),
            r#"{"kind":"restarting","attempt":2}"#
        );
        assert_eq!(serde_json::to_string(&ShellState::Idle).unwrap(), r#"{"kind":"idle"}"#);
    }
}
