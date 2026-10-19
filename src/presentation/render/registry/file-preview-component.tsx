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
 * a PDF opens in the browser's own viewer in a frame, a sound or a video in its
 * own player, each in a `file-preview-frame`, with a plain link to the file
 * below for a browser that cannot show it. Any other type is shadcn/ui's
 * outlined `Item`: a file icon, the name and the type, and a Download button.
 * Nothing here runs script: zoom opens the image whole in a native popover and
 * rotate is a checkbox the stage restyles on.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { cn } from '@/presentation/design/class-merge'
import { newTabName } from '@/presentation/design/new-tab-attributes'
import { omitInternalMarkers } from '@/presentation/render/props/internal-marker-props'
import { fileItem } from './file-preview-item'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
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
/** Every toolbar control is shadcn/ui's Button at its outline variant, small. */
const TOOL_CLASS = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/** The stage's own words, in the page language (`filePreview.*`, renamed under `sovrium.<key>`). */
type Words = Readonly<Record<Tool | 'toolbar' | 'newTab', string>>

const WORD_KEYS: readonly (keyof Words)[] = ['download', 'open', 'zoom', 'rotate', 'toolbar']

const wordsFor = (lang: string | undefined, languages: Languages | undefined): Words => ({
  ...(Object.fromEntries(
    WORD_KEYS.map((key) => [key, resolveInterpreterString(`filePreview.${key}`, lang, languages)])
  ) as Omit<Words, 'newTab'>),
  newTab: resolveInterpreterString('link.opensInNewTab', lang, languages),
})

/** A word with the file's name in its `{name}` slot. */
const naming = (template: string, name: string): string => template.split('{name}').join(name)

const isImage = (file: PreviewFile): boolean => file.type.startsWith('image/')
const isPdf = (file: PreviewFile): boolean => file.type === 'application/pdf'
const isAudio = (file: PreviewFile): boolean => file.type.startsWith('audio/')
const isVideo = (file: PreviewFile): boolean => file.type.startsWith('video/')

interface ToolContext {
  readonly file: PreviewFile
  readonly url: string
  readonly zoomId: string
  readonly words: Words
}

/** One toolbar control, in the order the author listed them. */
function tool(name: Tool, ctx: ToolContext): ReactElement | undefined {
  const { file, url, zoomId, words } = ctx
  if (name === 'download') {
    return (
      <a
        key={name}
        role="button"
        data-slot="button"
        href={url}
        download={file.name}
        className={TOOL_CLASS}
      >
        {words.download}
      </a>
    )
  }
  if (name === 'open') {
    return (
      <a
        key={name}
        role="button"
        data-slot="button"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        {...newTabName(words.open, words.newTab)}
        className={TOOL_CLASS}
      >
        {words.open}
      </a>
    )
  }
  if (!isImage(file)) return undefined
  return name === 'zoom' ? (
    <button
      key={name}
      type="button"
      data-slot="button"
      popoverTarget={zoomId}
      className={TOOL_CLASS}
    >
      {words.zoom}
    </button>
  ) : (
    <label
      key={name}
      data-slot="button"
      className={cn(TOOL_CLASS, 'cursor-pointer')}
    >
      <input
        type="checkbox"
        data-file-preview-rotate=""
        className="sr-only"
      />
      {words.rotate}
    </label>
  )
}

/** The file itself, as the stage draws it. */
function body(
  file: PreviewFile,
  ctx: {
    readonly url: string
    readonly frameUrl: string | undefined
    readonly alt: string
    readonly fit: string
  }
): ReactElement {
  if (isImage(file)) {
    return (
      <img
        src={ctx.url}
        alt={ctx.alt}
        loading="lazy"
        data-slot="image"
        className={cn(
          'mx-auto rounded-lg transition-transform group-has-[:checked]:rotate-90',
          ctx.fit === 'width' ? 'w-full' : 'max-h-full max-w-full object-contain'
        )}
      />
    )
  }
  // Sound and video play in the browser's own player, on the same signed address.
  if (isAudio(file)) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <audio
          src={ctx.url}
          controls
          preload="metadata"
          data-slot="audio"
          className="block w-full"
        />
      </div>
    )
  }
  if (isVideo(file)) {
    return (
      <video
        src={ctx.url}
        controls
        preload="metadata"
        data-slot="video"
        className="bg-muted h-full w-full"
      />
    )
  }
  // A PDF frames its INLINE address: the download one refuses to be framed.
  return (
    <iframe
      src={ctx.frameUrl ?? ctx.url}
      title={file.name}
      loading="lazy"
      className="h-full w-full border-0"
    />
  )
}

