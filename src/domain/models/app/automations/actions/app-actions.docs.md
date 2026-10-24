# App Actions

> Seed an app's own data from its own seed files, or reset the whole app to them, from an ordinary automation — so a demo, a sandbox or a training app comes back to its seed every night.

Every other action family works on records, files or services. The `app` family works on the app **itself**: its own data, its own accounts, its own files. It never reaches outside the app it runs in. Its one operator, `seed`, runs the seeder `sovrium seed` runs, inside the running server, on the `seed/` folder beside the config file the server was started with.

## Reset this sandbox every night

```yaml
automations:
  - name: nightly-reset
    triggers:
      - type: cron
        expression: '7 4 * * *'
        history: minimal
    actions:
      - name: reset
        type: app
        operator: seed
        props:
          mode: reset
```

<!-- sovrium:options AppActionSchema -->

## The four modes

`mode` is required, and written literally — never as a `{{template}}`, because the server reads it at boot.

| Mode       | What it does                                                                            |
| ---------- | --------------------------------------------------------------------------------------- |
| `if-empty` | Seeds only the tables that hold no rows                                                 |
| `upsert`   | Replays each seed file on its merge key: rows are created or updated, none is deleted   |
| `replace`  | Deletes the rows of each seeded table, then inserts the seed                            |
| `reset`    | Brings the whole app back to its seed: rows, accounts, sessions and uploads (see below) |

The first three are the modes of `sovrium seed --mode`, and the files are read exactly as the command reads them: `@table.key` links, `@user:` owners, `{{today±Nd}}` dates, `seed/users.yaml` accounts. `tables`, `today` and `dryRun` mean what `--table`, `--today` and `--dry-run` mean; `tables` is refused with `reset`, which always covers every table.

## What `reset` removes

A reset first reads and checks the whole seed folder — every file, and the password of every account `seed/users.yaml` lists — and refuses before touching anything. Then it:

1. empties every table of the app, with everything kept against its records — comments and who read them, favourites, recently viewed items, record history, search entries and per-record access — and form submissions and AI conversations with their messages and attachments; a table with no seed file stays empty;
2. removes every account `seed/users.yaml` does not list — erased as an account deletion erases it, with its tokens, keys and the rest of its personal data, and recorded in the audit log — and every session, so every visitor is signed out;
3. returns every account it keeps to its baseline (see below), keeping its id: its name, its role and its password come from the seed, so a visitor who changed a demo password cannot lock the next one out, and its sign-in methods are put back as its baseline holds them;
4. seeds every table that has a seed file;
5. removes every stored upload that no remaining row names — the app's rows, an account's avatar, or an automation run the reset keeps.

A reset keeps what belongs to the operator: automation runs, webhook deliveries, analytics events and the audit log.

A reset keeps the host's administrators even when `seed/users.yaml` does not list them: the account `AUTH_ADMIN_EMAIL` names, and the account bound to `SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT` — the one that signs in with Sovrium Cloud — whether they are one account or two. Each keeps its id, the admin role and its Cloud link, returns to its baseline like every kept account, and is signed out like everyone else; with `AUTH_ADMIN_PASSWORD` set, that password still signs in afterwards. An administrator the file also lists takes its name and password from the file, and stays an admin. Nor does a reset remove an unlisted account that is the last one able to administer the app.

## What a reset puts back on a kept account

A public demo often shares one account, with its password shown on the sign-in page. A visitor who turned on two-step verification would lock out everyone after them, and an API key they created would keep its access after the reset. A staging app reset every night, on the other hand, must keep its operator's own second factor and passkeys. So a reset returns every account it keeps — the accounts `seed/users.yaml` lists, and the host's administrators — to its **baseline**: how the account stood at the end of the previous reset, or when the operator last recorded it.

