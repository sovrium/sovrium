/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeFormClasses } from '../../design/forms-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { toUncontrolledFormProps } from '../props/uncontrolled-form-props'
import { renderAuthForm } from './auth-form-renderer'
import {
  renderAutomationForm,
  renderCrudUpdateForm,
  type AutomationFormAction,
} from './crud-form/crud-form-renderer'
import { renderEndpointForm } from './crud-form/endpoint-form-renderer'
import { renderStrategyAuthForm } from './enterprise-auth-form-renderer'
import type { AuthFormAction } from './auth-form-action'
import type { CrudFormAction } from './crud-form/crud-form-types'
import type { ElementProps } from './html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

// Re-export button-related renderers (extracted to button-renderer.tsx for file size)
export { renderButton } from './button-renderer'

// Re-export icon renderer (extracted to icon-renderer.tsx for file size)
export { renderIcon } from './icon-renderer'

// Re-export the search-input renderers (extracted to search-input-renderers.tsx for file size)
export { renderSearchInput, renderPageSearch } from './search-input-renderers'

/**
 * Renders link (anchor) element
 */
export function renderLink(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <a {...omitInternalMarkers(props)}>{content || children}</a>
}

/**
 * Configuration object for {@link renderForm}, bundled to stay under `max-params`.
 */
export interface RenderFormConfig {
  readonly props: ElementProps
  readonly children: readonly React.ReactNode[]
  readonly action?: AuthFormAction
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly component?: Component
  /**
   * Active page language code (page `meta.lang`). Threaded from the section
   * renderer so the auth-form renderer can resolve `$t:key` submit/field-label
   * references server-side through the app `languages` translations.
   */
  readonly lang?: string
  /** App-level centralized translations used to resolve `$t:key` references. */
  readonly languages?: Languages
  /**
   * App-level `auth.landingPath`. Forwarded
   * to the auth-form renderer so an `onSuccess.type=role-landing` login
   * redirects through the per-role landing resolver.
   */
  readonly landingPath?: string
  /** `design.components.form` under this node's `classes`: the parts a form draws. */
  readonly designStyles?: ComponentDesignResolution
}

/**
 * Renders form element
 *
 * When an auth action is provided, generates a complete auth form with
 * email/password inputs, data attributes for client-side handling, and
 * an error display area. Non-auth forms render as simple passthroughs.
 *
 * For OAuth strategy forms, renders a single button that starts the provider's
 * social sign-in.
 *
 * For a CRUD update action, generates an edit form with fields from the table
 * schema definition. A page form never creates a row (that is a `forms[]`
 * entry placed with `formRef`), and config validation refuses a create action
 * on it, so the update form is the only CRUD form drawn here; any other
 * operation draws the bare form.
 */
function renderCrudFormVariant(config: RenderFormConfig): ReactElement {
  const { props, children, action, tables, buckets, component, lang, languages } = config
  const crudAction = action as CrudFormAction
  if (crudAction.operation !== 'update') return renderBareFormVariant(props, children)
  return renderCrudUpdateForm(props, crudAction, tables, component, buckets, { lang, languages })
}

function renderAuthFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, component, lang, languages, landingPath } = config
  const byStrategy = renderStrategyAuthForm(props, action, {
    landingPath,
    component,
    lang,
    languages,
  })
  if (byStrategy !== undefined) return byStrategy
  return renderAuthForm(props, action!, { tables, component, lang, languages, landingPath })
}

/**
 * PG-04: when a `form` component carries a `dataSource` with
 * `mode: 'single'` but no explicit `action`, synthesize a `{ type: 'crud',
 * operation: 'update', table: <dataSource.table> }` action so the existing
 * `renderCrudUpdateForm` path renders fields (with values from the bound
 * record when one is resolved).
 *
 * Two synthesis scenarios:
 * 1. **Record-bound** (record-detail page, single-record collection): the
 *    page-level `applySingleRecordToComponent` resolver injects the fetched
 *    record onto `props._record`. The CRUD update path picks it up and
 *    prefills inputs with current values.
 * 2. **Drawer-bound** (PG-04 quick-edit drawer on a list page): no URL
 *    param resolves to a record at render time, so `_record` is absent.
 *    The synthesized action still fires — `renderCrudUpdateForm` draws the
 *    field labels + empty inputs, and the data-table row-click dispatch
 *    populates them client-side via the `sovrium:open-drawer` CustomEvent.
 *
 * Returns the synthesized action when the conditions are met, otherwise
 * the original action (which may itself be undefined). This is a render-
 * time decision — schema authors never see the synthesized action and may
 * still override it explicitly.
 */
function maybeSynthesizeCrudUpdateAction(config: RenderFormConfig): RenderFormConfig['action'] {
  if (config.action) return config.action
  const componentRecord = (config.component ?? {}) as Record<string, unknown>
  const dataSource = componentRecord['dataSource'] as
    { readonly table?: string; readonly mode?: string } | undefined
  if (!dataSource || dataSource.mode !== 'single' || typeof dataSource.table !== 'string') {
    return undefined
  }
  return {
    type: 'crud',
    operation: 'update',
    table: dataSource.table,
  } as RenderFormConfig['action']
}

