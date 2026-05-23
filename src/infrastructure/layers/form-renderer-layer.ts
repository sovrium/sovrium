/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  renderClosedFormPage,
  type ClosedReason,
} from '@/presentation/rendering/forms/form-closed-renderer'
import {
  renderEmbedFormPage,
  renderFormPage,
  renderFormStepFragment,
} from '@/presentation/rendering/forms/form-renderer'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormPrefillContext } from '@/presentation/rendering/forms/form-prefill-resolver'

export const FormRenderers = {
  renderForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    activeLang?: string,
    prefillCtx?: FormPrefillContext
  ): string => renderFormPage(app, form, activeLang, prefillCtx),
  renderEmbed: (
    app: Readonly<App>,
    form: Readonly<Form>,
    activeLang?: string,
    prefillCtx?: FormPrefillContext
  ): string => renderEmbedFormPage(app, form, activeLang, prefillCtx),
  renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ): string => renderFormStepFragment(app, form, stepId, draftValues),
  renderClosedForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    reason: ClosedReason,
    opensAt?: string
  ): string => renderClosedFormPage(app, form, reason, opensAt),
} as const
