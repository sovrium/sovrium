# Editor Setup

> Pointing an editor at the JSON Schema gives a config file autocomplete, hover documentation and errors underlined as you type — the same structural checks the validator runs, minus the trip to a terminal.

## VS Code

JSON Schema is handled natively for `.json`. For `.yaml` and `.yml` it needs the YAML extension (`redhat.vscode-yaml`).

### Declaring the schema in the file

The most portable option: the association travels with the config, so a teammate who clones the repo gets it without changing any settings.

```yaml
# yaml-language-server: $schema=https://sovrium.com/schema/app.json
name: my-app
```

Point it at a locally generated file instead to work offline, or to pin the exact version you deploy:

```yaml
# yaml-language-server: $schema=./app.schema.json
name: my-app
```

Generate that file with `sovrium schema --output app.schema.json` and commit it. Regenerate it whenever you upgrade the binary — a stale schema file is worse than none, because the squiggles it draws are confident and wrong.

### Mapping it in settings

Better when several files across a workspace share the schema.

```json
{
  "yaml.schemas": {
    "https://sovrium.com/schema/app.json": ["app.yaml", "*.sovrium.yaml"]
  },
  "json.schemas": [
    {
      "fileMatch": ["app.json", "*.sovrium.json"],
      "url": "https://sovrium.com/schema/app.json"
    }
  ]
}
```

## JetBrains IDEs

IntelliJ IDEA, WebStorm and their siblings map JSON Schemas natively, with no plugin, and one mapping covers both YAML and JSON.

Open **Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings**, add a mapping, paste the schema URL or the path to a generated file, and set the file pattern to match your config.

## What the schema cannot catch

Editor validation is **structural**. It catches a misspelled property, a value of the wrong type, an enum member that does not exist.

It does not catch cross-section mistakes — an automation naming a table that was never declared, a `$ref` pointing at a missing file — because those need the whole app resolved first, and an editor is looking at one file. Run `sovrium validate` for that, and run it in CI. Green squiggles are a fast first pass, not the gate.

**Authoring in TypeScript instead needs no schema mapping at all.** Running `sovrium types` writes a declaration that gives the editor the same information through the type system, and the two approaches are alternatives rather than layers.
