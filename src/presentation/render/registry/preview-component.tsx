/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `preview` — one component type, drawn with ONE option set to ONE value
 *.
 *
 * ─── WHAT IT IS FOR ────────────────────────────────────────────────────────
 *
 * A Configuration section has two halves. The first lists every option a type
 * accepts, straight from the schema — the table
 * `GET /api/admin/schema/component-types/:type/options` already serves. The
 * second is the half a reader learns from: beside `pagination.position: both`,
 * the picture of a grid with pagers top and bottom. This draws that picture.
 *
 * ─── THE DRAWING ARRIVES AS `renderedChildren` ─────────────────────────────
 *
 * `specimen-subject-resolver.ts` resolves the subject into the `component`
 * field, and `childrenToRender` routes that field through the ordinary child
 * pipeline — the SAME path a specimen's drawing takes. So the drawn thing is a
 * real component with the app's own design cascade on it, and a type that draws
 * in the kit draws here.
 *
 * ─── AND THE STAGE CARRIES `data-design-preview-subject` ───────────────────
 *
 * Its value is the RESOLVED type, which is what lets a routed preview prove it
 * drew the type the path named rather than merely drawing something.
 *
 * Deliberately NOT `data-design-specimen`. That attribute looks like the obvious
 * one and is not engine output at all: it is an authored prop the admin console
 * puts on a wrapper of its own (`apps/admin/config/pages/design-system/**`), so
 * a preview on an ordinary app page would carry it only if that page's author
 * wrote it — and this type's contract would then depend on one consumer's
 * config.
 *
 * It sits on the STAGE rather than on the drawing, so the element a reader
 * locates as "the preview of a badge" is one element whichever shape the
 * catalogue specimen happens to be — several of them compose — and the drawing
 * underneath it stays reachable as the stage's first descendant.
 *
 * Source: src/domain/models/app/pages/components/component-types/specialty/preview.ts
 * Specs: [internal ref]
 */

import {
  computePreviewCaptionClasses,
  computePreviewRootClasses,
  computePreviewStageClasses,
  computePreviewValueClasses,
} from '../../design/specialty-ssr-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Read one string field, when it is one. */
const text = (source: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The value as a reader would type it back into a config.
 *
 * A string prints bare rather than quoted: the readout sits above a drawing of
 * that value, and quotation marks would read as part of it.
 */
const printValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/**
 * The resolved subject, as three printable values.
 *
 * All three are absent together when the resolver reported the subject
 * undrawable — it strips `subject` along with the drawing — so the frame prints
 * no readout and stamps no type rather than half of one.
 */
const subjectOf = (
  source: Readonly<Record<string, unknown>>
): {
  readonly type: string | undefined
  readonly option: string | undefined
  readonly value: string | undefined
} => {
  const { subject } = source
  if (!isRecord(subject)) return { type: undefined, option: undefined, value: undefined }
  return {
    type: text(subject, 'type'),
    option: text(subject, 'option'),
    value: printValue(subject['value']),
  }
}

/**
 * `preview` — the readout, the drawing, and the caption.
 *
 * `showValue` defaults ON: a picture with no caption in a table of forty
 * options is a picture of nothing in particular. A Configuration row turns it
 * off, because its own left column already carries the path.
 *
 * `caption` emits NO element when none was declared. An empty caption box is a
 * row that reads as unfinished, which is a worse claim than saying nothing.
 */
export const previewComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  renderedChildren,
  component,
}) => {
  const source = (component ?? {}) as unknown as Readonly<Record<string, unknown>>
  const { type, option, value } = subjectOf(source)
  const caption = text(source, 'caption')
  const showValue = source['showValue'] !== false && option !== undefined && value !== undefined
  const { className: authorClassName, ...rest } = elementPropsWithSpacing

  return (
    <div
      {...rest}
      className={mergePrestyle(computePreviewRootClasses(), authorClassName as string | undefined)}
    >
      {showValue ? (
        <div
          data-design-preview-value=""
          className={computePreviewValueClasses()}
        >
          {`${option ?? ''}: ${value ?? ''}`}
        </div>
      ) : undefined}
      <div
        data-design-preview-subject={type}
        className={computePreviewStageClasses()}
      >
        {renderedChildren}
      </div>
      {caption === undefined ? undefined : (
        <p
          data-design-preview-caption=""
          className={computePreviewCaptionClasses()}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