/**
 * PG-04: when the CRUD update action was synthesized from a
 * `form` component bound via `dataSource: { mode: 'single' }`, default the
 * submit button label to "Save" (the natural verb for the quick-edit
 * pattern) instead of the generic "Update" hardcoded in
 * `renderCrudUpdateForm`. Achieved by injecting `props.label = 'Save'`
 * onto the synthesized config's `component` when the author hasn't set one.
 */
function maybeApplySaveButtonDefault(config: RenderFormConfig): RenderFormConfig {
  const componentRecord = (config.component ?? {}) as Record<string, unknown>
  const existingProps = (componentRecord['props'] as Record<string, unknown> | undefined) ?? {}
  if (typeof existingProps['label'] === 'string') return config
  return {
    ...config,
    component: {
      ...componentRecord,
      props: { ...existingProps, label: 'Save' },
    } as RenderFormConfig['component'],
  }
}

/**
 * Render the bare `{ type: 'form' }` fallback (no action attached) with the
 * the prestyled-islands rule prestyled form-card chrome. Author-supplied `props.className` is
 * merged through `resolveClasses`, so it beats the recipe on any same-property
 * conflict. Extracted from
 * `renderForm` so the dispatcher stays under the cyclomatic-complexity
 * ceiling (≤10) — every action-bearing branch already routes to a
 * dedicated renderer, so this helper exclusively owns the "actionless
 * form" path.
 */
function renderBareFormVariant(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  // `disabled` is lifted OFF the form element, because a `<form disabled>` is
  // not a thing: the attribute is ignored by every browser, so an author who
  // wrote it got a form that looked and behaved exactly like an enabled one.
  // `<fieldset disabled>` is the HTML-native way to say it and the only one —
  // it disables every control it contains, which is what the declaration meant.
  const { disabled, ...rest } = omitInternalMarkers(props) as ElementProps & {
    readonly disabled?: unknown
  }
  const authorClassName = rest.className as string | undefined
  const mergedClassName = resolveClasses(computeFormClasses(), authorClassName)
  const body = children.length > 0 ? children : <button type="submit">Submit</button>
  return (
    <form
      {...rest}
      className={mergedClassName}
    >
      {disabled === true ? (
        <fieldset
          disabled
          className="contents"
        >
          {body}
        </fieldset>
      ) : (
        body
      )}
    </form>
  )
}

export function renderForm(config: RenderFormConfig): ReactElement {
  const synthesizedAction = maybeSynthesizeCrudUpdateAction(config)
  const synthesized = synthesizedAction !== config.action
  const withAction = synthesized ? { ...config, action: synthesizedAction } : config
  const effectiveConfig = synthesized ? maybeApplySaveButtonDefault(withAction) : withAction
  const { props, children, action, tables, buckets, component } = effectiveConfig
  if (action?.type === 'crud') return renderCrudFormVariant(effectiveConfig)
  if (action?.type === 'automation') {
    return renderAutomationForm(props, action as AutomationFormAction, tables, component, buckets, {
      lang: effectiveConfig.lang,
      languages: effectiveConfig.languages,
    })
  }
  if (action?.type === 'auth') return renderAuthFormVariant(effectiveConfig)
  // PG-04 (Consoles-as-Config): a `form.endpoint` block routes to the
  // custom-endpoint submit renderer — a plain SSR `<form>` enhanced by the
  // vanilla runtime, distinct from the table-bound `crud` island.
  const endpointForm = renderEndpointForm(props, component, effectiveConfig.designStyles)
  if (endpointForm) return endpointForm
  return renderBareFormVariant(props, children)
}

/**
 * Renders input element
 *
 * An author-supplied `value` / `checked` is restated as `defaultValue` /
 * `defaultChecked` on the way to the DOM. The SSR tree ships no change
 * handlers, so React would otherwise read the bare `value` as a controlled
 * component and warn about a read-only field that is nothing of the sort.
 * The emitted HTML is unchanged — see `toUncontrolledFormProps`.
 */
export function renderInput(props: ElementProps): ReactElement {
  return <input {...toUncontrolledFormProps(props)} />
}

/**
 * Configuration for {@link renderFileUpload}.
 *
 * `props` is the standard `elementProps` (id, aria-label, className, data-testid, …).
 * `accept`, `maxFiles`, `dropZone`, `disabled` come from the schema's top-level
 * fields on the file-upload component (siblings of `props`), not from inside
 * `props` — see the `pickFromComponent` doc-comment in
 * `island-form-components.tsx` for the lookup contract.
 */
export interface RenderFileUploadConfig {
  readonly props: ElementProps
  readonly accept?: string
  readonly maxFiles?: number
  readonly dropZone?: boolean
  readonly disabled?: boolean
  readonly label?: string
}

