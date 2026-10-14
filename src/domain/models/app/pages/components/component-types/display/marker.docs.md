# Marker

> The `marker` component — a marker line inside a thread or a list: a status, a system note, a labelled break.

A conversation is not only turns. It has dates that break it up, people who join, a reply being written, a ticket it came from. A `marker` is that line: quieter than a message, inline with the thread, and read for what it is. Reference: shadcn/ui Marker.

```yaml
components:
  - type: marker
    content: Yesterday
    variant: separator
  - type: marker
    content: Léa Moreau joined the thread
    icon: user-plus
  - type: marker
    content: Generating a reply
    live: true
  - type: marker
    content: Opened from ticket 4821
    href: /tickets/4821
    variant: border
```

<!-- sovrium:options type:marker -->

`content` is required. `icon` names a Lucide icon drawn before the words; it is decorative and hidden from assistive technology. `variant: separator` centres the words between two rules that span the column — the dated break of a thread — and `variant: border` draws a rule under them. `live: true` makes the marker a status region, so a line that changes while the reader watches is announced. `href` turns the whole marker into a link named by its words.
