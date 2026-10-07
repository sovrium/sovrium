/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design-system admin reads, as registry entries: the two authorised
 * exports ([internal ref] A2) and the facets the console's design-system pages draw.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are all derived from it. Every facet is a function of
 * the operator's LIVE config, which the registry resolves per call.
 *
 * The markdown export answers TEXT, byte for byte the same on both surfaces.
 * Audit: the two exports write the design read event naming the caller; the
 * facets write none, as their routes never have. The schema reads are the
 * sibling `schema-read-operations.ts`.
 */

import { Effect } from 'effect'
import {
  adminReadText,
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadDefinition,
  type AdminReadOperation,
  type AdminReadOutcome,
} from '@/application/use-cases/admin/admin-read-operation'
import { buildDesignSystem } from '@/application/use-cases/admin/design-system'
import { brandFacet, zonesFacet } from '@/application/use-cases/admin/design-system-brand-facet'
import { coverageFacet } from '@/application/use-cases/admin/design-system-coverage'
import {
  designTokenFacet,
  exportsFacet,
  guidanceFacet,
  typeLadderFacet,
} from '@/application/use-cases/admin/design-system-facets'
import { renderDesignSystemMarkdown } from '@/application/use-cases/admin/design-system-markdown'
import { flattenDesignTokens } from '@/application/use-cases/admin/design-system-token-rows'
import { usageFacet } from '@/application/use-cases/admin/design-system-usage-facet'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  designSystemDocumentSchema,
  designSystemJsonQuerySchema,
} from '@/domain/models/api/admin/design-system'
import { flatTokensResponseSchema } from '@/domain/models/api/admin/design-system/component-types'
import {
  brandFacetResponseSchema,
  designCoverageQuerySchema,
  designCoverageResponseSchema,
  designSystemExportsResponseSchema,
  designTokenFacetResponseSchema,
  designTokenQuerySchema,
  designZonesResponseSchema,
  guidanceListResponseSchema,
  guidanceQuerySchema,
  typeLadderResponseSchema,
  usageQuerySchema,
  usageResponseSchema,
} from '@/domain/models/api/admin/design-system/facets'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { App } from '@/domain/models/app'
import type { Schema } from 'effect'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** A string argument of a design read, as the MCP tool advertises it. */
const stringArgument = (description: string) => ({ type: 'string', description })

/** The design read event, naming the caller: the config is the one entity both exports target. */
const DESIGN_AUDIT = {
  action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
  resourceId: (_app: App, _input: unknown, request: { readonly actorUserId: string }) =>
    request.actorUserId,
}

/** The token document, validated against its wire schema. */
const validatedDocument = (app: App) =>
  decodeSafe(designSystemDocumentSchema)(buildDesignSystem(app))

// ─── The two exports ──────────────────────────────────────────────────────────

const designSystemJson = defineAdminRead<boolean>({
  id: 'design-system.json',
  method: 'get',
  path: '/api/admin/design-system.json',
  pathParams: [],
  queryParams: ['flat'],
  tool: {
    suffix: 'design_system_json',
    description:
      'The design token document of this app, or the same tokens as flat rows with flat set, as GET /api/admin/design-system.json answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        flat: { type: 'boolean', description: 'Answer the same tokens as flat rows.' },
      },
    },
  },
  openapi: {
    summary: 'Export the design system as a token document',
    description:
      'The design token document the operator config resolves to. `?flat` answers the SAME ' +
      'tokens as rows; without it the document is the published standard format, unchanged. ' +
      'Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'getAdminDesignSystemJson',
    // Presence is the flag, so no value is refused.
    querySchema: designSystemJsonQuerySchema,
    refusesQuery: false,
    responseSchema: designSystemDocumentSchema,
    responseDescription: 'The design token document',
  },
  subject: 'design system document',
  // Presence is the flag over HTTP (`?flat=…`); over MCP it is `true`.
  decode: (raw) => ({ _tag: 'Ok', input: raw['flat'] !== undefined && raw['flat'] !== false }),
  read: (app, flat) =>
    Effect.sync((): AdminReadOutcome => {
      const document = validatedDocument(app)
      if (!document.success) return { _tag: 'ValidationFailed', error: document.error }
      if (!flat) return { _tag: 'Ok', body: document.data }
      const items = flattenDesignTokens(document.data as Readonly<Record<string, unknown>>, app)
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
      return {
        _tag: 'Ok',
        body: adminReadText(
          'text/markdown; charset=utf-8',
          renderDesignSystemMarkdown(document.data, app.name)
        ),
      }
    }),
  audit: DESIGN_AUDIT,
})

