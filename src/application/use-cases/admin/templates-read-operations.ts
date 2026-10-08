/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Result, Schema } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  isRecord,
  type Raw,
} from '@/application/use-cases/automations/action-handlers/document-run'
import { renderTemplateTextPreview } from '@/application/use-cases/automations/template-preview'
import {
  adminTemplatePreviewResponseSchema,
  adminTemplatesResponseSchema,
} from '@/domain/models/api/admin/templates'
import { resolveAssetKind, type Asset } from '@/domain/models/app/assets/asset'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

/**
 * The console's two read-only template reads: the template assets the config
 * declares, and one of them rendered with its `sampleData` — the same engine,
 * escaping and sanitizer as a run. A preview is a RENDER, never the raw file.
 */

const LISTED_KINDS: ReadonlySet<string> = new Set([
  'html',
  'svg',
  'partial',
  'text',
  'docx',
  'xlsx',
  'pptx',
])

const templateAssets = (app: App): ReadonlyArray<Asset> =>
  (app.assets ?? []).filter((entry) => LISTED_KINDS.has(resolveAssetKind(entry) ?? ''))

/** Every step anywhere under `value`, with its automation's name. */
const stepsOf = (automation: string, value: unknown): ReadonlyArray<readonly [string, Raw]> => {
  if (Array.isArray(value)) return value.flatMap((item) => stepsOf(automation, item))
  if (!isRecord(value)) return []
  const own =
    typeof value['type'] === 'string'
      ? [[`${automation}.${String(value['name'] ?? value['type'])}`, value] as const]
      : []
  return [...own, ...Object.values(value).flatMap((child) => stepsOf(automation, child))]
}

const everyStep = (app: App): ReadonlyArray<readonly [string, Raw]> =>
  (app.automations ?? []).flatMap((automation) => stepsOf(automation.name, automation.actions))

/** Whether a step reads the asset at `path` as one of its templates. */
const readsAsset = (step: Raw, path: string): boolean => {
  const props = isRecord(step['props']) ? step['props'] : {}
  return Object.values(props).some((value) => isRecord(value) && value['asset'] === path)
}

const usedBy = (app: App, path: string): ReadonlyArray<string> =>
  everyStep(app)
    .filter(([, step]) => readsAsset(step, path))
    .map(([name]) => name)

/** Whether an `email/send` step reads the template: then it previews as delivered. */
const readByEmail = (app: App, path: string): boolean =>
  everyStep(app).some(
    ([, step]) => step['type'] === 'email' && step['operator'] === 'send' && readsAsset(step, path)
  )

const templatesList = defineAdminRead<undefined>({
  id: 'templates.list',
  method: 'get',
  path: '/api/admin/templates',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'templates_list',
    description:
      'The template assets the app declares — path, kind, description, whether it carries sample data, and the automation steps that read it — as GET /api/admin/templates answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the template assets of the app',
    description:
      'Every template asset the config declares (html, svg, partial, text, docx, xlsx, pptx), in declaration order, with the automation steps that read it. Fonts, images and data files are not templates and are not listed. Read-only; admin only.',
    operationIdBase: 'listAdminTemplates',
    responseSchema: adminTemplatesResponseSchema,
    responseDescription: 'The template assets',
  },
  subject: 'templates list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: (app) =>
    Effect.succeed(
      answerWithSchema(adminTemplatesResponseSchema, {
        templates: templateAssets(app).map((entry) => ({
          path: entry.path,
          kind: resolveAssetKind(entry),
          ...(entry.description === undefined ? {} : { description: entry.description }),
          hasSampleData: entry.sampleData !== undefined,
          usedBy: usedBy(app, entry.path),
        })),
      })
    ),
})

/** The `?path=` of a declared template asset, or not found (never which assets exist). */
const decodePath = (raw: Raw, app: App): AdminReadDecode<Asset> => {
  const { path } = raw
  const entry = templateAssets(app).find((candidate) => candidate.path === path)
  return entry === undefined ? { _tag: 'NotFound' } : { _tag: 'Ok', input: entry }
}

/** The sample values a preview renders with: written in the config, or read from the data asset. */
const sampleOf = (entry: Asset) =>
  Effect.gen(function* () {
    if (isRecord(entry.sampleData)) return entry.sampleData
    const path = entry.sampleData
    const asset = typeof path === 'string' ? (yield* AssetStore).get(path) : undefined
    if (asset === undefined || path === undefined) return {}
    const text = new TextDecoder().decode(asset.bytes)
    // `validate` and the boot refuse a sample file that does not parse, so a preview of the
    // running config never meets one; an empty preview is the honest fallback.
    const parsed = Result.try({
      try: (): unknown => (/\.ya?ml$/i.test(path) ? Bun.YAML.parse(text) : JSON.parse(text)),
      catch: () => undefined,
    })
    return Result.isSuccess(parsed) && isRecord(parsed.success) ? parsed.success : {}
  })

const RENDERS_AS: Readonly<Record<string, 'html' | 'svg' | 'text' | 'none'>> = {
  html: 'html',
  svg: 'svg',
  partial: 'text',
  text: 'text',
  docx: 'none',
  xlsx: 'none',
  pptx: 'none',
}

const templatePreview = defineAdminRead<Asset>({
  id: 'templates.preview.read',
  method: 'get',
  path: '/api/admin/templates/preview',
  pathParams: [],
  queryParams: ['path'],
  tool: {
    suffix: 'template_preview_read',
    description:
      'One template asset rendered with its sample data, exactly as an automation would render it — an email template as email/send delivers it — as GET /api/admin/templates/preview answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'The asset path, as declared.' } },
      required: ['path'],
    },
  },
  openapi: {
    summary: 'Preview one template asset with its sample data',
    description:
      'Renders the template with its sampleData through the engine automations use — the same escaping and sanitizer — and returns the result for display in a sandboxed frame. A Word, Excel or PowerPoint template renders to a file: rendersAs is none, with no content. The raw asset is never returned. Read-only; admin only.',
    operationIdBase: 'getAdminTemplatePreview',
    querySchema: Schema.Struct({
      path: Schema.String.annotate({ description: 'The asset path of the template, as declared' }),
    }),
    refusesQuery: false,
    responseSchema: adminTemplatePreviewResponseSchema,
    responseDescription: 'The rendered template',
  },
  subject: 'template preview',
  decode: decodePath,
  read: (app, entry) =>
    Effect.gen(function* () {
      const kind = resolveAssetKind(entry) ?? 'text'
      const email = kind === 'html' && readByEmail(app, entry.path)
      const rendersAs = email ? 'email' : (RENDERS_AS[kind] ?? 'none')
      const content =
        rendersAs === 'none'
          ? undefined
          : yield* renderTemplateTextPreview({
              app,
              path: entry.path,
              data: yield* sampleOf(entry),
              email,
            }).pipe(
              Effect.tapCause((cause) =>
                Effect.sync(() => {
                  logError(`[admin] template preview of "${entry.path}" failed`, cause)
                })
              ),
              // effect-swallow: logged with its cause above; the console shows the
              // failure as the preview text rather than failing the whole read.
              Effect.catch((error) => Effect.succeed(`Preview failed: ${error.message}`))
            )
      return answerWithSchema(adminTemplatePreviewResponseSchema, {
        path: entry.path,
        rendersAs,
        ...(content === undefined ? {} : { content }),
        usedSampleData: entry.sampleData !== undefined,
      })
    }),
})

export const TEMPLATES_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  templatesList,
  templatePreview,
]
