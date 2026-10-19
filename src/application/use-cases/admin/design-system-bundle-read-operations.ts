/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The portable design-system bundle, read file by file ([internal ref] A11): its
 * manifest, one TEXT file of it, and its theme stylesheet. Each entry is the
 * admin route, the MCP admin tool and the OpenAPI operation at once.
 *
 * ─── WHOLE DOWNLOADS ARE AUDITED, A FILE READ IS NOT ───────────────────────
 *
 * The manifest read, the stylesheet read and the zip each write the design
 * read event naming the caller, as the two exports do: each is the design
 * system handed over whole (the manifest names and checksums every file). The
 * per-file read writes none. An assistant reading the bundle file by file
 * reads the manifest first, so that one event already records the hand-over,
 * and an event per file would bury it under dozens of identical rows.
 *
 * The bundle as ONE zip is not here: it is binary, so it has no tool, and it
 * is classified as an archive in `admin-read-registry.ts` whose MCP equivalent
 * is the first two reads below. Its route is `design-system-bundle-routes.ts`.
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
import { EmitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  buildDesignSystemBundle,
  buildDesignSystemThemeStylesheet,
  bundleTextFile,
  zipDesignSystemBundle,
} from '@/application/use-cases/admin/design-system-bundle'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  designSystemBundleFileQuerySchema,
  designSystemBundleManifestSchema,
  designSystemDocumentSchema,
} from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** The design read event, naming the caller — the same event the two exports write. */
const DESIGN_AUDIT = {
  action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
  resourceId: (_app: App, _input: unknown, request: { readonly actorUserId: string }) =>
    request.actorUserId,
}

/** A bundle that failed its own token schema answers as a schema failure, never partially. */
const bundleOutcome = <A>(
  app: App,
  answer: (bundle: Effect.Success<ReturnType<typeof buildDesignSystemBundle>>) => A
) =>
  buildDesignSystemBundle(app).pipe(
    Effect.map(answer),
    Effect.catchTag('DesignSystemBundleError', (error) =>
      Effect.succeed<AdminReadOutcome>({ _tag: 'ValidationFailed', error: error.cause })
    )
  )

const designSystemBundle = defineAdminRead<undefined>({
  id: 'design-system.bundle',
  method: 'get',
  path: '/api/admin/design-system/bundle',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'design_system_bundle',
    description:
      'The manifest of the portable design-system bundle — every file with its size, SHA-256 and role — exactly the manifest.json inside GET /api/admin/design-system.zip (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the design-system bundle manifest',
    description:
      'The manifest.json of the portable design-system bundle: its format, the colour modes it ' +
      'carries, and every file with its size, SHA-256 and role. The same manifest the zip holds. ' +
      'Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'getAdminDesignSystemBundle',
    responseSchema: designSystemBundleManifestSchema,
    responseDescription: 'The bundle manifest',
  },
  subject: 'design system bundle',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: (app) =>
    bundleOutcome(app, (bundle) =>
      answerWithSchema(designSystemBundleManifestSchema, bundle.manifest)
    ),
  audit: DESIGN_AUDIT,
})

const designSystemBundleFile = defineAdminRead<{ readonly path: string }>({
  id: 'design-system.bundle-file',
  method: 'get',
  path: '/api/admin/design-system/bundle/file',
  pathParams: [],
  queryParams: ['path'],
  tool: {
    suffix: 'design_system_bundle_file',
    description:
      'One text file of the portable design-system bundle, byte for byte, by the path its manifest lists (admin-only, read-only, not audited: the manifest read is). Fonts and other binary files are only in the zip; a binary, unlisted or climbing path is not found.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The bundle-relative path of one text file, as the manifest lists it.',
        },
      },
      required: ['path'],
    },
  },
  openapi: {
    summary: 'Read one text file of the design-system bundle',
    description:
      'One text file of the portable design-system bundle, byte for byte, with its own media ' +
      'type. A binary file, a path the manifest does not list, and a path climbing out of the ' +
      'bundle are the same 404. Writes no audit event: the manifest read that lists the file ' +
      'writes it. Admin only.',
    operationIdBase: 'getAdminDesignSystemBundleFile',
    querySchema: designSystemBundleFileQuerySchema,
    responseSchema: designSystemDocumentSchema,
    responseContentType: 'text/plain; charset=utf-8',
    responseDescription: 'The file, as its manifest media type',
  },
  subject: 'design system bundle file',
  decode: (raw) => decodeAdminReadQuery(designSystemBundleFileQuerySchema, raw),
  read: (app, { path }) =>
    bundleOutcome(app, (bundle): AdminReadOutcome => {
      const file = bundleTextFile(bundle, path)
      if (file === undefined) return { _tag: 'NotFound' }
      return {
        _tag: 'Ok',
        body: adminReadText(
          `${file.mediaType}; charset=utf-8`,
          new TextDecoder().decode(file.bytes)
        ),
      }
    }),
  // No `audit`: a file read is part of a hand-over the manifest read records.
})

const designSystemCss = defineAdminRead<undefined>({
  id: 'design-system.css',
  method: 'get',
  path: '/api/admin/design-system.css',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'design_system_css',
    description:
      'The theme stylesheet of this app in shadcn/ui variable names — light under :root, dark under .dark — byte for byte what GET /api/admin/design-system.css answers (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Export the design system as a theme stylesheet',
    description:
      'The colour and radius tokens as CSS variables in shadcn/ui names: the light palette under ' +
      '`:root`, the dark one under `.dark`. The `css/theme.css` of the bundle, byte for byte. ' +
      'Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'getAdminDesignSystemCss',
    responseSchema: designSystemDocumentSchema,
    responseContentType: 'text/css; charset=utf-8',
    responseDescription: 'The theme stylesheet',
  },
  subject: 'design system stylesheet',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: (app) =>
    buildDesignSystemThemeStylesheet(app).pipe(
      Effect.map((css): AdminReadOutcome => ({
        _tag: 'Ok',
        body: adminReadText('text/css; charset=utf-8', css),
      })),
      Effect.catchTag('DesignSystemBundleError', (error) =>
        Effect.succeed<AdminReadOutcome>({ _tag: 'ValidationFailed', error: error.cause })
      )
    ),
  audit: DESIGN_AUDIT,
})

/** The three bundle reads, in the order the registry lists them. */
export const DESIGN_SYSTEM_BUNDLE_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  designSystemBundle,
  designSystemBundleFile,
  designSystemCss,
]

/**
 * The bundle as one zip, for `GET /api/admin/design-system.zip`, writing the
 * same design read event the reads above write. Not a registry entry: the zip
 * is binary, so it is an archive (see the module docblock).
 */
export const downloadDesignSystemBundle = Effect.fn('design-system.bundle-download')(function* (
  app: App,
  actorUserId: string
) {
  const bundle = yield* buildDesignSystemBundle(app)
  const actor = yield* resolveActor(actorUserId)
  yield* EmitAuditEvent({
    action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
    actor,
    resourceId: actorUserId,
    severity: 'info',
    result: 'success',
    transport: 'api',
  })
  return zipDesignSystemBundle(bundle)
})

/**
 * The bundle as one zip for an anonymous share reader. The share itself is
 * resolved by the caller; this writes no event, as the reader page writes none.
 */
export const sharedDesignSystemBundle = (app: App) =>
  Effect.map(buildDesignSystemBundle(app), zipDesignSystemBundle).pipe(
    Effect.withSpan('design-system.bundle-shared')
  )
