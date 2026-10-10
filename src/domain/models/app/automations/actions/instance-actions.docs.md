# Instance Actions

> Supervise other Sovrium apps running on the same machine — read their state, start and suspend them, apply a signed release, roll it back, probe them, read their logs, back them up, restore them and seed them — from an ordinary automation.

Every other action family works inside its own app. The `instance` family reaches the machine: it drives the systemd units of **other** Sovrium apps, each running as `sovrium-app@<slug>.service`. That is what lets a fleet agent be a Sovrium app like any other — a cron trigger that reads the desired state, loops over the apps, compares revisions and applies what changed — rather than a separate daemon.

Because it reaches the host, the family is off unless the operator switches it on, and an app using it cannot also run custom code.

```yaml
automations:
  - name: reconcile-crm
    trigger:
      type: cron
      expression: '*/30 * * * * *'
    actions:
      - name: crmState
        type: instance
        operator: status
        props:
          slug: crm
      - name: probe
        type: instance
        operator: health
        props:
          slug: crm
```

<!-- sovrium:options InstanceActionSchema -->

## Switching it on

| Variable                     | Meaning                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SOVRIUM_HOST_ACTIONS`       | `1` or `true` enables the family. Unset or empty, every instance action fails and the app refuses to boot |
| `SOVRIUM_INSTANCES_DIR`      | Directory holding one folder per supervised app: its releases, `current`, `env` and `status.json`         |
| `SOVRIUM_BUNDLE_PUBLIC_KEYS` | The keys a release must be signed with, as `<id>:<base64>[,…]` (32 raw Ed25519 bytes each)                |
| `SOVRIUM_SYSTEMCTL_PATH`     | The `systemctl` to run. Default: `systemctl` on the `PATH`                                                |
| `SOVRIUM_JOURNALCTL_PATH`    | The `journalctl` to run. Default: `journalctl` on the `PATH`                                              |

A value of `SOVRIUM_HOST_ACTIONS` other than `1`, `true` or empty, or a `SOVRIUM_BUNDLE_PUBLIC_KEYS` entry that is not an identifier, a colon and 32 bytes in base64, refuses the boot rather than switching anything off silently.

Without the switch, an instance action fails with _instance/\* is disabled; set SOVRIUM_HOST_ACTIONS=1 on a host dedicated to supervising other Sovrium apps_, and an app declaring one — at any depth, in a branch, a loop or an action template — refuses to start with the same sentence.

### What the switch also forbids

With the switch on, an app that can run `code/runTypescript` — a step, an action template, or an agent granted that tool — refuses to start. A code step can call any action through `context.actions`, so on a supervising host the sandbox would be the only thing between a script and the machine's process supervisor. Keep the agent that supervises in its own app, with no code.

No instance action can be granted to an AI agent, whatever the switch says.

### The slug is the only thing that reaches a command line

`slug` is 2 to 28 lowercase letters, digits and `-`, starting and ending with a letter or a digit. The host runs each app as the system user `sa-<slug>`, and systemd refuses a user name longer than 31 characters, so 28 is the longest slug a host can run. Written literally it is checked when the config is read; written as one whole template — `'{{loop.item.slug}}'` — its resolved value is checked before anything runs. A slug mixing text and a template (`app-{{x}}`) is refused.

## The units each operator touches

| Operator  | What it runs                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`  | `systemctl show --property=ActiveState,SubState,MainPID,NRestarts,MemoryCurrent,Result,ExecMainStatus,InvocationID sovrium-app@<slug>.service` |
| `start`   | `systemctl start sovrium-app@<slug>.socket` — the first request wakes the app                                                                  |
| `stop`    | `systemctl stop sovrium-app@<slug>.socket sovrium-proxy@<slug>.service sovrium-app@<slug>.service`                                             |
| `restart` | `systemctl stop sovrium-proxy@<slug>.service sovrium-app@<slug>.service`, then `systemctl start sovrium-app@<slug>.service`                    |
| `remove`  | as `stop`, then with `purge: true` deletes the app's folder under `SOVRIUM_INSTANCES_DIR`                                                      |
| `logs`    | `journalctl -u sovrium-app@<slug>.service --no-pager -n <lines>` (plus `--since=` when given)                                                  |
| `backup`  | `systemctl start sovrium-backup@<slug>.service`, then stores the archive it leaves                                                             |
| `restore` | `stop`, then `systemctl start sovrium-restore@<slug>.service`, then `start`                                                                    |
| `seed`    | `systemctl start sovrium-seed@<slug>.service`, then returns the report it leaves                                                               |

Only `start`, `stop` and `restart` are ever asked of systemd, which is what lets the host's policy grant the agent exactly those verbs on exactly these units and nothing else. Stopping the app alone is not a suspend — while its socket listens, the next request starts it again — so `stop` stops the socket first.

