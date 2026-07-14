/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type CSSProperties } from 'react'
import { TOKENS } from './css-var'


export const computeFormLayoutClasses = (): string => 'flex w-full flex-col gap-3'

export const computeFormFieldClasses = (): string => 'flex w-full flex-col gap-1.5'

export const computeFormFieldLabelClasses = (): string => 'text-foreground text-sm font-medium'

export const computeFormHelpTextClasses = (): string => 'text-foreground-muted text-xs'


export const computeAuthFeedbackBannerClasses = (): string => 'rounded-md px-3 py-2 text-sm'

export const AUTH_ERROR_BANNER_STYLE: CSSProperties = {
  backgroundColor: `var(--sv-error-bg, ${TOKENS.errorBg})`,
  color: `var(--sv-error-fg, ${TOKENS.errorFg})`,
}

export const AUTH_SUCCESS_BANNER_STYLE: CSSProperties = {
  backgroundColor: `var(--sv-success-bg, ${TOKENS.successBg})`,
  color: `var(--sv-success-fg, ${TOKENS.successFg})`,
}


export const computeFormGroupClasses = (): string => 'flex flex-col gap-3'

export const computeFormGroupLabelClasses = (): string => 'text-foreground text-base font-semibold'
