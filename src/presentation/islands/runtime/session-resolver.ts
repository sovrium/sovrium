/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared client-side session resolver (GDPR-conversion foundation).
 *
 * The one place a client surface resolves the SIGNED-IN caller's OWN session
 * field — fetched CLIENT-SIDE from `GET /api/auth/get-session`, never
 * server-rendered or cached across users. Three cooperating surfaces consume it:
 *
 *  1. Session-bound `text` (`presentation/client.ts` `setupSessionBoundText`):
 *     a `data-session-template` element's `$session.<field>` token is resolved
 *     into the caller's own value — "logged in as X". An anonymous caller
 *     resolves to the EMPTY string (the security invariant — no identity leaks,
 *     no static cross-user value).
 *  2. The type-to-confirm confirm gate (the vanilla-DOM `client.ts` gate and the
 *     React `inline-confirm-dialog.tsx`): the gate's `matchValue` (e.g.
 *     `$session.email`) is resolved so the confirm affordance stays disabled
 *     until the caller retypes their OWN email.
 *  3. A form control's prefilled value (`data-session-value`, emitted by
 *     `render/elements/crud-form/endpoint-form-renderer.tsx`): a field's
 *     `defaultValue` of `$session.<field>` arrives as the TEMPLATE and is
 *     filled here, so the served bytes name nobody and a cached copy of the
 *     page cannot carry one reader's identity to the next.
 *
 * The resolvable fields are deliberately limited to the non-sensitive identity
 * fields the session envelope returns (`email` / `name` / `role` / `id`) — every
 * value is the CALLER's own, mirroring `SessionFieldSchema`.
 *
 * The GRAMMAR itself — the `$session.<field>` token and the `[ … ]` optional
 * segment around it — lives in `@/presentation/design/session-template`, because
 * the server's SSR placeholder has to resolve the same string the same way and
 * the two trees may not import each other. This module owns the FETCH and the
 * DOM fill; it re-exports the grammar so the client surfaces keep one import.
 */

import { deriveInitials } from '@/presentation/design/avatar-initials'
import { resolveSessionTemplate } from '@/presentation/design/session-template'
import type { SessionUser } from '@/presentation/design/session-template'

export { resolveSessionTemplate }
export type { SessionUser }

/**
 * Fetch the signed-in caller's OWN session identity from
 * `GET /api/auth/get-session`. Returns `undefined` for an anonymous caller (no
 * session, a non-2xx response, or a network failure) so the consumer resolves
 * every `$session.<field>` token to the empty string — the anon-safe path.
 */
