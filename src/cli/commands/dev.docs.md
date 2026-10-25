# The Dev Session

> `sovrium dev` boots your app on a fresh copy of its seed data, with an account to sign in with printed in the terminal and shown on every page, and reloads it on every save. One command, so you — or the AI agent working beside you — can open the printed address, sign in, and check each change against data you know.

## `sovrium dev`

```text
Usage: sovrium dev [config] [options]
```

Run it in the project directory. With no argument it finds the config the way `sovrium start` does: `app.yaml`, then `app.yml`, then `app.ts`.

```text
sovrium dev              # fresh data, the sign-in page opens in your browser
sovrium dev --no-open    # the same, without opening anything
```

Each run does the same things, in this order:

1. **Checks the config.** An invalid config stops here with the validation error, and nothing from the previous session is touched.
2. **Starts from a fresh state.** The dev data directory, `.sovrium/dev/`, is deleted and created again: its database, uploads, search index and history.
3. **Creates the dev account**, when the app declares `auth`.
4. **Loads the seed**, when a `seed/` folder sits beside the config. Every account in `seed/users.yaml` gets the dev password.
5. **Turns dev mode on** and boots the server with the watcher, exactly as `sovrium start --watch` does.
6. **Prints the session** and opens the browser.

Your project's own `.sovrium/` directory — the one `sovrium start` uses — is never read, wiped or written. The two sessions keep separate databases.

## What it prints

```text
✓ Dev session: crm — Ctrl-C stops it
→ App: http://localhost:3000
→ Admin: http://localhost:3000/_admin/login
→ Open: http://localhost:3000/login (opened)
→ Sign in: admin@crm.local / sovrium-dev-password
→ Data: /home/me/crm/.sovrium/dev (fresh: admin created, seed loaded)
→ Config: /home/me/crm/app.yaml
→ Status: /home/me/crm/.sovrium/dev/status.json
→ Next: edit the config, then read status.json (or `crm_config_status`) until `seq` advances
```

| Row       | What it tells you                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `App`     | The address the app answers on                                                                                           |
| `Admin`   | The operator console's sign-in, when the app has `auth`                                                                  |
| `Open`    | The page opened in your browser, or why none was                                                                         |
| `Sign in` | The account to sign in with, when the app declares `auth`                                                                |
| `Data`    | The dev data directory, and what was done to it: `fresh` with or without a seed, or `kept` (see **On PostgreSQL** below) |
| `Config`  | The file the watcher reloads on                                                                                          |
| `Status`  | The status file the server rewrites after every reload                                                                   |
| `Next`    | How to know an edit was applied                                                                                          |

The block is written for an agent as much as for you: every value it needs to continue is on one row, under a fixed label.

## The account

When the app declares `auth`, `sovrium dev` creates an admin named after the app — `admin@crm.local` for an app named `crm` — with the password `sovrium-dev-password`. Every account your `seed/users.yaml` lists takes the same password, so one password signs in as anyone the seed creates.

To use another password, set `SOVRIUM_DEV_PASSWORD` in the environment, for example in the project's `.env.local`. It is printed, shown and used in place of the default. A password shorter than the app's minimum length is refused before anything is deleted.

An app without `auth` has no account: the `Sign in` and `Admin` rows are left out, and the browser opens the home page.

## Dev mode

Every page the app serves carries a small panel at the bottom-left, saying the instance is in development mode, that its data is disposable, and which account to sign in with. On the sign-in page, its **Fill sign-in form** button fills the email and password into the form without submitting it. That is what lets an agent driving a browser — or you — sign in in one step.

`sovrium dev` sets the panel's five variables on every run. A value already in the environment wins, one variable at a time:

| Variable               | Set by `sovrium dev` to                                  |
| ---------------------- | -------------------------------------------------------- |
| `SOVRIUM_DEV_MODE`     | `on`                                                     |
| `SOVRIUM_DEV_NAME`     | the app's name                                           |
| `SOVRIUM_DEV_URL`      | the manual's page on Sovrium's website                   |
| `SOVRIUM_DEV_EMAIL`    | the dev account's email, when the app declares `auth`    |
| `SOVRIUM_DEV_PASSWORD` | the dev account's password, when the app declares `auth` |

