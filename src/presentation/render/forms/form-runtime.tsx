/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- This module pairs the
   SSR-only `FormRuntimeMount` with the constants and helper that build its payload.
   It is server-rendered only and never takes part in client-side HMR, as in
   `form-renderer.tsx` and `form-field-elements.tsx`. */

/**
 * Form Runtime — inline JavaScript that powers post-submit behavior on
 * standalone `/forms/:name` pages, plus the SSR React mount that emits it.
 *
 * Responsibilities (all client-side):
 *
 *   1. Intercept the native `<form>` submit and POST as JSON so we get a
 *      structured response (`{ submissionId, linkedRecordId }`) instead of
 *      a 303 redirect to the Referer.
 *   2. Run lightweight inline validation (HTML5 Constraint Validation API)
 *      to surface "name required" / "valid email" inline errors before the
 *      network round-trip — and to render the configured `onError` UI when
 *      validation fails.
 *   3. Branch on `onSuccess.type`:
 *        - `successPage` — replace the `<form>` with a success screen and
 *          render any configured `actions[]` (`reset` / `navigate`).
 *        - `redirect` — interpolate `$submission.id` and `$record.id` into
 *          `url`, then `window.location.assign` after `delaySeconds`.
 *        - `reset` — clear inputs except `preserveFields`. On multi-step
 *          forms, return to step 1.
 *        - `toast` — render a transient toast and leave the form populated.
 *        - `message` — render an inline message, leave the form populated.
 *   4. On HTTP error, render the configured `onError` UI plus the inline
 *      field errors echoed back by the server when available.
 *   5. Drive multi-step navigation (Next button → advance active step).
 *   6. Announce a record written to `submitTo.table` to the rest of the page.
 *
 * The script is delivered as a string that the form renderer drops into
 * a `<script>` element on the standalone form page. It reads its
 * configuration from a sibling `<script type="application/json"
 * data-form-config>` block so the runtime stays declarative — no template
 * literals interpolating arbitrary user content into JS source.
 *
 * ## Architectural choice: inline IIFE, not a React island
 *
 * The siblings `auth-form-island.tsx` / `crud-form-island/` use React, so
 * this file reasonably begs the question "why not another island?". The
 * standalone `/forms/:name` route renders ONLY a form — no tabs, no
 * accordion, no select — which means it never crosses the
 * `ISLAND_COMPONENT_TYPES` threshold that gates `<script src="islands.js">`
 * emission. Switching to an island would force every form page to download
 * the ~50 KB React + TanStack Query bundle to drive a script that does
 * declarative DOM mutation with no state, no hooks, and no virtual-DOM
 * benefit. The inline IIFE gzips to ~1.5 KB and ships as part of the SSR
 * HTML response — measurable wins on first-contentful-paint, RGESN 4.1
 * (transferred bytes) and 7.1 (wasted CPU). Auth/CRUD forms stay on the
 * island path because they are embedded inside dynamic pages that already
 * load `islands.js` for sibling components — the marginal cost there is
 * zero.
 *
 * Layer notes: this file is presentation-layer only. It produces a
 * string of source code; it does not import a DOM or React. The
 * companion `form-renderer.tsx` mounts both the JSON config block and
 * the runtime script.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { InlineScript } from '@/presentation/design/inline-script'
import { runtimeConditionsConfig, type RuntimeConditionsConfig } from './form-runtime-conditions'
import {
  resolveOnErrorText,
  resolveOnSuccessText,
  resolvePendingLabel,
  resolveRuntimeStrings,
} from './form-runtime-i18n'
import { FORM_RUNTIME_SCRIPT } from './form-runtime-script'
import type { Form, FormOnError, FormOnSuccess } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Public-shape configuration consumed by the inline runtime. Mirrors a
 * subset of the form schema — everything the client needs to mutate the
 * DOM after a submit, with no server-only state leaking through.
 */
