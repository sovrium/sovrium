/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { linkPreviewListResponseSchema } from '@/domain/models/api/tables/link-previews'
import {
  linkAddressesOfRecord,
  linkPreviewFieldsOf,
} from '@/domain/models/app/pages/components/component-types/display/link-preview-service'
import {
  cachedLinkPreviews,
  linkPreviewPicture,
  type CachedLinkPreview,
} from '@/infrastructure/egress/link-preview-cache'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runHandlerEffect, toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { guardForTable } from './row-level-guard'
import { checkGetReadGate, NOT_FOUND_RESPONSE, readRuleAdmits } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The link previews of one message, READ from the cache the server filled
 * when the message was stored:
 *
 *   - `GET /api/tables/:tableId/records/:recordId/link-previews` — the cards;
 *   - `GET /api/tables/:tableId/records/:recordId/link-previews/:previewId` —
 *     one card's picture, served by the app.
 *
 * Neither takes an address: the addresses are the record's own, read through
 * the records API's gate, so a caller who may not read the record — or the
 * field holding its text — gets 404, as from `GET /records/:recordId`, and a
 * preview id that is not one of the record's answers 404 too. Nothing here
 * makes the server fetch anything.
 */

const PREVIEW_ID = /^[0-9a-f]{64}$/

/** The record's previewing addresses as this caller reads them, or the refusal to answer. */
function readCallerAddresses(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const fields = linkPreviewFieldsOf(app).get(tableName) ?? []
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (fields.length === 0 || table === undefined) return NOT_FOUND_RESPONSE(c)
  const recordId = c.req.param('recordId')!
  return Effect.flatMap(guardForTable(session, { userRole, userGroups }, table, app), (guard) => {
    const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
    if (gateError) return Effect.succeed<readonly string[] | Response>(gateError)
    return Effect.match(
      createGetRecordProgram({
        ...{ session, tableName, app, userRole, recordId, userGroups },
        admits: readRuleAdmits(guard, table),
      }),
      {
        onFailure: (failure) => toErrorResponse(c, failure),
        onSuccess: (record) =>
          linkAddressesOfRecord(
            (record as { readonly fields?: Readonly<Record<string, unknown>> }).fields ?? {},
            fields
          ),
      }
    )
  })
}

/** One cached card as the wire contract names it. */
const toWireCard = (c: Context, card: CachedLinkPreview) => {
  const tableId = encodeURIComponent(c.req.param('tableId')!)
  const recordId = encodeURIComponent(c.req.param('recordId')!)
  return {
    id: card.id,
    url: card.url,
    title: card.title ?? null,
    description: card.description ?? null,
    siteName: card.siteName ?? null,
    imageUrl: card.hasImage
      ? `/api/tables/${tableId}/records/${recordId}/link-previews/${card.id}`
      : null,
    fetchedAt: card.fetchedAt,
  }
}

/** `GET /api/tables/:tableId/records/:recordId/link-previews` */
export async function handleListLinkPreviews(c: Context, app: App): Promise<Response> {
  const read = readCallerAddresses(c, app)
  if (read instanceof Response) return read
  return runHandlerEffect(
    c,
    Effect.map(read, (addresses) =>
      addresses instanceof Response ? addresses : listAnswer(c, addresses)
    )
  )
}

/** The cards of the record's addresses, held to the published contract before they leave. */
const listAnswer = (c: Context, addresses: readonly string[]): Response => {
  const body = { previews: cachedLinkPreviews(addresses).map((card) => toWireCard(c, card)) }
  const decoded = decodeSafe(linkPreviewListResponseSchema)(body)
  return decoded.success
    ? c.json(decoded.data, 200)
    : toErrorResponse(c, new Error('link previews broke their response contract'))
}

/** `GET /api/tables/:tableId/records/:recordId/link-previews/:previewId` */
export async function handleLinkPreviewPicture(c: Context, app: App): Promise<Response> {
  const previewId = c.req.param('previewId') ?? ''
  if (!PREVIEW_ID.test(previewId)) return NOT_FOUND_RESPONSE(c)
  const read = readCallerAddresses(c, app)
  if (read instanceof Response) return read
  return runHandlerEffect(
    c,
    Effect.map(read, (addresses) => {
      if (addresses instanceof Response) return addresses
      const picture = linkPreviewPicture(addresses, previewId)
      if (picture === undefined) return NOT_FOUND_RESPONSE(c)
      return new Response(new Blob([picture.bytes as Uint8Array<ArrayBuffer>]), {
        headers: {
          'Content-Type': picture.contentType,
          'Cache-Control': 'private, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      })
    })
  )
}
