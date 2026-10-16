# Interactive Components

> The clickable, inline primitives — button, link, alert, badge, button-group and theme-toggle.

Interactive components are the ones a reader acts on: buttons that fire actions, links that navigate, alerts and badges that convey status. They carry the shared `action` and `interactions` modules on top of `props`, `visibility` and `responsive`.

```yaml
components:
  - type: button
    label: Save
    action: { type: crud, operation: create, onSuccess: { type: navigate, navigate: /done } }
  - type: link
    content: Learn more
    props: { href: /docs, target: _blank }
```

## `button`

A button that runs an `action`, an `interactions` behaviour, or both.

<!-- sovrium:options type:button -->

`variant` is declared beside `action`, not inside `props`: `default` is the primary fill and what you get by declaring nothing, and the rest are `destructive`, `outline`, `secondary`, `ghost`, `link` and `fab`. Every variant and size draws shadcn/ui's Button exactly: one focus ring with no offset ring around it, a primary that hovers at 80 % of its own colour, and a `destructive` button drawn as a tint — the label in the destructive colour on a faint ground of it — rather than a solid red block. An app that wants the solid red declares it once, for every destructive button, under `design.components.button.variants.destructive.root` (for example `bg-destructive text-white hover:bg-destructive/90`); those classes win over the default on every property they name. `size` takes shadcn/ui's scale: `xs`, `sm`, `default` (what you get by declaring nothing) and `lg` for a labelled button, and `icon-xs`, `icon-sm`, `icon` and `icon-lg` for a square button that draws its `icon` alone. `icon` names a Lucide icon drawn before the label; at an icon size the `label` is no longer printed but becomes the button's accessible name, so an icon size without an `icon` or without a `label` is refused when the configuration is read. `label` is the text; `content` is the alternative when the button holds a child, such as an `icon`. `loading` — beside `type`, like `variant` and `label` — shows a spinner inside the button; `props.disabled` disables it, and that one really does live in the bag.

`{ action: openImport, table }` opens the CSV import dialog for that table — choose a file, map its columns to the table's fields, write the rows — the dialog a grid's own Import used to open. The button is drawn only for a reader the table lets create records.

`confirm` puts a prompt between the click and the action. It is an object rather than a boolean so that the prompt can say what is about to happen — see the confirmation options in the table above.

