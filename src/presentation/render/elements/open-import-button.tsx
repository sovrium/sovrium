/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveInterpreterStringOverrides } from '@/domain/models/app/languages/translation-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'

/**
 * An `openImport` button: the import island's host, holding the button drawn
 * disabled until the island mounts — a press before then would have no dialog
 * to open.
 *
 * The host is `display: contents`, so the button keeps its place in the row it
 * was authored in. The fields the dialog maps a CSV onto were stamped under
 * `props._import` by the render-time gate, which also left the button out for
 * a reader who may not create in the table. The dialog's words follow `lang`
 * (`csvImport.*`), sent only where they differ from English.
 */
export function renderOpenImportButton(
  table: string,
  props: ElementProps,
  label: string | undefined,
  lang?: { readonly currentLang?: string; readonly languages?: Languages }
): ReactElement {
  const words = resolveInterpreterStringOverrides(
    ['csvImport.'],
    lang?.currentLang,
    lang?.languages
  )
  const fields = (props as { readonly _import?: unknown })._import
  // A button names itself by its content, or by the `label` a config (a library
  // block, say) wrote instead — read here, never forwarded as an attribute.
  const {
    label: declared,
    'data-label': dataLabel,
    ...buttonProps
  } = omitInternalMarkers(props) as Record<string, unknown>
  const name = label ?? [declared, dataLabel].find((value) => typeof value === 'string')
  const islandProps = {
    table,
    label: name ?? '',
    buttonProps,
    ...(typeof fields === 'object' && fields !== null ? fields : {}),
    ...(words !== undefined && { uiStrings: words }),
  }
  return (
    <div
      className="contents"
      data-island="open-import"
      data-island-props={JSON.stringify(islandProps)}
    >
      <button
        type="button"
        {...buttonProps}
        // Disabled until the island replaces it — not `data-awaits-script`,
        // which the client runtime re-enables before this island has mounted.
        disabled
      >
        {name}
      </button>
    </div>
  )
}
