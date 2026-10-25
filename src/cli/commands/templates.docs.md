# Templates

> `sovrium templates` lists the templates your Sovrium binary carries, so you can pick one for `sovrium init --template` without guessing a name.

```text
Usage: sovrium templates [--json]
```

Every Sovrium binary carries a set of templates inside it: complete apps, with their pages, tables, demo data and design, that `sovrium init <dir> --template <slug>` copies into a new project. `sovrium templates` prints that set. It reads it out of the binary, so it works offline and lists exactly what the binary you run can scaffold.

## Reading the list

```bash
sovrium templates
```

The templates are grouped by category, in the order the gallery shows them. Each line gives the slug you pass to `--template`, the template's name and a one-line description. A template marked `(headless)` is an API or an MCP server rather than a website: it serves one landing page and its scaffold has no `public/` folder.

## For a script

```bash
sovrium templates --json
```

`--json` prints one JSON document and nothing else:

| Key             | What it holds                                                 |
| --------------- | ------------------------------------------------------------- |
| `format`        | Always `sovrium-templates`                                    |
| `schemaVersion` | `1`. It changes only when a key is removed or changes meaning |
| `engine`        | The version of the binary, as `sovrium --version` prints it   |
| `templates`     | One object per template, in gallery order                     |

Each template object has exactly these keys:

| Key           | What it holds                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------- |
| `slug`        | The name to pass to `sovrium init --template`                                                 |
| `name`        | The template's display name                                                                   |
| `description` | One line saying what the app is                                                               |
| `category`    | The gallery category it belongs to                                                            |
| `topics`      | A list of keywords                                                                            |
| `headless`    | `true` for an API or MCP template, `false` for a website                                      |
| `repository`  | The public repository holding the same template, `https://github.com/sovrium/<slug>-template` |

To print the slugs only:

```bash
sovrium templates --json | jq -r '.templates[].slug'
```

## Next

Scaffold one with `sovrium init my-app --template <slug>`, then `cd my-app` and `sovrium dev app.yaml`. The `init` article describes what the scaffold writes.
