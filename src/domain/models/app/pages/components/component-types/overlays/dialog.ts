/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../../../forms/name'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * Generic modal dialog (`type: 'dialog'`).
 *
 * Use for forms, detail panels, or focused content that should overlay the page
 * but remain dismissable via Escape key or backdrop click. For destructive
 * confirmations that must block accidental dismissal, use `'alert-dialog'`
 * instead (sibling schema with `cancelLabel` / `confirmLabel`).
 *
 * ARIA role: `dialog` (vs `alertdialog` for alert-dialog).
 *
 * Render contract:
 * - `title` → `<Dialog.Title>` (visible heading)
 * - `description` → `<Dialog.Description>` (visible supporting text)
 * - `children` → arbitrary nested components (fields, buttons, layout). Supplied
 *   via the shared `contentFields` module (`children?: PageComponent[]`); the
 *   dialog SSR renderer renders them into the modal body. Mutually exclusive in
 *   practice with `formRef` — use one or the other to populate the body.
 * - `formRef` → name of a top-level form (`app.forms[].name`) rendered inside
 *   the dialog body. When set, the dialog wraps that standalone form (fields +
 *   submit + onSuccess) declaratively, so no app needs an injected `<style>`
 *   modal + inline scripts to mount a form in a dialog.
 *
 * Hydrated by the `dialog` island (`src/presentation/islands/dialog-island.tsx`).
 * SSR placeholder lives in
 * `src/presentation/ui/sections/rendering/component-registry/island-overlay-components.tsx`.
 */
export const DialogTypeLiteral = Schema.Literal('dialog')

export const dialogFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...i18nFields,
  title: Schema.optional(
    Schema.String.annotations({ description: 'Dialog heading shown at the top of the modal' })
  ),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Supporting text rendered beneath the title (use for context, not actions)',
    })
  ),
  /**
   * Reference a top-level form by name (`app.forms[].name`). When set, the
   * dialog renders that standalone form inline in its body — fields, submit
   * button, and `onSuccess` flow from `app.forms[]`. This lets a dialog wrap a
   * form declaratively (the native "modal form" pattern) instead of forcing an
   * app to inject a `<style>` modal + inline mount scripts.
   *
   * Resolved server-side: the dialog SSR renderer expands `formRef` into the
   * modal body HTML (see `form-ref-resolver.ts` `expandFormRefs`). Mutually
   * exclusive with `children` in practice (use one to populate the body).
   * Additive/backward-compatible — dialogs without `formRef` are unchanged.
   *
   * @example
   * ```yaml
   * # A dialog that wraps the standalone "new-client" form
   * type: dialog
   * props:
   *   id: new-client-dialog
   *   title: Nouveau client
   * formRef: new-client
   * ```
   */
  formRef: Schema.optional(
    FormNameSchema.annotations({
      description:
        'Reference a top-level form by name (app.forms[].name) rendered inside the dialog body. Renders that form inline (fields + submit + onSuccess).',
    })
  ),
} as const
