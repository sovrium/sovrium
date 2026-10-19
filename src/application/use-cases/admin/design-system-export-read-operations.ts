/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two authorised design-system exports ([internal ref] A2), as registry entries:
 * the token document — in either colour mode, or as flat rows — and the
 * markdown brief. Each entry is the admin route, the MCP admin tool and the
 * OpenAPI operation at once. Both write the design read event naming the
 * caller. The facets the console draws are the sibling
 * `design-system-read-operations.ts`, which lists these first.
 */

import { Effect } from 'effect'
import {
  adminReadText,
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
  type AdminReadOperation,
  type AdminReadOutcome,
} from '@/application/use-cases/admin/admin-read-operation'
import { buildDesignSystem } from '@/application/use-cases/admin/design-system'
import { renderDesignSystemMarkdown } from '@/application/use-cases/admin/design-system-markdown'
import { flattenDesignTokens } from '@/application/use-cases/admin/design-system-token-rows'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  designSystemDocumentSchema,
  designSystemJsonQuerySchema,
  type DesignSystemMode,
} from '@/domain/models/api/admin/design-system'
import { flatTokensResponseSchema } from '@/domain/models/api/admin/design-system/component-types'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { App } from '@/domain/models/app'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** The design read event, naming the caller: the config is the one entity both exports target. */
const DESIGN_AUDIT = {
  action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
  resourceId: (_app: App, _input: unknown, request: { readonly actorUserId: string }) =>
    request.actorUserId,
}

/** The token document, validated against its wire schema. */
const validatedDocument = (app: App, mode?: DesignSystemMode) =>
  decodeSafe(designSystemDocumentSchema)(buildDesignSystem(app, mode))

const designSystemJson = defineAdminRead<{
  readonly flat: boolean
  readonly mode: DesignSystemMode | undefined
}>({
  id: 'design-system.json',
  method: 'get',
  path: '/api/admin/design-system.json',
  pathParams: [],
  queryParams: ['flat', 'mode'],
  tool: {
    suffix: 'design_system_json',
    description:
      'The design token document of this app in its light or dark colour mode, or the same tokens as flat rows with flat set, as GET /api/admin/design-system.json answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        flat: { type: 'boolean', description: 'Answer the same tokens as flat rows.' },
        mode: {
          type: 'string',
          enum: ['light', 'dark'],
          description: 'The colour mode the document describes; light when omitted.',
        },
      },
    },
  },
  openapi: {
    summary: 'Export the design system as a token document',
    description:
      'The design token document the operator config resolves to. `?flat` answers the SAME ' +
      'tokens as rows; without it the document is the published standard format, unchanged. ' +
      '`?mode=dark` answers the colours the dark scheme paints, every other group unchanged; ' +
      'an unknown mode is a 400. Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'getAdminDesignSystemJson',
    querySchema: designSystemJsonQuerySchema,
    responseSchema: designSystemDocumentSchema,
    responseDescription: 'The design token document',
  },
  subject: 'design system document',
  // `flat` is a flag by presence over HTTP (`?flat=…`) and `true` over MCP;
  // `mode` is decoded, so an unknown one is refused rather than read as light.
  decode: (raw) => {
    const decoded = decodeAdminReadQuery(designSystemJsonQuerySchema, raw)
    return decoded._tag === 'Ok'
      ? {
          _tag: 'Ok',
          input: {
            flat: raw['flat'] !== undefined && raw['flat'] !== false,
            mode: decoded.input.mode,
          },
        }
      : decoded
  },
  read: (app, { flat, mode }) =>
    Effect.sync((): AdminReadOutcome => {
      const document = validatedDocument(app, mode)
      if (!document.success) return { _tag: 'ValidationFailed', error: document.error }
      if (!flat) return { _tag: 'Ok', body: document.data }
      const items = flattenDesignTokens(
        document.data as Readonly<Record<string, unknown>>,
        app,
        mode
      )
      return answerWithSchema(flatTokensResponseSchema, { items, total: items.length })
    }),
  audit: DESIGN_AUDIT,
})

const designSystemMarkdown = defineAdminRead<undefined>({
  id: 'design-system.markdown',
  method: 'get',
  path: '/api/admin/design-system.md',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'design_system_markdown',
    description:
      'The design system of this app as markdown, byte for byte what GET /api/admin/design-system.md answers (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Export the design system as markdown',
    description:
      'The same design system as the token document, rendered as markdown a person or an ' +
      'assistant reads. Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'getAdminDesignSystemMarkdown',
    responseSchema: designSystemDocumentSchema,
    responseContentType: 'text/markdown; charset=utf-8',
    responseDescription: 'The design system as markdown',
  },
  subject: 'design system document',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: (app) =>
    Effect.sync((): AdminReadOutcome => {
      const document = validatedDocument(app)
      if (!document.success) return { _tag: 'ValidationFailed', error: document.error }
      const dark = validatedDocument(app, 'dark')
      if (!dark.success) return { _tag: 'ValidationFailed', error: dark.error }
      return {
        _tag: 'Ok',
        body: adminReadText(
          'text/markdown; charset=utf-8',
          renderDesignSystemMarkdown(document.data, dark.data, app.name)
        ),
      }
    }),
  audit: DESIGN_AUDIT,
})

/** The two exports, in the order the registry lists them. */
export const DESIGN_SYSTEM_EXPORT_READS: ReadonlyArray<AdminReadOperation> = [
  designSystemJson,
  designSystemMarkdown,
]
