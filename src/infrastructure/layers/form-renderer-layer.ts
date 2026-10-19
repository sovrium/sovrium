/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logError } from '@/infrastructure/logging/logger'
import { buildIslands } from '@/infrastructure/server/route-setup/island-assets'
import {
  renderClosedFormPage,
  type ClosedFormRequest,
  type ClosedReason,
} from '@/presentation/render/forms/form-closed-renderer'
import { formNeedsFieldIslands } from '@/presentation/render/forms/form-field-elements-design'
import {
  renderEmbedFormPage,
  renderFormPage,
  renderFormStepFragment,
  type StepFragmentState,
} from '@/presentation/render/forms/form-renderer'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormPrefillContext } from '@/presentation/render/forms/form-prefill-resolver'

/**
 * The island runtime's entry when the form draws a field the design system
 * mounts over its skeleton (a Select, a date picker), else nothing — a form
 * of plain inputs loads no island runtime at all. A build that fails leaves
 * the skeletons in place, which still hold and post their values.
 */
async function formIslandEntry(
  app: Readonly<App>,
  form: Readonly<Form>
): Promise<string | undefined> {
  const table = app.tables?.find((candidate) => candidate.name === form.submitTo.table)
  const columnTypeOf = (column: string): string | undefined =>
    table?.fields.find((field) => field.name === column)?.type
  if (!formNeedsFieldIslands(form, columnTypeOf)) return undefined
  try {
    return (await buildIslands()).entryFile
  } catch (error) {
    logError('[FORMS] Failed to build the island bundle', error)
    return undefined
  }
}

/**
 * Bundle of form-rendering callbacks supplied to the presentation
 * route layer. Routes cannot import `presentation-rendering` directly
 * under the layer-boundary rules, so this module — which lives in
 * `infrastructure-layer` (allowed to import `presentation-rendering`)
 * — provides the bridge.
 *
 * Mirrors the `PageRendererLive` ports/adapters approach used for page
 * rendering, but skipped the Effect Service indirection because form
 * rendering is a pure function and does not need Layer composition.
 */
export const FormRenderers = {
  renderForm: async (
    app: Readonly<App>,
    form: Readonly<Form>,
    activeLang?: string,
    prefillCtx?: FormPrefillContext
  ): Promise<string> => {
    const islandEntryFile = await formIslandEntry(app, form)
    return renderFormPage(
      app,
      form,
      activeLang,
      islandEntryFile === undefined ? prefillCtx : { query: {}, ...prefillCtx, islandEntryFile }
    )
  },
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
    state: StepFragmentState
  ): string => renderFormStepFragment(app, form, stepId, state),
  renderClosedForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    reason: ClosedReason,
    request?: ClosedFormRequest
  ): string => renderClosedFormPage(app, form, reason, request),
} as const
