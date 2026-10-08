/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AssetStore, type AssetStoreShape } from '@/application/ports/services/asset-store'
import { StorageError, StorageService } from '@/application/ports/services/storage-service'
import {
  renderTemplatePreview,
  type TemplatePreview,
  type TemplatePreviewInput,
} from '@/application/use-cases/automations/template-preview'
import { SvgRasterizerLive } from '@/infrastructure/assets/svg-rasterizer-live'
import { DocumentRendererLive } from '@/infrastructure/export/document-renderer-live'
import { OfficeConverterLive } from '@/infrastructure/export/office-converter-live'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { TemplateEngineLive } from '@/infrastructure/templates/template-engine-live'

/**
 * The services a template preview runs on, OFFLINE: the template engine, the
 * renderers and the office engine the `RENDERER_*` / `OFFICE_*` variables
 * configure, and the assets the caller loaded — but no database and no
 * storage. A preview reads no stored file: a picture a value names from a
 * bucket fails it, saying so.
 */

const offline = Effect.fail(
  new StorageError({ cause: new Error('a preview reads no stored file; use a declared asset') })
)

/** Storage that holds nothing: a preview never reaches a bucket or a database. */
const OfflineStorage = Layer.succeed(StorageService, {
  upload: () => offline,
  download: () => offline,
  delete: () => offline,
  deleteUncataloguedBytes: () => offline,
  getSignedUrl: () => offline,
  getMetadata: () => offline,
  list: () => offline,
  getTotalBytes: offline,
})

const PreviewServices = Layer.mergeAll(
  TemplateEngineLive,
  DocumentRendererLive,
  SvgRasterizerLive,
  ImageTransformServiceLive,
  OfficeConverterLive,
  OfflineStorage
)

/** Render a preview with the offline services; a refusal or a render failure is its `message`. */
export const runTemplatePreview = (
  input: TemplatePreviewInput,
  assets: AssetStoreShape
): Promise<
  | { readonly ok: true; readonly preview: TemplatePreview }
  | { readonly ok: false; readonly message: string }
> =>
  Effect.runPromise(
    renderTemplatePreview(input).pipe(
      Effect.provideService(AssetStore, assets),
      Effect.provide(PreviewServices),
      Effect.match({
        onSuccess: (preview) => ({ ok: true, preview }) as const,
        onFailure: (error) =>
          ({
            ok: false,
            message:
              typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : String(error),
          }) as const,
      }),
      Effect.withSpan('cli.template-preview')
    )
  )
