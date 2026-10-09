/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { declaredBucketNames } from './buckets/bucket-identity'
import type { App } from './app'

/**
 * A `file/upload` STEP NAMES A BUCKET THE APP DECLARES.
 *
 * The bucket a `file/upload` step stores into is a literal the operator wrote,
 * never a value a run supplies, so it can be checked before the app starts. A
 * name the app does not declare (`buckets`, or the built-in `system`) is
 * refused, naming it: otherwise every delivered file would be stored where no
 * attachment column and no route could reach it. At the app root because it
 * relates `automations` and `actions` to `buckets`. Both places a step is
 * written are walked: every automation, and every reusable action template.
 */

interface UploadStep {
  readonly step: string
  readonly bucket: string
}

/** Whether a node is a `file/upload` step. */
const isUploadStep = (value: Readonly<Record<string, unknown>>): boolean =>
  value['type'] === 'file' && value['operator'] === 'upload'

/** Every `file/upload` step anywhere under `value` that names a bucket. */
const uploadsIn = (value: unknown, step: string): ReadonlyArray<UploadStep> => {
  if (Array.isArray(value)) return value.flatMap((item) => uploadsIn(item, step))
  if (!isRecord(value)) return []
  const here = typeof value['name'] === 'string' && 'type' in value ? value['name'] : step
  const bucket = isRecord(value['props']) ? value['props']['bucket'] : undefined
  const own = isUploadStep(value) && typeof bucket === 'string' ? [{ step: here, bucket }] : []
  return [...own, ...Object.values(value).flatMap((child) => uploadsIn(child, here))]
}

/** One message per `file/upload` step whose `bucket` the app does not declare. */
export const validateFileUploadBuckets = (app: App): readonly string[] => {
  const known = new Set(declaredBucketNames(app.buckets))
  const unknown = (where: string, found: UploadStep): readonly string[] =>
    known.has(found.bucket)
      ? []
      : [
          `${where}: file/upload bucket "${found.bucket}" is not declared; name one of ${[...known].map((name) => `"${name}"`).join(', ')}`,
        ]
  return [
    ...(app.automations ?? []).flatMap((automation) =>
      uploadsIn(automation.actions, '').flatMap((found) =>
        unknown(`automation "${automation.name}", step "${found.step}"`, found)
      )
    ),
    ...(app.actions ?? []).flatMap((template) =>
      uploadsIn(template.action, template.name).flatMap((found) =>
        unknown(`action template "${template.name}", step "${found.step}"`, found)
      )
    ),
  ]
}