A restart is a stop, then a start — never `systemctl restart`. The proxy requires the app, so a plain restart of the app restarts the proxy too, and the proxy's own stop of the app — its idle exit — cancels the app's restart job: while the proxy runs, which it does for a live app once it has served a request, systemd answers `Job for sovrium-app@<slug>.service canceled.` and the step fails. Stopping the proxy and the app in one call makes both stops one transaction, into which the proxy's stop of the app merges; the app is then started alone, and the proxy comes back with the next request through the socket. The start waits up to 150 seconds — longer than the unit's own start limit plus the old process's stop — so the step reports systemd's verdict rather than giving up first. If the start fails once the stop has gone through, the step fails saying the app was stopped for the restart and could not be started again, followed by systemctl's own answer; its socket still listens, so the next request tries to start it again.

`status` answers `active` as one of `active`, `inactive`, `failed`, `activating`, `deactivating` or `unknown`, with `mainPid` and `memoryBytes` left out when systemd reports none. It also says how the unit's last run ended: `unitResult` is systemd's `Result` (`success`, `exit-code`, `signal`, `timeout`, …), `execMainStatus` the main process's exit status, and `invocationId` the id systemd gave the unit's current run — absent when systemd names none, on a unit not started since the host booted. The field is `unitResult`, not `result`, because `{{steps.<name>.result}}` already names a step's whole output. A command the host refuses fails the step with the unit's name and the refusal.

## Applying a signed release

`apply` writes a new release of an app from a bundle made by `sovrium bundle`, starts the app's socket, then restarts the app the way `restart` does:

```yaml
- name: release
  type: instance
  operator: apply
  props:
    slug: crm
    bundle:
      objectKey: '{{loop.item.objectKey}}'
    signature:
      keyId: cloud-2026
      algorithm: ed25519
      value: '{{loop.item.signature}}'
    revision: '{{loop.item.revision}}'
    env: '{{loop.item.env}}'
```

The bundle comes from storage (`objectKey`) or inline (`base64`). A stored bundle is read from the object store itself, so one another app wrote into a shared bucket is applied like one this app uploaded: the object's size is read from the store, and no catalog row is required. `signature.value` is a detached Ed25519 signature over the exact bytes of the bundle's `manifest.json`; it must verify against the key `keyId` names in `SOVRIUM_BUNDLE_PUBLIC_KEYS`, and every entry must then match the manifest's size and sha256. Before either check, the bundle may weigh at most 100 MiB stored and unpack to at most 256 MiB — it is inflated against that cap, never unpacked whole — and the manifest is read and its signature checked before any other entry. A bundle failing any of these fails the step and nothing is written.

The release is written whole under `rev-<revision>/` and only then made `current`; the `env` file is written with mode 0640, one `NAME="value"` line per variable with `"`, `\`, `` ` `` and `$` escaped, so systemd's `EnvironmentFile=` hands every value to the app unchanged — quotes, backslashes and surrounding spaces included — and `status.json` records the revision, the previous one, when each was applied (`appliedAt`, `previousAppliedAt`) and the release's `PORT`. Applying the revision already current answers `applied: false` and restarts nothing, so a reconcile loop can call it on every tick. `rollback` points `current` back at the previous release and restarts; rolling back twice returns to where it started. A rollback keeps each release's own time: `appliedAt` goes back to when the restored release was applied, the other one's becomes `previousAppliedAt`, and the moment of the swap is written as `rolledBackAt`, which the step also returns. The next `apply` dates itself and drops `rolledBackAt`. A `status.json` written by a version that recorded no `previousAppliedAt` has no time to give back, so the rollback then dates the restored release with the swap.

`revision` names a folder, so it is 1 to 64 letters, digits, `.`, `_` and `-`, not starting with `.` or `-`. Environment names are `UPPER_SNAKE_CASE`, and a value holding a line break is refused.

## Probing and reading logs

`health` sends `GET http://127.0.0.1:<port>/api/health` to the port the last `apply` recorded. The address is always loopback, so it never goes through the outbound URL checks an `http` step does. An app that does not answer is a successful step with `ok: false` to branch on. An app just restarted onto a release refuses connections until its server listens, so the probe asks again at a short interval until the app answers or `timeoutMs` (10 seconds by default) runs out; `latencyMs` is the whole wait, from the first attempt to the answer. The probe goes to the app's port, never through its socket, so it never wakes a suspended app: a suspended app is `ok: false`, however long the wait.

