# Reading the Manual Offline

> `sovrium docs` prints this manual out of the binary — offline, with no config file, no database and no network — so what you read describes the engine you are actually running.

The manual for the binary ships **inside** the binary. That is the same promise `sovrium types` already makes for the TypeScript surface, extended from types to prose: the declaration `sovrium types` emits describes the schema **that** binary accepts, and the manual `sovrium docs` prints describes **that** binary's behaviour. A version skew between the running engine and the documentation it hands you is not representable.

```bash
sovrium docs                                  # the table of contents
sovrium docs app-schema                       # a whole section
sovrium docs app-schema/llms-txt              # one article
sovrium docs search llms                      # find the article that covers a topic
sovrium docs config llms.full                 # look one option up
sovrium docs env DATABASE_URL                 # one environment variable
sovrium docs cli migrate                      # one command
sovrium docs admin /tables                    # which console page a route serves
sovrium docs --list-sections                  # the section slugs, and how many articles each holds
sovrium docs --section tables --full          # one section in full, repeatable
sovrium docs --full                           # the whole manual, for a context window
sovrium docs --full --format llms --output llms-full.txt
sovrium docs --export content/docs/en         # every article, as files a docs site can build
sovrium docs --export content/docs/en --force # replace a previous export
```

Markdown is the default, for the reason `sovrium design-system` already gives: the intended reader is a model reading a context window, and piping the manual into a prompt should need no flag. `--format json` is for tooling.

## Five lookups, and two section names they shadow

A positional argument is read as a **subcommand** first and as an address second. The subcommands are `search`, `config`, `env`, `cli` and `admin`, and each takes one argument.

Two of those names are also section slugs, so the section cannot be reached by name:

| You type              | You get                                         |
| --------------------- | ----------------------------------------------- |
| `sovrium docs admin`  | The `admin <page>` lookup, asking for a page    |
| `sovrium docs search` | The `search <query>` lookup, asking for a query |

Both exit non-zero rather than printing the section. Address those two sections either through an article — `sovrium docs admin/admin-dashboard` — or through the flag, which never competes with a subcommand:

```bash
sovrium docs --section admin
sovrium docs --section search
```

Every other section is addressable by name.

## Two halves, assembled at read time

The narrative is authored as markdown fragments co-located with the code they describe — the article about the `llms` key sits beside the schema file and its tests. The option tables are **not authored at all**: a fragment carries a directive naming a schema, and the command expands it from that schema's own annotations when it prints.

A table can therefore never fall behind the option it documents, because it does not exist until the moment it is read. A directive naming a schema that no longer exists is a build error; a hand-written table describing a schema that no longer exists is a lie nobody notices.

## Behaviour blocks come from acceptance criteria

Each article names the user stories it documents, and the command renders their acceptance criteria as a `Behaviour` block, grouped by story. A line there is therefore not a claim someone wrote next to a feature; it is the criterion of a test that is authored and not pinned. Criteria whose spec is still a placeholder are omitted, so the manual never describes behaviour nobody has specified.

What this does **not** prove is worth stating plainly rather than implying: "authored and not pinned" is a build-time signal. Whether the spec passes is what the end-to-end run asserts, and a criterion that is wrong ships wrong.

## Refusals, not fallbacks

- **An unknown `--format`.** Falling back to markdown silently is the worse failure: a build step asking for `yaml` receives markdown, exits `0`, writes the wrong file, and nobody looks again. It exits non-zero naming the accepted values.
- **A `--lang` other than `en`.** The in-binary manual is English. The flag exists so that adding a locale later is not a breaking change, and it refuses anything else **by name** rather than quietly serving English to someone who asked for French and will not check.
- **An unknown section, article, option path, environment variable, command or console page.** A reader who typed something that does not exist needs to learn what does, not receive the table of contents and be left to assume their path was empty. Each refusal names what it could not find and where the full list is.

## Determinism

`sovrium docs --full` is a pure function of the binary: two runs of one binary produce identical bytes. That is what lets a consumer pin a version, regenerate, and treat any diff as a real change rather than as noise.

## Exporting for a documentation site

