# Instance Actions

> Supervise other Sovrium apps running on the same machine — read their state, start and suspend them, apply a signed release, roll it back, probe them, read their logs, back them up and restore them — from an ordinary automation.

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

| Operator  | What it runs                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `status`  | `systemctl show --property=ActiveState,SubState,MainPID,NRestarts,MemoryCurrent sovrium-app@<slug>.service` |
| `start`   | `systemctl start sovrium-app@<slug>.socket` — the first request wakes the app                               |
| `stop`    | `systemctl stop sovrium-app@<slug>.socket sovrium-proxy@<slug>.service sovrium-app@<slug>.service`          |
| `restart` | `systemctl restart sovrium-app@<slug>.service`                                                              |
| `remove`  | as `stop`, then with `purge: true` deletes the app's folder under `SOVRIUM_INSTANCES_DIR`                   |
| `logs`    | `journalctl -u sovrium-app@<slug>.service --no-pager -n <lines>` (plus `--since=` when given)               |
| `backup`  | `systemctl start sovrium-backup@<slug>.service`, then stores the archive it leaves                          |
| `restore` | `stop`, then `systemctl start sovrium-restore@<slug>.service`, then `start`                                 |

Only `start`, `stop` and `restart` are ever asked of systemd, which is what lets the host's policy grant the agent exactly those verbs on exactly these units and nothing else. Stopping the app alone is not a suspend — while its socket listens, the next request starts it again — so `stop` stops the socket first.

`status` answers `active` as one of `active`, `inactive`, `failed`, `activating`, `deactivating` or `unknown`, with `mainPid` and `memoryBytes` left out when systemd reports none. A command the host refuses fails the step with the unit's name and the refusal.

## Applying a signed release

`apply` writes a new release of an app from a bundle made by `sovrium bundle`, then restarts it:

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

The release is written whole under `rev-<revision>/` and only then made `current`; the `env` file is written with mode 0640, one `NAME="value"` line per variable with `"`, `\`, `` ` `` and `$` escaped, so systemd's `EnvironmentFile=` hands every value to the app unchanged — quotes, backslashes and surrounding spaces included — and `status.json` records the revision, the previous one and the release's `PORT`. Applying the revision already current answers `applied: false` and restarts nothing, so a reconcile loop can call it on every tick. `rollback` points `current` back at the previous release and restarts; rolling back twice returns to where it started.

`revision` names a folder, so it is 1 to 64 letters, digits, `.`, `_` and `-`, not starting with `.` or `-`. Environment names are `UPPER_SNAKE_CASE`, and a value holding a line break is refused.

## Probing and reading logs

`health` sends `GET http://127.0.0.1:<port>/api/health` to the port the last `apply` recorded. The address is always loopback, so it never goes through the outbound URL checks an `http` step does. An app that does not answer is a successful step with `ok: false` to branch on; the default wait of 10 seconds covers an app the probe wakes from suspension.

When the probe gets no healthy answer, its output also carries `journal`: the app's latest journal lines, oldest first, so the run history shows why it failed without an extra `logs` step. They are read with `journalctl -u sovrium-app@<slug>.service --no-pager -n 50 --since=<applied-at>`, from the moment the last `apply` recorded (the last five minutes when none was recorded or the record cannot be read), within 5 seconds, and at most 16 KiB of them are kept, dropping the oldest first; a newest line longer than that alone is cut to fit and kept. A healthy probe reads nothing and has no `journal`. If the journal cannot be read, `journal` is left out and the step still reports the app unhealthy. Reading from the release time needs systemd 255 or later.

`logs` returns the last `lines` (100 by default, at most 1000) the app wrote to the journal, optionally from `since` — an ISO 8601 date or date-time.

The `journal` of a health step and the `lines` of a logs step are shown only to admin-equivalent readers; anyone else allowed to read the run (whoever started it by hand, or an approver) sees the step and the rest of its output without those lines. This holds on every road that answers the run: its detail in the run history, the response to a manual trigger, and the MCP tools that start a run. The lines stay admin-only even when a later step copies them — `{{steps.probe.journal}}` written into an alert's message is replaced by `***` for anyone but an admin, who still reads the run whole. The same goes for the run's own error and for the message of an approval request the run asks for.

## Backup and restore

A supervised app runs as its own system user, whose data the agent cannot read. So `backup` starts the one-shot unit `sovrium-backup@<slug>.service`, which runs `sovrium backup` as the app and leaves `backup/backup.tar.gz` in the app's folder; the step stores it at `destination.objectKey` in this app's storage and deletes the local copy. The app keeps running.

`restore` copies the archive from `source.objectKey` — read from the object store, whichever app wrote it — to `restore/restore.tar.gz` — a directory the agent sets to mode 2770 (0770 when its own sandbox refuses the setgid bit), so the app's group, which the restore unit runs in, can write to it — stops the app, starts `sovrium-restore@<slug>.service`, starts the app's socket again and deletes the copy. If the restore unit fails, the step fails and the app stays stopped, so a half-restored app is never served.

Those two units are defined on the host beside `sovrium-app@.service`; the engine only starts them.
