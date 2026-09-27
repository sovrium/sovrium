# Release Notes

> `sovrium changelog` prints the release notes of the version you run, of any earlier version, or of everything since the version you upgraded from — read from the binary, with no network.

```text
Usage: sovrium changelog [<version>] [--list] [--since <version>] [--format md|json] [--output <path>]
```

Every Sovrium release publishes release notes: what broke, what is new, what was fixed and what got faster. The binary carries those notes for every release, so the answer to "what changed?" is always one command away — on your laptop, on a server with no internet access, or inside the AI that edits your config.

The notes the binary prints are the ones published with it. Nothing is fetched, and nothing in your project is read.

## What changed in the version I run

```bash
sovrium changelog
```

Prints the entry of the version `sovrium --version` reports, then one line saying how many earlier releases the binary knows about.

An entry looks like this:

```markdown
## 0.27.0 (2026-09-23)

### Features

- **cli**: add sovrium docs --export for documentation sites

### Bug Fixes

- **pages**: keep what is typed into a form inside a tab panel
```

The bold prefix names the part of Sovrium a change touches. A release with nothing you can see says so in one line.

A binary you built yourself between two releases has no published entry of its own yet. It says so, and prints the latest entry it carries.

## One release

```bash
sovrium changelog 0.25.0
sovrium changelog v0.25.0
```

Both spellings work. A version the binary does not carry is refused, and the message suggests the nearest versions it does carry.

## Every release

```bash
sovrium changelog --list
```

One line per release, newest first, with its date and a count of what it holds — `1 feature, 3 fixes`, `4 breaking, …` — so you can see which entries are worth opening. The version you run is marked `current`.

## Everything since I upgraded

```bash
sovrium changelog --since 0.24.0
```

Prints every release after `0.24.0`, up to the version you run, newest first. Before the first entry, it gathers **every breaking change** of those releases in one place, each naming the version that introduced it: when you jump several versions at once, that is the list to read before anything else.

If `0.24.0` is the version you run, or a newer one, the answer is `Already up to date`.

## For tools and scripts

```bash
sovrium changelog --since 0.24.0 --format json
```

Prints one JSON document:

```json
{
  "format": "sovrium-changelog",
  "schemaVersion": 1,
  "engine": "0.28.0",
  "releases": [
    {
      "version": "0.27.0",
      "date": "2026-09-23",
      "compareUrl": "https://github.com/sovrium/sovrium/compare/v0.26.0...v0.27.0",
      "current": false,
      "sections": [
        {
          "kind": "features",
          "title": "Features",
          "entries": [
            { "scope": "cli", "text": "add sovrium docs --export for documentation sites" }
          ]
        }
      ]
    }
  ]
}
```

`kind` is `breaking`, `features`, `fixes`, `performance` or `other`. `scope` is `null` for a change that names no area. The releases are the same ones the markdown view prints, in the same order.

`--output <path>` writes the result to a file instead of the terminal, creating missing folders:

```bash
sovrium changelog --since 0.24.0 --output notes/upgrade.md
```

## Refusals

Each exits `1` with a message saying what to do instead:

- a version the binary does not carry, or a word that is not a version;
- a version together with `--list` or `--since` — ask for one view at a time;
- a `--format` other than `md` or `json`.

`sovrium changelog --help` prints the usage.