const canShow = (file: PreviewFile): boolean =>
  isImage(file) || isAudio(file) || isVideo(file) || isPdf(file)

/** The image at full size, in a native popover the Zoom button opens. */
function zoomPopover(id: string, url: string, alt: string): ReactElement {
  return (
    <div
      id={id}
      popover="auto"
      className="bg-background max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg border p-2"
    >
      <img
        src={url}
        alt={alt}
      />
    </div>
  )
}

/** A sound player is one control high: its frame hugs it unless the author set a height. */
const frameHeight = (file: PreviewFile, root: PreviewRoot): number | undefined =>
  isAudio(file) && root.height === undefined ? undefined : (root.height ?? DEFAULT_HEIGHT)

/**
 * A file the browser cannot show, in its named stage: the item always offers
 * the download, and Open joins it when the toolbar lists it.
 */
function itemStage(
  index: number,
  ctx: {
    readonly parts: Readonly<Record<string, string>>
    readonly listed: readonly Tool[]
    readonly toolCtx: ToolContext
  }
): ReactElement {
  const { parts, listed, toolCtx } = ctx
  const { file } = toolCtx
  const actions = (['download', 'open'] as const).filter(
    (name) => name === 'download' || listed.includes(name)
  )
  return (
    <section
      key={`${file.name}-${index}`}
      aria-label={file.name}
      data-file-preview-stage=""
      className={cn('flex flex-col gap-2', parts['stage'])}
    >
      {fileItem(
        file,
        actions.flatMap((name) => tool(name, toolCtx) ?? [])
      )}
    </section>
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
    readonly words: Words
  }
): ReactElement | undefined {
  const url = toSafeAssetUrl(file.url)
  if (url === undefined) return undefined
  const zoomId = `${ctx.hostId}-zoom-${index}`
  const alt = ctx.alt ?? file.name
  const toolCtx = { file, url, zoomId, words: ctx.words }
  const listed = ctx.root.toolbar ?? DEFAULT_TOOLBAR
  if (!canShow(file)) return itemStage(index, { parts: ctx.parts, listed, toolCtx })
  const tools = listed.flatMap((name) => tool(name, toolCtx) ?? [])
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
          aria-label={naming(ctx.words.toolbar, file.name)}
          className={cn('flex flex-wrap gap-2', ctx.parts['toolbar'])}
        >
          {tools}
        </div>
      )}
      <div
        data-slot="file-preview-frame"
        className="overflow-auto rounded-lg border"
        style={{ height: frameHeight(file, ctx.root) }}
      >
        {body(file, {
          url,
          frameUrl: file.frameUrl === undefined ? undefined : toSafeAssetUrl(file.frameUrl),
          alt,
          fit: ctx.root.fit ?? 'contain',
        })}
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
  currentLang,
  languages,
}) => {
  const root = (component ?? {}) as PreviewRoot
  const files = (rawProps?.['_previewFiles'] ?? []) as readonly PreviewFile[]
  const shown = root.list === 'none' ? files.slice(0, 1) : files
  const alt = nonEmpty(rawProps?.['_recordAlt'])
  const hostId = nonEmpty(elementProps['id']) ?? 'sv-file-preview'
  const parts = designStyles?.parts ?? {}
  const words = wordsFor(currentLang, languages)
  return (
    <div
      {...omitInternalMarkers(elementProps)}
      data-component-type="file-preview"
      data-slot="file-preview"
      className={cn('flex flex-col gap-4', elementProps['className'] as string | undefined)}
    >
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No file to preview.</p>
      ) : (
        shown.map((file, index) => stage(file, index, { root, alt, hostId, parts, words }))
      )}
    </div>
  )
}
