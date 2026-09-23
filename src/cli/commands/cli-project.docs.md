# Project Commands

> Scaffold a project, build it to static files, print its schema, check a config before you ship it, and write the types for a TypeScript config.

Five commands operate on a project rather than on a running server. Each answers `--help` with its own option list, which is the authoritative one; what follows is what the options are _for_.

## `sovrium init`

```text
Usage: sovrium init [dir] [options]
```

Scaffold a new project into the given directory, or into the current one when none is passed. Every scaffold writes a config file, a `CLAUDE.md` written for that template's domain, an `app-editor` subagent under `.claude/agents/`, an `.env.example`, a `.gitignore`, and a `public/` directory for static assets. The bare `hello-world` default gets the same set.

```bash
sovrium init ./my-app                          # blank starter
sovrium init ./my-app --template crm --name acme-crm
sovrium init ./my-app --template sovrium/crm-template#v2
sovrium init ./my-app --typescript
```

`--name` is written into the scaffolded config and defaults to the directory name. `--force` allows an existing config file to be overwritten.

`--template` takes a bundled template name — an unknown one exits `1` and prints the list — or a **GitHub repository** in any of the forms `owner/repo`, `gh:owner/repo` or `https://github.com/owner/repo`, each with an optional `#ref` naming a branch, tag or SHA. Only `github.com` is supported.

`--from-url <url>` forks one published `.yaml`, `.yml` or `.json` config over HTTPS, and `--git` initialises a repository and lands the scaffold as one commit. Both are described below.

`--typescript` writes an `app.ts` **instead of** a YAML config, alongside the `sovrium.d.ts` and `tsconfig.json` that make it check. It refuses to combine with `--template`: a template ships its own `app.yaml`, and Sovrium resolves `app.yaml` before `app.ts`, so the generated config would be permanently shadowed. Scaffold the template first, then convert its config by hand.

**`init` never clobbers what it does not own.** An existing `.gitignore`, `.env.example` or `public/` is left verbatim. The config file is the one thing `init` owns, and even that is only overwritten with `--force`.

### `--from-url` — fork one published config

`--template owner/repo` fetches a whole repository. `--from-url` fetches a **single** config document: the shape a gallery, a blog post or a colleague can publish without owning a repository at all.

```bash
sovrium init ./contact-book --from-url https://example.com/starters/contact-book.yaml
```

The document is fetched once, at scaffold time, and written into the project byte for byte — comments, key order and all. Nothing ever re-fetches it. That is the difference between a file you have and a file whose author can still change what your app does.

Beside it lands `.sovrium-template.json`, recording where the config came from:

```json
{
  "source": "https://example.com/starters/contact-book.yaml",
  "sha256": "9d950eca6a366fa932ceb930b0a288818cc66921f606decb2f749529148921f7",
  "file": "app.yaml",
  "fetchedAt": "2026-09-22T21:18:36.449Z"
}
```

It is meant to be committed. Provenance goes in a sidecar rather than a header comment because a comment does not survive the first rewrite, and a JSON config cannot carry one at all.

Every refusal below exits `1` **before a single file is written**, so a rejected fork leaves nothing behind to clean up:

| Refused                             | Why                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A plain `http://` URL               | The document becomes your whole application, so whoever can rewrite it in flight chooses what your project is                         |
| A URL ending in `.ts`               | A TypeScript config is a program. Downloading one from a URL to run it is a different thing from copying a document                   |
| Any other extension                 | The extension is what decides whether the fork lands as `app.yaml` or `app.json`                                                      |
| A document over 1 MB                | A config is a few kilobytes. The limit applies while the document is read, so an oversized one is abandoned rather than buffered      |
| A config carrying a remote `$ref`   | Following it would leave the fork incomplete and every later boot dependent on a host you did not choose                              |
| A config the schema rejects         | The document is decoded before the first write. A half-scaffolded project whose config does not boot is worse than no project         |
| A redirect chain over five hops     | A published document is served directly or behind a redirect or two. A longer chain is a loop, or a redirector                        |
| A redirect to a non-`https` address | You chose the address you typed; the publisher chose where it goes next. A cleartext hop hands the document to whoever is on the path |

```console
$ sovrium init ./my-app --from-url http://example.com/app.yaml
Error: --from-url requires an https:// address, and "http://example.com/app.yaml" is not one.
This document becomes your whole application, so it is fetched over TLS or not at all.
```

#### Redirects are followed, and each one is checked