export interface FormRuntimeConfig extends RuntimeConditionsConfig {
  readonly formName: string
  readonly onSuccess?: FormOnSuccess
  readonly onError?: FormOnError
  readonly multiStep: boolean
  readonly stepIds: ReadonlyArray<string>
  /** Enable Typeform-style one-question runtime. */
  readonly oneQuestion: boolean
  /**
   * The runtime's own messages (`form.requiredNamed`, `form.submissionFailed`)
   * in the page language, present only where they differ from the English the
   * runtime is written in.
   */
  readonly strings?: Readonly<Record<string, string>>
  /** `submitTo.table`, announced on success (`form-runtime-record-written.ts`). */
  readonly table?: string
  /** `display.pendingLabel`, resolved: the submit's in-flight word (else `form.sending`). */
  readonly pendingLabel?: string
}

/**
 * Build the runtime config for a form. Defaults track the platform-level
 * behavior described in `[internal ref]`:
 *   - When `onSuccess` is omitted, the runtime falls back to a success
 *     toast so the submitter still gets feedback.
 *   - When `onError` is omitted, the runtime falls back to an error toast.
 * The defaults are encoded inside the inline runtime so the JSON config
 * stays minimal (only fields actually configured by the user).
 */
export function buildFormRuntimeConfig(
  form: Readonly<Form>,
  languages?: Languages,
  activeLang?: string
): FormRuntimeConfig {
  const isMultiStep =
    form.layout === 'multi-step' && form.steps !== undefined && form.steps.length > 0
  const isOneQuestion = form.layout === 'one-question'
  const onSuccess =
    form.onSuccess !== undefined
      ? resolveOnSuccessText(form.onSuccess, languages, activeLang)
      : undefined
  const onError =
    form.onError !== undefined ? resolveOnErrorText(form.onError, languages, activeLang) : undefined
  const strings = resolveRuntimeStrings(languages, activeLang)
  return {
    formName: form.name,
    ...(onSuccess !== undefined ? { onSuccess } : {}),
    ...(onError !== undefined ? { onError } : {}),
    multiStep: isMultiStep,
    stepIds: isMultiStep ? form.steps!.map((step) => step.id) : [],
    oneQuestion: isOneQuestion,
    ...(strings !== undefined ? { strings } : {}),
    ...(form.submitTo.table !== undefined ? { table: form.submitTo.table } : {}),
    ...resolvePendingLabel(form, languages, activeLang),
    ...runtimeConditionsConfig(form),
  }
}

/**
 * SSR mount for the form runtime. Emits two `<script>` blocks:
 *   1. `<script type="application/json" data-form-config>` — declarative
 *      config payload (`onSuccess` / `onError` / multi-step state) that
 *      the runtime reads on load. Stored as JSON so the runtime stays
 *      pure and so no untrusted user content is interpolated into JS
 *      source text.
 *   2. `<script>` — the runtime IIFE itself, identical for every form.
 *
 * Both scripts use `dangerouslySetInnerHTML` so React does not HTML-escape
 * characters inside the payloads. The payloads are server-authored
 * (config from a validated schema, runtime from a constant string) so
 * there is no XSS surface to defend against.
 */
export function FormRuntimeMount({
  form,
  languages,
  activeLang,
}: {
  readonly form: Form
  readonly languages?: Languages
  readonly activeLang?: string
}) {
  // `serializeJsonForScript`, never a bare `JSON.stringify`: a `</script>`
  // sequence in any config string (a form label, a placeholder, a translated
  // message) would otherwise close this block early and turn the remainder
  // into live markup.
  const configJson = serializeJsonForScript(buildFormRuntimeConfig(form, languages, activeLang))
  return (
    <>
      <script
        type="application/json"
        data-form-config="true"
        dangerouslySetInnerHTML={{ __html: configJson }}
      />
      <InlineScript source={FORM_RUNTIME_SCRIPT} />
    </>
  )
}
