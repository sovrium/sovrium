/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const COMMENT_THREAD_LAYOUT = 'flex flex-col gap-3 my-6 p-4'

const COMMENT_THREAD_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

export const computeCommentThreadClasses = (): string =>
  [COMMENT_THREAD_LAYOUT, COMMENT_THREAD_SURFACE].join(' ')

const COMMENT_ITEM_LAYOUT_BASE = 'grid gap-2 p-3'

const COMMENT_ITEM_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeCommentItemClasses = ({
  depth = 0,
}: { readonly depth?: number } = {}): string =>
  [COMMENT_ITEM_LAYOUT_BASE, depth >= 1 ? 'ml-6' : '', COMMENT_ITEM_SURFACE]
    .filter(Boolean)
    .join(' ')

const COMMENT_META_LAYOUT = 'flex items-center justify-between text-xs'

const COMMENT_META_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeCommentMetaClasses = (): string =>
  [COMMENT_META_LAYOUT, COMMENT_META_SURFACE].join(' ')

const COMMENT_FORM_LAYOUT = 'grid gap-2 p-3 mt-4'

const COMMENT_FORM_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeCommentFormClasses = (): string =>
  [COMMENT_FORM_LAYOUT, COMMENT_FORM_SURFACE].join(' ')


const AI_CHAT_CONTAINER_LAYOUT = 'flex flex-col h-full overflow-hidden'

const AI_CHAT_CONTAINER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

export const computeAiChatContainerClasses = (): string =>
  [AI_CHAT_CONTAINER_LAYOUT, AI_CHAT_CONTAINER_SURFACE].join(' ')

const AI_CHAT_MESSAGE_LIST_LAYOUT = 'flex-1 overflow-y-auto p-4 space-y-2 text-sm'

const AI_CHAT_MESSAGE_LIST_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeAiChatMessageListClasses = (): string =>
  [AI_CHAT_MESSAGE_LIST_LAYOUT, AI_CHAT_MESSAGE_LIST_SURFACE].join(' ')

export type AiChatMessageRole = 'user' | 'assistant' | 'system'

const AI_CHAT_BUBBLE_BASE = 'w-fit max-w-[80%] px-3 py-2 break-words text-sm leading-snug'

const AI_CHAT_BUBBLE_RADIUS = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const AI_CHAT_BUBBLE_ROLE_CLASS: Record<AiChatMessageRole, string> = {
  user: [
    'ml-auto',
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  ].join(' '),
  assistant: [
    'mr-auto',
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  system: [
    'mx-auto text-center',
    `bg-transparent`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
    'border-dashed',
  ].join(' '),
}

export const computeAiChatMessageBubbleClasses = ({
  role = 'assistant',
}: {
  readonly role?: AiChatMessageRole
} = {}): string =>
  [AI_CHAT_BUBBLE_BASE, AI_CHAT_BUBBLE_RADIUS, AI_CHAT_BUBBLE_ROLE_CLASS[role]].join(' ')

const AI_CHAT_INPUT_ROW_LAYOUT = 'flex items-center gap-2 p-3'

const AI_CHAT_INPUT_ROW_SURFACE = [
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

export const computeAiChatInputRowClasses = (): string =>
  [AI_CHAT_INPUT_ROW_LAYOUT, AI_CHAT_INPUT_ROW_SURFACE].join(' ')

const AI_CHAT_INPUT_LAYOUT = 'flex-1 px-3 py-2 text-sm'

const AI_CHAT_INPUT_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg', T.bg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `placeholder:text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  'focus:outline-none focus:ring-2',
  `focus:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ')

export const computeAiChatInputClasses = (): string =>
  [AI_CHAT_INPUT_LAYOUT, AI_CHAT_INPUT_SURFACE].join(' ')

const AI_CHAT_SEND_BUTTON_LAYOUT =
  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium leading-none shrink-0'

const AI_CHAT_SEND_BUTTON_SURFACE = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
  'focus-visible:outline-none focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'disabled:opacity-50 disabled:cursor-not-allowed',
  `transition-[background-color] duration-[${v('sv-duration-fast', T.durationFast)}] ease-[${v('sv-ease-default', T.easeDefault)}]`,
].join(' ')

export const computeAiChatSendButtonClasses = (): string =>
  [AI_CHAT_SEND_BUTTON_LAYOUT, AI_CHAT_SEND_BUTTON_SURFACE].join(' ')
