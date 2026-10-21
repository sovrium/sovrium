/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// FOUNDATIONS — every token this app renders with, drawn as the thing it is.
//
// ─── A SPECIMEN IS RENDERED AT ITS OWN VALUE, NOT DESCRIBED AT IT ──────────
//
// `8px` and `4rem` printed in a table are two strings; drawn as bars they are a
// scale. Elevation cannot be read off a table at all. So every family here
// DRAWS, and prints its value beside the drawing rather than instead of it. The
// value reaches the element through `style`, never through a composed utility
// class: a `bg-$record.leaf` never enters the Tailwind candidate corpus and is
// dropped from the compiled CSS silently.
//
// ─── EVERY VALUE COMES FROM `/tokens`, AND SO DOES EVERY GATE ──────────────
//
// One endpoint, read once per family through `?group=`, plus two reads of the
// same body by another key: `summary` as the page RECORD, and `discarded` as
// the rows of the closing disclosure. The four projections a config page cannot
// perform are published on the row — `leaf` (there is no string splitting), the
// hex conversion and gamut verdict, the two contrast measurements, and the
// `fontSize` member of a typography composite, which `value` renders as one
// unsplittable string.
//
// ─── THE CHIP SHIPS BOTH SCHEMES AND CSS PICKS ONE ────────────────────────
//
// The scheme is the operator's stored preference (`localStorage.theme` →
// `html.dark`), which a server render cannot read. So every swatch carries TWO
// value blocks — each with its own notations, gamut and contrast badge — and the
// `dark:` variant shows exactly one. A single server-resolved block would leave
// the page painting one colour and printing another the moment the toggle moved.
//
// ─── `?scheme=` IS A DEEP LINK, AND IT RESOLVES ON THE CLIENT ─────────────
//
// The retired builder emitted a head script only when the server saw the query.
// A config page cannot vary its scripts per request, so the script reads
// `location.search` itself — same head position, same pre-paint timing, and it
// now works on every page of the section rather than on the two a builder still
// served. It writes nothing to storage: a link is not a preference.

import designSystemFoundations from './design-system-foundations.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default designSystemFoundations as PageConfig
