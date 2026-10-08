/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import {
  isTemplateHelper,
  renderTemplate,
  renderTemplateFor,
} from '@/infrastructure/templates/template-engine'

/**
 * The Handlebars template engine. Its environment and compile cache are module
 * state the engine owns; the layer holds no resource of its own, so
 * `Layer.succeed`.
 */
export const TemplateEngineLive = Layer.succeed(TemplateEngine, {
  render: renderTemplate,
  renderFor: renderTemplateFor,
  isHelper: isTemplateHelper,
})
