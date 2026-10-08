# Third-Party Licenses

> `sovrium licenses` prints the license notice of every third-party component the binary carries — its version, its copyright line and its license text — read from the binary, with no network.

```text
Usage: sovrium licenses [--format md|json] [--output <path>]
```

Sovrium is built on open-source components, and their licenses ask that their notices travel with the software that includes them. A standalone binary has no folder beside it to hold those files, so it carries them itself: every production package, the Bun runtime the binary is compiled with, and the fonts it embeds.

## Print every license

```bash
sovrium licenses
```

The document has two parts:

- **Components with a notice of their own** — those whose license asks for its full text and a pointer to the source (the Mozilla Public License 2.0, the SIL Open Font License 1.1, the Python Software Foundation License), and the Bun runtime. Each gets its name, version, license, source and full text.
- **Other open-source components** — every other package, grouped by license text. Most are under MIT, ISC, BSD or Apache 2.0, and many carry the same text word for word, so each distinct text is printed once, after the list of packages it covers. Each package keeps its own version and copyright lines.

Nothing is fetched, and nothing in your project is read.

## Keep a copy beside a deployment

```bash
sovrium licenses --output THIRD-PARTY-LICENSES.md
```

Writes the same document to a file instead of the terminal, creating parent directories as needed; it works with `--format json` too. Useful when you redistribute Sovrium inside an image or an installer of your own and want the notices next to it.

## For tooling

```bash
sovrium licenses --format json
```

One JSON document, marked `"format": "sovrium-licenses"`, with three arrays:

- `notices` — the components with a notice of their own: `name`, `version` (`null` for a font, which has no package version), `license`, `source`, `file` (where the notice lives in the source repository) and `text`.
- `components` — every other package: `name`, `version`, `spdx` (its license as an SPDX expression, for example `MIT OR Apache-2.0`), `declared` (the license exactly as the package states it, for example `MIT OR Apache`), `copyright` (a list of lines, possibly empty) and `textId`.
- `texts` — each distinct license text once: `id` and `text`. A component's `textId` names its text.

An unknown `--format` is refused: the command names the accepted values, `md` and `json`, prints no notices and exits 1.

## Where else the texts live

The hand-written notices are in the `licenses/` folder of the Sovrium source repository. The desktop app bundles that folder, including `licenses/desktop/THIRD-PARTY-NOTICES.txt`, which attributes the desktop shell's own Rust crates and window packages the same way. Sovrium's own license is `LICENSE.md`, at the root of that repository.
