/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_CARD_SLOT_ATTRIBUTES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardClasses,
  computeGalleryGridClasses,
} from '@/presentation/design/gallery-default-classes'
import { declaredGalleryPartClasses } from '@/presentation/design/gallery-part-class-resolution'
import { resolveWeekdayFields } from '@/presentation/render/props/resolve-weekday-fields'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import { islandLoadingLabel, islandUiStrings } from './island-loading-label'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'

/** The gallery island's props, the author's piece classes merged here, on the server. */
function extractGalleryProps(
  elementProps: Record<string, unknown>,
  tables: ComponentDispatchConfig['tables'],
  parts: Readonly<Record<string, string>> | undefined
): Record<string, unknown> {
  const tableName = (elementProps.dataSource as { readonly table?: unknown } | undefined)?.table
  const weekdays = resolveWeekdayFields(tables?.find((table) => table.name === tableName))
  return {
    ...(weekdays === undefined ? {} : { weekdays }),
    dataSource: elementProps.dataSource,
    gridColumns: elementProps.gridColumns,
    galleryCard: elementProps.galleryCard,
    emptyMessage: elementProps.emptyMessage,
    layout: elementProps.layout,
    featured: elementProps.featured,
    // The channel the gallery publishes the card a reader selects on.
    publishes: elementProps.publishes,
    ...declaredGalleryPartClasses(parts),
  }
}

/**
 * The record gallery, hosted by the island named after its type: `gallery`
 * (a grid, or a carousel track with `layout: carousel`), or `carousel`, the
 * same island with the track always on.
 */
const galleryRenderer =
  (type: 'gallery' | 'carousel'): ComponentRenderer =>
  ({ elementProps, tables, designStyles, currentLang, languages }) => {
    const loading = islandLoadingLabel('gallery.loading', currentLang, languages)
    const islandProps = {
      ...extractGalleryProps(elementProps, tables, designStyles?.parts),
      uiStrings: islandUiStrings('gallery', currentLang, languages),
    }
    // The ONE element naming the gallery; the grid writes `data-columns` onto it.
    const layout = typeof elementProps.layout === 'string' ? elementProps.layout : 'grid'
    return (
      <div
        data-island={type}
        data-island-props={JSON.stringify(islandProps)}
        {...namedHost(type, { 'data-layout': layout, 'data-gallery-layout': layout })}
        data-testid={elementProps['data-testid'] as string | undefined}
        className={hostClassName(elementProps)}
      >
        {/* Loading skeleton — preserved as Suspense fallback.

            Grid and card chrome come from the SAME recipes the hydrated island
            uses (`gallery-default-classes.ts`), so the cards do not re-draw at
            hydration: only the pulsing bars are replaced, inside boxes whose
            border, radius, fill and gutter never move. */}
        <div
          className={`${computeGalleryGridClasses()} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}
          data-loading-status=""
          aria-label={loading.status}
          role="status"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`gallery-skeleton-${String(i)}`}
              {...GALLERY_CARD_SLOT_ATTRIBUTES}
              className={computeGalleryCardClasses()}
            >
              <div
                data-slot="skeleton"
                className={`bg-muted w-full animate-pulse ${GALLERY_COVER_FALLBACK_HEIGHT_CLASS}`}
              />
              <div className={GALLERY_CARD_BODY_CLASSES}>
                <div
                  data-slot="skeleton"
                  className="bg-muted h-4 w-3/4 animate-pulse rounded-md"
                />
                <div
                  data-slot="skeleton"
                  className="bg-muted h-3 w-1/2 animate-pulse rounded-md"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

/** The gallery family's renderers, keyed by type, for the data registry. */
export const galleryComponents = {
  gallery: galleryRenderer('gallery'),
  carousel: (context) =>
    galleryRenderer('carousel')({
      ...context,
      elementProps: { ...context.elementProps, layout: 'carousel' },
    }),
} as const satisfies Readonly<Record<string, ComponentRenderer>>
