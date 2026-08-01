/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const FRAME_SHELL = [
  'overflow-hidden',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
].join(' ')

export const computeCodeFrameShellClasses = (): string => FRAME_SHELL


const FRAME_HEADER = [
  'flex items-center gap-2 px-4 py-2 font-mono text-xs',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeCodeFrameHeaderClasses = (): string => FRAME_HEADER


const OUTPUT_SURFACE = [
  'overflow-x-auto px-4 py-3 font-mono text-xs whitespace-pre-wrap',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeCodeOutputClasses = (): string => OUTPUT_SURFACE
