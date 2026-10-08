# Validation & Schema Generation

> Checking a config without starting anything, its `--json` report for programs, emitting the JSON Schema that describes every config, and exporting the design system for an agent.

Three commands that read a config and produce a file or a verdict. All three work on every distribution — the binary, Docker, Homebrew — and none of them starts a server or opens a database.

## `sovrium validate <file>`

```text
Usage: sovrium validate <config>
```

The pre-deploy gate. Prints `Valid configuration: <name>` and exits `0`, or the errors and exits `1`.

```bash
sovrium validate app.yaml
sovrium validate app.yaml || exit 1
```

**One validation, three commands.** `validate`, `start` and `build` read your config through the same pipeline: the same authoring shorthands are accepted, and the same cross-field rules are enforced. A config `sovrium validate` accepts is a config `sovrium start` boots.

### Every mistake, in one report

`validate` reports every mistake it finds in one run, not the first one. A config with a wrong strategy type under `auth`, a field without its `name`, and a misspelled component property in a `$ref` partial prints all three:

```console
$ sovrium validate app.yaml
Error: Validation failed.

3 problems

app.yaml
  Expected Auth Strategy, got {"type":"emailAndPasword"}
    at auth.strategies[0]
    Accepted variants: Email and Password Strategy, Magic Link Strategy, OAuth Strategy
  Missing key
    at ["tables"][0]["fields"][0]["name"]

pages/home.yaml
  Unknown property 'elemnt' on component type 'text'
    at pages[0].components[0]
    Did you mean 'element'?
    Accepted here: type, children, props, content, interactions, responsive, visibility, i18n, session, element, required
```

- **A count heads the list** — `1 problem`, `3 problems` — so you know how much is coming.
- **One heading per file.** Each is the file's path from the root config's directory — `pages/home.yaml`, not `home.yaml`, because two partials in two folders can share a name. The root config comes first, then each partial. Within a file, problems follow the order the keys appear in it.
- **One mistake, one problem.** A value that matches none of the shapes a position accepts is reported against the shape you meant — the one whose `type` you wrote, or that recognises most of your keys — and never again for the shapes it was compared with and ruled out.
- **At most 50 in prose.** Past that, the report prints the first 50 and closes with `and N more problems`; fix those and run again. The ceiling is for a terminal: `--json` carries every finding, however many there are.

`sovrium start` and `sovrium build` print the same report between their own first line — `Sovrium refused this configuration — nothing was started.` (or `built`) — and a closing pointer to `sovrium validate`, and exit `1` having started or built nothing.

### `--json` — the same verdict, for a program

`sovrium validate app.yaml --json` reports the verdict as one JSON document instead of prose. It is for the readers a terminal does not serve: an editor underlining the offending line, a CI step, a supervising shell, or the AI that just wrote the config and has to find out whether the edit landed.

Two guarantees make it safe to parse:

- **stdout carries the JSON document and nothing else.** Anything conversational stays on stderr — the `Using app.yaml (auto-discovered)` notice, and the `Error:` line for a file that could not be read at all. Nothing is ever interleaved with the document.
- **The exit code is unchanged.** `0` for a valid config, `1` for an invalid one. `--json` changes the shape of the report, never the verdict, so a script that already wraps `sovrium validate` keeps working when you add the flag.

An invalid config — a `text` component carrying `tag`, where the property is spelled `element`, in a config split across `$ref` files:

```json
{
  "valid": false,
  "files": ["/srv/invoices/app.yaml", "/srv/invoices/config/pages.yaml"],
  "findings": [
    {
      "path": "pages[0].components[0]",
      "message": "Unknown property 'tag' on component type 'text'",
      "accepted": [
        "type",
        "children",
        "props",
        "content",
        "interactions",
        "responsive",
        "visibility",
        "i18n",
        "session",
        "element",
        "required"
      ],
      "sourceFile": "pages.yaml",
      "severity": "error"
    }
  ],
  "notices": []
}
```

| Field      | Meaning                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `valid`    | The verdict — the same one the exit code carries                                                                                          |
| `files`    | Every file the verdict covered: the root, plus each `$ref` partial or imported module. This is how a watcher learns which files to follow |
| `findings` | One entry per refusal; empty when the config is valid                                                                                     |
| `notices`  | Non-fatal messages. A notice never makes `valid` false and never changes the exit code, so a deploy gate cannot fail on a working config  |

A finding:

