# Validating a Config

> `sovrium validate` decodes a config against the same schema the server decodes at boot. It touches no database, binds no port and needs no environment, which makes it the cheapest place to catch a broken config.

```bash
sovrium validate app.yaml
sovrium validate config.json
sovrium validate app.ts
```

It accepts `.json`, `.yaml`, `.yml` and `.ts`, and resolves every `$ref` include before checking anything — so a config split across twenty files is validated as the one object it becomes.

Success prints `Valid configuration: <name>` and exits `0`. **The decode is the same one the server performs**, in both directions: a config that validates will boot, and a config this rejects is one that `sovrium start` and `sovrium build` refuse too.

## What failure looks like

Problems print under a single header and exit `1`. An unrecognised property is named, located, and answered with the keys that node does accept:

```text
Error: Validation failed.

  Unknown property 'tag' on component type 'text'
    at pages[0].components[0]
    Accepted here: type, children, props, content, interactions, responsive,
                   visibility, i18n, session, element, required
```

A near miss also gets `Did you mean 'element'?` — but **only when the correction is actually derivable**. A suggestion produced unconditionally would confidently send you to the wrong property, so a name with no near neighbour gets the accepted-key list and nothing more.

Structural problems that are not a stray key print as the decoder's indented tree instead. Read that one from the bottom: it walks down through the schema before it reaches your config, so the top is machinery and the last lines are the finding.

**One property per run.** A config with three typos reports one of them. Fix it and run again.

## The four classes of error

| Class                 | Example                                                | Caught by                 |
| --------------------- | ------------------------------------------------------ | ------------------------- |
| Structural            | `name` missing; a number given where a string belongs  | The schema decode         |
| Unrecognised property | `tabels:` instead of `tables:`                         | Excess-property rejection |
| Unknown field type    | `type: web-site` on a table field                      | The post-decode sweep     |
| Unresolvable field    | `rowColorField: statuss` on a table with no such field | Cross-field checks        |

### Nothing is silently ignored

**Every property in your config is either understood and honoured, or reported as an error.** Validate, start and build all enforce this identically, because they run the same decoder.

Before that contract existed, an unrecognised key was dropped and the server started anyway — so `tag: 'h1'` on a text component, where the property is spelled `element`, rendered a plain paragraph with no error anywhere. The only evidence was the feature not being there.

**One deliberate exception: `props`.** It is an open passthrough for HTML and ARIA attributes, forwarded to the browser without interpretation, so nothing can know which keys are meaningful there. A typo _inside_ `props` is not caught; the same key one level up is. That exception is also the escape hatch — an attribute with no schema property of its own belongs there:

```yaml
components:
  - type: text
    content: Hello
    props:
      data-analytics-id: hero
```

### The field-type sweep

The third class runs _after_ the decode and prints plainly rather than as a tree:

```text
Error: Validation failed.

  Unknown field type "web-site" in field "website"
```

**A single-word type is not flagged.** The sweep reports a type only when it cannot recognise it **and** it contains a `-` or `_`. A bare word like `colour` is treated as a plausible alias, passes validation, and fails later during SQL generation — so check spellings against the field-type reference rather than relying on this sweep alone.

### Reading the config against itself

The fourth class is the one that changes what your app **does**, not only what the validator says. A component names a field, and the table it is bound to has to declare it:

```text
Error: Validation failed.

  rowColorField: field 'statuss' not found in table 'orders'. Available: id, customer, status
```

A column, a chart series, a kanban colour field or a form field naming a column that is not there used to render nothing and report nothing — indistinguishable from a column whose rows happen to be empty. Listing a view type without the configuration that builds it behaved the same way: a kanban tab with no grouping drew a control that did nothing when clicked. Both are now refused by all three commands, so the mistake surfaces at your desk instead of shipping as a feature that looks deliberate.

System columns — the id, the timestamps, the authorship columns — always resolve, because they exist without appearing in the field list. A component bound to a system source rather than a table is skipped, since its columns describe an endpoint's response rather than a declared table.

## Exit codes

| Exit code | Meaning                                                            |
| --------- | ------------------------------------------------------------------ |
| `0`       | The config is valid                                                |
| `1`       | Invalid — a decode error, an unknown field type, or a missing file |

Everything that failed is `1`, so gating a pipeline is one line: `sovrium validate app.yaml || exit 1`. Run it before the deploy step; it is the last point where a bad config costs seconds instead of a rollback.

A reader that is a program rather than a person wants the same verdict in a shape it can parse: `--json` reports it as one JSON document on stdout and leaves the exit code alone. The flag's own contract belongs with the command; what matters here is that adding it never changes the verdict this page describes.

## Validating from inside a running app

To check a config from an app rather than from a shell — a webhook receiving a submitted config, a scheduled audit — use the validate-config action. It runs this same decoder with no side effects and no boot, and exposes the verdict and the errors as step outputs.

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

There is deliberately no looser in-process alternative: a second validator tolerating what this one rejects would mean a config could pass one gate and fail the other. The candidate is also read **verbatim** — a template expression or an environment reference inside the submitted config is validated as literal text, never resolved — so the verdict describes what you passed rather than a rewritten copy of it.
