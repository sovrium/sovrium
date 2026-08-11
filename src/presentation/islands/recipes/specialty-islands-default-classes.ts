/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the React-island specialty surfaces
 *: `comments` (comment-thread island family) and `ai-chat`. Schema
 * authors who write the bare `{ type: 'comments' }` or `{ type: 'ai-chat' }`
 * get a complete, opinionated chat / discussion surface — separated comment
 * cards with author meta, message bubbles distinguished by role, fixed-bottom
 * input row — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric + date
 * + overlays + disclosure + feedback + interactive-content + specialty-SSR
 * slices (commits 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 +
 * 3d35fad9a + 0de6ded2a + 1b3f551a7 + c3b0241c7). Layout / spacing classes
 * (`flex`, `gap-2`, `space-y-2`) stay as raw Tailwind utilities — they encode
 * behavior, not color — while every color / border / radius / shadow class
 * goes through {@link withVarFallback} so `app.theme.*` overrides still win at
 * the CSS cascade layer (`var(--sv-X)` resolves the override first, falling
 * back to the inline OKLCH literal).
 *
 * Subparts covered:
 *
 *   - COMMENT THREAD CONTAINER  — outer `<section>` for the comments island,
 *                                 with vertical spacing between header,
 *                                 list, pagination, and form
 *   - COMMENT ITEM              — single comment card (top-level or threaded
 *                                 reply); the `depth` axis adds the inset
 *                                 (left margin) that distinguishes a reply
 *                                 from its parent
 *   - COMMENT META              — author + relative-time row at the top of
 *                                 each comment; small + muted so the body
 *                                 copy reads as focal
 *   - COMMENT FORM              — bordered card-like wrapper for the inline
 *                                 reply / new-comment form, matching the
 *                                 comment-item chrome so the form reads as
 *                                 part of the thread
 *   - AI CHAT CONTAINER         — outer flex-column surface, full height,
 *                                 bordered + rounded so the chat reads as a
 *                                 self-contained panel
 *   - AI CHAT MESSAGE LIST      — scrollable area containing message
 *                                 bubbles + the loading indicator
 *   - AI CHAT MESSAGE BUBBLE    — per-message chip; the `role` axis paints
 *                                 distinct tones (user = primary right,
 *                                 assistant = bg-subtle left, system =
 *                                 muted centered)
 *   - AI CHAT INPUT ROW         — fixed-bottom input row, border-top so the
 *                                 input reads as separated from the message
 *                                 list
 *   - AI CHAT INPUT FIELD       — bordered single-line `<input>`, fills
 *                                 available width; standard input chrome
 *   - AI CHAT SEND BUTTON       — primary-tone submit button matched to the
 *                                 default Sovrium button family
 *
 * Helper file lives in `src/presentation/islands/` (alongside the island
 * components that consume it). The `comment-thread-island.tsx` family +
 * `ai-chat-island/` files are React-tree islands that hydrate on the client,
 * so prestyle helpers ship in the same folder for layer hygiene.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// COMMENT THREAD — outer container with vertical spacing
// ──────────────────────────────────────────────────────────────────────────────

const COMMENT_THREAD_LAYOUT = 'flex flex-col gap-3 my-6 p-4'