Published templates redirect — `raw.githubusercontent.com` answers a `302` — so a link that redirects still works, and the provenance sidecar records the URL **you** gave rather than wherever it ended up. But the address you typed is the only one you chose, so each hop is put through the same checks again: it must be `https`, and it must not point at a private, loopback or link-local host. Up to five hops are followed; past that the chain is refused.

Without this, every rule in the table above would be decided against the first URL while the bytes came from the last one.

```console
$ sovrium init ./my-app --from-url https://example.com/starter.yaml
Error: https://example.com/starter.yaml redirected to http://cdn.example.net/starter.yaml, which is not https, so nothing was fetched.
A redirect hop is chosen by the publisher rather than by you, and a cleartext hop hands
the document to whoever is on the path. Ask them for an https address.
```

A document the schema rejects is reported without printing its own values back at you, unlike `sovrium validate` on a file you wrote. These bytes came from somebody else, and a publisher who controls them should not get to choose what lands in your terminal. You still get the position and the expected shape.

### `--git` — start the project under version control

```bash
sovrium init ./my-app --template crm --git
```

Runs `git init` in the new directory, stages the scaffold, and lands one commit:

```console
$ git -C ./my-app log --format='%an <%ae>%n%s' -1
Sovrium <local@sovrium>
Initial commit from sovrium init
```

That identity is passed per invocation rather than read from your git config, because a machine that has never run `git config --global user.email` is exactly the machine this flag is for — and there an inherited identity is no identity and the commit simply fails. `local@sovrium` has no TLD on purpose: it cannot be mistaken for a real mailbox. The `.gitignore` that `init` writes is what keeps the data directory and `.env` out of that commit.

**A convenience, never a prerequisite.** On a host with no `git` the scaffold still succeeds, exits `0`, writes no repository, and says what was skipped:

```console
git is not installed, so --git was skipped — the project itself was created.
Install git and run 'git init' in the project directory to version it.
```

Going back to an earlier version of an app does not depend on git either: under `--watch` Sovrium keeps its own history of every config it accepted, described in **Undo and Reset**.

## `sovrium build`

```text
Usage: sovrium build [config] [options]
```

Generate a static site — HTML, CSS and assets — from your configuration, ready for any static host.

```bash
sovrium build app.yaml

SOVRIUM_DEPLOYMENT=github-pages sovrium build app.yaml

SOVRIUM_OUTPUT_DIR=./out \
  SOVRIUM_BASE_URL=https://example.com \
  SOVRIUM_GENERATE_SITEMAP=true \
  SOVRIUM_GENERATE_ROBOTS=true \
  sovrium build app.yaml
```

Build options come from `SOVRIUM_` environment variables rather than flags, because they are deployment facts rather than per-invocation choices. Output goes to `SOVRIUM_OUTPUT_DIR` when set; otherwise to a `dist/` directory beside the config file.

## `sovrium schema`

```text
Usage: sovrium schema [options]
```

Print the JSON Schema (Draft 2020-12) for the app configuration to stdout, or write it to a file with `--output`.

```bash
sovrium schema
sovrium schema --output app.schema.json
```

The document is self-contained, with a top-level `$schema` declaration, so any JSON-Schema-aware editor or validator consumes it as-is.

## `sovrium validate`

```text
Usage: sovrium validate <config>
```

Decode a config file and report what is wrong. It accepts `.json`, `.yaml`, `.yml` and `.ts`, resolving `$ref` includes first. Prints `Valid configuration: <name>` and exits `0`, or a tree of errors and exits `1`. Run it in CI ahead of a deploy — it is the same decoder the server runs at boot.

## `sovrium types`

```text
Usage: sovrium types [options]
```

Write the TypeScript authoring surface into a directory, so a config can be authored as `app.ts` with no `package.json`, no `node_modules` and no install step.

```bash
sovrium types
sovrium types --output ./config
```

Two files land, and they are treated differently on purpose:

- **`sovrium.d.ts` is rewritten on every run**, because it describes the schema of the binary that wrote it. Re-run the command after upgrading.
- **`tsconfig.json` is written only when absent.** Once a project has one it is yours, and replacing it is not an acceptable side effect of asking for types. When one already exists the command says so, and names the single thing that has to stay true of it: `sovrium.d.ts` must remain in the TypeScript program.

Author the config with a **type-only** import — the declaration exports no runtime value, because the binary does not resolve bare-package specifiers:

```ts
import type { AppConfig } from 'sovrium'

export default { name: 'my-app' } satisfies AppConfig
```