/**
 * Renders a basic file-upload control (button + hidden input).
 *
 * The container `<div>` carries the user-supplied `id` so selectors like
 * `#avatar-upload` target the upload control, while the actual `<input
 * type="file">` is nested inside so `#avatar-upload input[type="file"]`
 * also resolves. The input is visually hidden via Tailwind's `sr-only`
 * but remains in the accessibility tree and is focusable through the
 * surrounding `<label>`.
 *
 * `accept` is forwarded as the native `accept` attribute. `multiple` is
 * applied only when `maxFiles` is greater than 1 (or unset, defaulting to
 * single-file). `disabled` cascades to both the button and the input.
 *
 * This renderer is intentionally non-interactive in SSR: it does not wire
 * upload submission, drag/drop, or progress reporting. Those concerns
 * belong to a future client-side island when richer behavior is needed.
 */
export function renderFileUpload(config: RenderFileUploadConfig): ReactElement {
  // Intentionally not destructured into the renderer body:
  // - `dropZone` (boolean): drives drag-and-drop UI; deferred to [internal ref] island
  //   - `uploadAction` (string | ActionSchema): wires submit destination; the
  //     basic AC under test (file selection + accept + multiple) doesn't fire
  //     a submit yet, so the field is accepted at the schema layer but unused
  // here. When [internal ref] lands the dropzone island, the island will read both
  //     fields from the same `pickFromComponent` lookup contract.
  const { props, accept, maxFiles, disabled, label } = config
  const id = props.id as string | undefined
  const ariaLabel = (props['aria-label'] as string | undefined) ?? label ?? 'Upload file'
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const inputId = id ? `${id}-input` : undefined
  const buttonText = label ?? ariaLabel

  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="file-upload"
      data-component-type="file-upload"
    >
      {/*
        A plain secondary button, from the one button recipe — R-E. This was a
        hand-written approximation of one that had drifted on every axis
        (40px tall against the button's 32, `rounded-md` against `radius-base`,
        and a `shadow-sm` the canvas retires on anything that does not float),
        so the same affordance looked different depending on which of the three
        file-upload renderers drew it.

        The `+` glyph is gone rather than replaced: its TODO asked for the
        iconography R-F has since wired, and on reaching that point the answer
        was that `variants.mjs:130` draws this variant as a bare button. "Choose
        a file" already says what pressing it does; a plus sign in front of it
        is the ornament [internal ref] D4 cuts.
      */}
      <label
        htmlFor={inputId}
        className={computeButtonDefaultClasses({
          variant: 'secondary',
          state: disabled === true ? 'disabled' : undefined,
        })}
        aria-disabled={disabled ? 'true' : undefined}
      >
        {buttonText}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={allowMultiple}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only"
      />
    </div>
  )
}

/**
 * Renders a customHTML component with inline content.
 *
 * Content is read from the component's `content` field (declared via
 * `contentFields` in the customHTML schema). The sibling `htmlSrc` field for
 * loading external HTML files is wired by a separate renderer path.
 *
 * SECURITY: Inline (schema-authored) HTML is sanitized by the canonical
 * `sanitizeRichTextHTML` (`@/domain/utils/html-sanitization`) before being
 * rendered via `dangerouslySetInnerHTML`. That sanitizer strips <script>
 * blocks, <iframe>/<object>/<embed> sinks, inline `on*=` handlers, and
 * `javascript:` URLs including entity-encoded obfuscation. It is DOM-free, so
 * it runs safely under Bun SSR. Using the single project-wide sanitizer here
 * (instead of a weaker local regex) keeps one source of truth for HTML
 * sanitization.
 *
 * `trusted` is `true` ONLY for server-generated markup synthesized at render
 * time (today: embedded forms expanded from `formRef` page components). That
 * content is never user input, and the rich-text sanitiser's allowlist drops
 * every interactive element (`<form>`, `<input>`, `<button>`, `<select>`,
 * `<label>`), so applying it would destroy the embedded form. The trusted
 * path is unreachable from any schema-authored `customHTML` component — the
 * decoded schema only exposes `content` / `htmlSrc`.
 *
 * The `data-component="customHTML"` attribute matches the schema type literal
 * (consistent with `data-component="dataTable"` etc.) and is used by E2E specs
 * to assert the component rendered.
 */
export function renderCustomHTML(
  props: ElementProps,
  content?: string,
  trusted = false
): ReactElement {
  const sanitizedHTML = trusted ? (content ?? '') : sanitizeRichTextHTML(content ?? '')
  return (
    <div
      {...omitInternalMarkers(props)}
      data-component="customHTML"
      // Safe: HTML has been sanitized to remove <script>, inline handlers, javascript: URLs
      // eslint-disable-next-line sovrium/require-sanitized-html -- sanitizeRichTextHTML output on every schema path; the unsanitized branch is the engine's own embedded-form markup, which no schema can reach
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
