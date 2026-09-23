# Design-Console Components

> The three types that document a design system rather than build a feature — specimen, field-specimen and preview.

Three components exist to document a design system. Sovrium's own design-system console is built from them, and your app can build its own page the same way.

They read your design rather than repeating it, which is the whole point. A page that writes out its own copy of a button shows what that button looked like the day it was typed. A specimen draws the one your app renders now.

The design tokens themselves are drawn by ordinary kit types: `swatch` paints a colour token and plots an easing one, `badge` with `variant: contrast` grades a pair for legibility, and `card` with `variant: scoped` marks a design boundary on a page showing two systems at once.

## `specimen`

Draws one component beside the config literal that produced it. Both are projected from the same declaration, so the snippet cannot stop matching the thing above it.

<!-- sovrium:options type:specimen depth=2 -->

`annotations` are callouts naming parts of the drawn component, `[{ part, label }]`, using the same part names a design's component block uses. `showProvenance` shows, per part, which layer contributed each class — the recipe, your own component block, or the locked accessibility floor.

```yaml
components:
  - type: specimen
    showSnippet: true
    showProvenance: true
    annotations:
      - { part: root, label: The button itself }
    component:
      type: button
      label: Save changes
```

### Naming a subject instead of writing one out

`component` holds a literal, which is what makes the snippet honest — and also means one declaration draws one type. A per-type kit route would need one page per type. So a specimen may instead NAME its subject, and Sovrium draws its own catalogue specimen for that type, with the illustrative props each type needs to be a specimen OF something. Rendered bare, a `select` is an empty box; the catalogue is where that knowledge lives.

```yaml
pages:
  - path: /kit/:type
    components:
      - type: specimen
        subject: { type: $param.type }
        showSnippet: true
```

`subject.type` is either a catalogued type name (`button`) or `$param.<name>` naming a segment of the host page's path. A literal is checked when the config is read: a typo, or a type a specimen may never draw, is named at boot. A `$param` one is a URL segment rather than a config fact, so a segment naming nothing drawable answers **404** — a mistyped URL that silently rendered some page makes a broken link look live, and an empty frame leaves a reader believing the type has no specimen rather than no existence.

`component` and `subject` are mutually exclusive, and exactly one is required. Both answer "what is drawn", and there is no defensible precedence between them: a specimen declaring both would show one and silently discard the other, along with the snippet projected from it.

A specimen refuses to draw a component that renders a submit control — `form` — at any depth, and refuses to nest inside another specimen. The first is a safety rule: a preview frame carries no write path. The second is a bound: each level projects its snippet from the level below, so the nesting would have no end. Both are refused when the config is read, so the failure names the reason instead of silently drawing nothing.

## `field-specimen`

Draws the control a table **field type** gets: one column type, rendered as the form control your record form will actually show for it. Where `specimen` documents the component half of a design system, this documents the data half.

<!-- sovrium:options type:field-specimen -->

`fieldType` is required and takes a catalogued field-type name, `$param.<name>` naming a path segment, or `$record.<field>` naming a column of the row the specimen is expanded from. `name` defaults to the field type with hyphens replaced by underscores, and `label` to the humanised control name. `options` absent draws the empty control, which is what an author who declares none gets. `value` is empty by default: a specimen documents the control, not a record.

```yaml
components:
  - type: field-specimen
    fieldType: single-select
    label: Status
    options: [Draft, Sent, Paid]
```

### It documents one surface, and says which

A field type is drawn on more than one surface, and those surfaces legitimately differ. So a specimen cannot claim to show _the_ rendering of a field type. It shows one named surface's control, and carries a caption saying which. `compact` suppresses that caption for a page drawing every type at once, where the same sentence belongs once above the group rather than dozens of times inside it.

Where a surface has no exact control yet, the specimen reports itself as **deferred** rather than drawing an approximation and letting you believe it. `compact` never suppresses that marker: hiding a caption is a layout choice, and hiding a fidelity warning is not.

### It hosts a control, and offers no way to submit it

The drawn control is a real one: the same control your record form shows, not a lookalike built beside it, which is what keeps the page from drifting away from the form. It is hosted directly, with no `form` around it and no submit affordance, so anyone who can read the page cannot become an accidental editor of anything.

There is no `surface` property and no `fullWidth`. The first would ask you to spell a constant — there is one surface today, and the property appears on the day there is a second. The second is layout, and layout belongs to the container you put the specimen in, not to a fact about the field type.

## `preview`

Draws one option of one type, set to the value you name — so a setting can be seen rather than described.

<!-- sovrium:options type:preview depth=2 -->

All three parts of `subject` are required. `subject.type` is a catalogued type name, or `$param.<name>` naming a segment of the host page's path, or `$record.<field>` naming a column of the row the preview is expanded from. `subject.option` is a path in the dotted grammar the component-type options endpoint publishes, with `[]` for an array level. `subject.value` is a string, a number or a boolean; a string is coerced against the option's own kind, so a row template carrying `$record.value` draws the same thing a literal `2` would.

```yaml
components:
  - type: preview
    subject: { type: table, option: pagination.position, value: both }
    caption: 'Pagers above and below, for a grid taller than the viewport.'
  - type: preview
    subject: { type: table, option: striped, value: true }
    showValue: false
```

### It draws one value, not a variant

`specimen` draws a component in a state — a variant, a size, a resting or hovered appearance — and its axis fields are genuinely optional, because a type has a default variant and a default size. A preview draws one **option** at one **value**, and no option has a "default option": that is why all three parts of `subject` are required rather than optional.

A structured value is deliberately out. An option whose value is an object is not one a reader learns from a single picture, and admitting one would make the caption unwritable. The empty string, by contrast, is deliberately **in**: a real option's interesting value is sometimes `''` — an empty `placeholder`, an empty `emptyText` — and a picture of it is exactly what a reader needs.

### The caption is written, not generated

A schema `description` says what an option _is_. What a reader needs beside the picture is what _this value_ does to it, and that is a sentence only an author can write. Omit `caption` where the effect is self-evident; Sovrium's own console writes one per row, which is a fair guide to how often it is not.

`showValue` is on by default, and the console turns it **off** because each of its Configuration rows already prints the option path in its own left column. An app drawing a single preview on its own page leaves it on.
