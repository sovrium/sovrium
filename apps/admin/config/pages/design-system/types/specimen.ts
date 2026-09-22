/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `specimen` — the frame this whole console is made of.
//
// It names a type, resolves the catalogue's own exhibit for it, and draws it
// with the real renderer. Optionally it prints the config that produced the
// drawing beside it, projected from the SAME declaration, so the picture and
// the snippet cannot drift — which is the property that makes a component
// gallery worth trusting.
//
// ─── IT CANNOT DRAW ITSELF, AND THE REASON IS NOT SAFETY ───────────────────
//
// `SPECIMEN_REFUSED_TYPES` names `specimen`, so a specimen whose subject is a
// specimen is refused at DECODE, not at render. Each level projects its snippet
// from the literal below it, so the nesting has no bottom — it is unboundedness
// rather than danger. (`form` is on that list for the other reason: it renders
// a live submit control, and a preview frame may carry no write path.)
//
// So the drawings below are this type doing its job on OTHER types, which is
// the only honest way to show it. And the page is not the best demonstration of
// it anyway: every drawing on every one of these eighty-eight pages is a frame
// like this one, so the reader is looking at hundreds of them already.

import type { TypePageBody } from './_shape'

const specimen: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [{ type: 'specimen', subject: { type: 'badge' } }],
    },
    {
      label: 'showSnippet',
      children: [{ type: 'specimen', subject: { type: 'button' }, showSnippet: true }],
    },
    {
      label: 'showProvenance',
      children: [{ type: 'specimen', subject: { type: 'badge' }, showProvenance: true }],
    },
  ],
}

export default specimen
