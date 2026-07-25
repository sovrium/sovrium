/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveRedirect } from '@/domain/utils/matching/redirect-matcher'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function setupRedirectRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const rules = app.redirects
  if (rules === undefined || rules.length === 0) return honoApp

  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  return honoApp.get('*', (c, next) => {
    const queryIndex = c.req.url.indexOf('?')
    const search = queryIndex === -1 ? '' : c.req.url.slice(queryIndex)

    const resolution = resolveRedirect(rules, languageCodes, c.req.path, search)
    if (resolution === undefined) return next()

    return c.redirect(resolution.location, resolution.status)
  })
}
