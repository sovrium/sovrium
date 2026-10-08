# Environment Variables: App, Server and Database

> Infrastructure configuration is read from the environment, never from the app config — the schema describes your application, the environment describes the machine it runs on.

Set these in a `.env` file beside your config, or in your host's environment. **Everything is optional.** Starting an app boots zero-config with embedded SQLite, local file storage, and an encryption key the app generates for itself. The one variable worth a decision before you deploy is the encryption key.

```bash
PORT=3000
BASE_URL=https://myapp.example.com
NODE_ENV=production
TRUSTED_PROXY_HOPS=1
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SOVRIUM_ENCRYPTION_KEY=<64 hex characters>
```

That is a complete deployed configuration — one secret, not two.

The variables here are the app's own settings: the server it binds, the database it opens, and the two secrets that protect it. The _paths_ — the project directory a supervisor hands over, and the data directory the engine writes into — are in **Env Vars: Directories**. Storage, AI, email and observability are in **Env Vars: Services**, and running under a supervisor in **Env Vars: Hosting**.

## Application and server

| Variable                                | Default                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_SCHEMA`                            | —                       | The config as inline JSON, inline YAML, or a remote URL, instead of a file path                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `APP_SCHEMA_FILE`                       | —                       | A path to the config, for a document too large to pass inline                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PORT`                                  | `3000`                  | Port to bind, 1 to 65535, or `0` for any free port. A port set here that another process holds refuses to start                                                                                                                                                                                                                                                                                                                                                                                 |
| `SOVRIUM_BIND_HOST`                     | `localhost`             | Network interface to bind: `localhost` or an IP literal such as `127.0.0.1`, `0.0.0.0` or `::`; anything else, a machine name included, refuses to start. `HOSTNAME`, its deprecated spelling, is still honoured while this is unset, with one warning per boot                                                                                                                                                                                                                                 |
| `BASE_URL`                              | `http://localhost:PORT` | Canonical public origin, used for auth callbacks, email links and OAuth issuer URLs, and for every URL a crawler reads: sitemap `<loc>` entries and the `Sitemap:` line of `robots.txt`, `hreflang` alternates on a page with no absolute `canonical`, `llms.txt` links and synthesised article JSON-LD. Without it those fall back to the request's host, and a page with no absolute `canonical` publishes no `hreflang` alternates at all — a multi-language app says so in one boot warning |
| `NODE_ENV`                              | unset                   | Set to `production` on every deployed instance                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TRUSTED_PROXY_HOPS`                    | `0`                     | How many reverse proxies sit in front of the app, 0 to 10                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `API_IP_RATE_LIMIT`                     | `1200`                  | API requests allowed per client address per `RATE_LIMIT_WINDOW_SECONDS` window, ahead of every session lookup; raise it when many users share one address                                                                                                                                                                                                                                                                                                                                       |
| `RATE_LIMIT_WINDOW_SECONDS`             | `60`                    | Length in seconds of the window every per-address rate limit counts in (sign-in, mail-sending auth routes, records, activity, the API ceiling); a whole number above zero, anything else refuses to start                                                                                                                                                                                                                                                                                       |
| `SOVRIUM_ADMIN`                         | `on`                    | `off` unmounts the operator console everywhere, whatever the config declares                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `SOVRIUM_ALLOW_INSECURE`                | unset                   | `1` or `true` (any case) relaxes CSRF enforcement and secure cookies on any bind, loopback or not, and also opens private and loopback outbound targets; any other non-empty value, `0` and `false` included, refuses to start                                                                                                                                                                                                                                                                  |
| `SOVRIUM_TIMEZONE`                      | `UTC`                   | IANA zone every scheduled and displayed time defaults to, e.g. `Europe/Paris`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `SOVRIUM_DEV_CLOCK`                     | unset                   | Development only: an ISO 8601 instant the server answers every "today" and "now" at; refused when `NODE_ENV=production`                                                                                                                                                                                                                                                                                                                                                                         |
| `SOVRIUM_NOTIFY_AUTOMATIONS`            | `on`                    | `off` stops the automation-failure email for the whole instance                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `SOVRIUM_NOTIFY_TO`                     | unset                   | Comma-separated extra addresses that receive the operator emails                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SOVRIUM_AUTOMATION_AUTOPAUSE`          | unset                   | Pause an automation after this many final failures in a row; unset never pauses                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `SOVRIUM_NOTIFY_DIGEST`                 | `weekly`                | `off` stops the weekly summary email for the whole instance                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SOVRIUM_NOTIFY_DIGEST_CRON`            | `0 8 * * 1`             | When the weekly summary goes out, as a five-field cron expression in the operator timezone                                                                                                                                                                                                                                                                                                                                                                                                      |
| `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` | `900000`                | How long a run of an automation that sets no `timeout` may execute, in milliseconds, 1000 to 3600000                                                                                                                                                                                                                                                                                                                                                                                            |

### The operator timezone

`SOVRIUM_TIMEZONE` names one IANA zone, such as `Europe/Paris`, and it is the default for every timed feature that names no zone of its own: cron triggers, agent schedules, `date` actions, template date helpers, the display formatting of records and the calendar day behind retention windows. Unset, it is `UTC`.

An explicit `timezone` always wins over it — on a cron trigger, an agent schedule, a `date` action, or the `timezone` parameter of a `?format=display` request. The variable is only the fallback.

The value is validated at boot: an unknown zone refuses to start the server, naming the variable and the value, rather than silently falling back to UTC and moving every schedule. POSIX `TZ` is ignored on purpose — it belongs to the host image, and a base-image change must not move your reports. Changing `SOVRIUM_TIMEZONE` takes effect on the next restart.

### The development clock

`SOVRIUM_DEV_CLOCK` is for development only. It holds an ISO 8601 instant, such as `2026-09-24T10:00:00+02:00` or the date `2026-09-24`, and the server answers every "today" and "now" at that instant: the `$today` family of relative-date filters, a page's look-back `window`, a form's `$now` prefill, formulas over `CURRENT_DATE`, `NOW()` or another clock function computed when a record is written, the automation `{{today}}` and `{{now}}` helpers, and the year a `short-date` leaves out when the server writes it. A browser keeps its own clock. A date-time without an offset is read as UTC.

What records what happened stays on the real clock: a record's `created_at` and `updated_at`, session and approval expiry, and the moment a scheduled automation fires. The calendar and timeline open on the browser's today.

Use it to review an app seeded on one day as it looked that day, without your Overdue lists and schedules moving with the real date. It is refused at boot when `NODE_ENV=production`, and when the value is not an ISO 8601 instant, naming the variable. A formula already stored keeps the value it was computed with; unsetting the variable rebuilds the formula triggers on the real clock at the next start.

### Operator emails

When an automation fails after its last retry, or times out, Sovrium emails the instance's admin-tier accounts that left **Automation alerts** on in their profile. `SOVRIUM_NOTIFY_TO` adds addresses to that audience — an on-call inbox, a shared ops mailbox — and is the only audience of an app with no `auth:` block. `SOVRIUM_NOTIFY_AUTOMATIONS=off` stops the email for the whole instance.

The same recipients are told when a run is interrupted by a restart, receive one hourly summary of the failures held back after an automation's first alert, and are emailed when an automation is paused or resumed. `SOVRIUM_AUTOMATION_AUTOPAUSE=<n>` makes the platform pause an automation itself after `n` final failures in a row; unset, nothing is ever paused automatically.

Once a week — `SOVRIUM_NOTIFY_DIGEST_CRON`, Mondays at 08:00 in `SOVRIUM_TIMEZONE` by default — the admin-tier accounts that left **Weekly summary** on, plus `SOVRIUM_NOTIFY_TO`, receive a summary of the instance: automation runs and failures, rows per table, new accounts, submissions, uploads, database and storage size, audit errors, and what is waiting on an operator, each compared with the week before. It never carries a record value, an email address or a name. A week missed while the server was down is caught up with one summary at the next boot. `SOVRIUM_NOTIFY_DIGEST=off` stops it for the whole instance. **Operator Notifications** describes both emails in full.

All five are validated at boot: `SOVRIUM_NOTIFY_AUTOMATIONS` accepts only `on` or `off`, `SOVRIUM_NOTIFY_DIGEST` only `weekly` or `off`, every entry of `SOVRIUM_NOTIFY_TO` must be an email address, `SOVRIUM_AUTOMATION_AUTOPAUSE` must be a positive whole number, and `SOVRIUM_NOTIFY_DIGEST_CRON` a five-field cron expression. A wrong value refuses to start the server, naming the variable and the value, rather than failing silently when the first alert is due. Set `BASE_URL` too: it is what makes the links in those emails absolute.

### Automation run timeout

A run of an automation that sets no `timeout` of its own is stopped as `timed-out` after `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` — fifteen minutes unless the variable says otherwise. Only active execution counts: the time a run waits for a concurrency slot is not part of it. The value is validated at boot like the others: anything but a whole number of milliseconds between 1000 and 3600000 refuses to start the server, naming the variable and the value.

Every five minutes, a sweep closes as `timed-out` any run still marked running a minute past its timeout — a run nothing will ever finish — and alerts it like any other timeout.

### Which config wins

Four sources can name the config, and the first that answers is the one that boots:

1. The path you pass — `sovrium start ./staging.yaml`
2. `APP_SCHEMA_FILE`
3. `APP_SCHEMA`
4. Auto-discovery in the project directory — `app.yaml`, then `app.yml`, then `app.ts`

Auto-discovery is last on purpose, so setting either variable cannot be quietly overridden by a file that happens to sit in the folder.

### Loading the config from a URL

When `APP_SCHEMA` holds a URL, that document becomes the whole application, so it is fetched under the same rules `sovrium init --from-url` applies. The address is checked before the request is made — private, loopback and link-local targets are refused — and **every redirect it follows is checked again**, because you chose the address in `APP_SCHEMA` and the publisher chose where it goes next. A hop must be `https` and must not point somewhere the first check would have refused; up to five are followed, a longer chain is declined, and a refused hop fails the boot with a message naming it rather than starting the server on a document that came from somewhere you never named. `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` (or `true`; any other non-empty value refuses to start) relaxes the private-target rule, for the first address and every hop alike — which is what makes a schema served from inside your own network reachable at all. It does not permit a cleartext hop to a public host. The same variable lifts the address rule for every other outbound request — the http, webhook, file-source and connection actions, table webhooks and token requests — whose redirects are checked hop by hop as well, on `http` as on `https`; addresses are compared by value, so no IPv6 spelling of a private address gets past it.

### What `NODE_ENV=production` actually buys

It turns on immutable caching for content-hashed assets. With it, hashed island chunks are served for a year and other static assets for an hour. Without it every asset is returned `no-store`, and the browser refetches the whole bundle on every page view — roughly a twentyfold increase in requests per page for identical bytes.

**Transport security does not depend on it.** Secure cookies and CSRF enforcement are decided by the bind posture instead: a non-loopback `BASE_URL` or `SOVRIUM_BIND_HOST` forces them on, a loopback bind relaxes them so plain HTTP works in development. Set a real `BASE_URL` in production and the secure posture follows on its own.

The one override is `SOVRIUM_ALLOW_INSECURE`, which relaxes both on any bind, and the outbound private-address guard with them. It exists for a deployment terminating TLS somewhere Sovrium cannot see, and it is the single most dangerous variable here. It is read by **value**: `1` or `true` (any case) relaxes, unset or empty keeps the secure posture, and anything else (`0`, `false` and `no` included) refuses to start, so remove the variable to switch it off. Whenever it is accepted while the public origin is not loopback, the startup banner carries a `⚠` line naming it; the public origin is `BASE_URL` when set, otherwise the bind, so the line appears behind a reverse proxy too. A second `⚠` line names `BASE_URL` and the bind when the server binds a reachable interface (`SOVRIUM_BIND_HOST=0.0.0.0`) while `BASE_URL` is unset or loopback: links the server mints then fall back to the socket address, and a loopback `BASE_URL` keeps CSRF checks and `Secure` cookies relaxed on a server the network can reach. Set `BASE_URL` to the public origin and both lines go away.

### Taking the operator console away

Whether the console is served at all is an application decision, made in the config. It is also a **deployment** decision, and `SOVRIUM_ADMIN=off` is that switch: every console path then answers `404` — for a signed-in admin exactly as for an anonymous visitor — and the app boots normally.

It is deliberately not an error for the config to serve the console while the environment switches it off. The config is the application's general rule; the environment is this deployment's override, and a safety switch that refused to start would be an outage.

The variable accepts `on` and `off` and nothing else. `false` or `0` are **refused at startup**, naming the variable and the two values it takes — a kill switch that quietly declined to kill would be worse than none, because you would believe it.

### Redirecting a retired hostname

An app that moved behind a new canonical origin still receives requests on the old one, from bookmarks and inbound links nobody controls. Two variables turn those into a single permanent redirect, with no per-route map.

| Variable                       | Means                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `SOVRIUM_REDIRECT_HOST`        | The retired hostname to match, case-insensitively and with any port stripped |
| `SOVRIUM_REDIRECT_HOST_TARGET` | The path prefix matched requests land under; no trailing slash               |

```bash
SOVRIUM_REDIRECT_HOST=docs.example.com
SOVRIUM_REDIRECT_HOST_TARGET=/en/docs
```

A request whose host — `X-Forwarded-Host` behind a declared proxy (`TRUSTED_PROXY_HOPS`), `Host` otherwise — matches the retired name answers `301` to `BASE_URL` plus the target prefix plus the original path and query string. Both survive, so a deep link keeps working rather than landing everyone on a home page.

**Both variables must be set.** With either unset the middleware is a complete no-op, which is what keeps it inert on every deployment that never merged a domain. Set `BASE_URL` alongside them: without it the redirect origin is derived from the incoming request, which on a retired host is the host you are trying to leave.

It is a deployment fact rather than an application one — two operators running the same config have different domain histories — so it lives here and never in the config.

### Running behind a reverse proxy

Rate limits, spam guards and abuse counters need to know which client a request came from. Bound directly to a port, that is whoever opened the connection. Behind a proxy every request arrives from the proxy, and the real client address travels in a forwarding header — which the client can also send itself.

Proxies **append** to that header rather than replacing it, so anything the client supplied stays at the front and only the entries at the end were written by infrastructure you control. `TRUSTED_PROXY_HOPS` says how many entries at the end to believe. Until it is set, no forwarding header is believed for the client's address.

| Deployment                                        | Value |
| ------------------------------------------------- | ----- |
| Bound straight to a port                          | `0`   |
| Behind one proxy — Caddy, nginx, or a PaaS router | `1`   |
| A CDN in front of your own proxy                  | `2`   |

Leaving it unset on a proxied deployment is safe but blunt: every visitor resolves to the proxy's address, so they share one rate-limit budget and one visitor's burst throttles everybody. The first request carrying a forwarding header logs a one-time warning naming this variable.

**Setting it higher than the number of proxies you run is the case to avoid.** The count reaches that many entries back from the end, so an inflated value reaches into entries the client wrote — which lets a caller choose their own rate-limit bucket and slip the limits entirely. Count only the proxies you operate.

The same count governs the address an instance prints. Without `BASE_URL`, `$app.origin`, a sharing image given as a path, and sitemap and `llms.txt` links follow `X-Forwarded-Host` and `X-Forwarded-Proto` only when `TRUSTED_PROXY_HOPS` is at least `1`; at `0` they use the `Host` the request was sent to, over `http`. A forwarded scheme other than `http` or `https` is ignored, and so is a forwarded host that is not a host name — one carrying a path, a scheme, an `@` or markup. A request whose `Host` is not a host name is refused with `400`. A request with no `Host` at all (an HTTP/1.0 client) is served against the address the instance listens on. Setting `BASE_URL` settles the question.

## Database

| Variable            | Default        | Description                                        |
| ------------------- | -------------- | -------------------------------------------------- |
| `DATABASE_URL`      | unset (SQLite) | Connection string; the scheme selects the engine   |
| `DATABASE_POOL_MAX` | `10`           | PostgreSQL connection-pool size, ignored by SQLite |

The URL is scheme-discriminated, and anything unrecognised fails loudly at startup.

| Value                                               | Engine                                                       |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Unset or empty                                      | SQLite at `<data dir>/database.db` — the zero-config default |
| `postgresql://user:pass@host:5432/db`               | PostgreSQL; `postgres://` is equally accepted                |
| `file:./data/app.db`, `sqlite:./app.db`, `:memory:` | SQLite at that path; `:memory:` is ephemeral                 |

