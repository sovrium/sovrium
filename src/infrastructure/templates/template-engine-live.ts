/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import {
  DEFAULT_RENDERER_MAX_OUTPUT_BYTES,
  parseRendererEnv,
} from '@/domain/models/process-env/renderer'
import { renderDocumentTemplate } from '@/infrastructure/templates/document-template-engine'
import {
  isTemplateHelper,
  renderTemplate,
  renderTemplateFor,
} from '@/infrastructure/templates/template-engine'

/** The rendered-text limit an env snapshot sets: `RENDERER_MAX_OUTPUT_BYTES`, else its default. */
export const renderedTextLimit = (env: Readonly<Record<string, string | undefined>>): number => {
  const parsed = parseRendererEnv(env)
  return parsed.ok ? parsed.config.maxOutputBytes : DEFAULT_RENDERER_MAX_OUTPUT_BYTES
}

/**
 * The Handlebars template engine. Its environment and compile cache are module
 * state the engine owns; the layer holds no resource of its own. It reads
 * `process.env` once when built, for the most bytes a document render may
 * produce — the same `RENDERER_MAX_OUTPUT_BYTES` every rendered output obeys.
 */
export const TemplateEngineLive = Layer.sync(TemplateEngine, () => {
  const maxOutputBytes = renderedTextLimit(process.env)
  return {
    render: renderTemplate,
    renderFor: renderTemplateFor,
    renderDocument: (template, context, options) =>
      renderDocumentTemplate(template, context, { maxOutputBytes, ...options }),
    isHelper: isTemplateHelper,
  }
})
