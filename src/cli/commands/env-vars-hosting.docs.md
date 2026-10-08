# Environment Variables: Hosting Under a Supervisor

> A developer machine and a supervised host want opposite things from the same situation. These variables tell Sovrium which one it is running on.

Everything here is optional, and a server started by hand needs none of it. They matter once an app runs under something that restarts it — a systemd unit, a container orchestrator, a socket-activation proxy — with a reverse proxy or a load balancer in front that expects to find it in one exact place.

| Variable                    | Default       | Description                                                                                                                                |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `SOVRIUM_STRICT_PORT`       | unset         | `1` or `true` makes a busy default port refuse to start instead of falling back to a free one; implied under systemd                       |
| `SOVRIUM_LISTEN_UNIX`       | unset         | Path of a Unix socket to serve HTTP on instead of a TCP port, created with mode `0660`; refuses to start alongside a `PORT`                |
| `SOVRIUM_IDLE_EXIT_SECONDS` | unset (never) | Exit cleanly after this many seconds with no request, no running automation and no scheduled automation due; a whole number, at least `30` |
| `SOVRIUM_LOG_FORMAT`        | `text`        | `json` writes one JSON object per line instead of text; any other value but `text` refuses to start                                        |

## A busy port

Started by hand with no `PORT`, Sovrium binds `3000`, and if that is taken it binds a free port and prints the real URL — two apps side by side just work. Under a supervisor that fallback is an outage: the unit reports itself running while the proxy in front of it still targets the port it was configured with. So a busy port **refuses to start**, with exit code `1` and a message naming the port — and the process holding it, when the system can tell — whenever the port was chosen on purpose:

- `PORT` is set to a non-empty value;
- `SOVRIUM_STRICT_PORT` is `1` or `true`;
- `INVOCATION_ID` is set — systemd sets it for every unit, so a unit file is strict without saying so.

Nothing is written before the refusal: no migration has run, and there is no lock file and no status file. `PORT=0` still means any free port. `SOVRIUM_STRICT_PORT=0` or `false` leaves the decision to the other two signals; any other value refuses to start.

## The interface

The interface comes from `SOVRIUM_BIND_HOST`. `HOSTNAME` used to carry it, and still does while `SOVRIUM_BIND_HOST` is unset, with one warning per boot. It is being retired because shells and containers export the machine name under that name, which moves the server onto an address nobody chose — or onto one that does not resolve, so the boot fails. The bind also decides the transport posture described in **Env Vars: Core**, so `SOVRIUM_BIND_HOST=0.0.0.0` keeps exactly the posture `HOSTNAME=0.0.0.0` had. A value that is neither `localhost` nor an IP literal refuses to start.

## A Unix socket instead of a port

For socket-activated hosting, `SOVRIUM_LISTEN_UNIX` serves HTTP on a Unix socket instead of a port. The socket is created with mode `0660`, the lock file and the status file record `socketPath` in place of `port`, `sovrium stop` and `restart` work as usual, and a clean stop removes the socket file. A socket file left behind by a crashed instance is removed at the next start. Setting it together with `PORT` refuses to start, since there is only ever one listener. Links the server mints for itself have no host to name over a socket, so set `BASE_URL` to the public address the proxy serves.

## Exiting when idle

`SOVRIUM_IDLE_EXIT_SECONDS` lets an instance give its memory back when nobody is using it. Once that many seconds pass with no request in flight or recently finished, no automation running, and no scheduled automation or agent due within the window, the server stops exactly as it does on `SIGTERM` and exits `0`. A socket-activation proxy in front of it then starts it again on the next connection, which takes a few seconds. The engine's own maintenance schedules do not keep an instance awake; they catch up at the next start. An automation waiting on a delay is not running, and resumes then too. The value is a whole number of at least `30`; anything else refuses to start.

## JSON logs

`SOVRIUM_LOG_FORMAT=json` is for a log collector — journald with a JSON reader, Loki, Vector, a platform's log drain. Every line the server writes becomes one object, the startup banner included, with `time` (ISO 8601), `level`, `message` and the record's structured attributes as further keys — the access log's `request.id`, for one — after the same secret redaction the telemetry export applies. A multi-line block, such as the banner or an error's cause chain, stays one object, its line breaks escaped inside `message`. Debug and info go to stdout, warnings and errors to stderr, exactly as in text mode. It changes how a record is written, never which records are written: `LOG_LEVEL` still decides that.

```json
{
  "time": "2026-10-08T09:41:07.412Z",
  "level": "info",
  "message": "[server] listening on http://127.0.0.1:3000"
}
```

What dependencies print through the console is captured too — the stylesheet optimiser's warnings when the CSS is compiled at start, for one — with its terminal colours removed. Two things stay outside it: native code writing to the process streams directly, and the runtime's own report of a crash. The format applies to `sovrium start` alone; other commands keep printing text.

## Supervising other Sovrium apps

A machine can run many Sovrium apps, each as its own systemd unit, with one more app — the fleet agent — supervising them through the `instance` automation actions. These variables set the agent up; every other app leaves them unset.

| Variable                     | Default      | Description                                                                                                         |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `SOVRIUM_HOST_ACTIONS`       | unset (off)  | `1` or `true` enables the `instance` actions. With it set, an app that can run `code/runTypescript` refuses to boot |
| `SOVRIUM_INSTANCES_DIR`      | unset        | Directory holding one folder per supervised app: its releases, `current`, `env` and `status.json`                   |
| `SOVRIUM_BUNDLE_PUBLIC_KEYS` | unset        | `<id>:<base64>[,…]` — the Ed25519 public keys a release must be signed with, also read by `crypto/verify` `keyId`   |
| `SOVRIUM_SYSTEMCTL_PATH`     | `systemctl`  | The `systemctl` binary the actions run                                                                              |
| `SOVRIUM_JOURNALCTL_PATH`    | `journalctl` | The `journalctl` binary `instance/logs` runs                                                                        |

The switch is deliberately an environment variable and never a config key: a config cannot grant itself reach over the machine it runs on. Set it only on a host dedicated to supervising other Sovrium apps — the **Instance Actions** article lists what it allows and what it forbids.
