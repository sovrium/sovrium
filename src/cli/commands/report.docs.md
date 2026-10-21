# Reporting a Problem

> `sovrium report` prints the address of a new issue on the Sovrium repository with the facts maintainers need already filled in — or, for a vulnerability, the address of the private advisory form. It never submits anything and never makes a network request.

```text
Usage: sovrium report [--config <path>] [--feature <config-option|engine-primitive|recipe>] [--security] [--last-error] [--request-id <id>] [--open]
```

You found something wrong. Before writing it up, `sovrium report` gathers what every report needs — the version you run, your operating system, how Sovrium was installed, which database it uses, and whether your configuration validates — and puts it in the issue form for you. You read the form in your browser, describe what happened, and submit it yourself, or close the tab.

Nothing leaves your machine until you press submit on the page. The command prints a web address and stops; Sovrium does not phone home, and reporting a problem is no exception.

## Report a bug

```bash
sovrium report
```

Prints one line, the address of the bug form with these fields filled in:

| Field            | What it holds                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Sovrium version  | What `sovrium --version` prints                                                               |
| Operating system | The platform and processor, such as `linux x64` or `darwin arm64`                             |
| Install channel  | `Binary`, `Desktop app`, `Docker`, `Homebrew`, `Scoop`, or `Built from source`                |
| Database         | `SQLite`, or `PostgreSQL` when `DATABASE_URL` names a Postgres server                         |
| Steps            | An `Environment:` block repeating the install channel and database, for you to continue below |
| Logs             | The result of `sovrium validate`                                                              |

The database is read from the scheme of `DATABASE_URL`. Sovrium does not connect to it, and the address itself is never copied.

Only the address goes to standard output, so it composes with other commands:

```bash
sovrium report > issue-link.txt
```

Add `--open` to have your browser open the form directly. With no browser available — over SSH, or with `BROWSER=none` — the address is printed all the same.

## A configuration error is not a bug

`sovrium report` first checks your configuration exactly as `sovrium validate` does. If it does not validate, no address is printed: the command shows what is wrong and exits with status 1. Fix the configuration — `sovrium docs` explains every option — and the problem may be gone.

The same rule holds everywhere: when Sovrium refuses a configuration, or a port is already in use, the message tells you how to fix it and offers no report.

So does a failure that is yours to fix rather than Sovrium's. A start without a required environment variable, a table dropped from the database under a running app, a database the server cannot reach or one that ran out of disk or connections each print what to do instead of a report, and keep nothing for `--last-error`. A database file Sovrium cannot read as SQLite is still offered a report: Sovrium wrote it.

## Attach your configuration

```bash
sovrium report --config app.yaml
```

Without `--config`, no part of your configuration is included — the report only says whether it validates. With it, the file is attached to the form's configuration field after these are removed:

- a value written directly at a key that names a secret, a password, a token or an API key;
- the `default` of an `env` entry, unless that entry says `secret: false`;
- any value equal to one held by an environment variable whose name marks it as secret.

Each removed value reads `[redacted]`. An `$env.NAME` reference stays as you wrote it: it names a variable, not its value. Your data never comes along — the command reads neither the database nor the `seed/` directory.

Attach the smallest configuration that still shows the problem. The whole address is kept within 6,000 characters: when it would be longer, the logs field is cut first, then the longest field left — usually the configuration — and each cut field ends with `…[truncated]`. Paste the rest into the form.

## Suggest a feature

```bash
sovrium report --feature config-option
sovrium report --feature engine-primitive
sovrium report --feature recipe
```

Each opens the form for that kind of idea and fills nothing in:

| Kind               | For                                                                          |
| ------------------ | ---------------------------------------------------------------------------- |
| `config-option`    | A new option on something the configuration already describes                |
| `engine-primitive` | A capability that cannot be built from what Sovrium already has              |
| `recipe`           | An app or a use case assembled from existing pieces, as a recipe or template |

## Report a vulnerability

```bash
sovrium report --security
```

Prints the address of the private security advisory form:

```text
https://github.com/sovrium/sovrium/security/advisories/new
```

