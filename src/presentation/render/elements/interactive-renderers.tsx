/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { SearchGlyph } from '@/presentation/design/form-glyphs'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeFormClasses } from '../../design/forms-default-classes'
import {
  computePageSearchFieldClasses,
  computePageSearchKeyHintClasses,
  computeSearchInputContainerClasses,
  computeSearchInputFieldClasses,
  computeSearchInputIconClasses,
} from '../../design/interactive-content-default-classes'
import { toUncontrolledFormProps } from '../props/uncontrolled-form-props'
import { renderAuthForm, type AuthFormAction } from './auth-form-renderer'
import {
  renderAutomationForm,
  renderCrudCreateForm,
  renderCrudUpdateForm,
  type AutomationFormAction,
} from './crud-form/crud-form-renderer'
import { renderEndpointForm } from './crud-form/endpoint-form-renderer'
import { renderOAuthForm } from './oauth-form-renderer'
import type { CrudFormAction } from './crud-form/crud-form-types'
import type { ElementProps } from './html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

// Re-export button-related renderers (extracted to button-renderer.tsx for file size)
export { renderButton } from './button-renderer'

// Re-export icon renderer (extracted to icon-renderer.tsx for file size)
export { renderIcon } from './icon-renderer'

/**
 * Renders link (anchor) element
 */
export function renderLink(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <a {...props}>{content || children}</a>
}

/**
 * Configuration object for {@link renderForm}.
 *
 * Bundled into a single object to keep the parameter count under the ESLint
 * `max-params` threshold while supporting the optional `tables` and
 * `component` inputs needed by CRUD-action forms.
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
 * For CRUD actions, generates a form with fields from the table schema definition.
 */
function renderCrudFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, buckets, component, lang, languages } = config
  const crudAction = action as unknown as CrudFormAction
  const renderContext = { lang, languages }
  if (crudAction.operation === 'update') {
    return renderCrudUpdateForm(props, crudAction, tables, component, buckets, renderContext)
  }
  return renderCrudCreateForm(props, crudAction, tables, component, buckets, renderContext)
}

function renderAuthFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, component, lang, languages, landingPath } = config
  if (action?.type === 'auth' && action.strategy === 'oauth')
    return renderOAuthForm(props, action, { landingPath })
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
 * [internal ref] prestyled form-card chrome. Author-supplied `props.className` is
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
  const { disabled, ...rest } = props as ElementProps & { readonly disabled?: unknown }
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
    return renderAutomationForm(
      props,
      action as unknown as AutomationFormAction,
      tables,
      component,
      buckets
    )
  }
  if (action?.type === 'auth') return renderAuthFormVariant(effectiveConfig)
  // PG-04 (Consoles-as-Config): a `form.endpoint` block routes to the
  // custom-endpoint submit renderer — a plain SSR `<form>` enhanced by the
  // vanilla runtime, distinct from the table-bound `crud` island.
  const endpointForm = renderEndpointForm(props, component)
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
 * Configuration for {@link renderSearchInput}.
 *
 * `debounceMs` and `minQueryLength` are top-level schema fields (siblings of
 * `props`) on the `search-input` component, NOT inside `props`. The dispatcher
 * extracts them via `component.debounceMs` / `component.minQueryLength` and
 * passes them here — the same lookup contract as {@link RenderPageSearchConfig}
 * and the other top-level-fielded components (textarea, time-picker, …).
 */
export interface RenderSearchInputConfig {
  readonly props: ElementProps
  readonly debounceMs?: number
  readonly minQueryLength?: number
}

/**
 * Renders a search input container with an inner input element.
 *
 * The component uses props.id as the container id and renders an input
 * element inside. This pattern allows selectors like `#search-bar input`
 * to locate the input element within the named search container.
 *
 * [internal ref] (prestyled-by-default): the container ships
 * `computeSearchInputContainerClasses()` chrome (relative + full-width on
 * focal fg tone) and the inner `<input>` ships
 * `computeSearchInputFieldClasses()` chrome (border + bg + radius + focus
 * ring) so the bare `{ type: 'search-input', scope: 'subscribers' }` schema renders as a peer of
 * the regular form `<input>` controls without the author spelling any
 * Tailwind classes. The merged className appends the author-supplied one
 * merged in via `resolveClasses`, so it beats the recipe on any same-property
 * conflict.
 *
 * `debounceMs` / `minQueryLength` are stamped onto the INNER `<input>` as
 * `data-search-debounce` / `data-search-min-length` — subscribers resolve
 * `#<id> input`, so the attributes must sit where the subscriber looks, not on
 * the container. Each attribute is emitted ONLY when the author declared the
 * field: an absent attribute means "0", and the reading subscriber owns that
 * default. Stamping a phantom fallback here would make the markup claim a
 * behaviour the config never asked for.
 */
