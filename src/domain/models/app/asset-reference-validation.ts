/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * EVERY `{ asset: <path> }` AN ACTION NAMES MUST BE DECLARED IN `assets`.
 *
 * At the app root because it relates two properties (`automations` and the
 * reusable `actions` on one side, `assets` on the other). Declaring a file is
 * what makes it an asset: a file that merely exists beside the config is not
 * readable by an action, so an undeclared path is refused when the config is
 * checked, naming the automation (or action template) and the path.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { validateTemplateReferences } from './template-reference-validation'

/** Every `{ asset }` path anywhere under `value` (props, nested `actions`, branches). */
const assetPathsIn = (value: unknown): ReadonlyArray<string> => {
  if (Array.isArray(value)) return value.flatMap(assetPathsIn)
  if (!isRecord(value)) return []
  const own = typeof value['asset'] === 'string' ? [value['asset']] : []
  return [...own, ...Object.values(value).flatMap(assetPathsIn)]
}

const declaredPaths = (config: Raw): ReadonlySet<string> =>
  new Set(
    (Array.isArray(config['assets']) ? config['assets'] : [])
      .filter(isRecord)
      .map((entry) => entry['path'])
      .filter((path): path is string => typeof path === 'string')
  )

const undeclared = (
  owner: string,
  value: unknown,
  declared: ReadonlySet<string>
): ReadonlyArray<string> =>
  [...new Set(assetPathsIn(value))]
    .filter((path) => !declared.has(path))
    .map(
      (path) =>
        `${owner} reads asset "${path}", which \`assets\` does not declare; add { path: ${path} } to \`assets\``
    )

/**
 * One message per `{ asset }` path no `assets` entry declares — then the
 * references the assets themselves carry: a `sampleData` path, and the
 * partials, translation keys and literal locale of a step's own template
 * (`template-reference-validation.ts`).
 */
export const validateAssetReferences = (normalized: unknown): readonly string[] => [
  ...validateDeclaredAssetPaths(normalized),
  ...validateSampleDataReferences(normalized),
  ...validateTemplateReferences(normalized),
]

const validateDeclaredAssetPaths = (normalized: unknown): readonly string[] => {
  if (!isRecord(normalized)) return []
  const declared = declaredPaths(normalized)
  const automations = (
    Array.isArray(normalized['automations']) ? normalized['automations'] : []
  ).filter(isRecord)
  const templates = (Array.isArray(normalized['actions']) ? normalized['actions'] : []).filter(
    isRecord
  )
  return [
    ...automations.flatMap((automation) =>
      undeclared(`automation "${String(automation['name'])}"`, automation['actions'], declared)
    ),
    ...templates.flatMap((template) =>
      undeclared(`action template "${String(template['name'])}"`, template['action'], declared)
    ),
  ]
}

const DATA_EXTENSION = /\.(?:json|ya?ml)$/i

/**
 * A template's `sampleData` written as a path names a declared `data` asset
 * (a `.json` or `.yaml` file): the sample a preview renders with is a file
 * of the project, like the template itself.
 */
export const validateSampleDataReferences = (normalized: unknown): readonly string[] => {
  if (!isRecord(normalized)) return []
  const entries = (Array.isArray(normalized['assets']) ? normalized['assets'] : []).filter(isRecord)
  const dataAssets = new Set(
    entries
      .filter(
        (entry) =>
          entry['kind'] === 'data' ||
          (entry['kind'] === undefined && DATA_EXTENSION.test(String(entry['path'])))
      )
      .map((entry) => String(entry['path']))
  )
  return entries.flatMap((entry) => {
    const sample = entry['sampleData']
    return typeof sample === 'string' && !dataAssets.has(sample)
      ? [
          `asset "${String(entry['path'])}": sampleData "${sample}" is not a declared data asset; declare it in \`assets\` (a .json or .yaml file)`,
        ]
      : []
  })
}
