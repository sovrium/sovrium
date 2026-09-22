/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declaration tree and the serialized configuration — the two reads the
 * Schema console page composes itself from.
 *
 * [internal ref] amendment A1 governs both exactly as it governs
 * `/api/admin/config/schema`: reading the running configuration is
 * observability, mutating it is authoring. Redaction is a CONDITION of that
 * authorisation and happens SERVER-SIDE, before serialisation — masking in the
 * UI would not do, because the payload is the boundary an operator's browser,
 * any intermediary proxy and the error tracker all see.
 *
 * ─── WHY `appJson` IS ADMITTED, AND `label` IS NOT A SENTENCE ─────
 *
 * A pretty-printed serialization of an object the platform already publishes
 * carries no word, no label and no ordering meant to be read — and a caller
 * could recompute it byte-for-byte, while the console cannot, having no
 * `JSON.stringify`. It lives on THIS record endpoint rather than on
 * `/api/admin/config/schema`, so no existing caller's payload doubles for a
 * field it never asked for.
 *
 * `label` and `detail` are the OPERATOR's own identifiers, verbatim. The family
 * HEADINGS a reader sees ("Tables", "Pages") exist nowhere but on the console
 * page and stay in its config, gated on the flat counts published here.
 *
 * The walk itself is lifted UNCHANGED from the retired Schema-explorer builder,
 * so the tree an operator reads after the migration is the tree they read
 * before it.
 */

import { redactAppConfigForReflection } from '@/application/use-cases/admin/config/redact-app-config'
import type {
  ConfigDeclaration,
  ConfigDeclarationFamily,
  ConfigDeclarationsResponse,
  ConfigReflectionResponse,
} from '@/domain/models/api/admin/config'
import type { App } from '@/domain/models/app'

type ConfigNode = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is ConfigNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The config families the tree walks, in the order `AppSchema` declares them.
 *
 * A closed set rather than an open string, so a typo in a `family` query param
 * is a decode error naming the seven legal values instead of an empty tree an
 * operator reads as "this instance declares nothing".
 */
export const CONFIG_DECLARATION_FAMILIES: readonly ConfigDeclarationFamily[] = [
  'tables',
  'pages',
  'forms',
  'automations',
  'agents',
  'buckets',
  'connections',
]

/** Read an array-valued top-level family, tolerating an absent or malformed one. */
const familyItems = (app: ConfigNode, key: string): readonly ConfigNode[] => {
  const value = app[key]
  return Array.isArray(value) ? value.filter((item): item is ConfigNode => isRecord(item)) : []
}

/**
 * The label one declaration answers to. `path` before `name`, because a page is
 * identified by the route an operator types and not by its slug.
 */
const declarationLabel = (item: ConfigNode): string => {
  const { path } = item
  if (typeof path === 'string' && path.length > 0) return path
  const { name } = item
  return typeof name === 'string' && name.length > 0 ? name : '(unnamed)'
}

/**
 * The second-level detail: what a declaration is made OF. Going one level
 * deeper than the family is what makes the tree a reflection rather than a
 * heading list — "does this instance have the `company` column yet?" is a
 * field-level question, and it is answerable here.
 */
const declarationDetail = (item: ConfigNode): string | undefined => {
  const fields = familyItems(item, 'fields')
  if (fields.length > 0) return fields.map((field) => declarationLabel(field)).join(' · ')
  const { trigger } = item
  if (isRecord(trigger) && typeof trigger['type'] === 'string') return `trigger: ${trigger['type']}`
  const { type } = item
  return typeof type === 'string' ? type : undefined
}

/**
 * Every declaration of one family, in the config's own order.
 *
 * Walked over the REDACTED config, not the raw one. A field name is an
 * identifier rather than a credential, but the tree and the serialization must
 * describe the same object: an operator comparing a row against the JSON block
 * beside it is reading one page, and two projections that disagree about what
 * is there is the failure mode a second walk always produces.
 */
function declarationsOf(
  redacted: ConfigNode,
  family: ConfigDeclarationFamily
): readonly ConfigDeclaration[] {
  return familyItems(redacted, family).map((item) => {
    const detail = declarationDetail(item)
    return {
      family,
      label: declarationLabel(item),
      ...(detail === undefined ? {} : { detail }),
    }
  })
}

/**
 * `GET /api/admin/config/declarations` — the tree's rows, narrowed to one family
 * when the `family` param is present and the whole tree otherwise.
 */
export function buildConfigDeclarations(
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>,
  family: ConfigDeclarationFamily | undefined
): ConfigDeclarationsResponse {
  const redacted = redactAppConfigForReflection(app, processEnv)
  const families = family === undefined ? CONFIG_DECLARATION_FAMILIES : [family]
  const declarations = families.flatMap((name) => declarationsOf(redacted, name))
  return { declarations, total: declarations.length }
}

/**
 * `GET /api/admin/config/reflection` — the Schema page's own record.
 *
 * Every family reports a count, INCLUDING the ones the config leaves empty. A
 * missing field coerces to the string `"undefined"` in a `visibility.record`
 * gate, which matches nothing — so the heading would never render and nothing
 * would say why.
 */
export function buildConfigReflection(
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): ConfigReflectionResponse {
  const redacted = redactAppConfigForReflection(app, processEnv)
  const countOf = (family: ConfigDeclarationFamily): number => familyItems(redacted, family).length

  return {
    // eslint-disable-next-line unicorn/no-null -- JSON.stringify's replacer arg requires `null` (not `undefined`) to take the indent
    appJson: JSON.stringify(redacted, null, 2),
    declarationCount: CONFIG_DECLARATION_FAMILIES.reduce(
      (total, family) => total + countOf(family),
      0
    ),
    tableCount: countOf('tables'),
    pageCount: countOf('pages'),
    formCount: countOf('forms'),
    automationCount: countOf('automations'),
    agentCount: countOf('agents'),
    bucketCount: countOf('buckets'),
    connectionCount: countOf('connections'),
    generatedAt: new Date().toISOString(),
  }
}
