/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `output.attachTo` in a run nobody started: what the file was built from.
 *
 * A `document/*` or `pdf/*` step that attaches its output to a record, in a
 * run nobody started by hand, attaches it only when every file it read
 * qualifies on its own:
 *
 * - its bytes came in with the run (`run-written-files.ts`); or
 * - it is an attachment of the very record `attachTo` writes, read out of a
 *   field whose read audience is at least as wide as the target field's, so
 *   the attached file reaches no one who could not read its source already.
 *
 * Otherwise the step fails with the attachment-reference refusal, naming the
 * input and the condition it missed, before anything is written. A run
 * started by hand is judged as its starter instead (`guardStarterAttach`).
 */

import { Effect } from 'effect'
import { ATTACHMENT_REFERENCE_REFUSAL } from '@/application/use-cases/attachments/validate-attachment-references'
import { fieldReadNoWider } from '@/domain/models/app/tables/field-read-audience-service'
import { GeneratedFileWriteError } from './document-output-error'
import { inputCarriesRunBytes, stepFileInputs, type StepFileInput } from './step-file-inputs'
import type { Raw } from './document-run'
import type { RunWrittenFiles } from './run-written-files'
import type { AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/** The record and field `attachTo` writes. */
interface AttachPlace {
  readonly table: string
  readonly recordId: string
  readonly field: string
}

/** Why one input may not go into `place`, or `undefined` when it may. */
export const attachInputRefusal = (
  app: App,
  written: RunWrittenFiles | undefined,
  place: AttachPlace,
  input: StepFileInput
): string | undefined => {
  if (inputCarriesRunBytes(written, input)) return undefined
  const { record } = input
  const sameRecord =
    record !== undefined && record.table === place.table && record.recordId === place.recordId
  if (!sameRecord) {
    return `${input.label} is neither a file this run brought in nor an attachment of record ${place.recordId} of ${place.table}`
  }
  if (fieldReadNoWider(app, place.table, { target: place.field, source: record.field })) {
    return undefined
  }
  return `${input.label} is read by fewer people than ${place.table}.${place.field}`
}

/** The first input refused, as the step's refusal; `undefined` when every input qualifies. */
export const attachInputsRefusal = (
  app: App,
  written: RunWrittenFiles | undefined,
  place: AttachPlace,
  inputs: readonly StepFileInput[]
): string | undefined => {
  const reason = inputs
    .map((input) => attachInputRefusal(app, written, place, input))
    .find((refusal) => refusal !== undefined)
  return reason === undefined ? undefined : `${ATTACHMENT_REFERENCE_REFUSAL}: attachTo ${reason}`
}

/**
 * In a run nobody started, refuse an `attachTo` whose step read a file that
 * qualifies neither way (see the module header). A run started by hand passes
 * through: its starter is judged instead.
 */
export const guardUnattendedAttach = (input: {
  readonly attachTo: Raw
  readonly app: App
  readonly automation: AutomationContext
}): Effect.Effect<void, GeneratedFileWriteError> =>
  Effect.gen(function* () {
    if (input.automation.startedByHand === true) return
    const place = {
      table: String(input.attachTo['table'] ?? ''),
      recordId: String(input.attachTo['record'] ?? ''),
      field: String(input.attachTo['field'] ?? ''),
    }
    const { inputs } = yield* stepFileInputs
    const refusal = attachInputsRefusal(input.app, input.automation.writtenFiles, place, inputs)
    if (refusal !== undefined) {
      return yield* new GeneratedFileWriteError({ message: refusal })
    }
  }).pipe(Effect.withSpan('automations.guard-unattended-attach'))