export async function fetchSessionUser(): Promise<SessionUser | undefined> {
  if (typeof fetch === 'undefined') return undefined
  try {
    const res = await fetch('/api/auth/get-session', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!res.ok) return undefined
    const body = (await res.json().catch(() => undefined)) as
      { readonly user?: SessionUser } | undefined
    return body?.user ?? undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// The client-side FILL — one mechanism, three surfaces
// ---------------------------------------------------------------------------

/** The attribute a session-bound `avatar` carries its whole fall-back chain in. */
const AVATAR_BINDING_ATTRIBUTE = 'data-session-avatar'

/** The `avatar` fields the server hands the client, templates and literals alike. */
interface AvatarBinding {
  readonly src?: string
  readonly label?: string
  readonly initials?: string
  readonly alt?: string
  /** Server-computed class for the `<img>` rung, so the client styles nothing. */
  readonly imageClass?: string
}

/** A resolved field, with the EMPTY string read as an absence rather than a value. */
function resolvedOrAbsent(
  template: string | undefined,
  user: SessionUser | undefined
): string | undefined {
  if (template === undefined) return undefined
  const value = resolveSessionTemplate(template, user)
  return value === '' ? undefined : value
}

/** The `<img>` rung, styled from the class the server computed for it. */
function avatarImage(binding: AvatarBinding, src: string, alt: string): HTMLImageElement {
  const image = document.createElement('img')
  image.setAttribute('data-avatar-image', '')
  image.setAttribute('src', src)
  image.setAttribute('alt', alt)
  if (binding.imageClass !== undefined) image.setAttribute('class', binding.imageClass)
  return image
}

/** The initials rung — the one most people land on, having no picture. */
function avatarInitials(letters: string): HTMLSpanElement {
  const initials = document.createElement('span')
  initials.setAttribute('data-avatar-initials', '')
  initials.append(letters)
  return initials
}

/**
 * Draw one avatar's fall-back chain from the caller's own session.
 *
 * The chain is `src` → `initials` → initials derived from `label` → an empty
 * disc, exactly as the server draws it for a record. The one rule this side has
 * to get right, and the one a text substitution does not have to: an unresolved
 * or empty token is an ABSENCE, never a literal. A `$session.` token surviving
 * into `src` is requested as a relative URL and painted as a broken image,
 * which is a visible defect where the same token in text is merely ugly.
 */
function fillSessionAvatar(element: HTMLElement, user: SessionUser | undefined): void {
  const raw = element.getAttribute(AVATAR_BINDING_ATTRIBUTE)
  if (raw === null) return
  const binding = JSON.parse(raw) as AvatarBinding
  const label = resolvedOrAbsent(binding.label, user)
  const src = resolvedOrAbsent(binding.src, user)
  const alt = resolvedOrAbsent(binding.alt, user)
  element.setAttribute('aria-label', label ?? alt ?? '')

  if (src !== undefined) {
    element.replaceChildren(avatarImage(binding, src, alt ?? label ?? ''))
    return
  }
  const letters =
    resolvedOrAbsent(binding.initials, user) ?? (label === undefined ? '' : deriveInitials(label))
  element.replaceChildren(...(letters === '' ? [] : [avatarInitials(letters)]))
}

/** The attribute a session-bound FORM CONTROL carries its value template in. */
const VALUE_BINDING_ATTRIBUTE = 'data-session-value'

/** Every element type whose prefilled value this can legitimately set. */
type ValueControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/**
 * Prefill one form control from the caller's own session.
 *
 * The THIRD surface of the same mechanism, and the one with the sharpest reason
 * to be client-side: a form's prefilled value is the most tempting thing to
 * resolve during SSR, and doing so writes one reader's identity into every
 * cached copy of the page. The server therefore emits the TEMPLATE and no
 * value at all, and the box is empty until this runs.
 *
 * An unresolved token is an ABSENCE, exactly as it is for an avatar: an
 * anonymous caller gets an empty box, never the literal `$session.name` — which
 * is what an unfilled marker looks like to someone reading the form.
 *
 * ─── AN ABSENCE LOOKS DIFFERENT ON A BOX AND ON A DROPDOWN ─────────────────
 *
 * On an `<input>` or a `<textarea>`, writing the empty string IS what "we do
 * not know" looks like, and the reader can type. On a `<select>` it is not:
 * no option carries the empty string, so the browser moves the control to
 * `selectedIndex: -1` and the dropdown renders BLANK — showing neither the
 * option the author wrote first nor anything a reader can act on, and
 * reporting no state at all. So an empty resolution leaves a `<select>` alone
 * and it keeps its authored selection.
 *
 * A resolution that is NOT empty still selects, on every control type: a value
 * matching an option is the whole reason a dropdown carries a session token,
 * and a fix that skipped selects wholesale would break the row that can
 * resolve while fixing the one that cannot.
 *
 * The tag is read off `tagName` rather than through `instanceof
 * HTMLSelectElement`, which is false across realms — and a marker filled inside
 * a lazily-mounted island's document fragment is exactly that case.
 */
function fillSessionValue(element: HTMLElement, user: SessionUser | undefined): void {
  const template = element.getAttribute(VALUE_BINDING_ATTRIBUTE)
  if (template === null) return
  const resolved = resolveSessionTemplate(template, user)
  if (resolved === '' && element.tagName === 'SELECT') return
  const control = element as ValueControl
  // eslint-disable-next-line functional/immutable-data -- prefilling the control IS the mutation
  control.value = resolved
}

/** Fill one `data-session-template` element with the caller's own value. */
function fillSessionText(element: HTMLElement, user: SessionUser | undefined): void {
  const template = element.getAttribute('data-session-template')
  if (template === null) return
  // `replaceChildren` (a method call) sets the text without a property
  // assignment to the element (no-param-reassign clean).
  element.replaceChildren(resolveSessionTemplate(template, user))
}

/**
 * Fill every session-bound marker under `root` from the caller's own session.
 *
 * Idempotent by construction — the markers stay on the elements and carry the
 * TEMPLATE, never the resolved value — so a surface that mounts late can simply
 * ask again. That is what a lazily-hydrated island needs: its trigger content
 * is injected after the page-load pass has already run and found nothing.
 *
 * Each call costs one session read. That is deliberate over a module-level
 * memo: the client runtime and a lazily-loaded island are separate bundles and
 * would each hold their own cache anyway, so the memo would buy at most one
 * saved request while making the module hold mutable state. The read only
 * happens at all when a marker is present, which is what keeps a page with no
 * session-bound chrome at zero.
 */
export function hydrateSessionBindings(root: ParentNode = document): void {
  const texts = root.querySelectorAll<HTMLElement>('[data-session-template]')
  const avatars = root.querySelectorAll<HTMLElement>(`[${AVATAR_BINDING_ATTRIBUTE}]`)
  const values = root.querySelectorAll<HTMLElement>(`[${VALUE_BINDING_ATTRIBUTE}]`)
  if (texts.length === 0 && avatars.length === 0 && values.length === 0) return
  void fetchSessionUser().then((user) => {
    texts.forEach((element) => fillSessionText(element, user))
    avatars.forEach((element) => fillSessionAvatar(element, user))
    values.forEach((element) => fillSessionValue(element, user))
  })
}