// ─── The facets ───────────────────────────────────────────────────────────────

/** What one facet read varies on; everything else is common to the family. */
interface FacetSpec<I> {
  readonly name: string
  readonly suffix: string
  readonly toolDescription: string
  readonly properties?: Readonly<Record<string, unknown>>
  readonly openapi: Pick<
    AdminReadDefinition<I>['openapi'],
    'summary' | 'description' | 'operationIdBase' | 'querySchema'
  >
  readonly responseSchema: Schema.Top
  readonly responseDescription: string
  readonly subject: string
  readonly queryParams: ReadonlyArray<string>
  readonly decode: (raw: Readonly<Record<string, unknown>>) => AdminReadDecode<I>
  readonly build: (app: App, input: I) => unknown
}

/** One facet: a pure function of the live app, validated, unaudited. */
const facetRead = <I>(spec: FacetSpec<I>): AdminReadOperation =>
  defineAdminRead<I>({
    id: `design-system.${spec.name}`,
    method: 'get',
    path: `/api/admin/design-system/${spec.name}`,
    pathParams: [],
    queryParams: spec.queryParams,
    tool: {
      suffix: spec.suffix,
      description: `${spec.toolDescription}, as GET /api/admin/design-system/${spec.name} answers it (admin-only, read-only).`,
      inputSchema: { type: 'object', properties: spec.properties ?? {} },
    },
    openapi: {
      ...spec.openapi,
      responseSchema: spec.responseSchema,
      responseDescription: spec.responseDescription,
    },
    subject: spec.subject,
    decode: spec.decode,
    read: (app, input) =>
      Effect.sync(() => answerWithSchema(spec.responseSchema, spec.build(app, input))),
  })

const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

const tokens = facetRead({
  name: 'tokens',
  suffix: 'design_system_tokens',
  toolDescription:
    'The resolved design tokens of this app, each marked declared or inherited, optionally one group',
  properties: { group: stringArgument('Only this token group (color, font, shadow, …).') },
  openapi: {
    summary: "Read this operator's resolved design tokens, with counts",
    description:
      'The tokens the app ships, each declared or inherited, with a summary counting the ' +
      'rows this response carries. An unknown group returns zero rows. Admin only.',
    operationIdBase: 'getAdminDesignTokens',
    querySchema: designTokenQuerySchema,
  },
  responseSchema: designTokenFacetResponseSchema,
  responseDescription: 'The resolved tokens and counts',
  subject: 'the design token facet',
  queryParams: ['group'],
  decode: (raw) => decodeAdminReadQuery(designTokenQuerySchema, raw),
  build: (app, query) => designTokenFacet(app, query.group),
})

const guidance = facetRead({
  name: 'guidance',
  suffix: 'design_system_guidance',
  toolDescription:
    'The design guidance sentences the operator declared, split into instruction and reason, optionally one kind',
  properties: {
    kind: stringArgument('Only this declaration (principles, voice.prefer, voice.avoid, …).'),
    label: stringArgument('Only the guidance of this subject.'),
  },
  openapi: {
    summary: 'Read the design guidance the operator declared, split into two registers',
    description:
      'Every sentence the app declares, addressed by its config position and split into the ' +
      'instruction a reader obeys and the reason given for it. The set of kinds is closed, so ' +
      'an unknown `kind` is answered 400. Admin only.',
    operationIdBase: 'getAdminDesignGuidance',
    querySchema: guidanceQuerySchema,
  },
  responseSchema: guidanceListResponseSchema,
  responseDescription: 'The declared sentences',
  subject: 'the guidance listing',
  queryParams: ['kind', 'label'],
  decode: (raw) => decodeAdminReadQuery(guidanceQuerySchema, raw),
  build: (app, query) => guidanceFacet(app, query.kind, query.label),
})

