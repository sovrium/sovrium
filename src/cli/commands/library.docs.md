# The Library of Ready-Made Pieces

> `sovrium library` ships blocks, connections and automation recipes inside the binary, and copies the one you pick into your config as a file you own.

```text
Usage: sovrium library list [--kind <kind>] [--category <c>] [--format md|json]
       sovrium library search <query> [--limit <n>]
       sovrium library show <id>
       sovrium library add <id> [--set key=value]... [--as <name>] [--into <config>] [--dry-run] [--no-wire] [--update]
       sovrium library add <provider>/<operation> [--dry-run]
       sovrium library add <provider> --tag <group> | --all [--yes] [--dry-run]
```

The fastest way to a good config is to start from a piece someone already wrote well: a hero section, a connection with the right authentication header, an automation that sends each sign-up to your email tool. The library is that catalogue, verified against the binary it ships in, and readable offline.

| Kind         | Installs into | Example                |
| ------------ | ------------- | ---------------------- |
| `block`      | `components`  | `block/hero-centered`  |
| `connection` | `connections` | `connection/qonto`     |
| `recipe`     | `automations` | `recipe/form-to-brevo` |

Every entry has an article in this manual under the `library` section — `sovrium docs library` lists them, and `sovrium docs search <provider>` finds one by name.

## Finding an entry

`sovrium library list` prints every entry with its kind, category and title; `--kind` narrows it to one kind. `sovrium library search brevo` ranks the entries matching a provider, a tag or a word of the title, best first. `sovrium library show <id>` prints one entry in full: what it installs and where, its parameters and their defaults, the environment variables it reads, what it requires, the provider's documentation link and the date the entry was last checked against it.

Add `--format json` to any of the three for a parseable array or object.

A block that mirrors a shadcn/ui block also answers to shadcn's own id, so `show` and `add` take the id you would give `npx shadcn add`: `sovrium library add login-03` installs `block/login-03`. A full catalogue id always wins, and if two entries ever mirror the same shadcn block the command writes nothing and names both, so you can pick one by its catalogue id.

## Installing an entry

```bash
sovrium library add block/hero-centered --set headline="Handmade bindings that last"
```

The command finds your config the way `sovrium start` does — `app.yaml`, `app.yml` or `app.ts` in the working directory — or uses the one `--into` names, which must sit inside the working directory. Then it:

1. **Writes the fragment** to `library/<kind>/<name>.yaml` beside your config, opening with a `# sovrium-library: <id>@<version>` line so you always know where it came from, and — when the entry has parameters — a `# sovrium-library-params:` line recording the values it was written with. The file is yours: edit it like any other part of your config.
2. **Wires it** by adding exactly one line, `- $ref: ./library/<kind>/<name>.yaml`, at the end of the `components`, `connections` or `automations` list — creating the key at the end of the file when it is missing. Nothing else in `app.yaml` moves: comments, ordering and quoting stay as you wrote them.
3. **Lists the secrets** an entry reads by appending their names — never a value — to `.env.example`. `.env` is never read or written.

An entry that reads environment variables needs them declared under `env` in your config first, since a config may reference only the variables it declares. Until they are, `add` refuses — writing nothing — and prints the exact lines to add, for example:

```yaml
env:
  - key: STRIPE_SECRET_KEY
```

The entry itself is never changed to fit.

A recipe that needs a connection installs it too, unless your config already defines one of that name. An entry another one requires — the password-reset block installs the screen its email links to — takes each `--set` value it declares under the same name and type, and the line announcing it names the value of each of its parameters and where it came from: `--set`, your config, or the entry's default.

A block that adds a record does it through a form, because a page `form` never creates a row on its own: the block places the form with `formRef`, and `add` installs that form beside it. The form is written to `library/form/<name>.yaml`, opens with the same `# sovrium-library:` line, and is wired with one `- $ref:` line under `forms`. It takes the next form `id` your config does not use, and keeps it if you install the block again. `library show` says when a block ships a form. A form embedded this way stores no submission in the Submissions inbox unless you add `submitTo.storeSubmission: true` to it.

