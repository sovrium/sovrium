/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { handleAiClassify, handleAiExtract, handleAiGenerate } from './ai'
import { handleAiAgent } from './ai-agent'
import { handleAnalyticsTrack } from './analytics'
import { handleApprovalRequest } from './approval'
import {
  handleAuthAssignRole,
  handleAuthBanUser,
  handleAuthCreateUser,
  handleAuthUnbanUser,
} from './auth'
import { handleAutomationCall, handleAutomationReturn } from './automation'
import { handleCodeRun } from './code'
import { handleCryptoHash, handleCryptoHmac } from './crypto'
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
import {
  handleDateAdd,
  handleDateDiff,
  handleDateEndOf,
  handleDateFormat,
  handleDateNow,
  handleDateParse,
  handleDateStartOf,
  handleDateSubtract,
} from './date'
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
  handleFileCompress,
  handleFileExtractText,
  handleFileGeneratePdf,
  handleFileTransformImage,
} from './file-advanced'
import {
  handleFileCopy,
  handleFileDelete,
  handleFileGetMetadata,
  handleFileList,
  handleFileMove,
  handleFileSignUrl,
} from './file-ops'
import { handleFileGenerateXlsx, handleFileParseXlsx } from './file-xlsx'
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
import { handleLinkCreate, handleLinkDelete, handleLinkUpdate } from './link'
import { handleLoopEach } from './loop'
import { handlePathBranch } from './path'
import {
  handleRecordCreate,
  handleRecordDelete,
  handleRecordList,
  handleRecordRead,
  handleRecordUpdate,
  handleRecordUpsert,
} from './record'
import {
  handleRecordBatchCreate,
  handleRecordBatchDelete,
  handleRecordBatchUpdate,
  handleRecordBatchUpsert,
} from './record-batch'
import { actionKey } from './shared'
import { handleSovriumValidateConfig } from './sovrium'
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
  ['crypto/hash', handleCryptoHash],
  ['crypto/hmac', handleCryptoHmac],
  ['data/set', handleDataSet],
  ['data/aggregate', handleDataAggregate],
  ['data/sort', handleDataSort],
  ['data/limit', handleDataLimit],
  ['data/deduplicate', handleDataDeduplicate],
  ['data/merge', handleDataMerge],
  ['data/split', handleDataSplit],
  ['data/compare', handleDataCompare],
  ['data/lookup', handleDataLookup],
  ['date/format', handleDateFormat],
  ['date/parse', handleDateParse],
  ['date/add', handleDateAdd],
  ['date/subtract', handleDateSubtract],
  ['date/diff', handleDateDiff],
  ['date/startOf', handleDateStartOf],
  ['date/endOf', handleDateEndOf],
  ['date/now', handleDateNow],
  ['ai/generate', handleAiGenerate],
  ['ai/classify', handleAiClassify],
  ['ai/extract', handleAiExtract],
  ['ai/agent', handleAiAgent],
  ['analytics/track', handleAnalyticsTrack],
  ['approval/request', handleApprovalRequest],
  ['link/create', handleLinkCreate],
  ['link/update', handleLinkUpdate],
  ['link/delete', handleLinkDelete],
  ['auth/assignRole', handleAuthAssignRole],
  ['auth/banUser', handleAuthBanUser],
  ['auth/createUser', handleAuthCreateUser],
  ['auth/unbanUser', handleAuthUnbanUser],
  ['filter/continue', handleFilterContinue],
  ['record/create', handleRecordCreate],
  ['record/read', handleRecordRead],
  ['record/list', handleRecordList],
  ['record/update', handleRecordUpdate],
  ['record/delete', handleRecordDelete],
  ['record/upsert', handleRecordUpsert],
  ['record/batchCreate', handleRecordBatchCreate],
  ['record/batchUpdate', handleRecordBatchUpdate],
  ['record/batchDelete', handleRecordBatchDelete],
  ['record/batchUpsert', handleRecordBatchUpsert],
  ['file/upload', handleFileUpload],
  ['file/download', handleFileDownload],
  ['file/parseCsv', handleFileParseCsv],
  ['file/generateCsv', handleFileGenerateCsv],
  ['file/parseXlsx', handleFileParseXlsx],
  ['file/generateXlsx', handleFileGenerateXlsx],
  ['file/list', handleFileList],
  ['file/getMetadata', handleFileGetMetadata],
  ['file/move', handleFileMove],
  ['file/copy', handleFileCopy],
  ['file/delete', handleFileDelete],
  ['file/signUrl', handleFileSignUrl],
  ['file/compress', handleFileCompress],
  ['file/extractText', handleFileExtractText],
  ['file/transformImage', handleFileTransformImage],
  ['file/generatePdf', handleFileGeneratePdf],
  ['http/request', handleHttpRequest],
  ['http/get', handleHttpGet],
  ['http/post', handleHttpPost],
  ['http/put', handleHttpPut],
  ['http/patch', handleHttpPatch],
  ['http/delete', handleHttpDelete],
  ['flow/stop', handleFlowStop],
  ['sovrium/validateConfig', handleSovriumValidateConfig],
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
  ['path/branch', handlePathBranch],
  ['automation/call', handleAutomationCall],
  ['automation/return', handleAutomationReturn],
])

/**
 * Explain why an action's key found no handler.
 *
 * `ref` is the one declarable type with no handler BY DESIGN: every `$ref` is
 * rewritten to its target template by `expandRefActions` before the run loop
 * dispatches anything, so the registry never sees the key. An action arriving
 * here as `ref` therefore means the referenced template is not declared in
 * `app.actions[]` — say THAT, rather than "no handler for ref", which sends the
 * reader hunting for a handler that must not exist. Mirrors the
 * `NEVER_DISPATCHED` allowlist in `registry-schema-coverage.test.ts`.
 */
const missingHandlerMessage = (action: Readonly<Record<string, unknown>>): string => {
  const type = String(action['type'] ?? '')
  if (type === 'ref') {
    return `action template '${String(action['$ref'] ?? '')}' is not defined in app.actions[]`
  }
  return `no handler registered for action '${actionKey(type, action['operator'] as string | undefined)}'`
}

/**
 * Fallback handler used when no entry is registered for the action's key.
 *
 * This used to be a no-op that reported SUCCESS, on the reasoning that the
 * dispatch shape should stay additive across waves — a new action type landing
 * without a handler would not regress unrelated tests. What it actually bought
 * was silence: `path/branch`, `record/batchUpdate`, `record/batchDelete` and
 * `record/batchUpsert` all shipped declarable, documented and schema-valid with
 * no handler, and every run of them reported success while doing nothing. The
 * only signal was the absence of rows in the database.
 *
 * So an unregistered key is now a step FAILURE. The blast radius is provably
 * zero for schema-valid configs: `registry-schema-coverage.test.ts` asserts
 * that every declarable action has a handler, so nothing a config author can
 * write reaches this path. It remains reachable from the code-action sandbox's
 * native invoker, which bypasses schema validation — and that path already
 * rejected unregistered keys loudly (`run/action-invokers.ts`), so this simply
 * ends an asymmetry rather than introducing a new failure mode.
 */
export const missingActionHandler: ActionHandler = (action, _app, _automation) =>
  Effect.succeed({ status: 'failure', error: missingHandlerMessage(action) } as const)

// Re-export the public surface so external callers (currently
// `run-automation.ts`) can keep importing from the same module path
// regardless of internal file structure.
export { actionKey }
export type {
  ActionHandler,
  ActionKey,
  ActionOutcome,
  ActionRunContext,
  AutomationContext,
} from './shared'