export function renderSearchInput(config: RenderSearchInputConfig): ReactElement {
  const { props, debounceMs, minQueryLength } = config
  const id = props.id as string | undefined
  const placeholder = props.placeholder as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = resolveClasses(containerDefaults, className)
  const fieldClassName = computeSearchInputFieldClasses()

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
    >
      <SearchGlyph className={computeSearchInputIconClasses()} />
      <input
        type="search"
        placeholder={placeholder ?? 'Search...'}
        aria-label={placeholder ?? 'Search...'}
        className={fieldClassName}
        data-search-debounce={debounceMs === undefined ? undefined : String(debounceMs)}
        data-search-min-length={minQueryLength === undefined ? undefined : String(minQueryLength)}
      />
    </div>
  )
}

/**
 * Configuration for {@link renderPageSearch}.
 *
 * `placeholder` and `maxResults` are top-level schema fields (siblings of
 * `props`) on the `search-input` component, NOT inside `props`. The
 * dispatcher extracts them via `component.placeholder` / `component.maxResults`
 * and passes them here. Same lookup contract as the other top-level-fielded
 * components (textarea, time-picker, …).
 */
export interface RenderPageSearchConfig {
  readonly props: ElementProps
  readonly placeholder?: string
  readonly maxResults?: number
}

/**
 * Renders the SSR shell for a `search-input` under `scope: 'page'`.
 *
 * The presence of any page-scoped `search-input` component anywhere in
 * `app.pages[].components[]` is the activation gate for the static
 * search index (see `page-search.ts` doc-comment). This renderer emits
 * the island marker (`data-island="search-input"` + `data-island-props=...`)
 * plus a SSR `<input type="search">` so the page is visually populated
 * on first request, BEFORE the React island hydrates.
 *
 * Once hydrated, `page-search-island.tsx` replaces the static input with
 * a live results panel sourced from `/sovrium-search/index.json`. The
 * SSR markup remains visible until the lazy chunk resolves, then
 * `island-client.tsx` swaps it for the React tree. The SSR `<input>` is
 * required for COMPONENT-001 (the input must be visible on first paint
 * regardless of JS availability).
 */
export function renderPageSearch(config: RenderPageSearchConfig): ReactElement {
  const { props, placeholder, maxResults } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const effectivePlaceholder = placeholder ?? 'Search...'

  // [internal ref] (prestyled-by-default): the SSR shell carries the same input
  // chrome as `renderSearchInput` so the SSR page-search reads as a styled
  // input on first paint. The hydrated `page-search-island` then swaps the
  // SSR markup for its own inline-styled live panel (see PanelInlineStyles
  // in page-search-island.tsx) — the island's inline styles are required
  // because the live panel may render on a third-party host that doesn't
  // ship Sovrium's CSS. The SSR shell is the only surface this helper paints.
  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = resolveClasses(containerDefaults, className)
  const fieldClassName = computePageSearchFieldClasses()

  const islandProps = {
    placeholder: effectivePlaceholder,
    ...(typeof maxResults === 'number' ? { maxResults } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(className !== undefined ? { className } : {}),
    ...(testId !== undefined ? { 'data-testid': testId } : {}),
  }
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
      data-island="search-input"
      data-island-props={propsJson}
    >
      <SearchGlyph className={computeSearchInputIconClasses({ scope: 'page' })} />
      <input
        type="search"
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        className={fieldClassName}
      />
      {/*
        The key that opens the panel, named on the control it opens. Not a
        `kbd` component: this is a hint printed on a field, and a keycap here
        would compete with the field's own border for the same 20px of edge.
      */}
      <span
        aria-hidden="true"
        className={computePageSearchKeyHintClasses()}
      >
        /
      </span>
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
      {...props}
      data-component="customHTML"
      // Safe: HTML has been sanitized to remove <script>, inline handlers, javascript: URLs
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-rendered customHTML; called once during server render
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
