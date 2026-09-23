# Interactive Components

> The clickable, inline primitives — button, link, alert, badge, button-group and theme-toggle.

Interactive components are the ones a reader acts on: buttons that fire actions, links that navigate, alerts and badges that convey status. They carry the shared `action` and `interactions` modules on top of `props`, `visibility` and `responsive`.

```yaml
components:
  - type: button
    label: Save
    action: { type: crud, operation: create, onSuccess: { type: navigate, url: /done } }
  - type: link
    content: Learn more
    props: { href: /docs, target: _blank }
```

## `button`

A button that runs an `action`, an `interactions` behaviour, or both.

<!-- sovrium:options type:button -->

`variant` is declared beside `action`, not inside `props`: `default` is the primary fill and what you get by declaring nothing, and the rest are `destructive`, `outline`, `secondary`, `ghost`, `link` and `fab`. `label` is the text; `content` is the alternative when the button holds a child, such as an `icon`. `loading` — beside `type`, like `variant` and `label` — shows a spinner inside the button; `props.disabled` disables it, and that one really does live in the bag.

`confirm` puts a prompt between the click and the action. It is an object rather than a boolean so that the prompt can say what is about to happen — see the confirmation options in the table above.

## `link`

An anchor.

<!-- sovrium:options type:link -->

`props.href` carries the URL or route path, `props.target` and `props.rel` the usual anchor attributes, and `children` lets a link wrap something other than text — an `image`, for a clickable image.

### Marking the current item

A period rail, a tab strip and a section nav all have the same shape: every item is always present — they ARE the choice — and one of them carries `aria-current` and a selected style. `activeWhen` compares a value to a literal and, when they match, merges `activeProps` over `props`:

```yaml
- type: link
  content: 30 days
  props: { href: '?period=30d', className: 'text-neutral-500' }
  activeWhen: { value: '$window.id', equals: '30d' }
  activeProps: { aria-current: page, className: 'font-medium text-neutral-900' }
```

`value` is normally a reference — `$window.id`, `$query.<name>`, `$param.<name>`, `$app.<name>` — and is already a literal by the time the comparison runs, so the same key expresses "the selected period", "the open tab" and "the current section" without knowing anything about URLs.

The merge is key by key, last wins: an attribute appears only on the current item, and a `className` declared in both is SWAPPED rather than concatenated, which is what a selected style usually wants. Three links stay three links; expressing this with a visibility gate would need six, each pair free to drift apart.

The two keys are useless apart and are refused apart at startup, as is a comparison between two literals — it answers the same on every render, so either every item of the set is current or none is.

## `alert`

An inline callout.

<!-- sovrium:options type:alert -->

`content` is the message. `alertVariant` — declared beside `type`, not inside `props` — picks `default`, `info`, `warning`, `success` or `destructive`, each with its own icon and tone triple; the danger tone is spelled `destructive`, as it is on a `button`, and there is no `error`. A bare top-level `variant` is still honoured as the old spelling of the same key. `props.dismissible` adds a close button.

## `badge`

A short status word pinned to a thing, never a sentence.

<!-- sovrium:options type:badge -->

`variant` and `badgeVariant` are two different axes, and both are spelled out because they do different jobs: `variant` changes **what the badge draws**, `badgeVariant` changes **how it is painted**. A key belonging to one mode is inert under the other rather than refused.

### `variant: status`

A coloured dot with a label. `status` is the text beside the dot, `statusColor` picks the dot's tone from `green`, `red`, `amber`, `yellow`, `blue` or `gray`, and `pulse` animates it.

```yaml
components:
  - { type: badge, variant: status, status: Live, statusColor: green, pulse: true }
```

### `variant: contrast`

The ratio between two colours, and the verdict on it. Give it the two colours as token names or as literals — hex, `rgb()`, `oklch()`, `white`, `black` — and it reports the contrast ratio with its grade.

```yaml
components:
  - type: badge
    variant: contrast
    foreground: '--sv-color-foreground'
    background: '--sv-color-background'
    threshold: AAA
```

`threshold` grades at normal body-text size: `AA` is 4.5:1 and the default, `AAA` is 7:1. The lenient large-text bars are deliberately not offered — a design token gets used at whatever size an author reaches for, so grading it against the easier bar would report a pass the interface does not earn.

A failing pair **says so** rather than rendering nothing, because a badge that only appeared on success would leave a reader unable to tell a failure from a badge that never rendered. If either colour does not resolve, the badge reports that it is not measurable rather than guessing at the missing operand.

## `button-group`

A row of related buttons, joined so they read as one control. Combine it with a `dropdown-menu` for a split button.

`button-group` declares no options of its own: the grouped `button` components go in `children`, and `props` carries the HTML attributes.

## `theme-toggle`

The one control that flips the colour scheme and remembers the choice.

<!-- sovrium:options type:theme-toggle -->
