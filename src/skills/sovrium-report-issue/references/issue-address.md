# Building the issue address by hand

Use this only when `sovrium report` cannot run — no shell, no binary at hand. The command builds the same address and does the redaction for you; prefer it whenever it is available.

## The address

```
https://github.com/sovrium/sovrium/issues/new?template=<form>&<field>=<value>&…
```

Each value is percent-encoded (`encodeURIComponent` in JavaScript: a space is `%20`, a new line `%0A`). GitHub fills an issue form's text fields from the address, keyed by each field's id.

| Kind of report   | `template=`                    |
| ---------------- | ------------------------------ |
| Bug              | `bug.yml`                      |
| Config option    | `feature-config-option.yml`    |
| Engine primitive | `feature-engine-primitive.yml` |
| Recipe           | `feature-recipe.yml`           |
| Task             | `task.yml`                     |

A vulnerability has no address to build: send the user to `https://github.com/sovrium/sovrium/security/advisories/new`, with nothing appended.

## The title

`<where>: <error class>` followed by the signature in square brackets: `sig:` and eight hexadecimal digits. `<where>` is the CLI command for a failure the terminal printed (`start`, `build`, `validate`, …), `request` for an internal error a server answered, and `automation` for a run the engine closed. Copy the signature as Sovrium printed it; never compute one.

Only an engine defect gets a report. A failure the operator can fix — an environment variable not set or wrong, a table missing from the database, a database the server cannot reach or that ran out of room — has no address: fix it instead.

## Bug form fields

| Field id            | Holds                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`           | What `sovrium --version` prints                                                                                                                                     |
| `last-good-version` | The last version that worked, for a regression                                                                                                                      |
| `install-channel`   | `Binary`, `Desktop app`, `Docker`, `Homebrew`, `Scoop` or `Built from source`                                                                                       |
| `database`          | `SQLite` or `PostgreSQL`                                                                                                                                            |
| `os`                | The platform and processor, `linux x64`, `darwin arm64`                                                                                                             |
| `domain`            | One value of [Domain](#domain)                                                                                                                                      |
| `bug-kind`          | `regression`, `crash-or-data-loss`, `wrong-behaviour`, `performance`, `ux-a11y` or `compat`                                                                         |
| `repro-config`      | The minimal configuration, redacted                                                                                                                                 |
| `steps`             | An `Environment:` block, then numbered steps                                                                                                                        |
| `expected`          | What should have happened                                                                                                                                           |
| `actual`            | What happened instead                                                                                                                                               |
| `logs`              | The exact error text; for a server failure, the request or run id, the class and the in-repository frames, never a name the operator chose (automation, table, app) |
| `frequency`         | `Every time`, `Sometimes` or `Happened once`                                                                                                                        |
| `workaround`        | Anything that avoids the problem                                                                                                                                    |

The bug form then ends with the [Agent brief](#the-agent-brief) and the two [boxes](#the-two-boxes).

## Feature and task form fields

Each opens with `domain`, one value of [Domain](#domain), and ends with the [Agent brief](#the-agent-brief) and the two [boxes](#the-two-boxes).

| Form                           | Field id             | Holds                                                                                   |
| ------------------------------ | -------------------- | --------------------------------------------------------------------------------------- |
| `feature-config-option.yml`    | `problem`            | What the user cannot do today                                                           |
|                                | `schema-node`        | The configuration key the option goes on, such as `tables[].fields[]`                   |
|                                | `sketch`             | The proposed configuration, as YAML                                                     |
|                                | `defaults`           | Its default, and what an existing configuration does without it                         |
|                                | `audience`           | `The operator (configuration and /_admin)`, `The app's end users` or `Both`             |
|                                | `docs-impact`        | The pages of the manual it changes                                                      |
| `feature-engine-primitive.yml` | `problem`            | What the user cannot do today                                                           |
|                                | `why-not-composable` | The existing pieces tried, and where each stops                                         |
|                                | `runtime-surface`    | What it adds that runs: a command, a route, a component, an action                      |
|                                | `security-impact`    | What it could expose, and to whom                                                       |
|                                | `performance-impact` | What it costs to run                                                                    |
| `feature-recipe.yml`           | `use-case`           | The app or use case                                                                     |
|                                | `primitives`         | The existing pieces it assembles                                                        |
|                                | `gap`                | The one thing missing, if any                                                           |
|                                | `delivery`           | `A library recipe (sovrium library)`, `A starter template (sovrium init)` or `Not sure` |
| `task.yml`                     | `goal`               | The outcome                                                                             |
|                                | `scope`              | What changes                                                                            |
|                                | `definition-of-done` | How anyone can tell it is done                                                          |