A bare filesystem path is rejected — prefix it with `file:`.

Sovrium turns PostgreSQL's JIT compilation off on the connections it opens. Its queries are short, and compiling them costs more than it saves. A connection pooler in front of the database can refuse that setting (a stock PgBouncer does); Sovrium then leaves JIT to the server and logs a warning at start-up, rather than failing to connect.

### Upgrading timestamp columns, on PostgreSQL

An explicitly written `created-at`, `updated-at` or `deleted-at` field now creates a `timestamptz` column, the same type the equivalent automatic columns have always used. Columns created by an older version are still `timestamp` without a zone, and they are not silently rewritten.

| Variable                                     | Default | Description                                                   |
| -------------------------------------------- | ------- | ------------------------------------------------------------- |
| `DATABASE_TIMESTAMPTZ_MIGRATION`             | off     | `on` converts those columns on the next start                 |
| `DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC` | off     | `1` allows the conversion when the database's zone is not UTC |

While it is off, every start logs one warning per affected column and changes nothing. Both column types serialise identically through the API, so leaving it off is safe indefinitely.

Turning it on rewrites each affected table under an exclusive lock, so treat it as a maintenance window on a large table. Every stored instant is preserved **provided the database's zone has been the same for the whole life of the data** — and if that zone is not UTC the start aborts, naming it. Two things become possible there that nothing can check for you: a zone changed at some point in the past, where rows on either side mean different instants and which is which is no longer recoverable; and the repeated hour when daylight saving ends, where up to one hour of rows per year may land an hour off. Acknowledge to proceed anyway, or pin the database to UTC first.

