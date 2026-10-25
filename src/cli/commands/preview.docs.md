# Share a Preview

> Put a change online for the people whose opinion you need with `sovrium preview`: the same bundle `sovrium deploy` would ship, running at a share address of its own, while the app your users rely on stays as it is.

## `sovrium preview`

```text
Usage: sovrium preview [config] [--app <slug>] [options]
```

```bash
sovrium preview                                 # app.ts, app.yaml… in the current directory
sovrium preview --app atelier-crm --no-wait     # record it and return at once
sovrium preview --env ./production.env          # set the app's variables from that file first
```

```console
$ sovrium preview
Bundled @atelier/crm (6 files, 41 KB).
Uploaded to https://cloud.sovrium.com.
Deployment 57: queued
Deployment 57: validating
Deployment 57: applying
Deployment 57: waking up
Preview at https://preview-crm.example.com.
Expires 2026-11-01.
```

Everything before the request is what [`sovrium deploy`](/en/docs/deploy) does, with the same refusals: the sign-in, the bundle, which app (`--app`, the project's link, then the config `name`), creating a free address with `--yes`, the variables the config requires and `--env <file>`, and the upload. A preview belongs to an app; it is not a second app to create or name. Once the cloud accepts it, the project's link names that app, as a deploy's would.

### Preview or deploy?

`sovrium deploy` changes the app at its own address. `sovrium preview` changes nothing there: the bundle runs on its own instance, with its own data, at the address the cloud gives it. Use a preview to collect opinions on a change; deploy once you have them.

Previewing the same content again answers the preview already recorded — `Already previewed (revision 57).` — and records nothing. A preview and a deploy of the same bundle are two different requests: deploying it records a release beside the preview.

### The share address

The address is the cloud's to choose — on Sovrium Cloud, `preview-<app>` on the cloud's domain — and the command prints it as the cloud gave it. It is the whole invitation: anyone with the address can open the preview, and the address is predictable from the app's, so share nothing in it you would not show the people you send it to.

The instance runs in development mode, so its sign-in page shows the accounts your `seed/` files create, ready to use. It asks search engines not to index it. It stops answering on the date printed after `Expires`; every new preview of the app pushes that date back.

### Waiting for it

The command follows the preview exactly as `sovrium deploy` follows a deployment — each state, a busy cloud waited through, a failed build printed with the cloud's report — and once the cloud reports it live, reads `<address>/api/health` for up to 30 seconds before it prints `Preview at …`. It never prints `Live at`: your app did not change.

`--no-wait` returns once the preview is recorded, with its number, its first state and `Preview URL: <address> — answers once the deployment is live.`

A cloud that does not offer previews yet says so — `This cloud has no previews yet — <cloud> does not answer sovrium preview.` — and nothing is recorded.

### Promoting it

When the opinions are in, deploy the very bundle you shared, without building or uploading it again:

```bash
sovrium deploy --from-preview 57
```

See [Promoting a preview](/en/docs/deploy#promoting-a-preview).

### What it does not do

`--seed` is refused before anything is built or sent: `--seed is not available with sovrium preview — nothing was built or sent.` The preview starts from the `seed/` folder of the bundle you shared; to fill your app instead, run `sovrium seed --app <slug>`.
