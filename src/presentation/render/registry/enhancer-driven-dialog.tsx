/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeDialogCloseClasses,
  computeDialogFooterClasses,
  computeDialogDescriptionClasses,
  computeDialogHeaderClasses,
  computeDialogTitleClasses,
  computeStaticDialogContentClasses,
  computeStaticDialogOverlayClasses,
} from '@/presentation/design/dialog-default-classes'
import { OverlayCloseGlyph } from '@/presentation/design/overlay-close-glyph'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { splitSlots } from '../elements/slot-children'
import { overlayCloseLabel, overlayUntitledLabel } from './island-overlay-props-builders'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReactElement, ReactNode } from 'react'

/** Stable identity for the closed-on-load placeholder container. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * Accessible name / description wiring for the zero-JS dialog panel.
 *
 * `aria-label` is the fallback ONLY when there is no title to point at, so a
 * titled dialog is named by its own visible heading rather than by a duplicate
 * string that can drift from it.
 */
function dialogLabelling(
  id: string | undefined,
  title: string | undefined,
  description: string | undefined,
  untitledLabel: string
): {
  readonly titleId: string | undefined
  readonly descriptionId: string | undefined
  readonly ariaLabel: string | undefined
} {
  const titleId = id === undefined || title === undefined ? undefined : `dialog-title-${id}`
  const descriptionId =
    id === undefined || description === undefined ? undefined : `dialog-description-${id}`
  return { titleId, descriptionId, ariaLabel: title === undefined ? untitledLabel : undefined }
}

/**
 * Title + supporting text, each omitted when the author declared neither.
 *
 * A plain render FUNCTION rather than a component: this module's export is
 * `renderEnhancerDrivenDialog`, and a PascalCase sibling would make the file a
 * mixed component/non-component export that `react-refresh` rejects.
 */
function renderDialogPanelHeader(props: {
  readonly titleId: string | undefined
  readonly title: string | undefined
  readonly descriptionId: string | undefined
  readonly description: string | undefined
}): ReactNode {
  if (props.title === undefined && props.description === undefined) return undefined
  return (
    <div
      data-slot="dialog-header"
      className={computeDialogHeaderClasses()}
    >
      {props.title !== undefined && (
        <h2
          id={props.titleId}
          data-slot="dialog-title"
          className={computeDialogTitleClasses()}
        >
          {props.title}
        </h2>
      )}
      {props.description !== undefined && (
        <p
          id={props.descriptionId}
          data-slot="dialog-description"
          className={computeDialogDescriptionClasses()}
        >
          {props.description}
        </p>
      )}
    </div>
  )
}

/**
 * The dialog body: either the `formRef` expansion or the authored children.
 *
 * Rendering the children at all is the first of the two defects this markup
 * must NOT inherit from the retired `modal` type, whose renderer read only
 * `props.id` / `props.title` and dropped them silently.
 */
function renderDialogPanelBody(
  formRefHtml: unknown,
  renderedChildren: readonly ReactElement[]
): ReactNode {
  if (typeof formRefHtml === 'string') {
    // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
    return <div dangerouslySetInnerHTML={{ __html: formRefHtml }} />
  }
  return renderedChildren
}

/** The corner close control the click enhancer closes the dialog with. */
const renderCloseButton = (label: string): ReactElement => (
  <button
    type="button"
    aria-label={label}
    data-component-type="button"
    data-modal-close
    data-slot="dialog-close"
    className={computeDialogCloseClasses()}
  >
    <OverlayCloseGlyph />
  </button>
)

/** The `footer` slot, in the band at the panel's foot; nothing when it is empty. */
const renderFooter = (footer: readonly ReactElement[]): ReactElement | undefined =>
  footer.length === 0 ? undefined : (
    <div
      data-slot="dialog-footer"
      className={computeDialogFooterClasses()}
    >
      {footer}
    </div>
  )

/**
 * SSR markup for a `hydrate: false` dialog — the zero-JavaScript overlay form
 * of `dialog` (there is no separate `modal` type).
 *
 * It emits exactly what the always-present click enhancer in
 * `page-body-scripts.tsx` reads, and nothing else:
 *
 * - `id` + `data-modal-container` on the ROOT — `openModal(id)` resolves it by
 *   `getElementById` and flips `style.display`, while `[data-modal-close]` and
 *   a direct `[data-backdrop]` click close it through
 *   `closest('[data-modal-container]')`.
 * - the root IS the full-screen layer (`fixed inset-0`), with the dimmer as an
 *   `absolute inset-0` child. `modal` nested it the other way round — a plain
 *   wrapper holding a `fixed` backdrop — which left the wrapper itself
 *   zero-height, so the element carrying the author's `id` never had a visible
 *   box for anything asserting on `#<id>` rather than on the inner panel.
 * - `role="dialog"` + `tabIndex={-1}`, so `openModal`'s `.focus()` lands.
 *
 * It deliberately does NOT emit `aria-modal="true"`, which `modal` did. That
 * attribute promises assistive technology the rest of the page is inert, and
 * the enhancer offers neither focus containment nor focus restoration — so the
 * promise would be false. The hydrated Base UI dialog emits none either, which
 * makes the two modes agree rather than diverge on the accessibility contract.
 */
export function renderEnhancerDrivenDialog(
  context: Pick<
    ComponentDispatchConfig,
    'rawProps' | 'elementProps' | 'renderedChildren' | 'currentLang' | 'languages' | 'component'
  >,
  formRefHtml: unknown
): ReactElement {
  const { rawProps, elementProps, component } = context
  const slots = splitSlots('dialog', component, context.renderedChildren)
  const renderedChildren = slots['$children'] ?? []
  const footer = slots['footer'] ?? []
  const showClose =
    (component as { readonly showCloseButton?: unknown } | undefined)?.showCloseButton !== false
  const id = (rawProps?.['id'] ?? elementProps['id']) as string | undefined
  const title = rawProps?.['title'] as string | undefined
  const description = rawProps?.['description'] as string | undefined
  // The page language's words: the close control's name, and an untitled dialog's.
  const labels = dialogLabelling(id, title, description, overlayUntitledLabel(context))

  return (
    <div
      id={id}
      data-testid={elementProps['data-testid'] as string | undefined}
      data-modal-container
      style={HIDDEN_STYLE}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        data-backdrop
        data-slot="dialog-overlay"
        className={computeStaticDialogOverlayClasses()}
      />
      <div
        role="dialog"
        aria-labelledby={labels.titleId}
        aria-describedby={labels.descriptionId}
        aria-label={labels.ariaLabel}
        tabIndex={-1}
        data-slot="dialog-content"
        className={resolveClasses(
          computeStaticDialogContentClasses(),
          undefined,
          elementProps['className'] as string | undefined
        )}
      >
        {showClose ? renderCloseButton(overlayCloseLabel(context)) : undefined}
        {renderDialogPanelHeader({
          titleId: labels.titleId,
          title,
          descriptionId: labels.descriptionId,
          description,
        })}
        {renderDialogPanelBody(formRefHtml, renderedChildren)}
        {renderFooter(footer)}
      </div>
    </div>
  )
}