| Field        | Meaning                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`       | Dotted and indexed path from the config root — for every kind of refusal, a length, range or pattern check included. Empty only for a refusal belonging to the config as a whole          |
| `message`    | What is wrong, in one line. It names the position and the expected shape — and the offending value only where that value is a name (see below)                                            |
| `accepted`   | What may be written there instead — read off the schema, and **never elided**. For an unknown component `type` that is every legal type, in full. Absent when there are no alternatives   |
| `sourceFile` | The `$ref` partial the mistake lives in, present only for a split config. There, `path` names a position in the _resolved_ document, which exists in no file; this names the file to open |
| `severity`   | `"error"` on every finding. Every refusal `validate` reports is fatal; the field exists so a reader never has to infer that from the exit code of the whole run                           |

Two things to build around. A config that cannot be **read** at all — a missing file, an unsupported extension — is refused before a verdict exists, so it prints an `Error:` line on stderr and exits `1` with no JSON document. And `findings` carries **every** mistake the run found, with no ceiling: the 50-problem limit applies to the prose report only, because a program can page through what a person would have to scroll.

The same finding shape is published by a running instance's status file, described in **Lifecycle Commands**, and pushed to the browser when a `--watch` save is refused — one vocabulary, whether you asked the question or were told the answer.

#### A finding carries the shape, not your config's values

The prose report echoes the value it rejected, because you wrote the file and the value is the part you act on. `--json` does not, and neither does any other machine-readable channel: its output goes wherever the caller sends it — a CI log, an editor's panel, an assistant's transcript — and the mistake that most often reaches a decoder is an `env:` block written as a mapping rather than a list, where the rejected value is a credential.

A finding names a rejected value only where that value was checked against a **closed set of names**, which the same finding publishes in full under `accepted`. So:

- `Unknown component type 'txt'` **keeps** the value. `accepted` lists every legal `type`, so `txt` is a misspelled name and telling you which one you wrote is the whole diagnosis.
- `Unknown property 'defalt' on field type 'date'` **keeps** it too. That is a key you wrote, not a value — and it is the thing to delete.
- `Expected array | undefined` **drops** it. There is no list of legal values to check against, so whatever sat there was free-form data.

What survives is always enough to act on: the path, the complaint, and the shape that belongs. Run `sovrium validate` without `--json` when you want the value back.

### Notices

A notice is something worth telling you that is not worth failing over. The config is valid and ships: `valid` stays `true` and the exit code stays `0`, so a deploy gate never trips on one. In prose mode notices print to **stderr** ahead of the verdict, which keeps stdout parseable; under `--json` they arrive in the `notices` array. Today four exist — a superseded design key, a field whose id is left implicit, an engine interface string overridden under its bare name, and a prose part (`paragraph`, `heading2`, `list` …) spaced with the `my-*` shorthand, which paints nothing there: the notice names the token, the part and the `mt-*` / `mb-*` spelling that does. A **deprecated key** is told the same way: it is still accepted for one release, and `sovrium validate`, `sovrium start` and `sovrium build` each print one `Warning:` line per occurrence on **stderr** — naming the key, its path, the release that will refuse it and what to write instead — without changing the verdict or the exit code.

#### `field-id-implicit`

A field `id` is optional. Leave it out and the decoder fills it in from the field's **position in the list** — so the identity exists whether or not you wrote it, and you cannot see it.

```console
$ sovrium validate app.yaml
Notice:

  field-id-implicit: table "contacts" — "full_name", "email" declare no id, so the id is the field's position in the list. Inserting a field above one of them shifts every id after it, and the migration diff reads that as a rename. Give each field an explicit id — keep the ones it has today, and give new fields the next unused number.

Valid configuration: crm
```

The migration engine diffs tables **by id**, so inserting a field anywhere but the end shifts every id after it. Three fields with no ids decode as `1`, `2`, `3`; add one at the top and they decode as `2`, `3`, `4` while the newcomer takes `1` — every field now carries the id that used to belong to its neighbour, and the diff reads that as a cascade of renames between fields nobody renamed.

Nobody writes that by hand. An AI asked to "add a field before `status`" writes it every time, which is why the notice exists now rather than when ids were introduced.

The fix is to write the ids down:

```yaml
tables:
  - name: contacts
    fields:
      - id: 1
        name: full_name
        type: single-line-text
      - id: 2
        name: email
        type: email
```

Keep the id each field has today — its current position, counting from `1` — and give every new field the next unused number, wherever in the list you put it. The id is identity; the array position is still what orders the fields, so the two are free to disagree. That is the whole point: a field inserted at the top with the next unused id changes the order and renames nothing.

One notice per **table**, not per field: a table written before ids were explicit omits every one of them, and forty identical lines teach their reader to ignore notices. The table is named because "some field somewhere has no id" is not actionable in a config split across a dozen `$ref` files, and a field with no `name` is referred to by the position that _is_ its id. The token `field-id-implicit` is in the message so it is greppable.

#### `engine-key-unprefixed`

You override the engine's own interface text — a grid's **New record**, a confirm dialog's **Cancel** — under the reserved `sovrium.` prefix: `languages.translations.en['sovrium.datatable.newRecord']`. Ten keys were read under their bare name before the prefix existed, and a config that still spells one of them that way keeps working, with this notice:

```console
$ sovrium validate app.yaml
Notice:

  engine-key-unprefixed: languages.translations.en['datatable.newRecord'] overrides engine interface text under its bare name, which is deprecated — write it as 'sovrium.datatable.newRecord'. The bare name still works for the ten keys that accepted it before the prefix.