An entry that reads data binds to a table your config already has: `library show` lists the table and fields it expects, `--set table=<yours>` (and any field parameter) rebinds it, and `add` refuses — writing nothing — when the table or a field is missing. The library never creates a table.

`--set key=value` fills a parameter the entry declares, and `--as <name>` installs it under another name. A parameter you leave unset takes the entry's default, except a link to the sign-in page, which follows `auth.loginPage` when your config sets it. `--dry-run` prints the files and the line it would write and writes nothing. `--no-wire` writes the fragment and prints the line for you to place.

## What it refuses, and what it leaves alone

The config is decoded before anything changes. If it did not validate to begin with, nothing is written and the existing problem is reported the way `sovrium validate` reports it — fix that first. The edited config is then decoded again, with the new fragment in place, before a byte reaches the disk; a change that would not validate is refused whole.

It never overwrites a fragment you edited, and it refuses an entry whose name your config already uses — naming `--as` as the way out. Adding an entry that is already installed and wired changes nothing and says so. Adding it again with other parameters rewrites the fragment, as long as it is still exactly what the library wrote with the parameters it records, and names each parameter that changed; a fragment you edited is left as it is, and the refusal prints the `--update` command that replaces it. The version on the first line is not part of that comparison: a fragment an earlier Sovrium wrote counts as unedited while the block still writes the same item, and one written before parameters were recorded is compared with the block's default parameters.

`--update` replaces an installed fragment in place with what this version of Sovrium writes, whether you edited it or the block has changed since: `sovrium library add block/hero-centered --update`. The first line then names the version that wrote it. The parameters are the ones the fragment's `# sovrium-library-params:` line records, and a `--set` given with `--update` overrides its own; a fragment that records none takes the entry's defaults. The command says what it replaced — `Replaced library/block/hero-centered.yaml — block/hero-centered@0.26.0, edited since it was installed, with block/hero-centered@<version>` — because an edit it replaces is gone: commit your config first if you may want it back. With `--dry-run` it prints `Would replace …` and writes nothing. A config that already wires the fragment is not wired a second time, and the config is decoded with the new fragment in place before anything is written, as for every install.

Every fragment is laid out the way Prettier lays it out at its default options, in YAML and in TypeScript, so formatting your project leaves it unchanged, and a fragment you only reformatted with those options still counts as unedited. A fragment written before Sovrium laid them out that way reads as edited; moving it aside gets a fresh one.

An empty list written inline — `components: []` — holds nothing to lose, so it becomes a block list holding the one new line; a trailing comment on that line is kept.

When the target key is written in a form a single line cannot safely extend — a non-empty inline list such as `components: [a, b]`, a `$ref` to another file, an anchor — the fragment is still written, your config is left exactly as it was, and the line to add is printed with the key it belongs under. A TypeScript config is never edited: the fragment is written as `library/<kind>/<name>.ts` and the `import` to paste is printed.

## Installing API operations one by one

Several connections come with the endpoints of their provider's API, generated from the vendor's own API description: `sovrium library search campaign` lists the matching ones under their provider, twenty at most unless `--limit` asks for another number, and `sovrium library show lemlist/get-campaigns` prints one with its method, path, parameters and the vendor's documentation. The connection's article, `sovrium docs library/connection-<provider>`, lists every operation, a heading per group.

```bash
sovrium library add lemlist/get-campaigns
```

This declares the operation, exactly as the library ships it, under `operations` in `library/connection/lemlist.yaml`, installing and wiring the lemlist connection first when your config does not have it. A second operation is appended after the ones already there; one already declared changes nothing. `--tag <group>` declares a whole group — `sovrium library add lemlist --tag campaigns` — and an unknown group is refused with the list of real ones. `--all` declares every operation of the provider, and asks for `--yes` when there are more than fifty. `--dry-run` prints the operations it would add and writes nothing.

The connection fragment is rewritten only while it is still exactly what the library wrote. Once you have edited it, it is left byte for byte as it is, and the operations are printed for you to paste under `operations` instead. The whole app is decoded with the new operations in place before anything is written.

The library never runs anything at install time, never reaches the network, and is not loaded when your app starts.