The panel never shows the real administrator credentials of `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`, and `sovrium dev` does not set them. **Env Vars: Services** describes the same variables for an instance that turns dev mode on without `sovrium dev`.

### On a public address

Dev mode is not refused behind a public address — a hosted demo is exactly that — but it is announced. When dev mode is on and the public origin (the host of `BASE_URL`, else the address the server binds) is not a loopback host, the startup banner prints one warning naming the account every visitor can read:

```text
⚠ Dev mode is on while the public origin is app.example.com — the sign-in page shows admin@crm.local to every visitor; unset SOVRIUM_DEV_MODE before launch
```

When the public address is deliberate — a hosted preview of an app still in dev mode — set `SOVRIUM_DEV_PUBLIC=on` to say so. The startup banner then prints no warning, and the instance keeps itself out of search indexes: every response carries `X-Robots-Tag: noindex`, every page a `noindex` robots meta, and `/robots.txt` disallows the whole site. The variable has no effect unless `SOVRIUM_DEV_MODE` is on.

## Already running

Run `sovrium dev` again while a session is live and it does not start a second one. It prints the running session — its address, its account, its status — and exits `0`, leaving the data as it is:

```text
✓ Already serving this project (PID 48211)
→ App: http://localhost:3000
→ Sign in: admin@crm.local / sovrium-dev-password
→ Status: /home/me/crm/.sovrium/dev/status.json — serving, seq 4
⚠ Data kept — stop it (Ctrl-C, or SOVRIUM_DATA_DIR=.sovrium/dev sovrium stop) and run sovrium dev again for a fresh state
```

So an agent can run `sovrium dev` whenever it needs the address, without checking first. A session left behind by a crashed process is detected and replaced.

If the project is also running under `sovrium start`, the dev session boots beside it on another port, and an `Also serving` row names the other instance. They do not share data.

## The port

The port follows `sovrium start`'s rule: `3000`, or a free port when `3000` is taken and `PORT` is unset. The address therefore stays the same from one session to the next, and a second project moves aside on its own. Setting `PORT` makes the port strict: a busy port is then an error. There is no `--port` flag.

## The browser

By default `sovrium dev` opens the app's sign-in page in your browser, or its home page when the app declares no `auth` or no sign-in page. `--no-open` skips it. Over SSH, in a container, on CI, or with `BROWSER=none`, nothing is opened and the `Open` row prints the address instead. A server listening on a Unix socket opens nothing either.

## The editing loop

Edit the config and save. The watcher reloads the server and rewrites the status file with a higher `seq`; an edit the server refuses leaves the running app as it was and records the refusal in the same file. An agent editing through the config MCP reads the same answer from the `<app>_config_status` tool.

Sovrium runs no model and holds no AI key: the agent is yours, in your own client. `sovrium dev` only gives it a predictable app to look at and a way to know where everything is.

## On PostgreSQL

With `DATABASE_URL` set, the database is not on disk under `.sovrium/dev/`, and `sovrium dev` never drops anything. It keeps the database, creates the dev account if it is missing, and seeds only the tables that are empty. The `Data` row says `kept`, and a warning says how to reset:

```text
⚠ DATABASE_URL is set — dev did not reset this database (only empty tables were seeded); `sovrium seed --mode replace` resets the seeded tables; set SOVRIUM_ENCRYPTION_KEY so dev and start read one key
```

## Stopping it

Ctrl-C stops the session, and so does `SIGTERM` from whatever started it. `sovrium stop`, `sovrium reload` and `sovrium restart` look in the project's own `.sovrium/`, where a dev session is not; point them at the dev directory:

```text
SOVRIUM_DATA_DIR=.sovrium/dev sovrium stop
```

`sovrium restart` relaunches without the watcher; run `sovrium dev` again instead.

## When to use `sovrium start --watch` instead

`sovrium dev` throws its data away on every run, and shows an account on every page. Use `sovrium start --watch` when the data must survive between runs or other people can reach the app, and `sovrium start` under a supervisor for production. A deployed app never needs `sovrium dev`.
