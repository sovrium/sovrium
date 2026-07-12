/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { computeFormLayoutClasses } from '@/presentation/utils/design/form-layout-classes'

export {
  computeFormLayoutClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
} from '@/presentation/utils/design/form-layout-classes'


const FORM_CARD_PADDING = 'p-5'

const FORM_SURFACE = [
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

export const computeFormClasses = (): string =>
  [FORM_CARD_PADDING, computeFormLayoutClasses(), FORM_SURFACE].join(' ')


const DROPZONE_LAYOUT = 'p-6 flex flex-col items-center gap-2'

const DROPZONE_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border-2 border-dashed',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeFileUploadDropzoneClasses = (): string =>
  [DROPZONE_LAYOUT, DROPZONE_SURFACE].join(' ')

const DROPZONE_ICON_CLASSES = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'text-3xl leading-none',
].join(' ')

export const computeFileUploadDropzoneIconClasses = (): string => DROPZONE_ICON_CLASSES

const DROPZONE_TEXT_CLASSES = [`text-[${v('sv-fg', T.fg)}]`, 'text-sm'].join(' ')

export const computeFileUploadDropzoneTextClasses = (): string => DROPZONE_TEXT_CLASSES

const DROPZONE_HINT_CLASSES = [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-xs'].join(' ')

export const computeFileUploadDropzoneHintClasses = (): string => DROPZONE_HINT_CLASSES
