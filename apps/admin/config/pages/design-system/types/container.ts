/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `container` — a box with one key, and the key is not about how it looks.
//
// `element` picks the tag: `div section main aside nav header footer article`.
// Nothing in that list paints differently. What it changes is the document —
// what a screen reader announces, what a skip link can reach, what the browser
// treats as a landmark — so the choice is editorial and invisible, which is
// exactly why it is worth saying out loud rather than drawing twice.
//
// `div` is the right answer whenever the box groups things for layout alone.
// Reach for one of the others only when the box IS the region it names: one
// `main` per page, `nav` around a real navigation, `aside` around content that
// stands apart from what it sits beside.
//
// Everything else a container does — its direction, its gaps, its padding, its
// border — is Tailwind in `props.className`. There are no layout keys here, and
// that is the design: a second spelling for `flex-col gap-4` would be one more
// vocabulary to learn and one more place for the two to disagree.
//
// It is drawn once, holding children, because a container with nothing in it
// renders as a `<div>` of no size at all.

import { genericBody } from './_generic'

const container = genericBody('container')

export default container
