/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `preview.subject` — the catalogue's own specimen for a type, drawn with ONE
 * option set to ONE value.
 *
 * ─── IT IS THE AXIS MACHINERY, ONE VOCABULARY OVER ─────────────────────────
 *
 * {@link catalogSpecimenInAxes} writes a VARIANT / SIZE / STATE onto the
 * specimen; this writes an arbitrary OPTION PATH. The two share the hard half —
 * unwrapping the specimen to the type's own node — and deliberately do not share
 * a signature: an axis is a closed union the schema publishes three of, and an
 * option is any of two hundred paths. Folding the second into the first is what
 * would turn `SpecimenSubject`'s four axis fields into "four axes and also
 * anything", which is the shape that stops a reader being able to tell what a
 * subject means.
 *
 * ─── THE SPECIMEN IS UNWRAPPED, FOR THE REASON THE AXES ARE ────────────────
 *
 * Several catalogue specimens COMPOSE: `badge`'s is a `container` of four
 * badges. Patching `variant` onto that root writes it onto a `container`, which
 * declares no such field — the renderer drops it and every preview of that
 * option draws the same four badges. So the type's OWN node inside the specimen
 * is what gets the option, keeping the illustrative content that makes a bare
 * `select` more than an empty box.
 *
 * ─── AND A STRING IS COERCED AGAINST THE OPTION'S OWN KIND ─────────────────
 *
 * A Configuration row carries `$record.value`, which is always a string off the
 * wire, while an app documenting its own kit writes the literal `2`. Both must
 * draw the same thing, so the value is measured against the kind
 * `GET /api/admin/schema/component-types/:type/options` publishes — the same
 * walk, so the coercion cannot come to disagree with the table a reader is
 * looking at.
 *
 * Coercion happens ONLY where the option does not accept a string. An option
 * declared `string | number` keeps the string it was given: the author wrote a
 * string and the option takes one, so there is nothing to correct.
 *
 * Source: src/domain/models/app/pages/components/component-types/specialty/preview.ts
 * Specs: [internal ref]
 */

import { catalogSpecimenComponent, ownNodeOf } from './catalog-specimens'
import { schemaOptionTree } from './schema-option-tree'
import type { Component } from '@/domain/models/app/pages/components'

/** The three scalar shapes an option's value may take. */
export type PreviewOptionValue = string | number | boolean

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The kinds one option accepts, from the SAME walk the options endpoint
 * publishes.
 *
 * `[]` for a path the walk does not know — a typo, or a level past the walk's
 * depth limit. The value is then written verbatim rather than guessed at: a
 * coercion inferred from the value's own shape would turn a legitimate `'2'`
 * placeholder into the number two.
 */
const kindsOf = (type: string, option: string): readonly string[] => {
  const row = schemaOptionTree(type).items.find((item) => item.path === option)
  return row === undefined ? [] : row.kind.split('|').map((kind) => kind.trim())
}

/**
 * The value to write, measured against the option's own kind.
 *
 * Only a string is ever changed, and only into the one kind the option accepts:
 * `'true'` for a boolean, `'2'` for a number. Anything else — an unknown path, a
 * kind that includes `string`, a string that is not a number — is left alone.
 */
export const coercePreviewValue = (
  type: string,
  option: string,
  value: PreviewOptionValue
): PreviewOptionValue => {
  if (typeof value !== 'string') return value
  const kinds = kindsOf(type, option)
  if (kinds.length === 0 || kinds.includes('string')) return value
  if (kinds.includes('boolean') && (value === 'true' || value === 'false')) return value === 'true'
  if (kinds.includes('number')) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && value.trim() !== '' ? parsed : value
  }
  return value
}

/**
 * Write a value at one option path, in the grammar the options endpoint
 * publishes: dotted, with `[]` for an array level.
 *
 * `columns[].format` sets `format` on EVERY element of `columns`, because a
 * preview of that option is a picture of what the option does to the column
 * list — not to its first column. An array level over an ABSENT array
 * synthesises one element rather than dropping the write: the option is what the
 * reader asked to see, and silently declining to apply it would draw the plain
 * specimen under a label promising something else.
 */
const setAtPath = (
  node: Readonly<Record<string, unknown>>,
  segments: readonly string[],
  value: PreviewOptionValue
): Readonly<Record<string, unknown>> => {
  const [head, ...rest] = segments
  if (head === undefined) return node
  const isArrayLevel = head.endsWith('[]')
  const key = isArrayLevel ? head.slice(0, -2) : head
  const current = node[key]

  if (!isArrayLevel) {
    return {
      ...node,
      [key]:
        rest.length === 0 ? value : setAtPath(isPlainRecord(current) ? current : {}, rest, value),
    }
  }

  if (rest.length === 0) return { ...node, [key]: value }
  const elements = Array.isArray(current) ? current : []
  return {
    ...node,
    [key]:
      elements.length === 0
        ? [setAtPath({}, rest, value)]
        : elements.map((element) => setAtPath(isPlainRecord(element) ? element : {}, rest, value)),
  }
}