When the probe gets no healthy answer, its output also carries `journal`, so the run history shows why it failed without an extra `logs` step. It first asks `systemctl show --timestamp=unix --property=ActiveState,SubState,Result,ExecMainStatus,InvocationID,ExecMainStartTimestamp sovrium-app@<slug>.service`, and `journal` opens with one line saying what systemd reports, such as `sovrium-app@crm.service is failed (sub-state failed, result exit-code, main process exit status 1)`. The lines that follow, oldest first, belong to the current run only, measured against the release time — the last rollback's when one is recorded, else the last `apply`'s:

- when systemd names the unit's current run and its process started at or after the release time (compared in whole seconds), they are that run's lines: `journalctl _SYSTEMD_INVOCATION_ID=<id> + INVOCATION_ID=<id> --no-pager -n 50`, what its process printed and what systemd wrote about it;
- when that run started before the release, nothing is read, and the second line says `no process of sovrium-app@<slug>.service has started since <release time>` — the restart onto the release never happened, and quoting the old process would mislead;
- when systemd names no run (the unit has not started since the host booted), or `systemctl show` fails — the summary line is then left out — they are the unit's lines since the release time, `journalctl -u sovrium-app@<slug>.service --no-pager -n 50 --since=<release time>`, or over the last five minutes when no release time is recorded or the record cannot be read.

Asking systemd and reading the journal take at most 5 seconds each, and at most 16 KiB of lines are kept, dropping the oldest first; a newest line longer than that alone is cut to fit and kept. A healthy probe reads nothing and has no `journal`. If the journal cannot be read, `journal` is left out and the step still reports the app unhealthy. Reading from the release time needs systemd 255 or later.

`logs` returns the last `lines` (100 by default, at most 1000) the app wrote to the journal, optionally from `since` — an ISO 8601 date or date-time.

The `journal` of a health step and the `lines` of a logs step are shown only to admin-equivalent readers; anyone else allowed to read the run (whoever started it by hand, or an approver) sees the step and the rest of its output without those lines. This holds on every road that answers the run: its detail in the run history, the response to a manual trigger, and the MCP tools that start a run. The lines stay admin-only even when a later step copies them — `{{steps.probe.journal}}` written into an alert's message is replaced by `***` for anyone but an admin, who still reads the run whole. The same goes for the run's own error and for the message of an approval request the run asks for.

## Backup and restore

A supervised app runs as its own system user, whose data the agent cannot read. So `backup` starts the one-shot unit `sovrium-backup@<slug>.service`, which runs `sovrium backup` as the app and leaves `backup/backup.tar.gz` in the app's folder; the step stores it at `destination.objectKey` in this app's storage and deletes the local copy. The app keeps running.

`restore` copies the archive from `source.objectKey` — read from the object store, whichever app wrote it — to `restore/restore.tar.gz` — a directory the agent sets to mode 2770 (0770 when its own sandbox refuses the setgid bit), so the app's group, which the restore unit runs in, can write to it — stops the app, starts `sovrium-restore@<slug>.service`, starts the app's socket again and deletes the copy. If the restore unit fails, the step fails and the app stays stopped, so a half-restored app is never served.

## Seeding

`seed` loads an app's seed data from the release it runs — the `seed/` folder `sovrium bundle` packed beside the config, under `current/`. Like a backup, it runs as the app: the step writes the run's options to `seed/request.json` in the app's folder — `seed/` set up as `restore/` is, so the app's group can write its report there — starts the one-shot unit `sovrium-seed@<slug>.service`, which runs `sovrium seed project/app.json --request … --report …` as the app, and returns the report that unit leaves — one entry per table, `seeded` with the rows created and updated or `skipped` with the rows already present, the lines `sovrium seed` prints, and the release's `revision` — then deletes both files.

```yaml
- name: seeded
  type: instance
  operator: seed
  props:
    slug: '{{loop.item.app}}'
    mode: '{{loop.item.mode}}'
    tables: '{{loop.item.tables}}'
    dryRun: '{{loop.item.dryRun}}'
```

`mode` is `if-empty` (the default), `upsert` or `replace`; `tables` restricts the run; `today` pins the day `{{today…}}` resolves against; `dryRun: true` reports the plan against the app's real data — a table that already holds rows is reported skipped — and writes nothing. The rows are written by the engine's own seeder, so no table webhook and no record automation fire.

The step's output is kept in the run history, so an invitation the seed files issue appears with its email and without its link, which would let anyone reading the history accept it. A release with no `seed/` folder fails the step before anything is started. Whatever the seeder refuses — an `upsert` on a table with no merge key, a seed file for a table the config no longer has — fails the step with the seeder's own message. The step takes no backup: an agent that runs a `replace` runs `backup` first.

Those three units are defined on the host beside `sovrium-app@.service`; the engine only starts them.
