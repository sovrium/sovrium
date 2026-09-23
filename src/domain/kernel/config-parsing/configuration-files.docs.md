# Config Files: YAML and JSON

> An app is one configuration object. This is how to write it as a YAML or JSON file, how the format is decided, and where a command looks for it.

## The same object, two spellings

YAML is the better default for hand-authoring: it takes comments, needs less punctuation, and diffs readably. JSON is the better target when something else generates the config.

```yaml
name: my-app
version: 1.0.0
description: A simple todo list

tables:
  - id: 1
    name: tasks
    fields:
      - { id: 1, name: title, type: single-line-text, required: true }
      - { id: 2, name: done, type: checkbox, default: false }
```

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A simple todo list",
  "tables": [
    {
      "id": 1,
      "name": "tasks",
      "fields": [
        { "id": 1, "name": "title", "type": "single-line-text", "required": true },
        { "id": 2, "name": "done", "type": "checkbox", "default": false }
      ]
    }
  ]
}
```

Either runs the same way, with `sovrium start app.yaml` or `sovrium start app.json`.

## The format comes from the extension

Never from the content. `.yaml` and `.yml` go through the YAML parser, `.json` through the JSON parser, `.ts` and `.mts` are imported as modules. Anything else is refused up front, naming what it accepts:

```text
Error: Unsupported file format: .toml

Supported formats: .json, .yaml, .yml, .ts
```

Because detection is by extension rather than by sniffing, every example in this manual transcribes between YAML and JSON unchanged — the resulting object is identical, and nothing about the file's contents can change which parser reads it.

**Tabs are the classic YAML failure.** Indentation must be spaces. A tab produces a parse error with a details line pointing at the offending position, which is the one YAML error that does not read as a schema problem.

## Where a command looks

Configuration comes from the first source that answers.

| Order | Source            | Form                                          |
| ----- | ----------------- | --------------------------------------------- |
| 1     | The path argument | `sovrium start app.yaml`                      |
| 2     | `APP_SCHEMA_FILE` | A path, for configs too large to pass inline  |
| 3     | `APP_SCHEMA`      | Inline JSON, inline YAML, or an `http(s)` URL |
| 4     | Auto-discovery    | `app.yaml`, then `app.yml`, then `app.ts`     |
| 5     | Nothing           | `Error: No configuration provided`            |

**A file path always wins over the environment.** That ordering is what lets a container carry a default `APP_SCHEMA` while a local run overrides it simply by naming a file — rather than having to unset a variable it did not set.

**Auto-discovery is last, and that is deliberate.** `sovrium start` with no argument probes the project directory for `app.yaml`, `app.yml` and `app.ts`, in that order, and boots the first that exists — printing a one-line notice naming what it found, so a discovered config is never mysterious. Placing the probe after both environment variables means no invocation that resolves today resolves differently; the step only fires where the command used to error out.

Two limits worth knowing. The probe reads **that one directory** and never walks up to a parent, because `start` anchors the public directory, the config hash and the content directory to the config's own folder and a parent walk would move all three silently. And naming a file through `SOVRIUM_CONFIG_FILE` **replaces** the probe rather than joining it: a supervisor that says `staging.yaml` means that file, and quietly falling back to `app.yaml` would boot something nobody asked for.

`APP_SCHEMA` holds the configuration itself rather than a path, which is the useful shape for a container or a one-off run where mounting a file is more trouble than it is worth.
