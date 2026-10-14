# Collapsible

> The `collapsible` component — one region hidden behind a single trigger, shown or hidden in place, with no siblings to close.

A `collapsible` keeps a region out of the way until the reader asks for it: advanced settings under a form, the notes of a release, the contacts behind a heading. Unlike an `accordion`, it stands alone: two collapsibles on a page open and close independently, and there is nothing to configure about which one wins. Reference: shadcn/ui Collapsible.

```yaml
components:
  - type: collapsible
    triggerLabel: Show advanced settings
    children:
      - type: text
        element: p
        content: Webhook retries, request timeout and the signing secret.
  - type: collapsible
    triggerLabel: Release notes
    hydrate: true
    defaultOpen: true
    children:
      - type: text
        element: p
        content: Charts gain radar and radial layouts.
```

<!-- sovrium:options type:collapsible -->

`triggerLabel` is required: it is the only thing on the trigger. By default the component is the browser's own disclosure (`details` and `summary`), which opens and closes with no script and is understood by every assistive technology. `hydrate: true` draws a button instead, which reports its state through `aria-expanded` and names the region it controls through `aria-controls`; a small script drives it, and the button is disabled until that script has run so an early press is never lost. `defaultOpen: true` opens the region on load, in either form.
