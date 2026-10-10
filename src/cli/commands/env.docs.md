# A Hosted App's Variables

> Set, list and remove the environment variables of an app hosted on a Sovrium Cloud with `sovrium env` — from a file you name, by name only, never printing a value.

An app's variables — a payment key, a webhook token — live in the cloud, never in the bundle: a bundle is kept for every deployment so you can roll back, and a secret inside one would outlive its rotation. The cloud writes them into the app's environment on its next deployment.

`sovrium env` finds the app the same way [`sovrium deploy`](/en/docs/deploy) does — `--app`, else the project's link, else the address from the config `name` — and signs in the same way, with [`sovrium login`](/en/docs/login). It reads your config as `sovrium deploy` does, too: a config that does not validate is refused, with its problems listed, before anything is sent.

## `sovrium env push`

```text
Usage: sovrium env push <file> [config] [--app <slug>] [--overwrite] [--plain <NAME>]… [--redeploy] [--yes]
```

```console
$ sovrium env push ./production.env
app address atelier-crm (from name @atelier/crm)
  skipped    PORT (set by the platform)
  ignored    LEGACY_MAILCHIMP_KEY (not declared in the config)
  to add     BREVO_API_KEY
  to add     HELLOASSO_CLIENT_ID
  to keep    ANALYTICS_SITE_ID (already set; --overwrite replaces it)
Send 3 variables to atelier-crm? [Y/n] y
  added      BREVO_API_KEY
  added      HELLOASSO_CLIENT_ID
  unchanged  ANALYTICS_SITE_ID (already set; --overwrite replaces it)
They reach the app on its next deployment.
```

- **The file is the one you name.** `push` reads only that file — `NAME=value` per line, `#` comments and blank lines allowed — and no command ever reads a `.env` on its own.
- **Only what your config declares.** A name your config does not declare under `env` is ignored and listed. A name the platform sets itself — `PORT`, `BASE_URL`, `AUTH_SECRET`, `NODE_ENV`, every `SOVRIUM_*` among others — is skipped with a note. Neither is sent.
- **Checked before you are asked, and before anything is sent.** An empty value, a value on more than one line, holding a backslash, starting with a quote, or starting or ending with a blank would be refused or reach the app altered: the push stops, naming each such variable — never its value.
- **Add only, unless you say so.** A variable already set is left unchanged; `--overwrite` replaces it.
- **Secret by default.** Once saved, a secret is readable by the operator only. `--plain <NAME>` sends that one as a plain value; repeat it for several.
- **Asked once.** A terminal shows what would change, by name, and asks before sending. A script is refused unless `--yes` is given.
- **`--redeploy`** deploys the app again at once, reusing its live bundle — nothing is uploaded — so the new values take effect now.

The cloud answers one result per name — `added`, `unchanged`, `replaced`, or `refused` with its reason — and the command prints them, names only.

## `sovrium env list`

```console
$ sovrium env list
Variables of atelier-crm on https://cloud.sovrium.com:
  BREVO_API_KEY         secret  set
  ANALYTICS_SITE_ID     plain   set
  BASE_URL                      platform
Missing, so the next deployment is refused until they are set:
  HELLOASSO_CLIENT_ID   missing
```

Every variable set on the app with its kind and source, the platform's names your config declares, then the variables your config requires and the app lacks. No value is printed, a plain one included. `--json` prints the same as JSON.

## `sovrium env unset`

```text
Usage: sovrium env unset <NAME>… [config] [--app <slug>] [--yes]
```

Removes the named variables after asking (a script needs `--yes`), and says which were removed and which were not set. A variable your config still requires is removed with a warning: the next deployment will be refused until it is set again.