const COMMENT_THREAD_SURFACE = [
  // Q1/Q2a island-contract surface chrome: every island must render a styled,
  // non-transparent surface with a recolor-able border. The thread `<section>`
  // IS the panel itself (the empty state has no `<li>` cards to read), so the
  // border + bg-raised live here — not just on per-comment items.
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for the outer `<section>` of the comments
 * island. Vertical flex with a `gap-3` interval so the header, comment
 * list, pagination, and reply form each read as their own row; `my-6` + `p-4`
 * matches the `.comments` legacy chrome so the section is set apart from
 * surrounding page content. Surface tokens (`border-border`, `bg-bg-raised`,
 * `rounded-lg`) honor the Q1/Q2a island-contract — the thread panel is a
 * styled, recolor-able surface even when it has zero comments.
 */
export const computeCommentThreadClasses = (): string =>
  [COMMENT_THREAD_LAYOUT, COMMENT_THREAD_SURFACE].join(' ')

const COMMENT_ITEM_LAYOUT_BASE = 'grid gap-2 p-3'

const COMMENT_ITEM_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for a single `<li>` comment card. The
 * `depth` axis pushes a reply (`depth >= 1`) inward by `ml-6` so the
 * thread shape reads as nested without changing the underlying chrome.
 * Top-level comments stay flush with the thread container's left edge.
 *
 * Bordered + bg-raised + radius-md so each comment reads as a card; the
 * grid layout keeps the meta row, body, action row, and any inline
 * form stacked with a consistent `gap-2`.
 */
export const computeCommentItemClasses = ({
  depth = 0,
}: { readonly depth?: number } = {}): string =>
  [COMMENT_ITEM_LAYOUT_BASE, depth >= 1 ? 'ml-6' : '', COMMENT_ITEM_SURFACE]
    .filter(Boolean)
    .join(' ')

const COMMENT_META_LAYOUT = 'flex items-center justify-between text-xs'

const COMMENT_META_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the `<header>` meta row of a single
 * comment — author name on the left, relative-time on the right, both
 * rendered at small text + muted foreground so the comment body remains
 * focal. The author name itself is rendered with a stronger tone by the
 * comment-item component (it spans `text-[sv-fg]` directly), but the
 * surrounding row tone is muted.
 */
export const computeCommentMetaClasses = (): string =>
  [COMMENT_META_LAYOUT, COMMENT_META_SURFACE].join(' ')

const COMMENT_FORM_LAYOUT = 'grid gap-2 p-3 mt-4'

const COMMENT_FORM_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for the inline new-comment / reply form
 * `<form>`. Bordered + bg-subtle so the form reads as a chrome stub
 * distinct from the comment cards (cards are bg-raised, form is
 * bg-subtle); the grid layout keeps the textarea, validation hint, and
 * action row stacked with the same `gap-2` the comment cards use.
 */
export const computeCommentFormClasses = (): string =>
  [COMMENT_FORM_LAYOUT, COMMENT_FORM_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// AI CHAT — container + message list + per-role bubbles + input row + send btn
// ──────────────────────────────────────────────────────────────────────────────

const AI_CHAT_CONTAINER_LAYOUT = 'flex flex-col h-full overflow-hidden'

const AI_CHAT_CONTAINER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

/**
 * Compute the default className for the outer `<div>` of the `ai-chat`
 * island. Bordered + bg-raised + radius-lg + shadow-sm so the chat reads
 * as a self-contained panel; `flex flex-col h-full` makes the message
 * list claim all remaining vertical space while the input row pins at
 * the bottom. `overflow-hidden` keeps the rounded corners clean when the
 * message list grows beyond the panel.
 */
export const computeAiChatContainerClasses = (): string =>
  [AI_CHAT_CONTAINER_LAYOUT, AI_CHAT_CONTAINER_SURFACE].join(' ')

const AI_CHAT_MESSAGE_LIST_LAYOUT = 'flex-1 overflow-y-auto p-4 space-y-2 text-sm'

const AI_CHAT_MESSAGE_LIST_SURFACE = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for the scrollable `<div>` that holds the
 * message bubbles + loading indicator. `flex-1` claims all space between
 * the (optional) header and the fixed-bottom input row; `overflow-y-auto`
 * keeps the user inside the chat panel when the conversation grows.
 * `space-y-2` separates message bubbles vertically.
 */
export const computeAiChatMessageListClasses = (): string =>
  [AI_CHAT_MESSAGE_LIST_LAYOUT, AI_CHAT_MESSAGE_LIST_SURFACE].join(' ')

/** Schema-aligned vocabulary for the message role axis. */
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

/**
 * Compute the default className for a single message bubble inside the
 * `ai-chat` message list. The `role` axis paints distinct tones:
 *   - `user`      — primary tone, right-aligned (`ml-auto`); the speaker's
 *                   own messages stand out as focal
 *   - `assistant` — bg-subtle tone, left-aligned (`mr-auto`); the AI's
 *                   responses read as neutral chrome
 *   - `system`    — transparent + dashed border, centered; metadata cues
 *                   like "Connection lost" or system prompts
 * All variants share `max-w-[80%]` so a long single-line response never
 * fills the full chat width, and `break-words` so URLs / long tokens wrap.
 */
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

/**
 * Compute the default className for the `<form>` input row pinned at the
 * bottom of the chat container. `border-t` separates the row from the
 * message list above; bg-raised matches the container surface so the row
 * doesn't read as a different panel. `flex items-center gap-2` keeps the
 * (optional) attachment button, input field, and send button on one
 * baseline.
 */
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

/**
 * Compute the default className for the `<input>` field inside the chat
 * input row. Bordered + radius-md + focus-ring matches the standard
 * Sovrium input recipe; `flex-1` claims all space between the attach
 * button and the send button. `disabled:opacity-50` dims the field while
 * the AI is responding (the island sets `disabled` during a stream).
 */
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

/**
 * Compute the default className for the `<button type="submit">` send
 * button at the right edge of the chat input row. Primary tone + hover
 * swap to `primary-hover` so the focal action stands out; `disabled:`
 * dims the button while the input is empty or the AI is responding (the
 * island handles the disabled-state logic via `canSend`).
 */
export const computeAiChatSendButtonClasses = (): string =>
  [AI_CHAT_SEND_BUTTON_LAYOUT, AI_CHAT_SEND_BUTTON_SURFACE].join(' ')
