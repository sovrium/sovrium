/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  renderEmbedFormPage,
  renderFormPage,
  renderFormStepFragment,
} from '@/presentation/rendering/forms/form-renderer'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

export const FormRenderers = {
  renderForm: (app: Readonly<App>, form: Readonly<Form>): string => renderFormPage(app, form),
  renderEmbed: (app: Readonly<App>, form: Readonly<Form>): string => renderEmbedFormPage(app, form),
  renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ): string => renderFormStepFragment(app, form, stepId, draftValues),
} as const