/**
 * Would this path overwrite a `type` key the subject does not publish as an
 * option?
 *
 * ─── THE ONE WRITE THAT CHANGES WHAT IS DRAWN, NOT HOW ─────────────────────
 *
 * Every other option lands on a prop: the renderer either reads it or drops it,
 * and the worst case is a picture of the default under a caption promising
 * something else. A `type` key is different, because it is the discriminator the
 * component renderer dispatches on. Writing one does not configure the drawn
 * component; it REPLACES it, after the catalogue has already decided what this
 * subject is allowed to be.
 *
 * That is a write-path escape rather than an aesthetic one, and it is now the
 * ONLY way a live submit control reaches a preview frame — the other two paths
 * are closed, each for its own reason:
 *
 *   - An author cannot DECLARE one. `SPECIMEN_REFUSED_TYPES` names `form` at any
 *     depth, so a `specimen` pointed at one is refused at decode time; its
 *     published sentence is `EXCLUDED_TYPES.form`.
 *   - The catalogue's own `form` specimen carries no submit control. It is no
 *     longer refused — {@link catalogSpecimenComponent} draws its BARE mode, the
 * one [internal ref] A3 clause 2 names verbatim: no `action`, no `dataSource`, no
 *     submit path. What makes that entry safe is its CHILDREN, not its type:
 *     `renderBareFormVariant` renders the declared body, and the entry declares
 *     two fields.
 *
 * Which is exactly why the write stays a hazard. That same renderer falls back
 * to `<button type="submit">Submit</button>` when a form has NO children, so the
 * hole is not "a form appears" but "a childless node becomes one". Measured on
 * this catalogue: the top-level key turns a badge into a live form carrying a
 * submit control, and an array level does the same one step down on every
 * specimen whose children are themselves rendered as components.
 *
 * ─── WHY THE TEST IS "UNPUBLISHED", NOT "NAMED `type`" ─────────────────────
 *
 * Several types publish a real option whose last segment is `type` — a column's
 * data kind, an action's kind, a nested subject's own name. Those are ordinary
 * options that happen to share a word, they are exactly what a Configuration
 * section exists to illustrate, and none of them dispatches a component:
 * measured across every catalogued type, each published one either names a field
 * kind or resolves back through the catalogue's own refusal. So membership is
 * the test, and it is exact — a path the type publishes is drawn, one it does
 * not is refused.
 *
 * No catalogued type publishes a bare top-level `type`, which is why that case
 * needs no exception and the rule costs nothing an author would notice.
 *
 * ─── AND WHY IT IS HERE RATHER THAN ONLY AT BOOT ───────────────────────────
 *
 * `preview-option-validation.ts` already refuses an unpublished path when it can
 * READ one, and stands down — deliberately — where the path is `$param.` or
 * `$record.`: a URL segment and a row value are not config facts, so there is
 * nothing to test at boot. Those two forms resolve to an arbitrary string at
 * render, and this is the site they resolve INTO. A rule that lives only at boot
 * covers the literal spelling of a hazard and none of the ways it arrives from
 * outside the config.
 */
const writesAnUnpublishedTypeKey = (type: string, option: string): boolean => {
  const last = option.split('.').at(-1)
  if (last === undefined || last.replace(/\[\]$/, '') !== 'type') return false
  return !schemaOptionTree(type).items.some((row) => row.path === option)
}

/**
 * The catalogue's specimen for one type, with one option set to one value.
 *
 * `undefined` covers every reason there is nothing to draw, and the caller wants
 * the same answer for all of them: a type nobody catalogued, a type the
 * catalogue REPORTS rather than draws, and a path that would replace the drawing
 * instead of configuring it. A frame around nothing would leave a reader
 * believing the type has no specimen rather than no existence, and the caller
 * turns each of them into the two answers a subject already gets — a 404 on a
 * route, an in-place refusal in a row.
 */
export const catalogSpecimenWithOption = (
  type: string,
  option: string,
  value: PreviewOptionValue
): Component | undefined => {
  if (writesAnUnpublishedTypeKey(type, option)) return undefined
  const base = catalogSpecimenComponent(type)
  if (base === undefined || !isPlainRecord(base)) return base
  const drawn = ownNodeOf(base, type) ?? base
  return setAtPath(drawn, option.split('.'), coercePreviewValue(type, option, value)) as Component
}