const coverage = facetRead({
  name: 'coverage',
  suffix: 'design_system_coverage',
  toolDescription:
    'Which layers of the design system the operator declared and which run on defaults',
  properties: { key: stringArgument('Only this layer.') },
  openapi: {
    summary: 'Report which layers of the design system this operator authored',
    description:
      'One row per layer, saying whether the operator declared anything in it and how many ' +
      'entries it publishes, with the config path that would declare it. An unknown `key` ' +
      'returns zero rows rather than 404. Admin only.',
    operationIdBase: 'getAdminDesignCoverage',
    querySchema: designCoverageQuerySchema,
  },
  responseSchema: designCoverageResponseSchema,
  responseDescription: 'The declaration ledger',
  subject: 'the declaration ledger',
  queryParams: ['key'],
  decode: (raw) => decodeAdminReadQuery(designCoverageQuerySchema, raw),
  build: (app, query) => coverageFacet(app, query.key),
})

const exportsLedger = facetRead({
  name: 'exports',
  suffix: 'design_system_exports',
  toolDescription:
    'The size, line count and opening of each design system export, measured against what it serves',
  openapi: {
    summary: 'Measure each design-system export against the bytes it serves',
    description:
      'The byte length, line count and opening of each export, from the same builder. Admin only.',
    operationIdBase: 'getAdminDesignExports',
  },
  responseSchema: designSystemExportsResponseSchema,
  responseDescription: 'The measured exports',
  subject: 'the export ledger',
  queryParams: [],
  decode: noInput,
  build: (app) => exportsFacet(app),
})

const usage = facetRead({
  name: 'usage',
  suffix: 'design_system_usage',
  toolDescription:
    "Where a component type or template is written in this app's pages, nested ones included",
  properties: {
    subject: { type: 'string', enum: ['type', 'component'], description: 'Default type.' },
    name: stringArgument('Only this type or template.'),
  },
  openapi: {
    summary: "Report where a component type or template is written in the operator's pages",
    description:
      "Walks the operator's pages recursively and reports, per subject, how many routes write " +
      'it and which. A subject nobody writes is a row with zero routes. Admin only.',
    operationIdBase: 'getAdminDesignUsage',
    querySchema: usageQuerySchema,
  },
  responseSchema: usageResponseSchema,
  responseDescription: 'Usage over the operator’s pages',
  subject: 'the usage ledger',
  queryParams: ['subject', 'name'],
  decode: (raw) => decodeAdminReadQuery(usageQuerySchema, raw),
  build: (app, query) => usageFacet(app, query.subject ?? 'type', query.name),
})

const brand = facetRead({
  name: 'brand',
  suffix: 'design_system_brand',
  toolDescription: 'The declared logo of this app in its light and dark variants',
  openapi: {
    summary: 'Read the declared brand mark',
    description:
      'One row per declared logo variant, with its alt text and usage rules. Admin only.',
    operationIdBase: 'getAdminDesignBrand',
  },
  responseSchema: brandFacetResponseSchema,
  responseDescription: 'The brand facet',
  subject: 'the brand facet',
  queryParams: [],
  decode: noInput,
  build: (app) => brandFacet(app),
})

const zones = facetRead({
  name: 'zones',
  suffix: 'design_system_zones',
  toolDescription: 'Each declared route zone of this app with its accent budget',
  openapi: {
    summary: 'List the declared route zones',
    description: 'One row per declared zone, by route pattern, with its accent budget. Admin only.',
    operationIdBase: 'getAdminDesignZones',
  },
  responseSchema: designZonesResponseSchema,
  responseDescription: 'The zones listing',
  subject: 'the zones listing',
  queryParams: [],
  decode: noInput,
  build: (app) => zonesFacet(app),
})

const typeLadder = facetRead({
  name: 'type-ladder',
  suffix: 'design_system_type_ladder',
  toolDescription: 'The platform type scale steps, smallest first',
  openapi: {
    summary: 'List the platform type ladder',
    description:
      'What the platform text utilities resolve to, in ascending size order. A build ' +
      'constant: two instances on one build answer identically. Admin only.',
    operationIdBase: 'listAdminTypeLadder',
  },
  responseSchema: typeLadderResponseSchema,
  responseDescription: 'The platform type ladder',
  subject: 'the platform type ladder',
  queryParams: [],
  decode: noInput,
  build: () => typeLadderFacet(),
})

/** The design-system admin reads, in the order the registry lists them. */
export const DESIGN_SYSTEM_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  designSystemJson,
  designSystemMarkdown,
  tokens,
  guidance,
  coverage,
  exportsLedger,
  usage,
  brand,
  zones,
  typeLadder,
]
