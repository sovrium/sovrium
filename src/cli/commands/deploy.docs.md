# Deploy to a Sovrium Cloud

> Ship an app from your machine with `sovrium deploy`: the CLI finds or creates the app it deploys to, checks the variables it needs, bundles and uploads it, and ends only once the app answers at its address — then, if you ask, fills it with your seed data.

## `sovrium deploy`

```text
Usage: sovrium deploy [config] [--app <slug>] [options]
```

```bash
sovrium deploy                                  # app.ts, app.yaml… in the current directory
sovrium deploy --yes                            # in a script: create the app if it does not exist
sovrium deploy app.ts --app atelier-crm-staging --no-wait
sovrium deploy --env ./production.env           # set the app's variables from that file first
sovrium deploy --seed                           # then fill the empty tables from seed/
```

```console
$ sovrium deploy
app address atelier-crm (from name @atelier/crm)
Create atelier-crm.cloud.sovrium.com? [Y/n] y
Bundled @atelier/crm (6 files, 41 KB).
Uploaded to https://cloud.sovrium.com.
Deployment 42: queued
Deployment 42: validating
Deployment 42: applying
Deployment 42: waking up
Live at https://atelier-crm.cloud.sovrium.com.
```

The cloud is the one this machine is signed in to with [`sovrium login`](/en/docs/login); `--host` names it explicitly, and a machine with no sign-in for that cloud is told to run `sovrium login` first — nothing is built or sent. In CI, set `SOVRIUM_API_KEY` to a key instead, and `SOVRIUM_HOST` to the cloud it belongs to (`https://cloud.sovrium.com` when unset): the variable takes precedence over the stored sign-in, and the key is never sent to another cloud.

### Which app it deploys to

The first of these that applies:

1. **`--app <slug>`** — named on the command line.
2. **The project's link** — `.sovrium/cloud.json` beside your config, written the first time a deployment of this project is accepted. It holds the cloud and the app; a link written for another cloud is ignored, and it never chooses the cloud. `--app` rewrites it.
3. **The config `name`** — lowercased, a scope's `@` dropped, every other run of characters written `-`: `@atelier/crm` deploys to `atelier-crm`. When the address differs from the name, the command says which it used.

An address is 3 to 28 lowercase letters, digits and `-`, starting and ending with a letter or a digit. The cloud runs each app under its own system user, whose name carries the address and is limited to 31 characters. A name that gives no address, or one longer than 28 characters, is refused before anything is sent — it is never shortened; name the app with `--app`. A few addresses are kept by the cloud — `www`, `api`, `admin`, `cloud`, `app`, `apps`, `status`, `docs`, `mail` — and are refused as well.

Before uploading anything, the command asks the cloud about that address:

| The address is…         | What happens                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One of your apps        | It deploys to it. On the first deploy of a project with no link, a terminal asks `Deploy to your existing app atelier-crm (…)? [Y/n]`; a script goes on and prints which app it uses |
| Free                    | A terminal asks `Create atelier-crm.cloud.sovrium.com? [Y/n]`. A script is refused unless `--yes` is given. The app is created on your account, then deployed to                     |
| Another account's       | Refused — nothing is uploaded. Choose another address with `--app`                                                                                                                   |
| Not one the cloud takes | Refused, with the cloud's reason — nothing is uploaded                                                                                                                               |

A cloud that does not offer this lookup is deployed to as before: name the app with `--app`. An app that is not on your account is refused with `No app <slug> on your account at <cloud>.` and how to create it.

### The variables your app needs

The bundle lists the **names** of the variables your config requires — every `env` entry with no `default` whose `required` is not `false` — and never a value. Before uploading, the command compares them with the variables set on the app in the cloud, and stops on any that are missing, naming each, and where to set them — `--env <file>`, or the app's environment page in the cloud. Nothing is uploaded.

`--env <file>` sets the variables your config declares from that file first — exactly as [`sovrium env push <file> --yes`](/en/docs/cloud-env) does — then deploys. No file is read unless you name it. A cloud that runs the same check itself refuses with its own message, printed as it wrote it.

### Two requests, never the archive in a message

1. **The archive.** The CLI builds the app exactly as [`sovrium bundle`](/en/docs/bundle) does — an invalid config prints the `validate` report and stops — and uploads the archive to the cloud's `deployments` bucket, signed with your API key. If the archive is larger than the cloud accepts, the command prints the cloud's limit and stops; nothing is deployed.
2. **The request.** The CLI then sends a small request naming the app, the uploaded file, the archive's sha256, the config's hash, the engine version, and the exact text of the archive's `manifest.json` — the bytes the cloud signs for the machine that runs your app, which checks that signature before it switches the release in. The archive itself never travels in it.

Neither request is retried on its own. If the network drops, run the command again: the next point makes that safe.

### Running it twice deploys once

The second request carries an `Idempotency-Key` computed from the app you deploy to and the bundle's contents — every file and its sha256, not the moment the archive was written. Deploy the same content to the same app again and the cloud answers with the deployment it already has:

```console
$ sovrium deploy
Bundled @atelier/crm (6 files, 41 KB).
Uploaded to https://cloud.sovrium.com.
Already deployed (revision 42).
Live at https://atelier-crm.cloud.sovrium.com.
```

Change a file, or deploy to another app, and it is a new deployment.

### Waiting for it

The command reads the deployment every two seconds, for up to ten minutes, and prints each state it reaches:

