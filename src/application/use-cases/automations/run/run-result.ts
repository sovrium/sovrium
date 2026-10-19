/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { runResultClientError } from './client-error'
import type { RunAccumulator, RunAutomationResult, StepContext } from './types'

/** Project a {@link RunAccumulator} into the public {@link RunAutomationResult}. */
export const buildRunResult = (
  runId: string,
  finalState: RunAccumulator,
  ctx: StepContext
): RunAutomationResult => ({
  runId,
  // The loop never leaves a scheduler-managed `'queued'`/`'running'` state: narrow it.
  status: finalState.runStatus as Exclude<RunAccumulator['runStatus'], 'queued' | 'running'>,
  actions: finalState.actions,
  ...(finalState.lastOutput !== undefined ? { lastOutput: finalState.lastOutput } : {}),
  ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  ...runResultClientError(finalState),
  ...(finalState.responseOverride !== undefined
    ? { responseOverride: finalState.responseOverride }
    : {}),
  ...(finalState.returnData !== undefined ? { returnData: finalState.returnData } : {}),
  ...(finalState.stopped === true ? { stopped: true } : {}),
  calledWriteOnly: ctx.automation.writeOnly?.called.values() ?? [],
})
