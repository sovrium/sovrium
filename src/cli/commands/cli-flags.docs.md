# Global Flags & Exit Codes

> Which command each flag belongs to, how an unknown one is rejected, the three-step static-asset fallback, and what the two exit codes mean.

Flags may appear anywhere in the invocation — before the command, after the config path, interleaved. `sovrium --watch start app.yaml` and `sovrium start app.yaml --watch` are the same command.

## Which flag belongs to which command

`sovrium <command> --help` prints the authoritative option list for one command, with its environment variables and examples. This is the map across commands, which is the thing one `--help` cannot show you.

| Flag                 | Commands                                   | What it does                                                                           |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `--watch`, `-w`      | `start`                                    | Watch the configuration and hot-reload on change.                                      |
| `--publicDir <path>` | `start`, `build`                           | Static-asset directory to serve, or copy into the build output.                        |
| `--no-publicDir`     | `start`, `build`                           | Serve no static assets. Overrides both the env var and the default.                    |
| `--output <path>`    | `schema`, `types`, `docs`, `design-system` | Where to write: a directory for `types`, a file for the rest.                          |
| `--typescript`       | `init`                                     | Scaffold a typed `app.ts`. Refuses `--template`.                                       |
| `--template <name>`  | `init`                                     | Bundled template name, or a GitHub repo as `owner/repo[#ref]`.                         |
| `--name <name>`      | `init`                                     | App name written into the scaffolded config.                                           |
| `--force`            | `init`                                     | Overwrite an existing config file.                                                     |
| `--from-url <url>`   | `init`                                     | Fork one published `.yaml`, `.yml` or `.json` config over HTTPS.                       |
| `--git`              | `init`                                     | Initialise a git repository and land the scaffold as one commit.                       |
| `--dir <path>`       | `seed`                                     | Seed-file directory.                                                                   |
| `--mode <mode>`      | `seed`                                     | `if-empty`, `upsert` or `replace`.                                                     |
| `--table <name>`     | `seed`                                     | Restrict to one table. Repeatable.                                                     |
| `--dry-run`          | `seed`, `migrate`                          | Report the plan and write nothing.                                                     |
| `--check`            | `migrate`                                  | Report whether the upgrade is safe to attempt, and write nothing.                      |
| `--format <name>`    | `design-system`, `docs`                    | `md` (default) or `json`; `docs` also takes `llms`. An unknown one is refused by name. |
| `--full`             | `docs`                                     | Print the whole manual rather than an index.                                           |
| `--section <slug>`   | `docs`                                     | Restrict to one section. Repeatable.                                                   |
| `--list-sections`    | `docs`                                     | Print the registered section slugs and exit.                                           |
| `--lang <code>`      | `docs`                                     | Manual locale. `en` only; anything else is refused by name.                            |
| `--password <value>` | `admin create`                             | Admin password. Omit it to be prompted, which requires a TTY.                          |
| `--message <text>`   | `reload`                                   | Operator note recorded against the new configuration version.                          |
| `--json`             | `validate`                                 | Report the verdict as one JSON document on stdout. Exit codes stand.                   |
| `--project <dir>`    | `mcp`                                      | Directory to read the config from. Beats `SOVRIUM_PROJECT_DIR`.                        |
| `--version`, `-v`    | any                                        | Print the version and exit. Always wins, wherever it appears.                          |
| `--help`, `-h`       | any                                        | Print help and exit. With a command in front, prints that command's.                   |

`sovrium version` and `sovrium help` are the bare-word spellings of the last two, and behave identically.

The config a command reads is always a **positional** argument, never a flag — `sovrium admin create me@example.com app.yaml`, not `--config app.yaml`. There is no `--config`, and passing one is refused by the unknown-flag check below.

## Static assets

`--publicDir` is the one flag with a multi-step fallback, shared by `start` and `build`:

1. `--no-publicDir` — opt out entirely; nothing else is consulted.
2. `--publicDir <path>` — the explicit path.
3. `SOVRIUM_PUBLIC_DIR` — the same thing from the environment. The literal value `none` is the env-var spelling of `--no-publicDir`.
4. Otherwise, `public/` **next to the config file**.

The default is anchored to the config file rather than to the working directory on purpose: the same command serves the same files no matter where you run it from. With an inline `APP_SCHEMA` there is no config file to anchor to, so no default applies.

```bash
sovrium start app.yaml --publicDir ./assets
sovrium start app.yaml --no-publicDir
SOVRIUM_PUBLIC_DIR=none sovrium build app.yaml
```

## An unknown flag is rejected

Any `-`-prefixed token not in the table above stops the command before it dispatches:

```text
Error: Unknown flag "--wtach"
```

This exists because of what used to happen instead. A typo'd flag was treated as a positional argument, fell through to the implicit `start`, and failed with `Error: No configuration provided` — an accurate message about entirely the wrong problem. Now the offending token is named.

## Exit codes

There are two. `0` is success; `1` is failure — an invalid config, a missing file, an unknown command or flag, a refused action. Every failure path exits `1`, and the distinction lives in the message rather than in the code, which makes gating a pipeline a one-liner:

```bash
sovrium validate app.yaml || exit 1
```

An unhandled failure prints an `Unexpected failure — Sovrium changed nothing.` banner with a link to open an issue. That banner means Sovrium itself did not anticipate the failure — worth reporting, with the message copied in. Its first clause is a promise: the command aborted before it wrote anything.
