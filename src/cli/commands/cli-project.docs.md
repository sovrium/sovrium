# Project Commands

> Scaffold a project, build it to static files, print its schema, check a config before you ship it, and write the types for a TypeScript config.

Five commands operate on a project rather than on a running server. Each answers `--help` with its own option list, which is the authoritative one; what follows is what the options are _for_. Two more move a whole install: `sovrium backup` writes the database, the key, the config and the uploads to one archive, and `sovrium restore` puts it back; see **Back Up and Restore**. `sovrium reindex` rebuilds the AI knowledge index from the shell; see **Rebuilding the AI Knowledge Index**.

## `sovrium init`

```text
Usage: sovrium init [dir] [options]
```

Scaffold a new project into the given directory, or into the current one when none is passed. Every scaffold writes a config file, a `CLAUDE.md` written for that template's domain, Sovrium's agent skills under `.claude/skills/` (as `sovrium skills` writes them; see **Agent Skills**), an `.env.example`, a `.gitignore`, and a `public/` directory for static assets. The bare `hello-world` default gets the same set.

```bash
sovrium init ./my-app                          # blank starter
sovrium init ./my-app --template crm --name acme-crm
sovrium init ./my-app --template sovrium/crm-template#v2
sovrium init ./my-app --typescript
```

`--name` is written into the scaffolded config and defaults to the directory name. `--force` allows an existing config file to be overwritten.

`--template` takes a bundled template name (`sovrium templates` lists the bundled names, and an unknown one exits `1` and prints the list) or a **GitHub repository** in any of the forms `owner/repo`, `gh:owner/repo` or `https://github.com/owner/repo`, each with an optional `#ref` naming a branch, tag or SHA. Only `github.com` is supported.

**A project you did not write may contain code.** An `app.ts` config is a program that `sovrium start` runs, and an automation's `code` step runs TypeScript on every trigger, with the access the project has, whatever the config's format. Before it creates a project from a GitHub repository, a published document (`--from-url`) or a bundle (`--from-bundle`), `init` names each one it finds: the file, or the automation and the step. A GitHub repository that contains code is refused with exit `1`, writing nothing, until you have read it and run the command again with `--allow-code`. A document or a bundle is created, the paragraph printed beside where it came from.

`--from-url <url>` forks one published YAML or JSON config over HTTPS (the format comes from the URL's path, `.yaml`, `.yml` or `.json`, or from the response's `Content-Type` when the path has no extension), and `--git` initialises a repository and lands the scaffold as one commit. The fork, what it refuses and how to inspect or pin a document first are described in **Forking a Published Config**; `--git` below.

`--from-bundle <source>` opens an archive written by `sovrium bundle` (from an `https:` link, a `file:` URL or a path) as a new project, after checking every file and its publisher; see **Opening a Bundle**.

`--typescript` writes an `app.ts` **instead of** a YAML config, alongside the `sovrium.d.ts` and `tsconfig.json` that make it check. It refuses to combine with `--template`: a template ships its own `app.yaml`, and Sovrium resolves `app.yaml` before `app.ts`, so the generated config would be permanently shadowed. Scaffold the template first, then convert its config by hand.

**`init` never clobbers what it does not own.** An existing `.gitignore`, `.env.example` or `public/` is left verbatim. The config file is the one thing `init` owns, and even that is only overwritten with `--force`.

### `--git`: start the project under version control

```bash
sovrium init ./my-app --template crm --git
```

Runs `git init` in the new directory, stages the scaffold, and lands one commit:

```console
$ git -C ./my-app log --format='%an <%ae>%n%s' -1
Sovrium <local@sovrium>
Initial commit from sovrium init
```

That identity is passed per invocation rather than read from your git config, because a machine that has never run `git config --global user.email` is exactly the machine this flag is for, and there an inherited identity is no identity and the commit simply fails. `local@sovrium` has no TLD on purpose: it cannot be mistaken for a real mailbox. The `.gitignore` that `init` writes is what keeps the data directory and `.env` out of that commit.

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

Generate a static site (HTML, CSS and assets) from your configuration, ready for any static host.

```bash
sovrium build app.yaml

SOVRIUM_DEPLOYMENT=github-pages sovrium build app.yaml

SOVRIUM_OUTPUT_DIR=./out \
  SOVRIUM_BASE_URL=https://example.com \
  SOVRIUM_GENERATE_SITEMAP=true \
  SOVRIUM_GENERATE_ROBOTS=true \
  sovrium build app.yaml
```

