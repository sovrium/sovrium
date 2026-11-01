/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Consent cross-validation: every reference to a purpose resolves.
 *
 * Three rules, each one a config that would otherwise run with something gated
 * on a purpose nobody can ever accept, or with something ungated that the author
 * believed was held back:
 *
 * 1. A page script's `consent` (external or inline) names a purpose declared in
 *    `consent.purposes`. Without a `consent` block there is no purpose to name.
 * 2. A `consent-choice` control's `purpose` names a declared purpose, or is
 *    `analytics`: with no `analytics` purpose declared, that control is the
 *    opt-out for the built-in analytics, which runs unless it is turned off.
 * 3. An app declaring `consent` and page `meta.analytics` providers declares a
 *    purpose with id `analytics`, the purpose that gates those providers.
 *
 * Loose-typed and walked recursively, like the other declaration checks bundled
 * into the closing `AppSchema` filter, so a `consent-choice` is found wherever
 * it is nested — a page tree or an `app.components` template.
 */

import { ANALYTICS_PURPOSE_ID } from './consent-version-service'

/** Minimal shape needed to validate purpose references. */
interface AppForConsentValidation {
  readonly consent?: { readonly purposes: readonly { readonly id: string }[] } | undefined
  readonly pages?: unknown
  readonly components?: unknown
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

/**
 * Every `consent` a page's scripts name, with where it was found. `external` is
 * the alias of `externalScripts`: both keys name the list the renderer holds back.
 */
const collectScriptPurposes = (
  pages: unknown
): readonly { readonly purpose: string; readonly where: string }[] =>
  asArray(pages).flatMap((page, pageIndex) => {
    const scripts = asRecord(asRecord(page)?.['scripts'])
    return (['externalScripts', 'external', 'inlineScripts'] as const).flatMap((kind) =>
      asArray(scripts?.[kind]).flatMap((script, scriptIndex) => {
        const purpose = asRecord(script)?.['consent']
        return typeof purpose === 'string'
          ? [{ purpose, where: `pages[${pageIndex}].scripts.${kind}[${scriptIndex}].consent` }]
          : []
      })
    )
  })

/** Every `consent-choice` purpose in a component tree. */
const collectChoicePurposes = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectChoicePurposes)
  const record = asRecord(node)
  if (record === undefined) return []
  const nested = Object.values(record).flatMap(collectChoicePurposes)
  const { purpose } = record
  return record['type'] === 'consent-choice' && typeof purpose === 'string'
    ? [purpose, ...nested]
    : nested
}

/** Whether any page declares a `meta.analytics` provider. */
const declaresAnalyticsProviders = (pages: unknown): boolean =>
  asArray(pages).some(
    (page) =>
      asArray(asRecord(asRecord(asRecord(page)?.['meta'])?.['analytics'])?.['providers']).length > 0
  )

const scriptReferenceError = (
  app: AppForConsentValidation,
  declared: ReadonlySet<string>
): string | undefined => {
  const unresolved = collectScriptPurposes(app.pages).find(({ purpose }) => !declared.has(purpose))
  if (unresolved === undefined) return undefined
  return app.consent === undefined
    ? `${unresolved.where} names the purpose "${unresolved.purpose}", but the app declares no consent block. Declare consent.purposes with an id "${unresolved.purpose}", or remove the key.`
    : `${unresolved.where} names the purpose "${unresolved.purpose}", which consent.purposes does not declare. Declared: ${[...declared].join(', ')}.`
}

const choiceReferenceError = (
  app: AppForConsentValidation,
  declared: ReadonlySet<string>
): string | undefined => {
  const unresolved = collectChoicePurposes([app.pages, app.components]).find(
    (purpose) => !declared.has(purpose) && purpose !== ANALYTICS_PURPOSE_ID
  )
  if (unresolved === undefined) return undefined
  return app.consent === undefined
    ? `A consent-choice control names the purpose "${unresolved}", but the app declares no consent block. Without one, only "analytics" is valid.`
    : `A consent-choice control names the purpose "${unresolved}", which consent.purposes does not declare. Declared: ${[...declared].join(', ')}.`
}

/**
 * Every purpose reference resolves; the first refusal, in the order of the
 * module header.
 */
export function validateConsentReferences(app: AppForConsentValidation): true | string {
  const declared = new Set((app.consent?.purposes ?? []).map((purpose) => purpose.id))
  const scriptError = scriptReferenceError(app, declared)
  if (scriptError !== undefined) return scriptError
  const choiceError = choiceReferenceError(app, declared)
  if (choiceError !== undefined) return choiceError
  if (
    app.consent !== undefined &&
    !declared.has(ANALYTICS_PURPOSE_ID) &&
    declaresAnalyticsProviders(app.pages)
  ) {
    return 'The app declares consent and page meta.analytics providers, but no purpose with id "analytics", which is the purpose that holds those providers back. Declare a purpose with id "analytics", or remove the providers.'
  }
  return true
}
