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
| `repro-config`      | The minimal configuration, redacted                                                                                                                                 |
| `steps`             | An `Environment:` block, then numbered steps                                                                                                                        |
| `expected`          | What should have happened                                                                                                                                           |
| `actual`            | What happened instead                                                                                                                                               |
| `logs`              | The exact error text; for a server failure, the request or run id, the class and the in-repository frames, never a name the operator chose (automation, table, app) |
| `workaround`        | Anything that avoids the problem                                                                                                                                    |

`install-channel`, `database`, `domain`, `bug-kind` and `frequency` are dropdowns. GitHub documents filling a form from its address for text fields only, so send each dropdown you set as its own field AND repeat it, one `- <field id>: <value>` line each, in an `Environment:` block at the top of `steps`:

```
Environment:
- install-channel: Docker
- database: PostgreSQL
```

Put it in `steps`, not `logs`: `logs` is the field cut first when the address is too long. A dropdown you leave out is left for the person to choose on the page. On the feature forms the block opens `problem` (config option, engine primitive) or `use-case` (recipe).

## Rules

- Keep the whole address within 6,000 characters. Cut `logs` first, then the longest field left, and end each cut field with `…[truncated]`; the person can paste the rest into the form.
- Never add `labels`, `assignees`, `milestone` or `projects`. The form labels the issue itself, and GitHub refuses the address with a `404` to anyone without triage rights on the repository.
- Never add a `body`: it replaces the form with free text and loses its fields.
- Redact before encoding, following [redaction.md](redaction.md). An encoded secret is still a secret.
