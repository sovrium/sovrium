/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { handleAiClassify, handleAiExtract, handleAiGenerate } from './ai'
import { handleAutomationCall, handleAutomationReturn } from './automation'
import { handleCodeRun } from './code'
import {
  handleDataAggregate,
  handleDataCompare,
  handleDataDeduplicate,
  handleDataLimit,
  handleDataLookup,
  handleDataMerge,
  handleDataSet,
  handleDataSort,
  handleDataSplit,
} from './data'
import { handleDelayQueue, handleDelayWait, handleDelayWebhook } from './delay'
import { handleDigestCollect, handleDigestRelease } from './digest'
import { handleEmailSend } from './email'
import {
  handleFileDownload,
  handleFileGenerateCsv,
  handleFileParseCsv,
  handleFileUpload,
} from './file'
import {
  handleFileCopy,
  handleFileDelete,
  handleFileGetMetadata,
  handleFileList,
  handleFileMove,
  handleFileSignUrl,
} from './file-ops'
import { handleFilterContinue } from './filter'
import { handleFlowStop } from './flow'
import {
  handleHttpDelete,
  handleHttpGet,
  handleHttpPatch,
  handleHttpPost,
  handleHttpPut,
  handleHttpRequest,
} from './http'
import { handleLoopEach } from './loop'
import {
  handleRecordBatchCreate,
  handleRecordCreate,
  handleRecordRead,
  handleRecordUpdate,
} from './record'
import {
  handleStateDelete,
  handleStateGet,
  handleStateIncrement,
  handleStateList,
  handleStateSet,
} from './state'
import { handleWebhookResponse, handleWebhookSend } from './webhook'
import type { ActionHandler, ActionKey } from './shared'

/**
 * Default registry of action handlers.
 *
 * Adding a new action type means registering its handler here, NOT
 * branching on `type/operator` inside the run loop. Each handler module
 * (`record.ts`, `http.ts`, `state.ts`, `digest.ts`) owns the operators
 * within its concern; the registry's job is dispatch by key, not
 * reasoning about action semantics.
 *
 * This file replaced the monolithic `../action-handlers.ts` (audit M3).
 * The original split tipped at 588 LOC across 5 concerns; the directory
 * structure exposes those concerns as separate, individually-testable
 * modules.
 */
export const defaultActionHandlers: ReadonlyMap<ActionKey, ActionHandler> = new Map<
  ActionKey,
  ActionHandler
>([
  ['code/runTypescript', handleCodeRun],
  ['data/set', handleDataSet],
  ['data/aggregate', handleDataAggregate],
  ['data/sort', handleDataSort],
  ['data/limit', handleDataLimit],
  ['data/deduplicate', handleDataDeduplicate],
  ['data/merge', handleDataMerge],
  ['data/split', handleDataSplit],
  ['data/compare', handleDataCompare],
  ['data/lookup', handleDataLookup],
  ['ai/generate', handleAiGenerate],
  ['ai/classify', handleAiClassify],
  ['ai/extract', handleAiExtract],
  ['filter/continue', handleFilterContinue],
  ['record/create', handleRecordCreate],
  ['record/read', handleRecordRead],
  ['record/update', handleRecordUpdate],
  ['record/batchCreate', handleRecordBatchCreate],
  ['file/upload', handleFileUpload],
  ['file/download', handleFileDownload],
  ['file/parseCsv', handleFileParseCsv],
  ['file/generateCsv', handleFileGenerateCsv],
  ['file/list', handleFileList],
  ['file/getMetadata', handleFileGetMetadata],
  ['file/move', handleFileMove],
  ['file/copy', handleFileCopy],
  ['file/delete', handleFileDelete],
  ['file/signUrl', handleFileSignUrl],
  ['http/request', handleHttpRequest],
  ['http/get', handleHttpGet],
  ['http/post', handleHttpPost],
  ['http/put', handleHttpPut],
  ['http/patch', handleHttpPatch],
  ['http/delete', handleHttpDelete],
  ['flow/stop', handleFlowStop],
  ['email/send', handleEmailSend],
  ['webhook/send', handleWebhookSend],
  ['webhook/response', handleWebhookResponse],
  ['state/set', handleStateSet],
  ['state/get', handleStateGet],
  ['state/list', handleStateList],
  ['state/delete', handleStateDelete],
  ['state/increment', handleStateIncrement],
  ['digest/collect', handleDigestCollect],
  ['digest/release', handleDigestRelease],
  ['delay/wait', handleDelayWait],
  ['delay/webhook', handleDelayWebhook],
  ['delay/queue', handleDelayQueue],
  ['loop/each', handleLoopEach],
  ['automation/call', handleAutomationCall],
  ['automation/return', handleAutomationReturn],
])

/**
 * No-op success handler used when no entry is registered for the action's
 * key. Records the run as successful so the dispatch shape stays additive
 * across waves (a new action type that lands without a handler doesn't
 * regress unrelated tests; it surfaces as a missing-handler entry in logs
 * that the next migration spec can fill in).
 */
export const noopActionHandler: ActionHandler = (_action, _app, _automation) =>
  Effect.succeed({ status: 'success' } as const)

// Re-export the public surface so external callers (currently
// `run-automation.ts`) can keep importing from the same module path
// regardless of internal file structure.
export { actionKey } from './shared'
export type {
  ActionHandler,
  ActionKey,
  ActionOutcome,
  ActionRunContext,
  AutomationContext,
} from './shared'
