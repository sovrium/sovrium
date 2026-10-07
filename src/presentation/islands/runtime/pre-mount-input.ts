/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a reader typed, picked or focused inside a server-rendered region
 * before its island mounted, captured from the static markup and handed back
 * to the hydrated controls so the mount loses none of it.
 */

/**
 * Extracts current form input values from the SSR skeleton.
 * Preserves values entered by the user before the island mounts.
 */
function extractFormValues(el: HTMLElement): Record<string, string> {
  const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input[name], textarea[name], select[name]'
  )
  const entries = Array.from(inputs)
    // Skip hidden inputs and file inputs. A file `<input>`'s `.value` is
    // always an empty/opaque string (browsers forbid reading it), so capturing
    // it here would clobber the record's existing attachment metadata in edit
    // mode (FORM-037) — `buildInitialValues` lets a captured value win over the
    // record, and `'' ?? record` keeps the empty string.
    .filter((input) => input.type !== 'hidden' && input.type !== 'file')
    .map((input) => [input.name, input.value] as const)
  return Object.fromEntries(entries)
}

/**
 * Writes the LIVE state of every form control in `el` back into its MARKUP.
 *
 * `innerHTML` serialises ATTRIBUTES, and a value someone has typed lives in the
 * `value` PROPERTY — the attribute still says whatever the server rendered. Two
 * captures read `el.innerHTML`: the Suspense fallback built in
 * {@link mountIslandsWithin}, and the `ssrHtml` an island keeps by declaring
 * `data-island-ssr`. Both are re-inserted into the document, so without
 * this capture each would hand back a copy of the page with every entered value reverted — silently,
 * with nothing thrown and nothing logged.
 *
 * The case that exposed it is a record form inside a tab panel. The tabs island
 * captures its panel as markup and re-inserts it, and the form island then
 * mounts against that copy; a name typed before the islands mounted was
 * serialised away, so the form posted the value the page had loaded with. The
 * record was saved unchanged and the edit simply disappeared.
 *
 * Mutating a subtree `createRoot` is about to discard is safe by construction:
 * all this does is make the serialisation say what is on screen. File inputs
 * are skipped — a selection cannot be written as an attribute, and travels
 * separately through {@link extractPendingFiles}.
 */
function inlineLiveFormState(el: HTMLElement): void {
  el.querySelectorAll('input').forEach((input) => {
    if (input.type === 'file') return
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.toggleAttribute('checked', input.checked)
      return
    }
    input.setAttribute('value', input.value)
  })
  // A `<textarea>` has no `value` attribute at all: its markup CONTENT is the
  // value, so the text node is what has to be replaced.
  el.querySelectorAll('textarea').forEach((area) => {
    area.replaceChildren(document.createTextNode(area.value))
  })
  el.querySelectorAll('option').forEach((option) => {
    option.toggleAttribute('selected', option.selected)
  })
}

/**
 * A file the user picked against the SSR skeleton, before the island mounted.
 *
 * The twin of {@link extractFormValues} for the one input type that hook
 * cannot carry: a file `<input>`'s `.value` is opaque, but its `.files`
 * `FileList` is readable and holds the whole selection.
 */
interface PendingFileSelection {
  readonly name: string
  readonly files: FileList
}

/**
 * Collects file selections made against the SSR skeleton before mount.
 *
 * `createRoot` (not `hydrateRoot`) DISCARDS the server-rendered subtree, so a
 * file picked between SSR delivery and React mount dies with the node that
 * held it: no change handler ever ran, no upload fired, and the input React
 * renders in its place is empty. On a slow connection — or when the island
 * chunk is built at request time — that window is seconds wide, and the user
 * watches their chosen file silently vanish.
 */
function extractPendingFiles(el: HTMLElement): readonly PendingFileSelection[] {
  const inputs = el.querySelectorAll<HTMLInputElement>('input[type="file"][name]')
  return Array.from(inputs)
    .filter((input) => (input.files?.length ?? 0) > 0)
    .map((input) => ({ name: input.name, files: input.files as FileList }))
}

/** How long to wait for a lazy island's real component before abandoning the replay. */
const PENDING_FILE_REPLAY_TIMEOUT_MS = 30_000

/**
 * Re-applies a pre-mount file selection to the input React just rendered, then
 * dispatches the `change` the skeleton's input could not deliver — so the
 * island's own validate → upload → preview path runs exactly as if the file
 * had been picked a moment later.
 *
 * Replayed exactly ONCE per host, gated on `data-island-ready` — the signal
 * {@link IslandReadySignal} sets when the REAL component has mounted. Gating on
 * anything earlier would apply the files to the Suspense fallback, which is
 * inert server-rendered HTML carrying no React listener, and the selection
 * would be lost a second time when the real component replaced it. Firing once
 * is also what stops a double upload: the file field remounts its input under
 * a fresh `key` after a successful upload, and a re-arming observer would read
 * that deliberately empty input as a second chance to replay.
 */