Build options come from `SOVRIUM_` environment variables rather than flags, because they are deployment facts rather than per-invocation choices. Output goes to `SOVRIUM_OUTPUT_DIR` when set; otherwise to a `dist/` directory beside the config file. It also writes the app's stylesheet to `output.css` in the data directory (`.sovrium/output.css` unless `SOVRIUM_DATA_DIR` moves it, or `SOVRIUM_CSS_FILE` names the exact path) with a first line recording the engine version and design that built it, so a production `sovrium start` can serve that file instead of compiling, whatever the app declares. A file whose first line names another engine version or design is set aside with one warning. The operator console compiles its own stylesheet and never reads this file.

With `SOVRIUM_GENERATE_SITEMAP=true` the build also reads the database it runs against (`DATABASE_URL`) for the records of each collection page an anonymous visitor could open, lists them in `sitemap.xml` exactly as the running server's `/sitemap.xml` does, and writes each listed record's page as its own HTML file (`blog/pricing-change.html` for `/blog/pricing-change`), so a static host answers every address the sitemap advertises. In an app that declares `languages`, it lists each page once per language, in every `languages.supported` language unless `SOVRIUM_LANGUAGES` names fewer. Past 5 000 addresses it writes `sitemap-1.xml`, `sitemap-2.xml`, … beside an index. The rules that decide which records are listed are in **SEO & Crawlers**.

An app that declares `languages` is written one directory per language, each page at the address the running server gives it. A page whose path names no language is written in every language: `/about` becomes `en/about.html` and `fr/about.html`, each composed in its own language. A page whose path already names its language is written once, there: `/fr/pricing` becomes `fr/pricing.html` and nothing else. A page with one path per language, such as `{ en: /manifesto, fr: /manifeste }`, becomes `en/manifesto.html` and `fr/manifeste.html`. The root `index.html` is the home page in the default language. Every absolute address the build derives, in `sitemap.xml` and `robots.txt` as in the pages' canonical and alternate links, starts with `SOVRIUM_BASE_URL`, even when the shell also sets `BASE_URL`. Under `SOVRIUM_BASE_PATH` it starts with that path too: `SOVRIUM_BASE_URL=https://acme.example` with `SOVRIUM_BASE_PATH=/docs` publishes `https://acme.example/docs/…`, and a base URL that already ends with the path, such as `https://acme.example/docs`, is not given it twice. So every address the sitemap and the pages' `hreflang` alternates name is a file in the output.

Every script a built page loads is written beside the pages, under the name the page asks for (`assets/client.js`, `assets/scroll-animation.js` and so on), together with every module those scripts import, under `assets/client-chunks/`, and the part of the interactive-component bundle the pages reach under `assets/islands/`. That part is the `island-entry-*.js` module a page loads and the files it imports, and the chunk of each interactive component a page uses, the built-in ⌘K palette included; a component no page uses is not written. So a static host answers each `<script src>` and `modulepreload` link in the output and each file it loads in turn. A build carries no development tooling: the live-reload client that `sovrium start` adds to its pages in local development is neither loaded by a built page nor written to the output, whatever `NODE_ENV` is set to.

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

`--output <dir>/<name>.json` also writes, beside it, `<name>.index.json` (the same schema with each top-level key pointing at its own file) and `<name>/<key>.json`, one schema per top-level key, sharing their definitions through `<name>/_defs.json`. Point a `$ref` partial that holds one section, such as a `tables.yaml`, at the file for its key. The full file is unchanged, and printing to stdout writes nothing.

## `sovrium validate`

```text
Usage: sovrium validate <config>
```

Decode a config file and report what is wrong. It accepts `.json`, `.yaml`, `.yml` and `.ts`, resolving `$ref` includes first. Prints `Valid configuration: <name>` and exits `0`, or a tree of errors and exits `1`. Run it in CI ahead of a deploy: it is the same decoder the server runs at boot.

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

Author the config with a **type-only** import. The declaration exports no runtime value, because the binary does not resolve bare-package specifiers:

```ts
import type { AppConfig } from 'sovrium'

export default { name: 'my-app' } satisfies AppConfig
```
