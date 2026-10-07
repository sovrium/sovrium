/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `file-preview` SSR renderer — a stored file shown in place.
 *
 * The files arrive resolved and signed (`_previewFiles`, set by
 * `file-preview-resolver.ts`), so this draws and decides nothing about access:
 * a preview the caller may not see reaches here with no file, and draws none.
 *
 * Each file sits in a bordered stage that is a region named by the file. An
 * image is drawn inline (its alternative text from `altField`, else its name);
 * a PDF opens in the browser's own viewer in a frame; any other type is a card
 * with its name. A plain link to the file is always there, for a browser that
 * cannot show it. Nothing here runs script: zoom opens the image whole in a
 * native popover and rotate is a checkbox the stage restyles on.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { cn } from '@/presentation/design/class-merge'
import { omitInternalMarkers } from '@/presentation/render/props/internal-marker-props'
import type { ComponentRenderer } from './component-dispatch-config'
import type { PreviewFile } from '@/presentation/render/resolve/file-preview-resolver'
import type { ReactElement } from 'react'

type Tool = 'download' | 'open' | 'zoom' | 'rotate'

interface PreviewRoot {
  readonly height?: number
  readonly fit?: 'contain' | 'width'
  readonly toolbar?: readonly Tool[]
  readonly list?: 'auto' | 'none'
}

const DEFAULT_HEIGHT = 560
const DEFAULT_TOOLBAR: readonly Tool[] = ['download', 'open']
const TOOL_CLASS =
  'inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted'

const isImage = (file: PreviewFile): boolean => file.type.startsWith('image/')
const isPdf = (file: PreviewFile): boolean => file.type === 'application/pdf'

/** One toolbar control, in the order the author listed them. */
function tool(
  name: Tool,
  ctx: { readonly file: PreviewFile; readonly url: string; readonly zoomId: string }
): ReactElement | undefined {
  const { file, url, zoomId } = ctx
  if (name === 'download') {
    return (
      <a
        key={name}
        role="button"
        href={url}
        download={file.name}
        className={TOOL_CLASS}
      >
        Download
      </a>
    )
  }
  if (name === 'open') {
    return (
      <a
        key={name}
        role="button"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={TOOL_CLASS}
      >
        Open
      </a>
    )
  }
  if (!isImage(file)) return undefined
  return name === 'zoom' ? (
    <button
      key={name}
      type="button"
      popoverTarget={zoomId}
      className={TOOL_CLASS}
    >
      Zoom
    </button>
  ) : (
    <label
      key={name}
      className={cn(TOOL_CLASS, 'cursor-pointer')}
    >
      <input
        type="checkbox"
        data-file-preview-rotate=""
        className="sr-only"
      />
      Rotate
    </label>
  )
}

/** The file itself, as the stage draws it. */
function body(
  file: PreviewFile,
  ctx: { readonly url: string; readonly alt: string; readonly fit: string }
): ReactElement {
  if (isImage(file)) {
    return (
      <img
        src={ctx.url}
        alt={ctx.alt}
        loading="lazy"
        className={cn(
          'mx-auto transition-transform group-has-[:checked]:rotate-90',
          ctx.fit === 'width' ? 'w-full' : 'max-h-full max-w-full object-contain'
        )}
      />
    )
  }
  if (isPdf(file)) {
    return (
      <iframe
        src={ctx.url}
        title={file.name}
        loading="lazy"
        className="h-full w-full border-0"
      />
    )
  }
  return (
    <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {`${file.name} cannot be shown here. Download it to open it.`}
    </p>
  )
}

/** The image at full size, in a native popover the Zoom button opens. */
function zoomPopover(id: string, url: string, alt: string): ReactElement {
  return (
    <div
      id={id}
      popover="auto"
      className="border-border bg-background max-h-[90vh] max-w-[90vw] overflow-auto rounded-md border p-2"
    >
      <img
        src={url}
        alt={alt}
      />
    </div>
  )
}

/** One file in its named stage, its toolbar above and its plain link below. */
function stage(
  file: PreviewFile,
  index: number,
  ctx: {
    readonly root: PreviewRoot
    readonly alt: string | undefined
    readonly hostId: string
    readonly parts: Readonly<Record<string, string>>
  }
): ReactElement | undefined {
  const url = toSafeAssetUrl(file.url)
  if (url === undefined) return undefined
  const zoomId = `${ctx.hostId}-zoom-${index}`
  const alt = ctx.alt ?? file.name
  const tools = (ctx.root.toolbar ?? DEFAULT_TOOLBAR).flatMap((name) => {
    const control = tool(name, { file, url, zoomId })
    return control === undefined ? [] : [control]
  })
  return (
    <section
      key={`${file.name}-${index}`}
      aria-label={file.name}
      data-file-preview-stage=""
      className={cn('group flex flex-col gap-2', ctx.parts['stage'])}
    >
      {tools.length > 0 && (
        <div
          role="toolbar"
          aria-label={`${file.name} tools`}
          className={cn('flex flex-wrap gap-2', ctx.parts['toolbar'])}
        >
          {tools}
        </div>
      )}
      <div
        className="border-border bg-muted/40 overflow-auto rounded-md border"
        style={{ height: ctx.root.height ?? DEFAULT_HEIGHT }}
      >
        {body(file, { url, alt, fit: ctx.root.fit ?? 'contain' })}
      </div>
      <a
        href={url}
        className="text-muted-foreground font-mono text-xs underline"
      >
        {file.name}
      </a>
      {isImage(file) && zoomPopover(zoomId, url, alt)}
    </section>
  )
}

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

export const filePreviewComponent: ComponentRenderer = ({
  component,
  rawProps,
  elementProps,
  designStyles,
}) => {
  const root = (component ?? {}) as PreviewRoot
  const files = (rawProps?.['_previewFiles'] ?? []) as readonly PreviewFile[]
  const shown = root.list === 'none' ? files.slice(0, 1) : files
  const alt = nonEmpty(rawProps?.['_recordAlt'])
  const hostId = nonEmpty(elementProps['id']) ?? 'sv-file-preview'
  const parts = designStyles?.parts ?? {}
  return (
    <div
      {...omitInternalMarkers(elementProps)}
      data-component-type="file-preview"
      className={cn('flex flex-col gap-4', elementProps['className'] as string | undefined)}
    >
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No file to preview.</p>
      ) : (
        shown.map((file, index) => stage(file, index, { root, alt, hostId, parts }))
      )}
    </div>
  )
}