## The Agent brief

Every form ends with the same five fields. They are optional on the page, but an issue is worked on only once they are complete, so fill them.

| Field id              | Holds                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `acceptance-criteria` | Numbered lines: `1. Given <the app or situation>, when <the person does this>, then <what they see>` |
| `affected-paths`      | The areas involved when known: the command, the configuration key, the page or the API route         |
| `verification`        | The commands to run or the requests to send that show it is done                                     |
| `out-of-scope`        | What the report deliberately does not ask for                                                        |
| `related`             | The issues the search found, as `#123`                                                               |

## The two boxes

`validated` ("I ran `sovrium validate` on my configuration") and `ai-drafted` ("This report was drafted with an AI assistant") are checkboxes, which an address does not tick. Tell the user to tick `ai-drafted` on the page whenever an assistant wrote any of the report, and `validated` only when the validation ran and passed.

## Domain

The same list on every form. Pick the part of Sovrium the problem shows up in; the maintainers can move it.

| Value                  | Covers                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `accessibility`        | Keyboard use, screen readers, contrast and focus in the pages an app renders         |
| `account`              | A signed-in person's own account: profile, avatar, data export, deleting the account |
| `admin`                | The operator console at `/_admin`                                                    |
| `ai`                   | AI fields, agents, AI actions and the AI providers                                   |
| `analytics`            | Page-view analytics an app collects                                                  |
| `api`                  | The HTTP API beyond table records: its routes, error answers, the OpenAPI document   |
| `assets`               | Static files, images and `public/`                                                   |
| `authentication`       | Sign-in, sign-up, magic links, OAuth and single sign-on, two-factor, sessions        |
| `automations`          | Triggers, actions, runs, schedules and approvals                                     |
| `buckets`              | File storage buckets and uploads                                                     |
| `cli`                  | The `sovrium` command and its verbs                                                  |
| `design`               | The `design` key: colours, type, spacing, radius and per-component classes           |
| `design-system`        | How the built-in components look and are put together                                |
| `ecoconception`        | Page weight and the `ECO_*` operator settings                                        |
| `footprint`            | The footprint overview of an app                                                     |
| `forms`                | Forms on pages: fields, conditions, submissions, spam protection                     |
| `infrastructure`       | Databases, email delivery, the server process, packaging and the binary              |
| `internationalization` | Languages, translations and right-to-left text                                       |
| `links`                | Short links, QR codes, redirects and link tracking                                   |
| `migrations`           | `sovrium migrate` and how the database follows a changed configuration               |
| `pages`                | Pages, their components, layout and rendering                                        |
| `records-api`          | Reading and writing table records through the API                                    |
| `security`             | Hardening an app (headers, CSRF, CORS, rate limits); a vulnerability never goes here |
| `tables`               | Tables, fields, views, permissions and data                                          |
| `templates`            | The starter templates `sovrium init` scaffolds                                       |
| `theming`              | Colours, dark mode and responsive styles as rendered                                 |
| `user-management`      | Users, roles, groups and invitations                                                 |
| `desktop`              | The desktop app                                                                      |
| `docs`                 | The manual (`sovrium docs`) and the documentation website                            |
| `toolchain`            | Building Sovrium from source                                                         |

`install-channel`, `database`, `domain`, `bug-kind`, `frequency`, `audience` and `delivery` are dropdowns, and each value must be written exactly as the form offers it. GitHub documents filling a form from its address for text fields only, so send each dropdown you set as its own field AND repeat it, one `- <field id>: <value>` line each, in an `Environment:` block at the top of `steps`:

```
Environment:
- install-channel: Docker
- database: PostgreSQL
```

Put it in `steps`, not `logs`: `logs` is the field cut first when the address is too long. A dropdown you leave out is left for the person to choose on the page. On the feature forms the block opens `problem` (config option, engine primitive) or `use-case` (recipe), and on the task form `goal`. Tell the user which dropdowns to check on the page before submitting.

## Rules

- Keep the whole address within 6,000 characters. Cut `logs` first, then the longest field left, and end each cut field with `…[truncated]`; the person can paste the rest into the form.
- Never add `labels`, `assignees`, `milestone` or `projects`. The form labels the issue itself, and GitHub refuses the address with a `404` to anyone without triage rights on the repository.
- Never add a `body`: it replaces the form with free text and loses its fields.
- Redact before encoding, following [redaction.md](redaction.md). An encoded secret is still a secret.
