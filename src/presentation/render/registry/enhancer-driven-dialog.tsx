/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { ReactElement, ReactNode } from 'react'

/** Stable identity for the closed-on-load placeholder container. */
const HIDDEN_STYLE = { display: 'none' } as const

const PANEL_DEFAULTS =
  // `shadow-lg`, not `shadow-xl`: the `xl` step was retired from the scale and
  // the utility fell through to Tailwind's own stock elevation, putting a
  // shadow from outside the design system on a modal.
  'bg-background-overlay text-foreground relative max-h-full w-full max-w-md overflow-y-auto rounded-md p-6 shadow-lg'

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
  description: string | undefined
): {
  readonly titleId: string | undefined
  readonly descriptionId: string | undefined
  readonly ariaLabel: string | undefined
} {
  const titleId = id === undefined || title === undefined ? undefined : `dialog-title-${id}`
  const descriptionId =
    id === undefined || description === undefined ? undefined : `dialog-description-${id}`
  return { titleId, descriptionId, ariaLabel: title === undefined ? 'Dialog' : undefined }
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
  return (
    <>
      {props.title !== undefined && (
        <h2
          id={props.titleId}
          className="text-foreground mb-4 text-2xl font-semibold"
        >
          {props.title}
        </h2>
      )}
      {props.description !== undefined && (
        <p
          id={props.descriptionId}
          className="text-foreground-muted text-md mb-4"
        >
          {props.description}
        </p>
      )}
    </>
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
    return (
      <div
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only; trusted server-generated markup from `expandFormRefs`
        dangerouslySetInnerHTML={{ __html: formRefHtml }}
      />
    )
  }
  return renderedChildren
}

/**
 * SSR markup for a `hydrate: false` dialog — the zero-JavaScript overlay that
 * `dialog` absorbed when `modal` was retired.
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
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  renderedChildren: readonly ReactElement[],
  formRefHtml: unknown
): ReactElement {
  const id = (rawProps?.['id'] ?? elementProps['id']) as string | undefined
  const title = rawProps?.['title'] as string | undefined
  const description = rawProps?.['description'] as string | undefined
  const labels = dialogLabelling(id, title, description)

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
        className="bg-foreground/50 absolute inset-0"
      />
      <div
        role="dialog"
        aria-labelledby={labels.titleId}
        aria-describedby={labels.descriptionId}
        aria-label={labels.ariaLabel}
        tabIndex={-1}
        className={resolveClasses(
          PANEL_DEFAULTS,
          undefined,
          elementProps['className'] as string | undefined
        )}
      >
        <button
          type="button"
          aria-label="Close dialog"
          data-modal-close
          className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4"
        >
          &#10005;
        </button>
        {renderDialogPanelHeader({
          titleId: labels.titleId,
          title,
          descriptionId: labels.descriptionId,
          description,
        })}
        {renderDialogPanelBody(formRefHtml, renderedChildren)}
      </div>
    </div>
  )
}
