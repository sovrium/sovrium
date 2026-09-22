/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a catalogue specimen's ROWS came from, published to its two readers.
 *
 * Both answer ONE question off ONE field of the catalogue entry — the frame
 * attributes it declares — and they are here together for exactly that reason:
 * a renderer stamps the attribute onto the frame it draws, and a config page,
 * which cannot inspect a wrapper, is handed the boolean instead. Two derivations
 * of one fact in two files is how they come to disagree about which seven types
 * read the platform fixture.
 */

import { SPECIMEN_BY_TYPE, FIXTURE_SOURCE_ATTRIBUTE } from '.'

/**
 * Whether this type's specimen draws PLATFORM FIXTURE ROWS rather than nothing.
 *
 * The seven data types are the only ones that read rows at all, and each reads
 * the catalogue's own fixture endpoint — never an operator table. That bound is
 * a confidentiality claim, so the card that says so must say it from the same
 * fact the wrapper is stamped from, not from a hand-kept list of seven names
 * that would drift the day an eighth type became drawable.
 *
 * `false` for the other 81 — measured over `SPECIMEN_BY_TYPE`, and a count that
 * moves every time a type becomes drawable, so re-measure rather than trust it
 * — and `false` for a type the catalogue has never heard of. The two silences are deliberately conflated HERE where they are
 * kept apart in {@link catalogSpecimenRefusal}: the question is "does this card
 * carry a provenance mark", and an unknown type carries no card at all.
 */
export function catalogSpecimenIsFixtureBacked(type: string): boolean {
  return SPECIMEN_BY_TYPE.get(type)?.wrapperProps?.[FIXTURE_SOURCE_ATTRIBUTE] !== undefined
}

/**
 * The attributes this type's specimen declares for the frame drawn AROUND it.
 *
 * ─── WHY THE RENDER PATH READS THIS AND NOT ONLY A CALLER ──────────────────
 *
 * `wrapperProps` was authored for a caller that composed the frame itself: the
 * retired type-page builder held the `CatalogSpecimen` in hand and spread these
 * onto the wrapper it was building. Nothing on the RENDER path did, so a
 * `specimen` component drew the fixture-backed rows and said nothing about where
 * they came from — and the one surface that did say it read a separately
 * published boolean, which is a second copy of a fact that can drift from the
 * drawing it describes.
 *
 * Handing them to the specimen node itself makes the claim travel with the
 * drawing: a type that stops reading the platform fixture stops declaring the
 * marker, and every frame around it loses the stamp in the same commit. That is
 * the same anti-drift argument `snippet` and `drawnProps` are published under —
 * one definition, projected, never restated.
 *
 * `{}` — never `undefined` — for a type declaring none and for a type the
 * catalogue has never heard of, so a caller spreads unconditionally.
 */
export function catalogSpecimenWrapperProps(type: string): Readonly<Record<string, string>> {
  return SPECIMEN_BY_TYPE.get(type)?.wrapperProps ?? {}
}
