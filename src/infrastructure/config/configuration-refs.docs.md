# Multi-File Configs with `$ref`

> One file stops being readable somewhere around the third table. `$ref` splits a YAML or JSON config across as many files as you like, with no change to the resulting object.

Any object whose **only** key is `$ref`, and whose value is a relative path, is replaced by the parsed contents of that file.

```yaml
name: crm-workspace
version: 2.0.0

auth:
  $ref: ./config/auth.yaml

design:
  $ref: ./config/design.yaml

tables:
  - $ref: ./config/tables/companies.yaml
  - $ref: ./config/tables/contacts.yaml

pages:
  - $ref: ./config/pages/sign-in.yaml

agents:
  - $ref: ./config/agents/records-assistant.yaml
```

Each partial is the object it stands in for, and nothing else:

```yaml
id: 1
name: Companies
fields:
  - { id: 1, name: name, type: single-line-text, required: true }
  - { id: 2, name: website, type: url }
```

## The rules

| Rule              | Behaviour                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Path resolution   | Paths resolve relative to the file that contains them, not the working directory                                         |
| Mixed formats     | A YAML root may reference a JSON partial and the reverse; each file is parsed by its own extension                       |
| Array elements    | A reference can stand in for a whole array element or a whole object value                                               |
| Resolution timing | Every reference is resolved into one object **before** validation                                                        |
| Cycles            | A file that references itself, directly or through a chain, is refused with `Circular $ref detected` rather than looping |
| Containment       | When `SOVRIUM_PROJECT_DIR` is set, no reference may resolve outside it — see below                                       |

**Resolving before validation is what makes splitting safe.** A rule such as "a record automation must reference an existing table" is still checked across the whole app, even when the automation and the table live in different files. Splitting a config therefore costs nothing in checking — the validator never sees the seams.

Errors are attributed back to the partial they came from rather than to the root, so a mistake in one table's file is reported against that file:

```text
Error: Validation failed.

  companies.yaml: Unknown field type "web-site" in field "website"
```

## The `config/` convention

Scaffolding and the bundled templates follow one shape: **one file per collection entity, one file per singleton, scalars stay inline.**

```text
app.yaml               # name, version, and the $ref map
config/
  auth.yaml            # singleton
  design.yaml          # singleton
  tables/
    companies.yaml     # one entity per file
    contacts.yaml
  pages/
    sign-in.yaml
```

Nothing enforces this layout — a reference accepts any relative path. It earns its keep by making the root file a table of contents: what the app contains becomes legible without opening anything else.

## When to split

Keep a config in one file while it is small, and split once a section grows big enough to deserve its own name — in practice, past the first couple of tables or pages, or as soon as a design system gets substantial. The design block holds tokens plus principles, voice and usage rules, so it is often the first singleton worth extracting.

## The project directory is a jail for the whole graph

`SOVRIUM_PROJECT_DIR` names a root, and when it is set **every** file in the config graph must sit inside it — not just the entry point. A reference climbing out with `../` is refused before the file is opened, so a rejected path never even reveals whether it exists:

```text
$ref resolves outside the project directory: ../../secrets.yaml
The project directory is /srv/my-app, and the whole config graph must stay inside it.
```

That containment is what lets a supervising process — the desktop shell, a hosting runtime — hand the engine a folder without also handing it the rest of the filesystem. Leave `SOVRIUM_PROJECT_DIR` unset and the check is inert, which is the ordinary case when you run the binary yourself.

**`$ref` is a YAML and JSON mechanism only.** A TypeScript config composes with ordinary imports instead, and a `$ref` key in one is just an object with a strange property name.