`sovrium docs --export <dir>` writes the whole manual as a directory a documentation site can build from, using nothing but the binary — no source tree, no network.

- **One file per article**, `<dir>/<slug>.md`: a six-key frontmatter block (`title`, `description`, `keywords`, `section`, `order`, `sidebarLabel`) followed by exactly the body `sovrium docs <section>/<slug>` prints. Links a website cannot follow — a relative path, a source file — are flattened to their words. The files are byte-identical to the English articles on the published Sovrium site, which are generated from this same renderer.
- **One manifest**, `<dir>/_nav.json`, carrying what a sidebar needs without re-reading the articles:

  ```json
  {
    "format": "sovrium-docs-export",
    "schemaVersion": 1,
    "engine": "<sovrium --version>",
    "lang": "en",
    "tabs": ["…"],
    "sections": [
      {
        "slug": "app-schema",
        "title": "App Schema",
        "tab": "platform",
        "order": 9000,
        "articles": [
          {
            "slug": "llms-txt",
            "title": "Publish llms.txt",
            "sidebarLabel": "Publish llms.txt",
            "order": 9060,
            "file": "llms-txt.md"
          }
        ]
      }
    ],
    "files": ["…"]
  }
  ```

  Sections are in reading order and articles in section order; `tabs` is in first-appearance order; `files` is every file the export wrote other than the manifest, sorted. Labels, icons and landing paths are not in it — they are your site's copy.

- **A non-empty directory is refused** without `--force`, and nothing is written. A missing directory is created with its parents; an empty one is accepted.
- **`--force` replaces what the export owns and nothing else.** Ownership is the previous export's own `_nav.json` `files` list: those files are removed, the new set is written, and anything the manifest never listed — pages your site authors beside the exported ones — is left untouched. A directory with no manifest has no owned files, so `--force` then only overwrites the paths it writes. It never clears the directory.
- **It is its own output mode.** It refuses to run without a directory, and refuses to combine with an address, a subcommand, `--full`, `--list-sections`, `--section`, `--output` or `--format`, naming both flags.
- **Deterministic.** Two exports from one binary are byte-identical, manifest included — no timestamp, no absolute path — so a site can pin a version, regenerate, and treat any diff as a real change.

## Pointing an agent at it

The whole point is that an agent configuring your app reads the rules from the artifact it is configuring, rather than from pretrained knowledge that may describe a different version. Put this in the project's `CLAUDE.md` — `sovrium init` scaffolds it for you:

```markdown
The complete manual ships in the `sovrium` binary — do not search the web.
Run `sovrium docs search <topic>`, then `sovrium docs config <path>`.
The docs describe THIS binary: check `sovrium --version`.
```

A practical loop for authoring a config with an agent:

1. **Give it the context it needs, and no more.** `sovrium docs search <topic>` finds the article; `sovrium docs <section>/<slug>` prints it. Reach for `--full` only when a tool genuinely needs the whole corpus in one call — it is large enough to crowd out everything else in a context window.
2. **Author in TypeScript.** Run `sovrium types` once, then have the agent generate an `app.ts` checked with `satisfies AppConfig`. Your editor validates its output as it writes, catching invalid field types and misshaped sections inline.
3. **Validate before running.** `sovrium validate app.ts` confirms the config decodes, surfacing unknown field types and structural errors with exit code `1`.
4. **Iterate against the running app.** `sovrium start app.ts --watch` reloads on save, so the agent can refine the config and see the result.

Pairing the manual (context) with the declaration `sovrium types` writes (compile-time validation) and `sovrium validate` (runtime decode) gives the agent a tight feedback loop: generated configs are checked at author time and at validate time, before they ever boot. **When this manual and `sovrium schema` disagree, the schema wins** — it is derived from the same definitions the decoder runs.

## The published-website equivalents

A Sovrium app can publish its own machine-readable documentation over HTTP — an `llms.txt` index, an `llms-full.txt` corpus, and a raw-markdown twin of every page — through the `llms` key of the config. That is a different surface with a different audience: those files describe **your** app to a crawler, where `sovrium docs` describes **the engine** to whoever is configuring it. See the App Schema section for the key.
