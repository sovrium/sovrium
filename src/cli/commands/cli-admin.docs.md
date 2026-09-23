# Admin & Maintenance

> Commands you run against a deployment rather than against a config: create the account that can sign in, produce and settle the secrets the environment needs, and upgrade the binary in place.

## `sovrium admin create`

```text
Usage: sovrium admin create <email> [config] [options]
```

Provision an admin user directly in the database. This is the bootstrap path — it needs no running server and no full config.

```bash
sovrium admin create me@example.com                             # prompt for the password
sovrium admin create me@example.com --password 's3cret-pass'    # CI, provisioning scripts
sovrium admin create me@example.com app.yaml                    # resolve auth from a config
```

The password is prompted for with echo disabled unless `--password` is supplied. The auth configuration is resolved in order: the config path given as the **fourth positional argument**, after the verb and the email, then `APP_SCHEMA`, then a minimal built-in default — so the bare form works with no config file at all. There is no `--config` flag, and passing one is refused before the command runs. Migrations run first, so this also works against an empty database.

Two things to know before scripting it:

- **No TTY and no `--password` is an error.** In a non-interactive shell you must pass `--password`, or the command exits `1` rather than hanging on a prompt.
- **It is idempotent.** If the email already has an account, nothing is changed.

If the resolved config has no `auth` block, the command refuses and tells you to add one.

## `sovrium secret generate`

```text
Usage: sovrium secret generate [scope]
```

Print freshly generated, cryptographically random secrets as paste-ready `.env` lines. Each is 256 bits, rendered as 64 hexadecimal characters. The `scope` positional is `auth`, `encryption` or `all`, and defaults to `all`.

```bash
sovrium secret generate                  # AUTH_SECRET + SOVRIUM_ENCRYPTION_KEY
sovrium secret generate auth >> .env     # append just AUTH_SECRET
sovrium secret generate encryption       # the encryption key only
```

**Nothing is written to disk.** The `.env` lines go to stdout — so redirection works cleanly — and the explanatory notes go to stderr. Sovrium never silently persists a credential somewhere it might get committed.

Neither secret has to be set. An unset `SOVRIUM_ENCRYPTION_KEY` is generated and kept in the data directory on first start, and `AUTH_SECRET` is derived from it. Generate them when you want to manage them yourself.

## `sovrium secret adopt`

Write the encryption key this process already has into `<data dir>/encryption-key`, where the server looks for it.

This is the one command that deliberately does persist a secret, and it exists for a single migration. A deployment that has always supplied `SOVRIUM_ENCRYPTION_KEY` cannot simply stop: the next start would find no key file, generate a fresh key, and quietly orphan every stored credential the old one protected. Adopting first makes removing the variable a no-op.

```bash
export SOVRIUM_ENCRYPTION_KEY=<the key currently in use>
sovrium secret adopt
```

```text
Encryption key adopted — written to /srv/app/.sovrium/encryption-key (mode 0600)
```

Three outcomes, and the third is the point:

- **Nothing in the environment** — refuses, naming the variable it expected. Nothing is written.
- **The same key is already persisted** — says so and exits `0`, so a deploy script can run it on every release.
- **A different key is already stored** — refuses and leaves the file untouched.

Overwriting a different key would make everything encrypted under the stored one unreadable, and only you know which of the two is authoritative. Keep the persisted key by unsetting the variable, or delete the file first if the environment holds the key your data was actually encrypted with.

**Back up the file.** After adopting, `<data dir>/encryption-key` is the only copy of the key. Losing it makes every stored connection token unreadable, and the affected users have to reconnect.

## `sovrium update`

```text
Usage: sovrium update
```

Update Sovrium to the latest release. What happens depends on how it was installed, which the command detects for you:

- **binary** — self-replaces from GitHub Releases, on Unix.
- **homebrew** — delegates to `brew upgrade sovrium/tap/sovrium`.
- **scoop** — delegates to `scoop update sovrium`.
- **docker** — prints the `docker pull` instruction.
- **desktop** — declines, and points at the app that owns it.

Delegating to Homebrew and Scoop rather than self-replacing is deliberate: it keeps the package manager's own version ledger correct. Docker containers cannot self-update, so that path prints the pull command instead.

Detection is overridable with `SOVRIUM_INSTALL_METHOD`, which honours those five names and ignores anything else. A raw Windows binary that Scoop does not manage is pointed at Scoop or Docker rather than attempting to overwrite a running `.exe`.

### Inside the Sovrium app

The desktop app supervises this binary as a sidecar and carries its own updater, so it sets `SOVRIUM_INSTALL_METHOD=desktop` and `sovrium update` steps aside:

```console
$ sovrium update
Sovrium is running inside the Sovrium app, which keeps it up to date for you.

Nothing was changed. To update, open the Sovrium app and use its own
update check — it replaces the app and this engine together, so the two
never end up on different versions.
```

It replaces nothing — no download, no package manager, no rename — and it reaches neither the network nor a package manager on the way. Two updaters racing leaves a shell and a sidecar on different versions, each expecting a command surface the other does not have.

It exits **`0`**, exactly as the `docker` branch does. Both are the same shape of answer — _this install is managed elsewhere, and here is where_ — and both leave the system in the state you asked for. A non-zero exit would make a wrapper script treat a correct refusal as a failure, and would tell a desktop user their app is broken when it is not.

The same marker silences the background "a newer version is available" notice: a prompt to run a command that will decline is worse than silence, and the app surfaces available updates in its own interface.
