# Lifecycle Commands

> Run and control a server — `start`, `stop`, `restart` and the zero-downtime `reload` — plus the lock file that ties the four together and the status file a running instance publishes about itself.

`stop`, `restart` and `reload` all find the running process through a **lock file** the server writes at boot, recording its PID, port and config path. That is why none of them needs you to name the config again.

## `sovrium start`

```text
Usage: sovrium start [config] [options]
```

Start the server. This is the default command, so the `start` word is optional when a config path is present. `sovrium start --help` prints the full option and environment list.

```bash
sovrium start app.yaml          # explicit
sovrium app.yaml                # implicit — identical
sovrium start app.yaml --watch  # reload on config change

PORT=8080 sovrium start app.yaml
```

The port comes from `PORT` and defaults to `3000`. If that port is already taken Sovrium does **not** fail — it binds an OS-assigned free port and prints the real URL in the startup banner:

```text
13:19:04 Warning: [server] Port 3000 in use; using an OS-assigned port (see URL below).
```

Starting while another instance holds the lock is refused:

```text
Error: Server already running (PID: 12345, port: 3000)
```

A lock left behind by a crashed process is detected — its PID no longer exists — and removed automatically, so this only blocks you when an instance really is running. An app that moved behind a new canonical origin keeps receiving requests on the old hostname; `SOVRIUM_REDIRECT_HOST` and `SOVRIUM_REDIRECT_HOST_TARGET` turn those into one path- and query-preserving `301`, described in **Env Vars: Core**.

## `sovrium stop`

```text
Usage: sovrium stop
```

Send `SIGTERM` to the process named in the lock file, then **wait up to 5 seconds for that process to exit**. The lock is removed only once the process is really gone, so a lock file that survives a `stop` is telling you the truth: the server is still up.

On success it prints `Server stopped.` and exits `0`.

If the recorded PID no longer exists, the stale lock is cleared and the output says so instead of claiming a stop that never happened:

```text
Server was not running — removed a stale lock file for PID 12345.
```

A server still alive 5 seconds after `SIGTERM` exits `1` and **keeps the lock**, naming the escalation:

```text
Error: Server (PID 12345) did not exit within 5s after SIGTERM.

Force it with 'kill -9 12345', then run 'sovrium stop' again to clear the lock.
```

With no lock file at all it also exits `1`, and says to start one.

On `SIGTERM` — or `Ctrl-C` in the foreground — the server finishes the requests already in flight, force-closes long-lived connections such as server-sent-event streams, and exits, normally in well under a second. `docker stop` and systemd therefore complete without falling back to `SIGKILL`. A second `Ctrl-C` skips the drain and exits immediately: the second signal is an order, not a repeat.

## `sovrium restart`

```text
Usage: sovrium restart [config]
```

Stop the running server, then relaunch it detached in the background. The config path is optional — without one, the path recorded in the lock file is reused.

```bash
sovrium restart          # same config as the running instance
sovrium restart app.yaml # swap in a different config
```

Restart waits for the old process exactly as `stop` does, and **refuses to launch a replacement** if it is still alive after 5 seconds, so you never end up with two servers running side by side. The refusal is the same `did not exit within 5s` message, and the old server keeps running and keeps its lock.

Restart is a full process replacement: the port is reassigned and connections are dropped. Prefer `reload` when the only thing that changed is the configuration.

## `sovrium reload`

```text
Usage: sovrium reload [options]
```

Re-read the configuration of a running server **without downtime**. Sovrium validates the file first and only signals the process once it decodes cleanly, so an invalid edit is rejected before it can reach the live server.

```bash
sovrium reload
sovrium reload --message "Add the invoices table"
```

`--message` records an operator note against the new configuration version, which then shows up in the app's migration history.

Because configuration is code-only, there is no runtime-edited schema for a reload to conflict with — the file on disk is always the truth. An invalid file stops the reload with `Error: Invalid configuration -` and the failing path and reason.

**Reload changes config, not code.** A new Sovrium version still needs `restart`, or a redeploy. `reload` re-reads your config file; it does not swap the binary.

## The status file

Every run writes `status.json` beside the lock file, describing what the instance is doing right now. The lock answers _is something running, and where_; the status file answers the question the lock cannot — **was my last edit taken?** — because a lock is rewritten identically whether a save landed or was thrown away.

It exists for the readers that are not watching the terminal: a supervising shell or desktop window, a CI step, or the AI that just rewrote the config in another process.

It sits in the same directory as the lock — `SOVRIUM_LOCK_DIR` when set, otherwise `SOVRIUM_DATA_DIR`, and `./.sovrium/` by default — so one variable moves both, and a reader that found one has found the other. Each write is atomic, a temp file then a rename, so a poller never observes a half-written document.

Just after boot:

```json
{
  "seq": 1,
  "state": "serving",
  "pid": 44051,
  "port": 5391,
  "configHash": "55435833ce83",
  "configPath": "/srv/invoices/app.yaml",
  "updatedAt": "2026-09-22T19:42:23.924Z"
}
```

