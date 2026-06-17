/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { gradeBytes, parseEcoIndexHeader } from '@/domain/models/env/eco/eco-index-header'
import { recordGradedResponse } from '@/infrastructure/utils/eco-index-tracker'
import type { Context, MiddlewareHandler, Next } from 'hono'

const HEADER_NAME = 'X-Eco-Index'

async function handleEcoIndexResponse(c: Context, next: Next): Promise<void> {
  await next()

  const mode = parseEcoIndexHeader(process.env as Readonly<Record<string, string | undefined>>)
  if (mode === 'off') return

  const contentLength = c.res.headers.get('content-length')
  const headerBytes = contentLength == undefined ? undefined : Number.parseInt(contentLength, 10)
  const contentType = c.res.headers.get('content-type') ?? ''
  const canBufferForGrade = contentType.toLowerCase().includes('text/html')
  const bytes =
    headerBytes !== undefined && Number.isFinite(headerBytes)
      ? headerBytes
      : canBufferForGrade
        ? await c.res
            .clone()
            .text()
            .then((body) => body.length)
            .catch(() => 0)
        : 0
  const grade = gradeBytes(bytes)

  c.res.headers.set(HEADER_NAME, grade)
  recordGradedResponse(grade)
}

export const ecoIndexHeaderMiddleware = (): MiddlewareHandler => handleEcoIndexResponse