Once its action succeeds, a button can close the dialog, drawer or popover it sits in (`onSuccess.close`) and take the reader elsewhere (`onSuccess.navigate`, filled from the button's record, and for a `fetch` action from the body the request returned). A button has no form, so its `onSuccess.type` can only be `navigate`, and its `onError` only a `toast`; anything else is refused when the configuration is read.

### Once the action has answered

On success, an action's effects run in one order: the toast, then `status` and `refetch`, then a reset, then `close`, then leaving the page — `navigate`, a redirect or `reload`. A failure runs none of them: the control comes back as it was, the field errors are drawn, the focus returns to the control, and the `onError` toast follows. Nothing closes and nothing navigates. A fetch toast with a `loadingMessage` shows one `loading` toast while the request is in flight, and that same toast then turns into the `onSuccess` or the `onError` message: one toast, never two.

`close: true` closes the overlay the control sits in — a dialog, an alert dialog, a sheet, a record-detail sheet or a popover. A table row action and a menu item close the overlay that holds their table or their menu: a "Send reminder" row action in a table shown in a dialog closes that dialog once its start is accepted. A menu's own popup closes as soon as an item is chosen, with or without the key; `close` is what closes the drawer or dialog around the menu. When two are nested, only the innermost closes: a popover inside a dialog closes, the dialog stays. A control that sits in no overlay has nothing to close, and the key does nothing there. Whichever confirm gates a row action — a one-line prompt or a dialog with its own title and buttons — `close` reaches the overlay around its table. Left unset, each control keeps its habit: a `crud` form in a dialog, or in a drawer a row click opened for quick editing, closes it after its write, whether the save goes by a plain page post or through the page's script; a button, a row action and a menu item close nothing. `close: false` keeps the overlay open even after a write — the quick editor saved several times in a row.

`navigate` takes the reader to another address once the action has succeeded. On an `automation`, success is the accepted start, or with `await: true` the end of the run, so an awaited button moves on only once the run is over; `$record.<field>` is filled from the record the control has — the page's record, or the row a row action sits in; a menu item has none, so its address is written out. A relative address — `preview`, `?saved=1`, `#comments` — is resolved against the page the control is on, on an edit form as on a button. On a `fetch` action, and on a `file-upload`, `navigate` may also read the body the request returned through `$response.<field>`, so a "Create the invoice" button can open the invoice it just created:

```yaml
- type: button
  content: Create the invoice
  action:
    type: fetch
    method: POST
    url: /api/invoices
    onSuccess:
      type: toast
      message: Invoice created
      navigate: /invoices/$response.id
```

A success that both shows a toast and moves to another page of this site carries the toast with the reader: the page they land on shows it once as it loads, in the same notice region and under the same rules as any toast, and a reload does not show it again. A carried toast older than a minute is dropped. Before it leaves, the page waits half a second, long enough for a write the next page reads to land, with the control kept busy. A move that stays on the page (`#comments`) shows the toast in place.

Some pairings are refused when the configuration is read, each with a message naming both keys: on a `fetch` action, `navigate` beside `reload`, `status` or `refetch`, and `close` beside `reload` — each writes into, re-reads or leaves the same page — and `navigate` in any `mode` but `fetch`; on any action, `close: true` beside a success page, which would be closed before anyone read it.

What a control cannot do is refused rather than ignored. A button, a table row action or a menu item has no form, so its `onSuccess.type` can only be `navigate`, and the keys that describe a form — `preserveFields`, `title`, `message`, `actions`, `showSummary`, `redirect` — are refused there. `onError` takes only `toast`, wherever the action sits. `type: role-landing` belongs to an `auth` sign-in. An `onSuccess.navigate` naming another site (`https://…`) is refused on every control — a button, a row action, a menu item, an endpoint form, a file upload and a form alike — because an answered action moves the reader within the app; a link sends them elsewhere. Each refusal names the place and says what to write instead.

## `link`

An anchor.

<!-- sovrium:options type:link -->

`props.href` carries the URL or route path, `props.target` and `props.rel` the usual anchor attributes, and `children` lets a link wrap something other than text — an `image`, for a clickable image.

A link with `target: _blank` tells assistive technology that it opens a new tab: "(opens in a new tab)" ends its accessible name, in the page language, and nothing changes on screen. Every link the engine opens in a new tab says the same — the "Built with Sovrium" badge, a docs article's edit and issue links, a file's Open, an attachment, a `url` cell, a menu or navigation entry, and a `button` whose `openUrl` click or `navigate` action sets `openInNewTab`. Rename the words under `sovrium.link.opensInNewTab`.

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

A shared navigation placed as a component template names its current item through the placement's `vars`: `activeWhen: { value: '$current', equals: 'pricing' }` inside the template, placed with `vars: { current: 'pricing' }`, marks that item on that page only. `activeWhen` and `activeProps` take the vars like `props` does, on the template's root and on every nested item.

The merge is key by key, last wins: an attribute appears only on the current item, and a `className` declared in both is SWAPPED rather than concatenated, which is what a selected style usually wants. Three links stay three links; expressing this with a visibility gate would need six, each pair free to drift apart.

The two keys are useless apart and are refused apart at startup, as is a comparison between two literals — it answers the same on every render, so either every item of the set is current or none is.

## `alert`

An inline callout the reader must see before going on. Reference: shadcn/ui Alert.

<!-- sovrium:options type:alert -->

`content` is the message, drawn under an optional `title` in bold; without `content`, the alert's children are the message. A leading icon sits beside both. `alertVariant` — declared beside `type`, not inside `props` — picks `default`, `info`, `warning`, `success` or `destructive`. `default` and `destructive` are shadcn/ui's two alerts: the card surface, in its own ink or in the destructive one. `info`, `success` and `warning` are Sovrium's additions: the same card surface as `default`, told apart by their icon — an `i`, a check, a triangle. The danger tone is spelled `destructive`, as it is on a `button`, and there is no `error`. A bare top-level `variant`, or `props.variant`, is still honoured as an older spelling of the same key. `props.dismissible` adds a close button in the top-right corner.

```yaml
- type: alert
  alertVariant: warning
  title: Your trial ends in 3 days
  content: Add a payment method to keep your projects.
```

## `badge`

A short status word pinned to a thing, never a sentence. Reference: shadcn/ui Badge.

<!-- sovrium:options type:badge -->

`variant` and `badgeVariant` are two different axes, and both are spelled out because they do different jobs: `variant` changes **what the badge draws**, `badgeVariant` changes **how it is painted**. A key belonging to one mode is inert under the other rather than refused.

`badgeVariant` takes shadcn/ui's six tones: `default`, `secondary`, `destructive`, `outline`, `ghost` (no fill until it is hovered) and `link` (the text of a link). `href` makes the badge a link — meant for `link`, though any tone navigates — so "3 unpaid" can take the reader to the invoices it counts. The same tones apply to a navigation item's badge.

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
    foreground: '--foreground'
    background: '--background'
    threshold: AAA
```

`threshold` grades at normal body-text size: `AA` is 4.5:1 and the default, `AAA` is 7:1. The lenient large-text bars are deliberately not offered — a design token gets used at whatever size an author reaches for, so grading it against the easier bar would report a pass the interface does not earn.

A failing pair **says so** rather than rendering nothing, because a badge that only appeared on success would leave a reader unable to tell a failure from a badge that never rendered. If either colour does not resolve, the badge reports that it is not measurable rather than guessing at the missing operand.

## `button-group`

A row of related buttons, joined so they read as one control. Combine it with a `dropdown-menu` for a split button.

The grouped components go in `children`, in the order they are drawn: buttons, a `text` read-out such as "Page 4 of 9", a vertical `separator`, or a nested `button-group`. `orientation: vertical` stacks them in one joined column, such as a zoom control; `horizontal`, the default, joins them in a row. `props.label` names the group, and `props` carries the HTML attributes.

## `theme-toggle`

The one control that flips the colour scheme and remembers the choice.

<!-- sovrium:options type:theme-toggle -->