| Field        | Meaning                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seq`        | A counter incremented on every write. A successful save begins and ends at `serving`, so a poller comparing `state` alone sees no change — `seq` is what tells it something happened |
| `state`      | `serving`, `rejected` or `down` — see below                                                                                                                                          |
| `pid`        | The instance's process id, the same value the lock file carries, so a reader can check the process is alive before trusting `port`                                                   |
| `port`       | The bound port. This is how a shell finds the app again after a restart-class reload rebinds it                                                                                      |
| `configHash` | Exactly the value the server sends as the `X-Sovrium-Config` response header, so a page in a browser and the file on disk can be compared directly                                   |
| `configPath` | Absolute path of the config root. Empty for an inline `APP_SCHEMA` config, which has no file                                                                                         |
| `updatedAt`  | ISO 8601 instant of this write                                                                                                                                                       |
| `lastReload` | Absent until the first save; from then on it describes the most recent one                                                                                                           |

### `state` and `lastReload.outcome` answer different questions

`state` says what the instance is doing **now**; `outcome` says what the last **save** did to it. The refused case is why both are needed: they read `rejected` and `kept` — the save failed, the server is fine and still serving the previous configuration. Nothing else a caller can observe says so, because the last-good server keeps answering `200` with a perfectly good page.

| `state`    | Meaning                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- |
| `serving`  | Serving, and the last save — if there was one — was applied                                  |
| `rejected` | Serving, and the last save was refused. The configuration on disk is **not** the one running |
| `down`     | Nothing is listening: a save failed, and the previous configuration would not boot either    |

`lastReload` carries `at`, the instant the verdict was reached; `kind`, either `hot` or `restart`, absent when the save never got far enough to be classified; `durationMs`; `outcome`; `phase`, one of `load`, `preflight` or `boot`, present on a failure only; and `findings`, in the same shape `sovrium validate --json` publishes. `phase` says where the save stopped, and that decides who has to act: `load` is the config, `boot` is the new server failing after the old one was stopped, and `preflight` is the checks that run **before** anything is stopped — so it always reads `kept`.

| `outcome`     | What happened to the listener                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `success`     | The save was applied                                                                            |
| `kept`        | Nothing was stopped — the previous configuration is still serving                               |
| `rolled-back` | The server was stopped, the new configuration would not boot, and the previous one was restored |
| `down`        | The rollback failed too. Nothing is listening                                                   |

Two things end a save at `preflight`: a change the live database would reject, and a database the checks could not reach at all. The second is a refusal rather than a shrug, because whatever stops a read of the database would also stop the running configuration booting again; the port keeps serving and `findings` names the database error. And **`findings` never carries your config's values** — same shape `sovrium validate --json` publishes, under the same rule: the position, the complaint and the expected shape, plus a rejected value only where it is a name checked against a closed list. This file sits on disk for the life of the instance, in a directory `SOVRIUM_LOCK_DIR` may point anywhere, so a mistyped `env:` block leaves no credential there — the terminal still prints the value.

A refused save, seen through the file. The server is still up on the same port, `configHash` still names the configuration that is actually running, and `findings` says what to fix:

```json
{
  "seq": 3,
  "state": "rejected",
  "pid": 44390,
  "port": 5392,
  "configHash": "8bef4c1355f2",
  "configPath": "/srv/invoices/app.yaml",
  "lastReload": {
    "at": "2026-09-22T19:42:46.460Z",
    "durationMs": 5,
    "outcome": "kept",
    "phase": "load",
    "findings": [
      {
        "path": "pages[0].components[0]",
        "message": "Unknown property 'tag' on component type 'text'",
        "severity": "error"
      }
    ]
  },
  "updatedAt": "2026-09-22T19:42:46.460Z"
}
```

### It is removed on shutdown

A clean stop unlinks the status file along with the lock, rather than leaving behind a record saying `stopped`. If the status file outlived the lock there would be a moment in which the lock says "no instance" and the status says `serving` — and a reader believes whichever was written last. An absent file is unambiguous and cannot go stale. To tell a clean stop from a crash, check whether `pid` is still alive, which a supervisor does anyway before trusting `port`.

The write is best-effort by design. A read-only lock directory or a full disk costs you a warning in the log and nothing else: an instance that refused to serve because it could not describe itself would be strictly worse than one with no status file at all.

### What the browser shows when a save is refused under `--watch`

A refused save changes nothing the page can observe — the previous version keeps serving, so it keeps rendering correctly. Under `--watch`, the dev server therefore pushes the refusal to every open tab over the live-reload connection the page already holds, and an overlay appears along the bottom of the window:

```text
Sovrium refused this save. The previous version is still running.
```

Under that headline, one block per finding: the message, the `path` it occurred at, the `sourceFile` when the config is split across `$ref` files, and the accepted values **in full**. Those are the things that let you — or the AI that made the edit — write the next one correctly.

The overlay sits _over_ the running app rather than replacing it, because the app really is still running and still usable. There is no dismiss button: the next accepted save reloads the page, which clears it. Like the rest of live reload it exists in development only, so a production build serves neither the endpoint nor the script.

Every save the instance **accepts** under `--watch` is also copied into the data directory, so the version before your last change is always recoverable without git. **Undo and Reset** describes the history and how to restore an entry.