| State        | Means                                                                |
| ------------ | -------------------------------------------------------------------- |
| `queued`     | Recorded; the cloud has not started on it                            |
| `validating` | The cloud checks the archive and validates the config it carries     |
| `applying`   | The new revision is being switched in                                |
| `waking up`  | The app is starting — a few seconds after a switch or a quiet spell  |
| `retrying`   | An attempt failed and the cloud is trying the deployment again       |
| `live`       | Switched in; the command now checks that the address answers         |
| `failed`     | Stopped; the cloud's report is printed and the command exits `1`     |
| `replaced`   | It went live and a newer deployment has since replaced it; exits `0` |

An app the cloud has not put on a machine yet is said to be **waiting for a machine**: the deployment is kept and starts once one takes it. A note the cloud adds — that the app's machine has not reported for a while, for example — is printed as it wrote it.

**Live means your address answers.** Once the cloud reports `live`, the command reads `<address>/api/health` itself, for up to 30 seconds, and only when it answers prints `Live at <address>.` and exits `0`. If it does not answer in that time, the command exits `1` with `deployment applied but the URL does not answer` and the deployment's number: the release is in place, and what fails is the way to it.

When the cloud signs the app's admins in with their Cloud account, the next line names the console:

```console
Live at https://atelier-crm.cloud.sovrium.com.
Admin: https://atelier-crm.cloud.sovrium.com/_admin — sign in with Sovrium Cloud
```

When the cloud tries a deployment again, the command says which attempt it is on and how the one before ended, once, even if the state it reaches is one it already printed:

```console
Deployment 44: applying
Deployment 44: attempt 2, previous attempt failed: the node did not answer within 30 s
Deployment 44: retrying
Deployment 44: applying
Live at https://atelier-crm.cloud.sovrium.com.
```

A state a newer cloud reports that this version of Sovrium does not know is printed as the cloud wrote it, and the command keeps waiting.

A config the cloud refuses prints the same kind of report `sovrium validate` prints, as the cloud wrote it:

```console
Deployment 43: validating
Deployment 43: failed
Error: Deployment 43 failed on https://cloud.sovrium.com.

  tables[0].fields[1].type: "single-line-txt" is not a field type
  Did you mean "single-line-text"?

Fix what the report names, then run 'sovrium deploy' again.
```

`--no-wait` returns as soon as the deployment is recorded, printing its number and first state.

### Seeding it

`--seed` fills the app from the `seed/` folder of the bundle you just deployed, once it is live and its address answers — exactly as `sovrium seed --app <slug> --yes` does (below), in `if-empty` mode: only tables with no rows are written, so deploying again never overwrites your data. The seed's report follows `Live at …`. Without `--seed`, a deploy writes no rows, so a production app stays empty until you decide otherwise.

`--seed` waits for the deployment, so it cannot be combined with `--no-wait`; the command refuses before anything is sent. If the bundle has no `seed/` folder, or the seed fails on the host, the app stays live and the command exits `1` with `Deployed, but not seeded:` and the reason.

### Network rules

The same as [`sovrium login`](/en/docs/login): `https` only, plain `http` for a private or loopback address under `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, and nothing at all under `SOVRIUM_DISABLE_NETWORK=1`. A cloud that does not answer ends the command with one line naming it.

## Seeding a hosted app

```text
Usage: sovrium seed --app <slug> | --remote [--mode …] [--table <name>] [--today <date>] [--dry-run] [--yes]
```

`sovrium seed --app atelier-crm` fills an app you host on a Sovrium Cloud from the `seed/` folder of the deployment it runs. No row is sent from your machine: `sovrium deploy` already packed your seed files into the bundle, and the machine hosting the app loads them with [`sovrium seed`](/en/docs/cli-seed), as the app. So a remote seed is as silent as a local one — no table webhook, no record automation — and to change the data, you deploy.

```console
$ sovrium seed --app atelier-crm
Seed atelier-crm on https://cloud.sovrium.com (mode if-empty)? [y/N] y
Seed run 7: queued
Seed run 7: running
  ✓ companies: created 12 records
  ✓ contacts: created 48 records
```

In a project that `sovrium deploy` linked to an app (`.sovrium/cloud.json`), `sovrium seed --remote` seeds that app without naming it; a project with no link for the signed-in cloud is refused. A plain `sovrium seed` always seeds this machine, even in a linked project. Nothing is opened on this machine when the target is a hosted app — no database, no data directory.

- **Confirmation.** A terminal asks before anything is sent; a script passes `--yes`. A `--dry-run` writes nothing and needs no confirmation.
- **`--dry-run`** is computed on the host, against the app's real data: the tables it would write and how many rows, and the ones `if-empty` would skip because they already hold rows.
- **`replace`** deletes the app's rows, so the host takes a backup first and the command prints where it is — `Backup taken: …` — before the result; that backup restores like any other. A terminal asks you to type the app's address; a script passes `--yes --confirm atelier-crm`, and a confirmation naming another address is refused.
- **`upsert`** follows the same rules as on your machine: a table with no merge key is refused on the host with the message `sovrium seed` prints locally, and nothing is written.
- **Only the deployed seed files count.** Nothing of this machine's `seed/` folder is read, so `--dir`, `--as`, `--request` and `--report` are refused with `--app` or `--remote`.
- **Invitation links stay on the host.** An account the seed files invite is reported with its email, but its link is withheld: the run is kept in the cloud's history, and the link would let anyone holding it accept the invitation. Send those invitations with **Resend** in the app's console.

The cloud refuses an app that is not on your account (`No app <slug> on your account at <cloud>.`), an app with no live deployment (deploy it first), and a deployment whose bundle has no `seed/` folder (add one beside your config, then deploy). A cloud that does not offer seeding yet says so, and nothing is seeded anywhere.