A vulnerability is reported privately, to the maintainers only — never as an issue, which anyone can read. Nothing is filled in: you write the report yourself, and decide what it contains. `--security` overrides every other flag; given beside `--config` or `--last-error`, it still attaches nothing and says so.

## When Sovrium itself fails

When `sovrium start` cannot start, `sovrium build` cannot build, or a command stops on an error Sovrium has no specific handling for, the message ends with the address of a bug report already filled in: the four facts above, and the error text in the logs field, with secrets, your project's full path and your home directory removed.

Its title reads like this:

```text
build: DatabaseConnectionError [sig:3f9a1c07]
```

Where it failed, the kind of error, and a signature. Where it failed is the command for a failure the terminal printed, `request` for an internal error a server answered, and `automation` for a run the engine closed. The signature is computed from where in Sovrium's code the error happened, so the same bug carries the same signature on every machine. Searching the repository's issues for it shows whether someone already reported it — add what you know there rather than opening a second issue.

Sovrium keeps that last failure, already redacted, in the project's `.sovrium/` directory. Once the terminal has scrolled away:

```bash
sovrium report --last-error
```

prints the same address again. With no failure kept, it says so and exits with status 1.

## A server error, by its request id

A server error answers with a request id: the `requestId` of a `500` response, the id an error page shows, or the one the operator console shows when a view fails to load. The server's log line for the same request names it too, with the error's signature and the command to report it — or, for an error that is yours to fix, `operator-fixable:` and the fix, and no command.

Run, where that server runs:

```bash
sovrium report --request-id 0e12a140-b07a-423d-a5ea-13d2ca76a734
```

It prints the filled-in bug report for that error, from the copy the server kept: its logs name the request id, the kind of error and where in Sovrium's code it happened. For an error that is yours to fix it prints the fix instead, and exits with status 1. An id the server did not record exits with status 1.

The people using your app never see an issue address: an error page and an API error give them the request id only, which they can pass on to you. The console offers **Report on GitHub** beside a records grid or the run history that failed to load with an internal error, and on the page of an automation run the engine stopped; for an error that is yours to fix it shows what to do instead. With nothing failed on screen, its **Report a problem** page, in the command palette's Help group, opens a blank report with your installation's facts, or the report of the last internal error the server kept. An AI connected through `sovrium mcp` is pointed at the `sovrium-report-issue` skill when a tool meets one.

## The same address, from the operator console

The operator console asks the server for the same address, so the console and the terminal give the same report for the same failure:

| Read                                          | Answers                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/reports/requests/<requestId>` | `{ url }` for an internal error the server kept under that request id; `{ fix }` for one that is yours to fix |
| `GET /api/admin/reports/runs/<runId>`         | `{ url }` for an automation run that stopped on an internal error in Sovrium                                  |

`fix` is one of `missing-env`, `invalid-env`, `database-schema-drift`, `database-unreachable` and `database-resources`, and the console words what to do for each.

Both are admin only. Anything else answers `404`: a caller who is not an admin, an id the server kept nothing under, a malformed id, and a run that finished or failed on its own step, which is the app's to fix rather than a bug in Sovrium. The address names the request or the run, the kind of error, its signature and where in Sovrium's code it happened — never the error's message, what a trigger sent, record data, or a name you chose: not the automation, its actions, a table or the app. A run that stopped because of something yours to fix, such as a dropped table, is not a defect and offers no report. Nothing is sent: the address files nothing until you submit the form. An AI connected through `sovrium mcp` with an admin key reads the same two addresses as admin tools.

Two more reads take no id, for a problem with nothing failed on screen:

| Read                                  | Answers                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/admin/reports/installation` | `{ url }`: the blank bug form with the version, the operating system, the install channel and the database, and no title, logs or app name |
| `GET /api/admin/reports/latest`       | `{ url, requestId }`: the most recent internal error the server kept, the same address the request read answers for that `requestId`       |

They are admin only too. The latest read skips a failure the operator can fix, and answers `404` while the server has kept no engine defect.