## Secrets

Two secrets protect an app: an encryption key for stored credentials, and a signing secret for sessions. Neither has to be set — the app provisions both — but **where the app runs decides whether that is enough**.

| Variable                 | Default                                    | Description                                                                  |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `SOVRIUM_ENCRYPTION_KEY` | Generated into `<data dir>/encryption-key` | Master key for stored credentials, and the root the auth secret derives from |
| `AUTH_SECRET`            | Derived from the encryption key            | Signs session cookies, tokens and signed URLs; 16 characters minimum         |

`sovrium secret generate` prints paste-ready lines to stdout and never writes them to disk.

The key resolves in three steps: the variable when set, and nothing is written to disk; then the file this install generated on an earlier start; otherwise 256 fresh bits written at mode `0600`. If the data directory cannot be written, the app refuses to start rather than run on a key it will forget. Every start reports which of the three it used — and **seeing "generated" on a restart rather than "from" means the previous key is gone** and everything encrypted under it is now unreadable.

### When to set it yourself

The generated key sits beside the SQLite database it protects, so on a persistent disk the two live and die together and nothing is left stranded. Local development and a single-server SQLite deployment need no key at all.

Set it explicitly whenever the key and the data it protects **do not share a fate**: an external database on a host whose filesystem resets on deploy or restart, or any deployment where the data directory is not a persistent volume. There the database outlives the key that encrypted it, so every stored connection token becomes unreadable on the next restart, and again on the one after. Sovrium says so at boot when it recognises the shape.

