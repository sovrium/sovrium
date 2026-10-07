/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * When `antiSpam.honeypot: true`, render a conventionally-
 * named hidden input (`_hp`) with all four invisibility markers — humans
 * cannot tab into it, see it, or have their password manager auto-fill it,
 * but a naive bot that fills every input will trigger the server-side
 * detection (`submit-form-honeypot.ts`).
 */
// The honeypot markup is emitted as a raw, fully-static HTML string (no
// interpolation of any value, untrusted or otherwise) for two reasons:
//
//  1. A forms spec asserts the SSR HTML contains the *lowercase* standard DOM
//     attribute `autocomplete="off"` (case-sensitive: `/autocomplete="off"/`),
//     and real password managers also key on the lowercase attribute. Under
//     this app's React 19 `renderToString` path, the recognized `autoComplete`
//     JSX prop is emitted verbatim as camelCase `autoComplete="off"` — it is
//     NOT lowercased the way `tabIndex` → `tabindex` is — so a plain JSX prop
//     cannot satisfy the assertion.
//  2. Passing a lowercase `autocomplete` JSX prop (e.g. via a spread) makes
//     React reject it as an unrecognized DOM property and log
//     `Invalid DOM property \`autocomplete\`. Did you mean \`autoComplete\`?`
//     on every SSR render — terminal noise with no benefit.
//
// Injecting the constant markup verbatim sidesteps both: React never validates
// the attribute, and the exact lowercase `autocomplete="off"` reaches the HTML.
//
// Both constants live at module level so React allocates nothing fresh per SSR
// pass (react-perf/jsx-no-new-object-as-prop) — the `__html` payload and the
// wrapper style are stable across renders.
const HONEYPOT_INNER_HTML = {
  __html:
    '<input type="text" name="_hp" tabindex="-1" aria-hidden="true" autocomplete="off" style="display:none" />',
} as const

// Wrapper uses `display: contents` so it adds no box of its own — the honeypot's
// own `display:none` keeps the field invisible/untabbable for humans while a
// naive bot that fills every input still trips `_hp` (submit-form-honeypot.ts).
const HONEYPOT_WRAPPER_STYLE = { display: 'contents' } as const

export function HoneypotInput() {
  return (
    <span
      style={HONEYPOT_WRAPPER_STYLE}
      // eslint-disable-next-line sovrium/require-sanitized-html -- a same-file string literal, hoisted into a constant object for react-perf
      dangerouslySetInnerHTML={HONEYPOT_INNER_HTML}
    />
  )
}
