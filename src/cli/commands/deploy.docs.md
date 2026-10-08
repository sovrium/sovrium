# Deploy to a Sovrium Cloud

> Ship an app from your machine with `sovrium deploy`: the CLI bundles it, uploads the archive, asks the cloud to deploy it, and shows each step until the app is live.

## `sovrium deploy`

```text
Usage: sovrium deploy [config] --app <slug> [options]
```

```bash
sovrium deploy --app atelier-crm               # app.ts, app.yaml… in the current directory
sovrium deploy app.ts --app atelier-crm --no-wait
```

```console
$ sovrium deploy --app atelier-crm
Bundled @atelier/crm (6 files, 41 KB).
Uploaded to https://cloud.sovrium.com.
Deployment 42: queued
Deployment 42: validating
Deployment 42: applying
Deployment 42: waking up
Live at https://atelier-crm.cloud.sovrium.com.
```

`--app` names the hosted app to deploy to: 2 to 28 lowercase letters, digits and `-`, starting and ending with a letter or a digit. A longer name is refused before anything is built or sent — the cloud runs each app under its own system user, whose name carries the slug and is limited to 31 characters. The cloud is the one this machine is signed in to with [`sovrium login`](/en/docs/login); `--host` names it explicitly, and a machine with no sign-in for that cloud is told to run `sovrium login` first — nothing is built or sent.

### Two requests, never the archive in a message

1. **The archive.** The CLI builds the app exactly as [`sovrium bundle`](/en/docs/bundle) does — an invalid config prints the `validate` report and stops — and uploads the archive to the cloud's `deployments` bucket, signed with your API key. If the archive is larger than the cloud accepts, the command prints the cloud's limit and stops; nothing is deployed.
2. **The request.** The CLI then sends a small request naming the app, the uploaded file, the archive's sha256, the config's hash, the engine version, and the exact text of the archive's `manifest.json` — the bytes the cloud signs for the machine that runs your app, which checks that signature before it switches the release in. The archive itself never travels in it.

Neither request is retried on its own. If the network drops, run the command again: the next point makes that safe.

### Running it twice deploys once

The second request carries an `Idempotency-Key` computed from the app you deploy to and the bundle's contents — every file and its sha256, not the moment the archive was written. Deploy the same content to the same app again and the cloud answers with the deployment it already has:

```console
$ sovrium deploy --app atelier-crm
Bundled @atelier/crm (6 files, 41 KB).
Uploaded to https://cloud.sovrium.com.
Already deployed (revision 42).
Live at https://atelier-crm.cloud.sovrium.com.
```

Change a file, or deploy to another app, and it is a new deployment.

### Waiting for it

The command reads the deployment every two seconds, for up to ten minutes, and prints each state it reaches:

| State        | Means                                                               |
| ------------ | ------------------------------------------------------------------- |
| `queued`     | Recorded; the cloud has not started on it                           |
| `validating` | The cloud checks the archive and validates the config it carries    |
| `applying`   | The new revision is being switched in                               |
| `waking up`  | The app is starting — a few seconds after a switch or a quiet spell |
| `live`       | Serving at its address; the command exits `0`                       |
| `failed`     | Stopped; the cloud's report is printed and the command exits `1`    |

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

### Network rules

The same as [`sovrium login`](/en/docs/login): `https` only, plain `http` for a private or loopback address under `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, and nothing at all under `SOVRIUM_DISABLE_NETWORK=1`. A cloud that does not answer ends the command with one line naming it.