export function replayPendingFiles(
  el: HTMLElement,
  pending: readonly PendingFileSelection[]
): void {
  whenIslandReady(el, () => {
    pending.forEach(({ name, files }) => {
      const input = el.querySelector<HTMLInputElement>(
        `input[type="file"][name="${CSS.escape(name)}"]`
      )
      // A selection already present is the user's own, made after mount —
      // never overwrite it with the stale skeleton pick.
      if (!input || (input.files?.length ?? 0) > 0) return
      input.files = files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })
}

/**
 * Run `apply` exactly once, when the island on `el` has mounted its REAL
 * component — the `data-island-ready` signal {@link IslandReadySignal} sets.
 * Anything earlier would act on the Suspense fallback, inert server-rendered
 * HTML the real component is about to replace. Gives up after
 * {@link PENDING_FILE_REPLAY_TIMEOUT_MS}, so a chunk that never loads leaves no
 * observer behind.
 */
function whenIslandReady(el: HTMLElement, apply: () => void): void {
  if (el.dataset.islandReady === 'true') {
    apply()
    return
  }
  const observer = new MutationObserver(() => {
    if (el.dataset.islandReady !== 'true') return
    observer.disconnect()
    apply()
  })
  observer.observe(el, { attributes: true, attributeFilter: ['data-island-ready'] })
  setTimeout(() => observer.disconnect(), PENDING_FILE_REPLAY_TIMEOUT_MS)
}

/** The skeleton control that had the keyboard when the mount began. */
interface PendingFocus {
  readonly selector: string
  readonly selection?: { readonly start: number; readonly end: number }
}

type NamedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const isNamedControl = (node: Element | null): node is NamedControl =>
  (node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement) &&
  node.name !== ''

/**
 * Note which control inside `el` has the keyboard, and where its caret is.
 *
 * `createRoot` discards the server-rendered subtree, and the focused input goes
 * with it: the browser moves focus to `<body>`. The input's VALUE survives
 * (it rides across as `initialValues`), but everything typed after that point
 * goes nowhere — someone who started typing into a drawer's form while its
 * code was still loading keeps typing into nothing, and a save sends only
 * what reached the field before the swap. The caret is kept too: a selection
 * the user was about to type over must still be one, or their next keystroke
 * appends to the old text instead of replacing it.
 */
export function capturePendingFocus(el: HTMLElement): PendingFocus | undefined {
  const active = document.activeElement
  if (!isNamedControl(active) || !el.contains(active)) return undefined
  const selection = selectionOf(active)
  return selection
    ? { selector: controlSelector(active), selection }
    : { selector: controlSelector(active) }
}

/** A selector finding the mounted twin of `control`: same tag, same name (and value, in a group). */
function controlSelector(control: NamedControl): string {
  const byName = `${control.tagName.toLowerCase()}[name="${CSS.escape(control.name)}"]`
  const inGroup =
    control instanceof HTMLInputElement && (control.type === 'radio' || control.type === 'checkbox')
  return inGroup ? `${byName}[value="${CSS.escape(control.value)}"]` : byName
}

/** The caret or selection of `control`, when its type has one (not email, number or a select). */
function selectionOf(control: NamedControl): PendingFocus['selection'] {
  if (control instanceof HTMLSelectElement) return undefined
  const { selectionStart: start, selectionEnd: end } = control
  return start !== null && end !== null ? { start, end } : undefined
}

/**
 * Give the keyboard back to the control the mount took it from, caret and
 * all — but only while focus is still where the swap dropped it. A user who has
 * since clicked somewhere else has moved on, and is not pulled back.
 */
export function restorePendingFocus(el: HTMLElement, pending: PendingFocus): void {
  whenIslandReady(el, () => {
    const current = document.activeElement
    if (current !== null && current !== document.body) return
    const control = el.querySelector<NamedControl>(pending.selector)
    if (!control) return
    control.focus()
    if (pending.selection && !(control instanceof HTMLSelectElement)) {
      try {
        control.setSelectionRange(pending.selection.start, pending.selection.end)
      } catch {
        // The mounted control is a type without a text selection — focus alone is right.
      }
    }
  })
}

/**
 * Everything the user put into the SSR skeleton that must survive the mount.
 *
 * `createRoot` discards the server-rendered subtree, so anything typed or
 * picked between SSR delivery and React mount is lost unless it is read out
 * first. Text/select values ride across as the `initialValues` prop; a file
 * selection cannot (a `FileList` is not JSON) and is replayed onto the mounted
 * input instead.
 *
 * In create mode `initialValues` preserves typing into the empty skeleton; in
 * update mode the skeleton is pre-filled with the record's current values, so
 * extracting is a no-op for untouched fields and correctly carries over any
 * value the user typed between SSR delivery and React mount (otherwise that
 * keystroke is lost when React re-renders from `record`, and a downstream
 * auto-save sees no diff against the original).
 *
 * The third thing an island can ask to keep is the SERVER-RENDERED MARKUP
 * itself, by declaring `data-island-ssr="true"` on its host. An island that
 * does so is telling the mounter that the document — not its serialised props —
 * is where some of its content lives, so shipping that content twice can stop.
 * The tabs island is the first: the panel a URL addresses is real markup in the
 * page, and serialising it again into `data-island-props` cost the response a
 * whole second escaped copy of its largest panel. The
 * read has to happen HERE because `createRoot` discards the server-rendered
 * subtree on its first commit, and no code inside the island runs before that.
 * Nothing is captured for a host that does not opt in.
 */
export function capturePreMountInput(
  el: HTMLElement,
  props: Record<string, unknown>
): {
  readonly mergedProps: Record<string, unknown>
  readonly pendingFiles: readonly PendingFileSelection[]
} {
  // Ahead of BOTH markup captures — the `ssrHtml` below, and the Suspense
  // fallback `mountIslandsWithin` reads off the same element a moment later.
  inlineLiveFormState(el)
  const initialValues = extractFormValues(el)
  const withValues = Object.keys(initialValues).length > 0 ? { ...props, initialValues } : props
  return {
    mergedProps:
      el.dataset.islandSsr === 'true' ? { ...withValues, ssrHtml: el.innerHTML } : withValues,
    pendingFiles: extractPendingFiles(el),
  }
}
