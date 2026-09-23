# Reusable Components

> Define a component template once in `app.components` and instantiate it across pages with `$ref` and `vars`, so a shared UI pattern has a single source of truth — plus `customHTML`, the escape hatch for markup the kit does not cover.

The same UI pattern usually appears on several pages — a feature badge, a section header, a call-to-action block. Copying its component tree into each page means every future change has to be made in every copy.

`app.components` is a library of named templates. Define the pattern once, with `$variable` placeholders where the content differs:

```yaml
components:
  - name: section-header
    type: container
    props: { className: 'text-center mb-12' }
    children:
      - { type: text, props: { level: h2 }, content: '$title' }
      - { type: text, props: { level: p }, content: '$subtitle' }
```

Then instantiate it from any page with `$ref`, passing the values:

```yaml
pages:
  - name: Home
    path: /
    components:
      - $ref: section-header
        vars:
          title: Own your software
          subtitle: One config file. A complete app.
```

## Template properties

| Property   | Description                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| `name`     | Unique kebab-case identifier used by `$ref`. Must start with a lowercase letter. |
| `type`     | The component type the template renders — any type a page can use.               |
| `props`    | Component properties. Values may contain `$variable` placeholders.               |
| `content`  | Text content. May contain `$variable` placeholders.                              |
| `children` | Nested child components, which may themselves carry placeholders.                |

## Variables

A placeholder is a `$` followed by an alphanumeric name (`$title`, `$iconName`). At instantiation, `vars` supplies the values:

| Rule               | Detail                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Key format         | Starts with a letter, alphanumeric only — `$titleColor`, not `$title-color`. |
| Value types        | String, number, or boolean.                                                  |
| Where they resolve | In `props` values, in `content`, and at any depth inside `children`.         |

The same template with different vars produces different instances:

```yaml
components:
  - name: icon-badge
    type: badge
    props: { color: '$color' }
    children:
      - { type: icon, props: { name: '$icon' } }
      - { type: text, content: '$label' }

pages:
  - name: Features
    path: /features
    components:
      - $ref: icon-badge
        vars: { color: orange, icon: users, label: 'Team ready' }
      - $ref: icon-badge
        vars: { color: green, icon: lock, label: 'Self-hosted' }
```

Component names must be unique across the library — a duplicate would make a `$ref` ambiguous, and it is rejected when the config is decoded.

**Templates versus page components.** `app.components` holds patterns you instantiate. Anything used exactly once belongs inline in the page that uses it — a template referenced from a single place adds indirection without removing duplication.

## `customHTML`

The one type that renders markup you wrote rather than markup the kit draws. It takes its HTML either from `content` or from an external file:

| Property  | Description                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| `content` | Inline HTML. Substitutes `$record.*`, `$vars.*` and `$t:` like any other content. |
| `htmlSrc` | Path to an external `.html` file, as an alternative to inline `content`.          |

`customHTML` is the only component type outside the twelve published categories, and the reason is that there is nothing generic to draw: a specimen of it would be a specimen of whatever an operator happened to write. It carries `props`, `content`, `interactions`, `responsive`, `visibility` and `i18n`, and declares no options beyond `htmlSrc`.
