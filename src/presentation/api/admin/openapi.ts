/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  configDeclarationsResponseSchema,
  configReflectionResponseSchema,
} from '@/domain/models/api/admin/config'
import {
  componentTypeDetailSchema,
  componentTypeListResponseSchema,
  provenanceQuerySchema,
  provenanceResponseSchema,
} from '@/domain/models/api/admin/design-system/component-types'
import {
  designCoverageQuerySchema,
  designCoverageResponseSchema,
  designSystemExportsResponseSchema,
  designTokenFacetResponseSchema,
  designTokenQuerySchema,
  guidanceListResponseSchema,
  guidanceQuerySchema,
  usageQuerySchema,
  usageResponseSchema,
  typeLadderResponseSchema,
} from '@/domain/models/api/admin/design-system/facets'
import { fieldTypeListResponseSchema } from '@/domain/models/api/admin/design-system/field-types'
import { instanceFactsResponseSchema } from '@/domain/models/api/admin/instance'
import { mcpToolsResponseSchema } from '@/domain/models/api/admin/mcp'
import { storageStatusResponseSchema } from '@/domain/models/api/admin/storage/status'
import { clearTransformCacheResponseSchema } from '@/domain/models/api/admin/storage/transform-cache'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

/** The `:type` segment of the per-type schema read. */
const componentTypeParam = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The component-type literal, exactly as an author writes it in config',
    examples: ['button', 'table'],
  }),
})

