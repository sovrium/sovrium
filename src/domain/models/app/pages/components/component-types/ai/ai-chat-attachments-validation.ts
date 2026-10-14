/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isAcceptedMediaType } from '@/domain/kernel/identity/attachment-content-type'
import {
  placedTemplatesOf,
  renderedNodesWhere,
  type ComponentTreeSource,
  type TreeNode,
} from '../../../component-tree-has-type'

/**
 * The upload rules of one `ai-chat`, and the judgement of one upload against them.
 *
 * A chat names its attachment rules in its `attachments` block: the bucket the
 * files land in, the media types it takes, and the largest file. The upload
 * route addresses the chat by its `id`, so the rules are looked up from the
 * page tree as RENDERED — on a page, inside a placed template, or only in a
 * breakpoint's children — through the one walker every component search uses.
 */

/** Media types a chat takes when its `attachments` block names none: the ones the parser reads. */
export const DEFAULT_CHAT_ATTACHMENT_ACCEPT: readonly string[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/markdown',
  'text/plain',
]

/** Largest upload, in megabytes, when the block names no `maxSizeMb`. */
export const DEFAULT_CHAT_ATTACHMENT_MAX_SIZE_MB = 10

/** The upload rules of one chat, with every default applied. */
export interface ChatAttachmentPolicy {
  readonly bucket: string
  readonly accept: readonly string[]
  readonly maxSizeMb: number
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/** The policy an `attachments` block declares, or `undefined` when the node carries none. */
const policyOf = (node: TreeNode): ChatAttachmentPolicy | undefined => {
  const block = node['attachments']
  if (block === null || typeof block !== 'object') return undefined
  const { bucket, accept, maxSizeMb } = block as Readonly<Record<string, unknown>>
  if (!isNonEmptyString(bucket)) return undefined
  return {
    bucket,
    accept:
      Array.isArray(accept) && accept.every(isNonEmptyString)
        ? (accept as readonly string[])
        : DEFAULT_CHAT_ATTACHMENT_ACCEPT,
    maxSizeMb:
      typeof maxSizeMb === 'number' && Number.isFinite(maxSizeMb) && maxSizeMb > 0
        ? maxSizeMb
        : DEFAULT_CHAT_ATTACHMENT_MAX_SIZE_MB,
  }
}

/**
 * The attachment rules of the `ai-chat` whose `id` is `chatId`, or `undefined`
 * when no drawn chat has that id or the chat declares no `attachments` block —
 * a chat with `allowAttachments` alone keeps its files in the browser.
 */
export const findChatAttachmentPolicy = (
  app: ComponentTreeSource,
  chatId: string
): ChatAttachmentPolicy | undefined => {
  const templates = app.components ?? []
  const matches = (node: TreeNode): boolean => node['type'] === 'ai-chat' && node['id'] === chatId
  const chat = (app.pages ?? [])
    .flatMap((page) => {
      const items = page.components ?? []
      return renderedNodesWhere(items, placedTemplatesOf(items, templates), matches)
    })
    .find((node) => policyOf(node) !== undefined)
  return chat === undefined ? undefined : policyOf(chat)
}

/** The verdict on one upload: kept as the type its bytes announce, or refused and why. */
export type ChatUploadVerdict =
  | { readonly _tag: 'Accepted'; readonly mediaType: string }
  | { readonly _tag: 'TooLarge'; readonly maxSizeMb: number }
  | { readonly _tag: 'UnsupportedType' }

/**
 * Judge one upload against its chat's rules. Size is judged first: an
 * oversized file is refused for its size whatever it holds. The type is the
 * one its BYTES announce (`detected`), `undefined` when they announce none.
 */
export const judgeChatUpload = (input: {
  readonly size: number
  readonly detected: string | undefined
  readonly policy: ChatAttachmentPolicy
}): ChatUploadVerdict => {
  const { size, detected, policy } = input
  if (size > policy.maxSizeMb * 1024 * 1024) {
    return { _tag: 'TooLarge', maxSizeMb: policy.maxSizeMb }
  }
  if (detected === undefined || !isAcceptedMediaType(detected, policy.accept)) {
    return { _tag: 'UnsupportedType' }
  }
  return { _tag: 'Accepted', mediaType: detected }
}

/** The refusal a person reads for a file of a type the chat does not take. */
export const UNSUPPORTED_TYPE_MESSAGE = 'This file type is not accepted'

/** The refusal a person reads for a file over the chat's size limit. */
export const tooLargeMessage = (maxSizeMb: number): string =>
  `This file is larger than ${String(maxSizeMb)} MB`

/** Every `ai-chat` with an `attachments` block anywhere under `value`, with the bucket it names. */
const chatUploadsIn = (
  value: unknown
): ReadonlyArray<{ readonly chat: string; readonly bucket: string }> => {
  if (Array.isArray(value)) return value.flatMap(chatUploadsIn)
  if (!isRecord(value)) return []
  const block = value['attachments']
  const own =
    value['type'] === 'ai-chat' && isRecord(block) && typeof block['bucket'] === 'string'
      ? [{ chat: typeof value['id'] === 'string' ? value['id'] : '', bucket: block['bucket'] }]
      : []
  return [...own, ...Object.values(value).flatMap(chatUploadsIn)]
}

/**
 * One message per `ai-chat` whose `attachments.bucket` names a bucket the app
 * does not declare, naming it: otherwise every upload to that chat would be
 * refused at run time with nothing in the configuration saying why. Every chat
 * is walked, on a page or in a template, placed or not.
 */
export const validateChatAttachmentBuckets = (
  app: ComponentTreeSource,
  declaredBuckets: readonly string[]
): readonly string[] => {
  const known = new Set(declaredBuckets)
  const names = [...known].map((name) => `"${name}"`).join(', ')
  return chatUploadsIn([app.pages ?? [], app.components ?? []])
    .filter((found) => !known.has(found.bucket))
    .map(
      (found) =>
        `ai-chat "${found.chat}": attachments bucket "${found.bucket}" is not declared in buckets; name one of ${names}`
    )
}
