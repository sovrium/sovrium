/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeAttachmentClasses,
  computeAttachmentContentClasses,
  computeAttachmentDescriptionClasses,
  computeAttachmentMediaClasses,
  computeAttachmentTitleClasses,
  computeAttachmentTriggerClasses,
  type AttachmentOrientation,
  type AttachmentSize,
} from '../../design/attachment-default-classes'
import { resolveLucideIcon } from '../elements/lucide-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** The Lucide icon a file extension suggests, when the author named none. */
const ICON_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'file-text',
  doc: 'file-text',
  docx: 'file-text',
  txt: 'file-text',
  md: 'file-text',
  csv: 'file-spreadsheet',
  xls: 'file-spreadsheet',
  xlsx: 'file-spreadsheet',
  ods: 'file-spreadsheet',
  png: 'file-image',
  jpg: 'file-image',
  jpeg: 'file-image',
  gif: 'file-image',
  webp: 'file-image',
  avif: 'file-image',
  svg: 'file-image',
  zip: 'file-archive',
  mp3: 'file-audio',
  wav: 'file-audio',
  mp4: 'file-video',
  mov: 'file-video',
}

const iconNameOf = (name: string, authored: unknown): string => {
  if (typeof authored === 'string' && authored.length > 0) return authored
  const extension = name.includes('.') ? (name.split('.').at(-1) ?? '').toLowerCase() : ''
  return ICON_BY_EXTENSION[extension] ?? 'file'
}

const pick = <const T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** The icon or thumbnail tile. */
const renderMedia = (source: Readonly<Record<string, unknown>>, name: string): ReactElement => {
  if (source['media'] === 'image' && typeof source['src'] === 'string') {
    return (
      <div
        data-slot="attachment-media"
        data-variant="image"
        className={computeAttachmentMediaClasses('image')}
      >
        <img
          src={source['src']}
          alt=""
          loading="lazy"
        />
      </div>
    )
  }
  const Icon = resolveLucideIcon(iconNameOf(name, source['icon'])) ?? resolveLucideIcon('file')
  return (
    <div
      data-slot="attachment-media"
      data-variant="icon"
      className={computeAttachmentMediaClasses('icon')}
    >
      {Icon === undefined ? undefined : <Icon aria-hidden="true" />}
    </div>
  )
}

/**
 * `attachment` — a file as a chip (`data-slot="attachment"`). A file in state
 * `done` with an `href` carries a transparent link over the whole chip, named
 * after the file; any other state is drawn and never linked.
 *
 * Source: src/domain/models/app/pages/components/component-types/content/attachment.ts
 */
const attachmentComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const name = typeof source['name'] === 'string' ? source['name'] : ''
  const state = pick(source['state'], ['idle', 'uploading', 'processing', 'error', 'done'], 'done')
  const size: AttachmentSize = pick(source['size'], ['default', 'sm', 'xs'], 'default')
  const orientation: AttachmentOrientation = pick(
    source['orientation'],
    ['horizontal', 'vertical'],
    'horizontal'
  )
  const href = state === 'done' && typeof source['href'] === 'string' ? source['href'] : undefined
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  return (
    <div
      {...rest}
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={mergePrestyle(
        computeAttachmentClasses(size, orientation),
        authorClassName as string | undefined
      )}
    >
      {renderMedia(source, name)}
      <div
        data-slot="attachment-content"
        className={computeAttachmentContentClasses()}
      >
        <span
          data-slot="attachment-title"
          className={computeAttachmentTitleClasses()}
        >
          {name}
        </span>
        {typeof source['description'] === 'string' ? (
          <span
            data-slot="attachment-description"
            className={computeAttachmentDescriptionClasses()}
          >
            {source['description']}
          </span>
        ) : undefined}
      </div>
      {href === undefined ? undefined : (
        <a
          href={href}
          aria-label={name}
          data-slot="attachment-trigger"
          className={computeAttachmentTriggerClasses()}
        />
      )}
    </div>
  )
}

/** The attachment renderer, keyed by type. */
export const attachmentComponents = {
  attachment: attachmentComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
