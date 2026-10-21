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

A template with no `$variable` placeholders is placed with `$ref` alone — `vars` may be omitted. In a YAML or JSON config, `$ref: section-header` is a template name because it has no `/` or `.`; a value that does, like `./header.yaml`, includes a file instead (see Multi-File Configs).

A name that matches no template in `app.components` is refused when the config is validated or the app starts, in both placement forms — `$ref: plan-card` and `component: plan-card` — so a typo never reaches a page.

A placement may carry a `key` beside `vars`, like any component of the page, which names that placement for the tools that read your pages (see The Component Model). A page export draws a placement expanded, as a visitor sees it, but treats it as one node: its inside belongs to the template, and to every page that places it. The components a page passes to its slots are the exception: they are the page's own nodes, which a design tool may edit.

## Template properties

| Property   | Description                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `name`     | Unique kebab-case identifier used by `$ref`. Must start with a lowercase letter.                         |
| `type`     | The component type the template renders — any type a page can use.                                       |
| `props`    | Component properties. Values may contain `$variable` placeholders.                                       |
| `content`  | Text content. May contain `$variable` placeholders.                                                      |
| `children` | Nested child components, which may themselves carry placeholders — or `$children`, the slot (see below). |
| `render`   | `named` (the default) or `transparent`: draw exactly what the tree draws written inline (see below).     |
| `inputs`   | The values a placement passes, by name and kind: `text`, `number`, `boolean`, `json` or `slot`.          |

## Slots: a template around the page's own components

A template can leave a place for the components of the page that places it. Write `children: $children` on the node that should hold them — at any depth, or on the template's root — and pass those components as the placement's `children`. This is how an application shell is declared once:

```yaml
components:
  - name: app-shell
    type: flex
    props: { className: 'min-h-screen flex flex-col lg:flex-row' }
    children:
      - type: sidebar
        groups:
          - label: Billing
            items:
              - { label: Invoices, href: /invoices, icon: file-text }
              - { label: Clients, href: /clients, icon: users }
      - type: container
        element: main
        props: { className: 'flex-1 min-w-0 px-4 py-8' }
        children: $children

pages:
  - name: invoices
    path: /invoices
    components:
      - component: app-shell
        children:
          - { type: text, element: h1, content: Invoices }
          - { type: text, element: p, content: '42 invoices this quarter' }
  - name: clients
    path: /clients
    components:
      - component: app-shell
        children:
          - { type: text, element: h1, content: Clients }
```

Every placement form takes `children` — `component:` and `$ref:`, with or without `vars`.

| Rule                      | Detail                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whose components they are | The page's. They are read in the page's scope — the page's record, `$t:` keys and visibility rules — and a template placed among them expands like any other placement.            |
| The template's `vars`     | Reach the template's own nodes only, never the components in the slot.                                                                                                             |
| No `children`             | A slotted template placed without `children` draws its slot empty.                                                                                                                 |
| One slot of each name     | `$children` is marked once per template, and so is each named slot. A template marking `$children` twice is refused.                                                               |
| No slot                   | A placement passing `children` to a template without a slot is refused, rather than its components being dropped.                                                                  |
| Not through a value       | A placement filling the slot with `vars: { children: … }` is refused: the slot takes a list of components.                                                                         |
| Not inside a data node    | A slot inside a node that reads rows or repeats (`dataSource`, `contentFrom`, `repeat`, the slot's own node included) is refused: there the page's components would read each row. |
| Tabs and steppers         | A slot on a `tabs` or `stepper` node takes exactly one component per panel or step, in order; any other count is refused.                                                          |

All of these are refused when the config is validated or the app starts. The library's sidebar shell block (`sovrium library add block/shell-sidebar`) is a slotted template of exactly this shape.

## Named slots

A shell often has more than one region a page fills, such as a breadcrumb trail in its header as well as its body. Declare each extra region as an input of kind `slot`, mark it with `children: $slots.<name>`, and fill it from the placement's `slots`:

```yaml
components:
  - name: app-shell
    type: flex
    inputs: { trail: { kind: slot } }
    children:
      - { type: container, element: header, children: $slots.trail }
      - { type: container, element: main, children: $children }

pages:
  - name: invoice
    path: /invoices/:id
    components:
      - component: app-shell
        slots:
          trail: [{ type: link, props: { href: /invoices }, content: Invoices }]
        children:
          - { type: text, element: h1, content: 'Invoice $record.number' }
```

A named slot follows every rule of `$children`, and a slot left out draws empty. A `slots` entry the template does not declare is refused, and so is a `$slots.<name>` the template marks without declaring it. A design tool shows the components a page passes to any slot as page nodes it may edit, while the template around them stays locked.

## Transparent templates

A placed template is named by its template: its root carries `data-component`, `data-type` and a `component-<name>` test id, which a template you review on the Design System pages needs. An app's own furniture (a shell, a toolbar, a grid it repeats on every page) needs the opposite. `render: transparent` draws exactly what the same tree draws written inline at that position, attribute for attribute:

```yaml
components:
  - name: invoice-toolbar
    type: flex
    render: transparent
    children:
      - { type: text, element: h2, content: Invoices }
      - { type: button, content: New invoice }
```

A transparent template is not listed on the Design System pages and has no page of its own there. A design tool still treats it as a template, and an edit made inside it is refused on import. Template names starting `console-` are the operator console's own: `sovrium validate` warns about an app template named that way, which still validates.

## Variables

A placeholder is a `$` followed by an alphanumeric name (`$title`, `$iconName`). At instantiation, `vars` supplies the values:

| Rule               | Detail                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Key format         | Starts with a letter, alphanumeric only — `$titleColor`, not `$title-color`.                                      |
| Value types        | String, number, or boolean. For an input of kind `json`, any JSON list or object: see Structured Template Inputs. |
| Where they resolve | In `props` values, in `content`, and at any depth inside `children`.                                              |

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
