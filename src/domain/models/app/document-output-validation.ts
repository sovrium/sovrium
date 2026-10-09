/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { SYSTEM_BUCKET_NAME } from './buckets/bucket-identity'
import { resolveFieldBucket } from './buckets/field-bucket'
import { validateFileUploadBuckets } from './file-upload-bucket-validation'
import type { App } from './app'

/**
 * A GENERATED FILE IS ATTACHED TO A RECORD OR TEMPORARY, AND AN ATTACHED ONE
 * GOES TO THE FIELD'S BUCKET.
 *
 * `output.attachTo` writes into the bucket the attachment field is bound to
 * (`system` when the column names none), so the file is governed, served and
 * erased like the field's other files. An `output.bucket` naming another
 * bucket contradicts that and is refused, naming both. An `output.bucket`
 * with no `attachTo` is refused too: a file in a bucket that belongs to no
 * record could be neither exported nor erased for anyone. At the app root
 * because it relates `automations` and `actions` to `tables`.
 *
 * The field's bucket is read by {@link resolveFieldBucket}, the resolver the
 * write itself uses, so the check and the write cannot disagree about it.
 * Both places a step is written are walked: every automation, and every
 * reusable action template (`actions[]`), whose step is named by the template.
 */

/** The action types whose `output` is a generated file. */
const FILE_OUTPUT_TYPES: ReadonlySet<unknown> = new Set(['document', 'pdf'])

interface StepOutput {
  readonly step: string
  readonly type: unknown
  readonly output: Raw
}

/** Every `output` object anywhere under `value`, with the step that holds it and its type. */
const outputsIn = (value: unknown, step: string): ReadonlyArray<StepOutput> => {
  if (Array.isArray(value)) return value.flatMap((item) => outputsIn(item, step))
  if (!isRecord(value)) return []
  const here = typeof value['name'] === 'string' && 'type' in value ? value['name'] : step
  const own =
    isRecord(value['props']) && isRecord(value['props']['output'])
      ? [{ step: here, type: value['type'], output: value['props']['output'] }]
      : []
  return [...own, ...Object.values(value).flatMap((child) => outputsIn(child, here))]
}

/**
 * A table or field name that is only known when the step runs — a template
 * variable (`$table`) or an expression (`{{…}}`) — names no column the config
 * can check, so it is left to the run.
 */
const isLiteralName = (name: string): boolean =>
  name !== '' && !name.startsWith('$') && !name.includes('{{')

/** The message for a file `output` naming a bucket and no record, if it does. */
const bucketWithoutRecord = (where: string, { type, output }: StepOutput): readonly string[] =>
  typeof output['bucket'] === 'string' &&
  !isRecord(output['attachTo']) &&
  FILE_OUTPUT_TYPES.has(type)
    ? [
        `${where}: output bucket "${output['bucket']}" names no record; a generated file is attached to a record or temporary, so add \`attachTo\` (the file then goes to the field's bucket) or drop \`bucket\` to keep it temporary`,
      ]
    : []

/** The message for one `output` whose `bucket` contradicts its `attachTo` field's, if it does. */
const contradiction = (app: App, where: string, output: Raw): readonly string[] => {
  const { attachTo } = output
  if (!isRecord(attachTo) || typeof output['bucket'] !== 'string') return []
  const table = String(attachTo['table'] ?? '')
  const field = String(attachTo['field'] ?? '')
  if (!isLiteralName(table) || !isLiteralName(field)) return []
  const expected = resolveFieldBucket(app, table, field) ?? SYSTEM_BUCKET_NAME
  return output['bucket'] === expected
    ? []
    : [
        `${where}: output bucket "${output['bucket']}" differs from "${expected}", the bucket of the attachment field ${table}.${field}; drop \`bucket\` (attachTo writes into the field's bucket)`,
      ]
}

/** Every message one `output` earns: a bucket with no record, or one that contradicts its field's. */
const issuesOf = (app: App, where: string, found: StepOutput): readonly string[] => [
  ...bucketWithoutRecord(where, found),
  ...contradiction(app, where, found.output),
]

/**
 * One message per `output` that names a bucket and no record, or whose
 * `bucket` contradicts its `attachTo` field's — and one per `file/upload` step
 * naming a bucket the app does not declare (`file-upload-bucket-validation.ts`).
 */
export const validateDocumentOutputBuckets = (app: App): readonly string[] => [
  ...validateFileUploadBuckets(app),
  ...(app.automations ?? []).flatMap((automation) =>
    outputsIn(automation.actions, '').flatMap((found) =>
      issuesOf(app, `automation "${automation.name}", step "${found.step}"`, found)
    )
  ),
  ...(app.actions ?? []).flatMap((template) =>
    outputsIn(template.action, template.name).flatMap((found) =>
      issuesOf(app, `action template "${template.name}", step "${found.step}"`, found)
    )
  ),
]
