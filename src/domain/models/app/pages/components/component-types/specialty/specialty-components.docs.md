# Specialty Components

> The focused-use-case types — reorderable-list, language-switcher, file-upload, number-input and time-picker.

Specialty components serve one purpose each: reordering a list by hand, switching the active language, picking files, counting a number, and choosing a time. All accept the shared `props` bag plus the `visibility` and `responsive` modules.

The category also holds `comments` and the three design-console types; both groups have a page of their own.

```yaml
components:
  - { type: language-switcher, props: { className: ml-auto } }
  - { type: number-input, min: 1, max: 99, step: 1, props: { name: quantity } }
  - { type: file-upload, accept: 'image/*', maxFiles: 5, dropZone: true, props: { name: photos } }
```

## `reorderable-list`

A list whose items can be reordered by drag-and-drop or by keyboard.

<!-- sovrium:options type:reorderable-list depth=3 -->

`onReorder` must be a `toast` action — `{ type: toast, message, variant, duration }` is the only type a reorder runs — and its `duration`, in milliseconds, overrides the usual toast dismissal rules. The list items go in `children`, each with its own drag handle.

## `language-switcher`

A control that switches the active language for an internationalised app.

It declares no schema option of its own: `props` carries the HTML attributes and the display options, such as `className` and the label style. What languages it offers comes from the app's own language declaration, not from the component.

## `file-upload`

A file selector with optional drag-and-drop.

<!-- sovrium:options type:file-upload depth=2 -->

`accept` takes MIME types or extensions — `image/*,.pdf`. `maxFiles` caps how many may be selected at once and `maxFileSize` is a size in bytes, with oversized files rejected with an error. `dropZone` renders a drop area with a visual indicator. `uploadAction` performs the upload, and `onSuccess` and `onError` handle its result.

Uploaded files land in a bucket, which is also where the size and type policy is ultimately enforced — `accept` and `maxFileSize` are a client-side courtesy, not the security boundary.

**The trigger's label is translatable.** `props.label` takes a `$t:` key and resolves it in the page's own language, like any other authored copy; omit it for the control's own built-in text.

```yaml
- type: file-upload
  accept: 'image/*'
  maxFiles: 1
  uploadAction: /api/buckets/default/files
  props: { label: '$t:upload.change' }
```

A label that is not a key is rendered exactly as written, so a literal stays a literal.

## `number-input`

A numeric input with stepper buttons.

<!-- sovrium:options type:number-input -->

`min` and `max` bound typed values as well as stepped ones, and `step` is the increment for both the stepper buttons and the keyboard arrows.

Prefer `number-input` over an `input` with `inputType: number` when the value is genuinely counted — it gives keyboard and pointer affordances a text box does not.

## `time-picker`

A time input.

<!-- sovrium:options type:time-picker -->

`timeFormat` is `12h`, with an AM/PM selector, or `24h`. `minTime` and `maxTime` are `HH:mm` strings. The granularity key is **`minuteStep`** — a positive integer, 15 by default, so `15` gives quarter-hours.

## `status-indicator` was withdrawn

It is now `badge` with `variant: status`, which carries the same `label`, `color` and `pulse`.