Valid configuration: crm
```

One notice for the whole config, listing every occurrence with its prefixed spelling. The server prints the same notice once when it starts. A bare key that is not one of the ten earns nothing: it is your own vocabulary, and it never renames engine chrome.

## Validating from inside a config

To check a config **from a running app** — a webhook that accepts a submitted config, a scheduled audit of a config in storage — use the `sovrium` automation action with the `validateConfig` operator. It runs the same decoder, with no side effects and no boot.

```yaml
automations:
  - name: check-submitted-config
    trigger:
      type: webhook
      method: POST
    actions:
      - name: check
        type: sovrium
        operator: validateConfig
        props:
          config: '{{trigger.data.config}}'
          format: auto
```

The step exposes `{{steps.check.valid}}` and `{{steps.check.errors}}`. `config` takes the config object or a serialized string; `format` reads the string arm — `json` (the default), `yaml`, or `auto` to try JSON then YAML. To check an archive written by `sovrium bundle` instead, use the `validateBundle` operator described in **Bundle an App**.

Two behaviours are worth knowing before you build on it:

- **An invalid config is a successful step**, reported as `{ valid: false, errors }`. Validation is a verdict, not a fault, so the run continues and your next step decides what to do about it.
- **The candidate is read verbatim.** A `{{...}}` or `$env.X` occurring _inside_ the config you submit is not resolved — it is validated as the literal text it is. That is what makes the verdict trustworthy: what gets checked is exactly what you passed, not a rewritten copy of it.

## `sovrium schema`

```text
Usage: sovrium schema [options]
```

Print the JSON Schema (Draft 2020-12) for the app configuration — the same document the hosted schema URLs serve.

```bash
sovrium schema
sovrium schema --output schemas/app.json
```

With `--output`, the full schema is joined by files for editing **one section** of a config — what a `$ref` partial holds. For `--output schemas/app.json`:

| File                     | What it describes                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `schemas/app.json`       | The whole config. Byte-for-byte what `sovrium schema` prints                                                         |
| `schemas/app.index.json` | The whole config too, with each top-level key pointing at its own file                                               |
| `schemas/app/<key>.json` | The value of one top-level key — `app/tables.json` is what a `tables.yaml` partial holds, `app/pages.json` a `pages` |
| `schemas/app/_defs.json` | The definitions the per-key files share, written once rather than copied into each                                   |

The files reference each other by relative path and declare no `$id`, so an editor resolves them on disk, never over the network. Printing to stdout writes nothing at all.

It takes no arguments beyond the output path and reads nothing from the environment: the schema is derived from the config schema itself, so the output depends only on the Sovrium version. That makes it safe to regenerate in CI and diff — a change in the file is a change in the schema, never in the machine that ran it.

A common use is pinning the schema beside the config so editors validate against the exact version you deploy. Regenerate it after every upgrade, and point your config at it:

```yaml
# yaml-language-server: $schema=./app.schema.json
name: my-app
```

## `sovrium design-system`

```text
Usage: sovrium design-system [config] [options]
```

Export the app's design system — the `design` block plus everything it inherits — as a brief written for an agent, or as a standard token document.

```bash
sovrium design-system app.yaml                                    # the brief, on stdout
sovrium design-system app.yaml --output DESIGN.md                 # committed beside the config
sovrium design-system app.yaml --format json --output tokens.json # DTCG tokens, for tooling
```

Markdown is the default because the default reader is a model. `--format json` emits a W3C Design Tokens (DTCG 2025.10) document, with the Sovrium-specific layer — principles, voice, colour roles, component guidance — carried in `$extensions`.

Like `sovrium schema` it runs offline. Unlike it, the output depends on your config, so it belongs in a pre-commit hook or a CI step that regenerates the committed brief when the design changes.

Two things it refuses rather than works around:

- **An unknown `--format`.** Falling back to markdown would let a CI step asking for something else exit `0` having written the wrong file.
- **A config that fails validation.** Exporting from an unvalidated config produces a design system describing an app that cannot boot — handed to an agent, that is a brief for building against something nobody runs.

The same content is available at runtime from `GET /api/admin/design-system.md` and `GET /api/admin/design-system.json`, both admin-gated.
