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
  handleRecordDelete,
  handleRecordRead,
  handleRecordUpdate,
  handleRecordUpsert,
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
  ['ai/generate', handleAiGenerate],
  ['ai/classify', handleAiClassify],
  ['ai/extract', handleAiExtract],
  ['ai/agent', handleAiAgent],
  ['analytics/track', handleAnalyticsTrack],
  ['approval/request', handleApprovalRequest],
  ['auth/assignRole', handleAuthAssignRole],
  ['auth/banUser', handleAuthBanUser],
  ['auth/createUser', handleAuthCreateUser],
  ['auth/unbanUser', handleAuthUnbanUser],
  ['filter/continue', handleFilterContinue],
  ['record/create', handleRecordCreate],
  ['record/read', handleRecordRead],
  ['record/update', handleRecordUpdate],
  ['record/delete', handleRecordDelete],
  ['record/upsert', handleRecordUpsert],
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

export const noopActionHandler: ActionHandler = (_action, _app, _automation) =>
  Effect.succeed({ status: 'success' } as const)

export { actionKey } from './shared'
export type {
  ActionHandler,
  ActionKey,
  ActionOutcome,
  ActionRunContext,
  AutomationContext,
} from './shared'