- **Sign-in methods** — two-step verification, passkeys, API keys, calendar-feed links and linked sign-in accounts — go back to the baseline: one added since is removed, one changed or deleted is put back. Those the operator had before keep working.
- **The rest of the account** — name, email, avatar, language, email preferences, and whether it is banned or scheduled for erasure — goes back to the baseline too, so a changed email does not turn the shared account into a stranger the reset would erase, and a ban cannot lock it out past the reset. Two kept accounts given each other's address get their own back. The name and password a seed file or `AUTH_ADMIN_PASSWORD` gives still win; a password neither gives comes back from the baseline.
- **OAuth clients and connected accounts** go back to the baseline too: a client the account owned stays with the resources it was linked to, one it registered since is removed, and so is a third-party account it connected since. A connected account the baseline holds keeps the tokens it holds now, since a provider renews them on every refresh; one disconnected since is put back. The app's own connections — a credential shared by the whole app — follow the same rule.
- **OAuth tokens and consents, device codes, pending verifications and sessions** are removed at every reset, and so are an OAuth client registered with no account, a token the app obtained with a connection's own client credentials (it obtains a fresh one on its next call), and an OAuth resource no remaining client links to, except the one Sovrium declares for its MCP endpoint.
- **Small settings** — notification channels, favourite and recently viewed pages, which records were read, presence and notifications — go back to their defaults at every reset, baseline or not. Language and email preferences, which belong to the account itself, follow the baseline.

Every reset records the baseline as it ends: an account it returned to a baseline keeps that baseline. The first reset, or the first one an account goes through, has no baseline to return to: the account keeps only its password and, for the platform administrator, its Sovrium Cloud link, is not banned or scheduled for erasure, and that is what the reset records, whatever is done in the app while it runs. To make a reset keep what you add later — your own second factor, an OAuth client or a connected account on a staging app — set them up, then run `sovrium seed --baseline` on the host. Nothing a visitor can do inside the app changes the baseline.

An app with no `seed/` folder, or a seed folder with no accounts file, keeps its accounts and sessions: a reset then only empties its tables (and seeds them, when there are seed files). A `dryRun` reset reports the plan and touches nothing.

A listed account with no password of its own takes `SOVRIUM_SEED_PASSWORD`. Under `reset` that holds for every listed account, existing ones included, since the reset puts the password back: without the variable, the step fails with the seeder's own message, naming the account and the variable, and deletes nothing.

## The organisation

A reset rebuilds the app's organisation from the config and the seed, as it rebuilds its tables: pending invitations are removed, the teams are exactly the groups the config declares — they keep their identity, and every other team goes — and no one is in a team, since no seed file puts anyone in one. Each account `seed/users.yaml` lists is a member with the role a seed run gives it, the host's administrators keep their own membership, and the organisation takes the app's name again.

## Switching it on

The host decides whether an app may seed or reset itself, never the config: a template that ships a nightly reset must not wipe the data of an app built from it.

| `SOVRIUM_SELF_SEED` | Modes allowed                                   |
| ------------------- | ----------------------------------------------- |
| unset or empty      | none: an automation holding the step is not run |
| `reset`             | `if-empty`, `upsert`, `replace`, `reset`        |
| any other value     | `if-empty`, `upsert`                            |

Only the exact word `reset` allows the modes that delete rows, so a typo can at most add missing rows.

When the variable does not allow the mode of an `app/seed` step — anywhere in the automation, inside a `path` branch or a `loop` included — the whole automation is **not scheduled**. None of its triggers is armed, it is absent from the automation list, triggering it by name answers as for an automation that does not exist, and it never records a run. The server prints one line at boot naming the automation and the variable.

## Silent, and kept out of the history

A self-seed fires no record automation, no table webhook and no activity-log entry for the rows it deletes or writes — nor does `sovrium seed`. The only entry a reset leaves is the audit-log record of each unlisted account it erases. A reset is one operation on the app's own state, not hundreds of business events: replaying it as deletions and creations would reach every webhook receiver nightly and bury the activity log.

The step's output is the seeder's report: the mode, one entry per table — `seeded`, `skipped`, or `emptied` for a table a reset emptied for want of a seed file — and, for a reset, how many accounts, sessions and files it removed. With `history: minimal` on the trigger, as in the example above, the run keeps its status and timings and not the report; a run started by hand still answers with it. `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS` bounds how long runs are kept.

The step runs on SQLite and PostgreSQL alike.
