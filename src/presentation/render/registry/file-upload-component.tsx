/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `file-upload` SSR renderer: the plain picker, or the island placeholder the
 * drop zone and the uploading button hydrate from.
 *
 * `accept`, `maxFiles`, `dropZone`, `maxFileSize` and `disabled` are top-level
 * schema fields (siblings of `props`), read like the form-control islands'
 * (`pickCompField`); the `fileUpload.*` words serve both variants. A control
 * that uploads to a declared bucket and states no rule takes the bucket's, and
 * its drop zone names the types in words — see `resolveFileUploadLimits`. A
 * `compact` upload states those types and its cap on a line just after it.
 */

import { FileUploadCompactHint } from '@/presentation/design/file-upload-compact-hint'
import {
  fileUploadCompactHintId,
  fileUploadDropzoneHint,
} from '@/presentation/design/file-upload-default-classes'
import { UploadGlyph } from '@/presentation/design/form-glyphs'
import * as Renderers from '../elements'
import { resolveFileUploadLimits } from '../props/resolve-file-upload-limits'
import { localizeChildLabel, resolveInterpreterStringOverrides } from './island-child-label'
import { pickCompField, resolveUploadActionUrl } from './island-overlay-props-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

export const fileUploadComponent: ComponentRenderer = ({
  elementProps,
  component,
  rawProps,
  currentLang,
  languages,
  buckets,
}) => {
  const uiStrings = resolveInterpreterStringOverrides(['fileUpload.'], currentLang, languages)
  const c = (component ?? {}) as Record<string, unknown>
  const maxFiles = pickCompField<number>(c, rawProps, 'maxFiles')
  const dropZone = pickCompField<boolean>(c, rawProps, 'dropZone')
  const compact = pickCompField<boolean>(c, rawProps, 'compact')
  const disabled = rawProps?.['disabled'] as boolean | undefined
  // `rawProps` is the props bag BEFORE transformation, so a `$t:` key in the
  // trigger's label arrives unresolved — the seam `localizeChildLabel`
  // already exists for on a tab's caption. An ABSENT label stays absent, so
  // the island keeps choosing its own built-in text rather than an empty one.
  const authoredLabel = rawProps?.['label'] as string | undefined
  const label =
    authoredLabel === undefined
      ? undefined
      : localizeChildLabel(authoredLabel, currentLang, languages)
  // Submission wiring (siblings of `props`): the upload destination + the onSuccess
  // effects / onError toast, run by the island on the response to its POST.
  const uploadActionUrl = resolveUploadActionUrl(pickCompField(c, rawProps, 'uploadAction'))
  const { accept, maxFileSize, acceptLabel } = resolveFileUploadLimits({
    accept: pickCompField<string>(c, rawProps, 'accept'),
    maxFileSize: pickCompField<number>(c, rawProps, 'maxFileSize'),
    uploadAction: uploadActionUrl,
    buckets,
    currentLang,
    languages,
  })
  const shared = { accept, maxFiles, dropZone, disabled, label }

  // Hydrate (emit the island marker) when `dropZone` is true (real-time size /
  // count validation) OR when an `uploadAction` is set (the button variant
  // must hydrate to POST the picked file + run its onSuccess/onError effects).
  // The SSR placeholder is the same plain skeleton; the island re-renders on
  // mount.
  if (dropZone === true || uploadActionUrl !== undefined) {
    const islandProps = {
      accept,
      acceptLabel,
      maxFiles,
      maxFileSize,
      dropZone,
      compact,
      disabled,
      label,
      uiStrings,
      uploadAction: uploadActionUrl,
      onSuccess: pickCompField(c, rawProps, 'onSuccess'),
      onError: pickCompField(c, rawProps, 'onError'),
      id: elementProps.id as string | undefined,
      className: elementProps.className as string | undefined,
      'data-testid': elementProps['data-testid'] as string | undefined,
    }
    // A compact trigger carries the upload icon, drawn here as the island draws it.
    const triggerIcon = compact === true ? <UploadGlyph size={16} /> : undefined
    const host = Renderers.renderFileUploadIsland({
      props: elementProps,
      islandProps,
      ...shared,
      triggerIcon,
    })
    return withCompactHint(host, compact === true, islandProps)
  }

  return Renderers.renderFileUpload({ props: elementProps, ...shared, uiStrings })
}

/**
 * A compact upload, followed by the line naming what it takes; any other upload,
 * or a compact one with no rule to state, as it is.
 */
const withCompactHint = (
  host: ReactElement,
  compact: boolean,
  islandProps: Parameters<typeof fileUploadDropzoneHint>[0] & {
    readonly id?: string
    readonly uiStrings?: Readonly<Record<string, string>>
  }
): ReactElement => {
  const hint = compact ? fileUploadDropzoneHint(islandProps, islandProps.uiStrings) : undefined
  if (hint === undefined) return host
  const id = islandProps.id === undefined ? undefined : fileUploadCompactHintId(islandProps.id)
  return (
    <>
      {host}
      <FileUploadCompactHint
        id={id}
        hint={hint}
      />
    </>
  )
}
