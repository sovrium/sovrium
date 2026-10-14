# Label

> The `label` component — the visible name of one form control, wired to it so a click on the name focuses the control.

A `label` names one control on its page and is connected to it: clicking the words moves the focus into the control, and the words become the control's accessible name, the one a screen reader announces. Reference: shadcn/ui Label.

```yaml
components:
  - type: label
    text: Work email
    for: signup-email
    required: true
  - type: input
    inputType: email
    props:
      id: signup-email
      placeholder: you@company.com
```

<!-- sovrium:options type:label -->

`for` is the `props.id` of the control the label names. A browser resolves it inside one page only, so a `for` that names no component of the label's own page is refused when the config is validated, with a message naming the label's text and the id it could not find. `required` draws a mark after the text; the mark is hidden from assistive technology, so the control is still announced by the text alone. `text` accepts a `$t:` translation key.
