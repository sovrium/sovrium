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

A port counts as busy when another process holds it on any address the bind host reaches, or on the wildcard of either family. So `localhost` is checked on both `127.0.0.1` and `::1`, and a holder listening on `0.0.0.0` or `::` refuses a boot on any host, as does a holder on either loopback when Sovrium itself binds a wildcard. An address the machine cannot bind at all, such as `::1` on a host without IPv6, is skipped rather than counted as busy.

## The interface

The interface comes from `SOVRIUM_BIND_HOST`. `HOSTNAME` used to carry it, and still does while `SOVRIUM_BIND_HOST` is unset, with one warning per boot. It is being retired because shells and containers export the machine name under that name, which moves the server onto an address nobody chose — or onto one that does not resolve, so the boot fails. The bind also decides the transport posture described in **Env Vars: Core**, so `SOVRIUM_BIND_HOST=0.0.0.0` keeps exactly the posture `HOSTNAME=0.0.0.0` had. A value that is neither `localhost` nor an IP literal refuses to start.

## A Unix socket instead of a port

For socket-activated hosting, `SOVRIUM_LISTEN_UNIX` serves HTTP on a Unix socket instead of a port. The socket is created with mode `0660`, the lock file and the status file record `socketPath` in place of `port`, `sovrium stop` and `restart` work as usual, and a clean stop removes the socket file. A socket file left behind by a crashed instance is removed at the next start. Setting it together with `PORT` refuses to start, since there is only ever one listener. Links the server mints for itself have no host to name over a socket, so set `BASE_URL` to the public address the proxy serves.

## A database that is not there yet

When the database is unreachable at boot — PostgreSQL stopped, restarting or in crash recovery — the server does not exit. It binds its port and answers `503` on every route while it retries the connection, after one second and then at doubling intervals up to every 30 seconds: `/api/health` and `/api/health?probe=db` report `{ "status": "degraded", "checks": { "db": "error" } }`, API routes return the `SERVICE_UNAVAILABLE` error envelope, pages a short unavailable page, all with a `Retry-After` header. Nothing is migrated and no automation runs until the database answers; then the boot completes in place and the same process turns healthy, with no restart and on the same port.

The `listening on` line prints as soon as the port is held, suffixed `(degraded: database unreachable)`. A unit's readiness probe should therefore accept `503` as "started" — an `ExecStartPost` loop that only passes on `200` would fail the unit and restart it into the same state. A refused configuration or an unsupported `DATABASE_URL` still exits `1`: only an unreachable database degrades.

## Exiting when idle

`SOVRIUM_IDLE_EXIT_SECONDS` lets an instance give its memory back when nobody is using it. Once that many seconds pass with no request in flight or recently finished, no automation running, and no scheduled automation or agent due within the window, the server stops exactly as it does on `SIGTERM` and exits `0`. A socket-activation proxy in front of it then starts it again on the next connection, which takes a few seconds. The engine's own maintenance schedules do not keep an instance awake; they catch up at the next start. An automation waiting on a delay is not running, and resumes then too. The value is a whole number of at least `30`; anything else refuses to start.

## A memory limit

On Linux the runtime sizes its heap against the limit of the container or the systemd unit (`MemoryMax=`) it runs in, but that limit covers the whole process, not only the heap. On a small limit, lower `ECO_PAGE_CACHE_MAX_MB` (default `64`), and leave headroom for the database and the native buffers by setting `BUN_JSC_forceRAMSize` to about three quarters of the limit, in bytes (`402653184` under 512 MiB): the heap is then sized against that figure instead. The operations manual's **Database Infrastructure** article, under "Running in a small container", explains the trade-offs. Code steps run inside the same process and under the same limit.

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

## Signing in with Sovrium Cloud

An app hosted on Sovrium Cloud receives `SOVRIUM_PLATFORM_SSO_ISSUER`, `SOVRIUM_PLATFORM_SSO_CLIENT_ID`, `SOVRIUM_PLATFORM_SSO_CLIENT_SECRET` and, for the first admin, `SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT`: they let its owner open the console with their Cloud account. The Cloud sets them; a self-hosted app leaves them unset, and setting only some of them refuses to boot. The **User Management** article describes what they do.

## Framing and private previews

Two switches let you show an app inside your own dashboard, or keep a staging instance private. Both are read once at start, so changing either means a restart; unset, nothing about the app's responses, cookies or log changes.

| Variable                  | Default                                 | Description                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOVRIUM_FRAME_ANCESTORS` | unset (no other site may frame the app) | Space-separated origins allowed to show the app in a frame, such as `https://editor.example.com`. Each is `https://host` or `https://host:port`, or `http://localhost` / `http://127.0.0.1` with an optional port |
| `SOVRIUM_PREVIEW_TOKEN`   | unset (no gate)                         | A secret of at least 32 characters. Set, the app answers `404` to every request that does not carry it, except a health probe from the machine itself                                                             |