/** Admin read-endpoint group: storage status and the design-system schema reads. */
export const adminGroup: StaticGroupSpec = {
  tag: 'Admin',
  tagDescription: 'Administrative read endpoints: storage status and design-system schema reads',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/admin/storage/status',
      summary: 'Get storage status',
      description: 'Returns the configured storage provider and its settings. Admin only.',
      operationIdBase: 'getAdminStorageStatus',
      responses: {
        200: effectJsonResponse(storageStatusResponseSchema, 'Storage status'),
        500: errorResponse('Failed to build storage status'),
      },
    },
    {
      method: 'delete',
      pathTemplate: '/api/admin/storage/transform-cache',
      summary: 'Clear the image transform cache',
      description:
        'Discards the derived image-transform variants. Stored originals are never ' +
        'touched — transforms are recomputed on demand from them, so the only effect ' +
        'is that the next request for each variant pays for a fresh transform. The ' +
        'operation is idempotent: clearing an already-empty cache succeeds and reports ' +
        'zero. Admin only.',
      operationIdBase: 'deleteAdminStorageTransformCache',
      responses: {
        // 200 is the ONLY declared code because the handler has no failure
        // path: it calls a synchronous cache primitive and returns its counts.
        // Admin gating happens upstream in `createApiRoutes`, so the 401/404
        // it produces belong to that middleware, not to this operation —
        // the sibling status route declares its codes on the same basis.
        200: effectJsonResponse(clearTransformCacheResponseSchema, 'Transform cache cleared'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/schema/component-types',
      summary: 'List every component type the engine can draw',
      description:
        'Returns the whole component-type catalogue in the shared `{ items, total }` rows ' +
        'envelope. A type the console refuses to DRAW is listed all the same, carrying its ' +
        'own reason: hiding it would read as "this type does not exist", which is false. ' +
        'Never paginated — the catalogue is bounded by the schema rather than by data. ' +
        'Admin only, and a non-admin caller is answered 404 rather than 403.',
      operationIdBase: 'listAdminComponentTypes',
      responses: {
        200: effectJsonResponse(componentTypeListResponseSchema, 'The component-type catalogue'),
        500: errorResponse('Failed to build the component-type catalogue'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/type-ladder',
      summary: 'List the platform type ladder',
      description:
        'Returns what Tailwind’s own `text-*` utilities resolve to, in ascending size order, each row carrying the utility class, its step name and its size and leading in CSS pixels. A BUILD CONSTANT — it takes no config and two instances on one build answer identically, which is what makes it safe to draw beside a disclosure saying the operator declared no type scale of their own. Admin only, and a non-admin caller is answered 404 rather than 403.',
      operationIdBase: 'listAdminTypeLadder',
      responses: {
        200: effectJsonResponse(typeLadderResponseSchema, 'The platform type ladder'),
        500: errorResponse('Failed to build the platform type ladder'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/schema/field-types',
      summary: 'List every table field type the schema registers',
      description:
        'Returns the whole FIELD-type catalogue in the shared `{ items, total }` rows envelope, ' +
        'in registry reading order, each row carrying its category, that category’s heading, and ' +
        'whether it is the first row of that category — the boundary a page needs to head each ' +
        'group once. Derived from the schema alone: it describes what a table MAY declare, never ' +
        'what this instance’s tables do. Never paginated. Admin only, and a non-admin caller is ' +
        'answered 404 rather than 403.',
      operationIdBase: 'listAdminFieldTypes',
      responses: {
        200: effectJsonResponse(fieldTypeListResponseSchema, 'The field-type catalogue'),
        500: errorResponse('Failed to build the field-type catalogue'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/schema/component-types/{type}',
      summary: "Read one component type's fields",
      description:
        'Returns the fields a type declares itself, the shared field modules it spreads, and ' +
        'its variant and size axes when it has them. A type the catalogue refuses to draw ' +
        'answers 404 indistinguishably from one that does not exist, so a caller cannot ' +
        'enumerate which types are withheld. Admin only.',
      operationIdBase: 'getAdminComponentType',
      parameters: effectParameters(componentTypeParam, 'path'),
      responses: {
        200: effectJsonResponse(componentTypeDetailSchema, "The type's fields"),
        404: errorResponse('No such component type, or one the catalogue does not draw'),
        500: errorResponse('Failed to build the component-type detail'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/provenance',
      summary: 'Report why a class is on one part of one component',
      description:
        'Resolves one part of one engine type against `design.components` and returns both ' +
        'the merged class list the renderer applies AND the same resolution layer by layer, ' +
        'in precedence order. Neither answers the other question: the merged string cannot ' +
        'say where a class came from, and the chain cannot say which of two conflicting ' +
        'declarations survived the merge. A layer contributing nothing is omitted. Admin only.',
      operationIdBase: 'getAdminClassProvenance',
      parameters: effectParameters(provenanceQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(provenanceResponseSchema, 'The resolved class provenance'),
        400: errorResponse('Malformed query'),
        500: errorResponse('Failed to build the class provenance chain'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/tokens',
      summary: "Read this operator's resolved design tokens, with counts",
      description:
        'Returns the tokens the app actually ships, each saying whether the operator declared ' +
        'it or inherited it, plus a `summary` counting the rows THIS response carries — filter ' +
        'included, so a headline and the table beneath it cannot disagree. `?group=` narrows to ' +
        'one group of the token document, plus `shadow`, which the elevation ramp is published ' +
        'under and which the document projection cannot carry. An unknown group returns zero ' +
        'rows rather than 404: a 404 would let a caller enumerate the groups by probing. ' +
        'Admin only.',
      operationIdBase: 'getAdminDesignTokens',
      parameters: effectParameters(designTokenQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(designTokenFacetResponseSchema, 'The resolved tokens and counts'),
        400: errorResponse('Malformed query'),
        500: errorResponse('Failed to build the design token facet'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/guidance',
      summary: 'Read the design guidance the operator declared, split into two registers',
      description:
        'Returns every sentence the app declares — principles, voice, colour roles, component ' +
        'templates and per-zone overrides — addressed by its config position and split into the ' +
        'instruction a reader obeys and the reason the same line gave for it. The split is ' +
        'quote-aware and runs server-side: rejoining the two halves with one space reproduces ' +
        'the declaration exactly. `reason` is ABSENT, never empty, for a one-sentence rule. ' +
        'Unlike a token group the set of kinds is CLOSED, so an unknown `kind` is answered 400 ' +
        'rather than with an empty table nobody investigates. Admin only.',
      operationIdBase: 'getAdminDesignGuidance',
      parameters: effectParameters(guidanceQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(guidanceListResponseSchema, 'The declared sentences'),
        400: errorResponse('Malformed query, or a kind that is not a declaration'),
        500: errorResponse('Failed to build the guidance listing'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/coverage',
      summary: 'Report which layers of the design system this operator authored',
      description:
        'One row per layer, saying whether the operator declared anything in it and how many ' +
        'entries it publishes. The two are NOT the same number: twelve colours ship whether or ' +
        'not anyone chose them, so a single figure would make an untouched palette read as a ' +
        'decision. Every row carries the config path that would declare the layer, whether it ' +
        'is declared or not. An unknown `key` returns zero rows rather than 404. Admin only.',
      operationIdBase: 'getAdminDesignCoverage',
      parameters: effectParameters(designCoverageQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(designCoverageResponseSchema, 'The declaration ledger'),
        400: errorResponse('Malformed query'),
        500: errorResponse('Failed to build the declaration ledger'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/exports',
      summary: 'Measure each design-system export against the bytes it serves',
      description:
        'Returns the byte length, line count and opening excerpt of each authorised ' +
        'serialization, taken from the SAME builder the download serves. A figure typed beside ' +
        'a download link is documentation that drifts silently — right for one app and wrong on ' +
        'every other instance, with nothing to ever say so. `bytes` is an integer rather than a ' +
        'rendered label: the unit convention belongs to the renderer. Only the markdown row ' +
        'claims `sections` — a JSON document has groups, not sections. Admin only.',
      operationIdBase: 'getAdminDesignExports',
      responses: {
        200: effectJsonResponse(designSystemExportsResponseSchema, 'The measured exports'),
        500: errorResponse('Failed to build the export ledger'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/design-system/usage',
      summary: "Report where a component type or template is written in the operator's pages",
      description:
        "Walks the operator's `pages[]` recursively and reports, per subject, how many routes " +
        'write it and which. The walk skips the open `props` bag whole, because it carries ' +
        'native HTML attributes whose values collide with type names — a `props.type: "button"` ' +
        'is an attribute, not a component. `?subject=component` asks the same question of a ' +
        'named `components[]` template instead; it defaults to `type`. A subject nobody writes ' +
        'is a row with zero routes rather than an absent row, so "unused" stays distinguishable ' +
        'from "not a type". Admin only.',
      operationIdBase: 'getAdminDesignUsage',
      parameters: effectParameters(usageQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(usageResponseSchema, 'Usage over the operator’s pages'),
        400: errorResponse('Malformed query'),
        500: errorResponse('Failed to build the usage ledger'),
      },
    },
    // ─── The four Developers reads ────────────────────────────────
    //
    // Each publishes the FACTS the three Developers console pages gate and
    // template on, never a string those pages would otherwise have composed.
    // Their query parameters are declared HERE as a literal array rather than
    // through `effectParameters`, because a query schema would be a new
    // definition in `src/domain/models/api/` — [internal ref]'s
    // surface. The published contract is identical either way; only the
    // authoring seam moves.
    {
      method: 'get',
      pathTemplate: '/api/admin/instance',
      summary: 'Read the facts the Developers docs pages compose themselves from',
      description:
        "Returns this instance's resolved public origin (BASE_URL, else the proxy/Host " +
        'headers, else the request URL), its declared `app.version`, the declared tables in ' +
        'DECLARATION order, and the flat counts every heading on the API and MCP pages gates ' +
        'on. `oauthApplicationType` is computed from the origin per RFC 8252 §7.3: a client ' +
        'registering an http loopback redirect URI must send `native`, and omitting the field ' +
        'defaults it to `web`, which the authorization server refuses. No rendered curl, no ' +
        'joined example list and no composed address crosses the wire — those are the ' +
        "console's own prose, and this endpoint is not its only reader. Admin only.",
      operationIdBase: 'getAdminInstance',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          required: false,
          description:
            'Cap the `tables` array. The counts stay whole: a capped `tableCount` would make ' +
            'a five-table app look like a four-table one. A malformed value is treated as ' +
            'absent rather than refused — this narrows a display list, so the honest ' +
            'degradation is showing everything.',
          schema: { type: 'integer', minimum: 1 },
        },
      ],
      responses: {
        200: effectJsonResponse(instanceFactsResponseSchema, 'The instance facts'),
        500: errorResponse('Failed to build the instance facts'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/mcp/tools',
      summary: 'List the MCP tools this configuration exposes to an AI',
      description:
        'One row per exposed tool, carrying the EXACT identifier the MCP server advertises ' +
        'over tools/list, the family it derives from, and its own one-line description — the ' +
        'same string an AI client receives, built by the shared builders the wire compiler ' +
        'calls. Nothing is exposed without an explicit `aiAccess` opt-in, so an empty array ' +
        'and a zero is the DEFAULT posture rather than an error. The category words a reader ' +
        "sees are the console's and stay in its config. Admin only.",
      operationIdBase: 'getAdminMcpTools',
      parameters: [
        {
          name: 'category',
          in: 'query',
          required: false,
          description:
            'Narrow to one family. `total` then counts the MATCHES rather than the ' +
            'catalogue. A value outside the three is refused 400 rather than silently ' +
            'answering with everything.',
          schema: { type: 'string', enum: ['table', 'action', 'automation'] },
        },
      ],
      responses: {
        200: effectJsonResponse(mcpToolsResponseSchema, 'The exposed tools'),
        400: errorResponse('A category outside the three families'),
        500: errorResponse('Failed to build the tools listing'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/config/reflection',
      summary: 'Read the serialized configuration and one flat count per declaration family',
      description:
        'Returns the REDACTED running configuration serialized with two-space indentation — ' +
        'what an operator pastes into a bug report or diffs against git by hand — plus one ' +
        'count per family, INCLUDING the families the config leaves empty. Redaction is ' +
        'server-side and is a condition of the authorisation (ADR-022 A1), not a quality ' +
        'concern: the payload is the boundary the browser, any intermediary proxy and the ' +
        'error tracker all see. Counts are flat rather than nested because a config gate ' +
        'names one field and has no path syntax. Admin only.',
      operationIdBase: 'getAdminConfigReflection',
      responses: {
        200: effectJsonResponse(configReflectionResponseSchema, 'The reflection record'),
        500: errorResponse('Failed to build the reflection record'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/admin/config/declarations',
      summary: 'Walk the declaration tree, optionally one family at a time',
      description:
        "One row per declaration, in the config's own order, carrying the operator's own " +
        'identifier (`path` before `name`, because a page is identified by the route an ' +
        "operator types) and its second level — a table's field names, an automation's " +
        "trigger type, a component's type. Going one level deeper than the family is what " +
        'makes this a reflection rather than a heading list. A family outside the seven is ' +
        'refused 400: answering an empty list would read as "this instance declares nothing", ' +
        'which is the one wrong answer a typo must not produce. Admin only.',
      operationIdBase: 'getAdminConfigDeclarations',
      parameters: [
        {
          name: 'family',
          in: 'query',
          required: false,
          description: 'Narrow to one config family. Omit for the whole tree.',
          schema: {
            type: 'string',
            enum: ['tables', 'pages', 'forms', 'automations', 'agents', 'buckets', 'connections'],
          },
        },
      ],
      responses: {
        200: effectJsonResponse(configDeclarationsResponseSchema, 'The declaration rows'),
        400: errorResponse('A family outside the seven the tree walks'),
        500: errorResponse('Failed to build the declaration rows'),
      },
    },
  ],
}
