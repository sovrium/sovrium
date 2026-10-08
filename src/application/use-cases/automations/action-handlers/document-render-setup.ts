/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import { resolveAssetKind } from '@/domain/models/app/assets/asset'
import { resolveTemplateLanguage } from '@/domain/models/app/languages/template-language-service'
import type {
  DocumentRenderOptions,
  DocumentTarget,
} from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'

/**
 * What a document template renders with beyond its data: what it renders
 * into, the language of the step (`locale`), and the partials the config
 * declares (`partial` assets, by their path without the extension).
 */

export type DocumentRenderSetup = Omit<DocumentRenderOptions, 'mode' | 'trust'>

const withoutExtension = (path: string): string => path.replace(/\.[^./]+$/, '')

/** Every declared `partial` asset, by name. Never read from a bucket. */
export const declaredPartials: Effect.Effect<(app: App) => Readonly<Record<string, string>>> =
  Effect.gen(function* () {
    const store = yield* AssetStore
    const decoder = new TextDecoder()
    return (app: App) =>
      Object.fromEntries(
        (app.assets ?? []).flatMap((entry) => {
          const asset = resolveAssetKind(entry) === 'partial' ? store.get(entry.path) : undefined
          return asset === undefined
            ? []
            : [[withoutExtension(entry.path), decoder.decode(asset.bytes)] as const]
        })
      )
  }).pipe(Effect.withSpan('automations.document-declared-partials'))

/** The setup of one render of `target`, in the language `locale` names (else the default). */
export const documentRenderSetup = (
  app: App,
  locale: unknown,
  target: DocumentTarget
): Effect.Effect<DocumentRenderSetup> =>
  Effect.gen(function* () {
    const partials = (yield* declaredPartials)(app)
    const language = resolveTemplateLanguage(
      app.languages,
      typeof locale === 'string' ? locale : undefined
    )
    return {
      target,
      partials,
      ...(language === undefined ? {} : { locale: language.locale, translate: language.translate }),
    }
  }).pipe(Effect.withSpan('automations.document-render-setup'))