A framing value with a path, a wildcard host, `*`, a keyword such as `'self'`, an `http://` origin other than localhost, or nothing at all stops the start with one line naming the variable and the entry, for instance `SOVRIUM_FRAME_ANCESTORS: "https://editor.example.com/app" is not an origin (no path allowed)`.

With `SOVRIUM_PREVIEW_TOKEN` set, a visitor meets the app like this:

1. Without the token, every address answers `404` with the platform's plain not-found answer — never your app's own `/404` page, which would show its name and navigation — and no cookie. A wrong token gets the same answer, and nothing says a token exists.
2. Opening `https://<host>/<path>?preview=<token>` redirects to the same address without `preview`, other query parameters kept, and sets the cookie `__Host-sovrium-preview` (`Secure; HttpOnly; SameSite=None; Path=/`). The address bar and the history no longer carry the token.
3. From then on the browser is admitted for the life of that cookie, and the app behaves as without the gate, its own sign-in and permissions included. `/_admin` still asks for the console's own sign-in.
4. Restarting with a different token turns every cookie issued for the old one away.

Without the token, every page, static and public file, everything under `/api` (`/api/auth/*` included), WebSocket and realtime channels, event streams, `/mcp`, inbound webhook addresses (a preview receives no third-party events), `robots.txt` and the sitemap answer `404`. The one exemption is `GET /api/health` asked from the machine itself — from `127.0.0.1` or `::1`, with no `Forwarded`, `X-Forwarded-For` or `X-Real-IP` header — so the supervisor can probe it; it then answers liveness without the app's name. Behind a reverse proxy on the same host, have the proxy set `X-Forwarded-For` (or `Forwarded`) on every request it relays: otherwise a stranger's request reaches the app from `127.0.0.1` and the exemption answers the health probe publicly. Every response carries `X-Robots-Tag: noindex`, every page `<meta name="robots" content="noindex">`, and `robots.txt` disallows everything.

The cookie needs HTTPS: browsers accept `Secure` cookies on `http://localhost`, so the flow works in development, but not over plain HTTP to any other host. A token shorter than 32 characters stops the start with `SOVRIUM_PREVIEW_TOKEN must be at least 32 characters`. The start-up banner says `Preview: only requests carrying the preview token are answered`; the token never appears in a log line or an error, and the access log writes `?preview=***`. With both variables set, your page frames the preview at `?preview=<token>`, and the cookie works inside that frame.

## Supervising other Sovrium apps

A machine can run many Sovrium apps, each as its own systemd unit, with one more app — the fleet agent — supervising them through the `instance` automation actions. These variables set the agent up; every other app leaves them unset.

| Variable                       | Default                    | Description                                                                                                         |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `SOVRIUM_HOST_ACTIONS`         | unset (off)                | `1` or `true` enables the `instance` actions. With it set, an app that can run `code/runTypescript` refuses to boot |
| `SOVRIUM_INSTANCES_DIR`        | unset                      | Directory holding one folder per supervised app: its releases, `current`, `env` and `status.json`                   |
| `SOVRIUM_BUNDLE_PUBLIC_KEYS`   | unset                      | `<id>:<base64>[,…]` — the Ed25519 public keys a release must be signed with, also read by `crypto/verify` `keyId`   |
| `SOVRIUM_SYSTEMCTL_PATH`       | `systemctl`                | The `systemctl` binary the actions run                                                                              |
| `SOVRIUM_JOURNALCTL_PATH`      | `journalctl`               | The `journalctl` binary `instance/logs` runs                                                                        |
| `SOVRIUM_ENGINES_DIR`          | `/var/lib/sovrium/engines` | The engine store: one `<version>/sovrium` per Sovrium release a supervised app runs on                              |
| `SOVRIUM_UPDATE_DOWNLOAD_HOST` | `github.com`               | Host Sovrium releases are downloaded from, by `instance/engineInstall` and `sovrium update`, reached over HTTPS     |

The switch is deliberately an environment variable and never a config key: a config cannot grant itself reach over the machine it runs on. Set it only on a host dedicated to supervising other Sovrium apps — the **Instance Actions** article lists what it allows and what it forbids.

## An app that resets itself

A demo, sandbox or training app can bring itself back to its seed from one of its own automations, with the `app/seed` action. Whether it may is decided by the host:

| Variable            | Default     | Description                                                                                                                                                                          |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SOVRIUM_SELF_SEED` | unset (off) | Switches on the `app/seed` automation action: `reset` allows every mode, any other value allows `if-empty` and `upsert` only; unset, an automation holding the step is not scheduled |

Like the switch above, it is an environment variable and never a config key: a template that ships a nightly reset must not wipe the data of an app built from it. An automation whose step the variable does not allow is not scheduled at all, and the server names it once at boot — the **App Actions** article has the details.
