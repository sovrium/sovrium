# The Library of Ready-Made Pieces

> `sovrium library` ships blocks, connections and automation recipes inside the binary, and copies the one you pick into your config as a file you own.

```text
Usage: sovrium library list [--kind <kind>] [--category <c>] [--format md|json]
       sovrium library search <query> [--limit <n>]
       sovrium library show <id>
       sovrium library add <id> [--set key=value]... [--as <name>] [--into <config>] [--dry-run] [--no-wire]
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

## Installing an entry

```bash
sovrium library add block/hero-centered --set headline="Handmade bindings that last"
```

The command finds your config the way `sovrium start` does — `app.yaml`, `app.yml` or `app.ts` in the working directory — or uses the one `--into` names, which must sit inside the working directory. Then it:

1. **Writes the fragment** to `library/<kind>/<name>.yaml` beside your config, opening with a `# sovrium-library: <id>@<version>` line so you always know where it came from. The file is yours: edit it like any other part of your config.
2. **Wires it** by adding exactly one line, `- $ref: ./library/<kind>/<name>.yaml`, at the end of the `components`, `connections` or `automations` list — creating the key at the end of the file when it is missing. Nothing else in `app.yaml` moves: comments, ordering and quoting stay as you wrote them.
3. **Lists the secrets** an entry reads by appending their names — never a value — to `.env.example`. `.env` is never read or written.

A recipe that needs a connection installs it too, unless your config already defines one of that name.

An entry that reads data binds to a table your config already has: `library show` lists the table and fields it expects, `--set table=<yours>` (and any field parameter) rebinds it, and `add` refuses — writing nothing — when the table or a field is missing. The library never creates a table.

`--set key=value` fills a parameter the entry declares, and `--as <name>` installs it under another name. `--dry-run` prints the files and the line it would write and writes nothing. `--no-wire` writes the fragment and prints the line for you to place.

## What it refuses, and what it leaves alone

The config is decoded before anything changes. If it did not validate to begin with, nothing is written and the existing problem is reported the way `sovrium validate` reports it — fix that first. The edited config is then decoded again, with the new fragment in place, before a byte reaches the disk; a change that would not validate is refused whole.

It never overwrites a fragment you edited, and it refuses an entry whose name your config already uses — naming `--as` as the way out. Adding an entry that is already installed and wired changes nothing and says so.

When the target key is written in a form a single line cannot safely extend — `components: []`, a `$ref` to another file, an anchor — the fragment is still written, your config is left exactly as it was, and the line to add is printed with the key it belongs under. A TypeScript config is never edited: the fragment is written as `library/<kind>/<name>.ts` and the `import` to paste is printed.

## Installing API operations one by one

Several connections come with the endpoints of their provider's API, generated from the vendor's own API description: `sovrium library search campaign` lists the matching ones under their provider, twenty at most unless `--limit` asks for another number, and `sovrium library show lemlist/get-campaigns` prints one with its method, path, parameters and the vendor's documentation. The connection's article, `sovrium docs library/connection-<provider>`, lists every operation, a heading per group.

```bash
sovrium library add lemlist/get-campaigns
```

This declares the operation, exactly as the library ships it, under `operations` in `library/connection/lemlist.yaml`, installing and wiring the lemlist connection first when your config does not have it. A second operation is appended after the ones already there; one already declared changes nothing. `--tag <group>` declares a whole group — `sovrium library add lemlist --tag campaigns` — and an unknown group is refused with the list of real ones. `--all` declares every operation of the provider, and asks for `--yes` when there are more than fifty. `--dry-run` prints the operations it would add and writes nothing.

The connection fragment is rewritten only while it is still exactly what the library wrote. Once you have edited it, it is left byte for byte as it is, and the operations are printed for you to paste under `operations` instead. The whole app is decoded with the new operations in place before anything is written.

The library never runs anything at install time, never reaches the network, and is not loaded when your app starts.
