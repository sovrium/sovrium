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

A list whose items can be reordered by drag-and-drop or by keyboard. Reference: shadcn/ui Item, Button. Each row is drawn as an outlined Item with a grip-handle button at its start; a row picked up for moving — Space on its handle, or a drag — paints the muted surface, and the arrow keys move it.

<!-- sovrium:options type:reorderable-list depth=3 -->

`onReorder` must be a `toast` action — `{ type: toast, message, variant, duration }` is the only type a reorder runs — and its `duration`, in milliseconds, overrides the usual toast dismissal rules. The list items go in `children`, each with its own drag handle.

## `language-switcher`

A control that switches the active language for an internationalised app.

It declares no schema option of its own: `props` carries the HTML attributes and the display options, such as `className` and the label style. What languages it offers comes from the app's own language declaration, not from the component.

The switcher never prints the app's `fallback` language. When one is declared it is exposed on the switcher as `data-fallback-language`, for a script or a stylesheet to read. Reference: shadcn/ui Dropdown Menu, Button. The default variant is a dropdown menu: an outline trigger showing a globe, the current language and a chevron, and a menu of languages in which the current one shows a check. The arrow keys move through the menu, Enter picks a language and Escape closes it. It needs no styling of its own to sit in a header beside the navigation.

`props.variant: toggle` — for an app with exactly two languages — renders one link to the same page in the other language, reading its code and named by its label. The toggle's link is drawn as a ghost button.

Whichever variant it draws, the switcher's outer element carries `data-component-type="language-switcher"` and the HTML attributes given in `props`, `className` among them. No element inside it carries the name.

The `toggle` variant's link takes classes by part, `link`, through `classes`: `classes: { parts: { link: 'h-8' } }` gives the toggle the height of the controls beside it in a header. Its keyboard focus ring stays whatever the classes say.

## `file-upload`

A file selector with optional drag-and-drop.

<!-- sovrium:options type:file-upload depth=2 -->

`accept` takes MIME types or extensions — `image/*,.pdf`. `maxFiles` caps how many may be selected at once and `maxFileSize` is a size in bytes, with oversized files rejected with an error. `dropZone` renders a drop area, drawn as shadcn/ui's Empty with a dashed edge: it names the accepted types and the limits, the types as a person knows them — `image/png,application/pdf` reads "PNG, PDF" and `image/*` "images", while an extension such as `.pdf` reads as written — offers a Browse files button, takes files dropped on it, and is edged in the ring colour while a file is held over it. Reference: shadcn/ui Empty. Each picked file is then listed as an outlined item showing its name. `uploadAction` performs the upload, and `onSuccess` and `onError` handle its result. A control uploading to a declared bucket (`/api/buckets/<name>/files`) that states neither `accept` nor `maxFileSize` takes the bucket's own `allowedMimeTypes` and `maxFileSize`, so its picker and its drop zone say what the bucket will accept before a file is sent; a control that states either keeps exactly what it states. A successful upload answers as a `fetch` button does: its toast, then `status` and `refetch`, `close`, then `navigate`, which may quote what the upload answered through `$response.<field>` — `navigate: /photos?file=$response.filename` opens a page naming the stored file. A failed upload keeps its file listed, marked as failed, with Retry, which sends the same file again, and Remove. In the `onError` toast's `message`, `{file}` is replaced with the name of the file that did not go up, so `Couldn't upload {file}.` says which one.

Uploaded files land in a bucket, which is also where the size and type policy is ultimately enforced — `accept` and `maxFileSize` are a client-side courtesy, not the security boundary.

**The trigger's label is translatable.** `props.label` takes a `$t:` key and resolves it in the page's own language, like any other authored copy; omit it for the control's own built-in text.

```yaml
- type: file-upload
  accept: 'image/*'
  maxFiles: 1
  uploadAction: /api/buckets/system/files
  props: { label: '$t:upload.change' }
```

A label that is not a key is rendered exactly as written, so a literal stays a literal.

Pointed at `/api/account/avatar`, a `file-upload` sets the signed-in visitor's own profile picture; **Profile Avatars** gives the whole account-page control, with an `avatar` that shows the picture and a button that removes it.

## `number-input`

A numeric input with stepper buttons. Reference: shadcn/ui Field, Input Group, Button. Its label sits above one bordered group of a decrement button, the number and an increment button; a step button is disabled when the value already sits on the bound it would cross.

<!-- sovrium:options type:number-input -->

`min` and `max` bound typed values as well as stepped ones, and `step` is the increment for both the stepper buttons and the keyboard arrows.

Prefer `number-input` over an `input` with `inputType: number` when the value is genuinely counted — it gives keyboard and pointer affordances a text box does not.

## `time-picker`

A time input. Reference: shadcn/ui Field, Input Group. Its label sits above the control, which is one bordered group: the time input and a clock glyph at its end.

<!-- sovrium:options type:time-picker -->

`timeFormat` is `12h`, with an AM/PM selector, or `24h`. `minTime` and `maxTime` are `HH:mm` strings. The granularity key is **`minuteStep`** — a positive integer, 15 by default, so `15` gives quarter-hours.

## `status-indicator` was withdrawn

It is now `badge` with `variant: status`, which carries the same `label`, `color` and `pulse`.