An install that already supplies the variable cannot simply unset it: the next start would find no key file, generate one, and orphan everything. `sovrium secret adopt` writes the key the process already has into the file the server reads, so removing the variable then changes nothing.

**Back the key up with the database.** A credential encrypted under a key you no longer have cannot be recovered — the affected users have to reconnect. Setting or rotating the auth secret signs every active session out.

### Seeding the first administrator

Both the email and the password must be set for seeding to happen at all.

| Variable              | Default         | Description                                     |
| --------------------- | --------------- | ----------------------------------------------- |
| `AUTH_ADMIN_EMAIL`    | —               | Email address of the seeded administrator       |
| `AUTH_ADMIN_PASSWORD` | —               | Password for that account, 8 characters minimum |
| `AUTH_ADMIN_NAME`     | `Administrator` | Display name                                    |
| `AUTH_ADMIN_ROLE`     | `admin`         | Role assigned to the account                    |

`sovrium admin create <email>` does the same job interactively, without putting a password in the environment.

### OAuth providers

Each provider configured in the auth block reads a credential pair named after it in uppercase — `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and so on. Five providers are accepted, and the list is closed: `google`, `github`, `microsoft`, `slack` and `gitlab`. Any other name is refused when the config is validated, so there is no credential pair to set for it. Callback URLs are derived from `BASE_URL`, so that must be right before OAuth works at all.
