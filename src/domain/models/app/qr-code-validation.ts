/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `qr-code` payload cross-validation.
 *
 * A `qr-code` component encodes EXACTLY ONE of `link` (a short-link slug) or
 * `value` (an arbitrary string). Both answer "what goes in the symbol", and
 * there is no defensible precedence between them — so guessing one would encode
 * something the author did not ask for, onto something that then gets PRINTED.
 * A wrong QR fails in the field, months later, where nobody can fix it, which
 * is why this is a refusal rather than a warning.
 *
 * Declaring neither is the same defect read from the other end: there is
 * nothing to encode, and the alternative to refusing is a symbol resolving to
 * an empty payload.
 *
 * WHY THIS IS NOT IN THE COMPONENT'S OWN SCHEMA
 * ---------------------------------------------
 * Two independent optional fields cannot express "exactly one of" at the field
 * level — the rule is inherently struct-level. And the per-branch struct has no
 * refinement hook: `buildComponentUnion` composes all 90-odd branches
 * mechanically from `[typeLiteral, fields]` tuples, so widening that tuple to
 * carry a refinement would touch every component and push TypeScript's
 * inference depth in the one place the codebase already documents as fragile.
 *
 * So it lives exactly where the identically-shaped `select` rule lives —
 * `select-option-source-validation.ts`, whose `options` / `dataSource`
 * exclusion is the same defect in a different component — and the caller
 * BUNDLES it into the existing final `Schema.filter` rather than adding a new
 * one, for the deep-instantiation reason documented at that call site.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 * -----------------------------------
 * A `link` slug is NOT resolved against `app.links[]`, and the asymmetry with
 * `formRef` is the point. A form is config-only, so a dangling `formRef` is
 * always an authoring error. A link may legitimately be minted at runtime, and
 * a poster is designed before the campaign is set up more often than the
 * reverse — so rejecting the config would refuse a valid workflow rather than
 * catch a mistake.
 *
 * The walk is intentionally loose-typed (`unknown`) and recurses through every
 * value, so it finds a `qr-code` wherever it is nested — top-level
 * `components[]`, a container's `children[]`, or a card inside a grid.
 */

/** Minimal shape needed to validate qr-code payloads. */
interface AppForQrCodeValidation {
  readonly pages?: unknown
}

/** A `qr-code` component found in the page tree, reduced to what matters. */
interface FoundQrCode {
  readonly hasLink: boolean
  readonly hasValue: boolean
}

const isQrCodeNode = (record: Readonly<Record<string, unknown>>): boolean =>
  record['type'] === 'qr-code'

/** Recursively collect every `qr-code` component in the page tree. */
const collectQrCodes = (node: unknown): readonly FoundQrCode[] => {
  if (Array.isArray(node)) return node.flatMap(collectQrCodes)
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectQrCodes)
  if (!isQrCodeNode(record)) return nested

  return [
    { hasLink: record['link'] !== undefined, hasValue: record['value'] !== undefined },
    ...nested,
  ]
}

/** Validate ONE component; returns an error message, or `undefined` when it resolves. */
const validateQrCode = (qr: FoundQrCode): string | undefined => {
  if (qr.hasLink && qr.hasValue) {
    return "A qr-code component declares both 'link' and 'value' — the two are mutually exclusive, and there is no defensible precedence between them. Remove one."
  }
  if (!qr.hasLink && !qr.hasValue) {
    return "A qr-code component declares neither 'link' nor 'value' — it has nothing to encode. Add exactly one."
  }
  return undefined
}

/**
 * Validate every `qr-code` component's payload declaration.
 *
 * Returns `true` when all components declare exactly one payload, or an error
 * message string naming the first offending component.
 */
export const validateAllQrCodePayloads = (app: AppForQrCodeValidation): string | true => {
  if (!app.pages) return true

  const found = collectQrCodes(app.pages)
  if (found.length === 0) return true

  return found.map((qr) => validateQrCode(qr)).find((e) => e !== undefined) ?? true
}
