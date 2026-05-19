/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import Handlebars from 'handlebars'
import { registerHelpers } from './handlebars-helpers'

const engine = Handlebars.create()
registerHelpers(engine)

const TEMPLATE_PATTERN = /\{\{[\s\S]*?\}\}/

type Compiled = (ctx: Readonly<Record<string, unknown>>) => string
const FAILED_COMPILE: Compiled = () => ''
const compileCache = new Map<string, Compiled>()

const getCompiled = (template: string): Compiled => {
  const cached = compileCache.get(template)
  if (cached !== undefined) return cached
  const result = ((): Compiled => {
    try {
      return engine.compile(template, { noEscape: true, strict: false })
    } catch (error) {
      if (process.env['DEBUG']?.includes('sovrium:templates')) {
        console.error('[templates] compile failed', { template, error })
      }
      return FAILED_COMPILE
    }
  })()
  compileCache.set(template, result)
  return result
}

export const renderTemplate = (
  template: string,
  context: Readonly<Record<string, unknown>>
): string => {
  if (!TEMPLATE_PATTERN.test(template)) return template
  const compiled = getCompiled(template)
  if (compiled === FAILED_COMPILE) return template
  try {
    return compiled(context)
  } catch (error) {
    if (process.env['DEBUG']?.includes('sovrium:templates')) {
      console.error('[templates] render failed', { template, error })
    }
    return template
  }
}
