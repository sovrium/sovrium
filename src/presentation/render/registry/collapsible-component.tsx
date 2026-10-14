/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  computeCollapsibleChevronClasses,
  computeCollapsibleClasses,
  computeCollapsibleContentClasses,
  computeCollapsibleTriggerClasses,
} from '../../design/collapsible-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * `collapsible` — one region behind one trigger.
 *
 * Without `hydrate` the root holds a `<details>`/`<summary>` and loads no
 * script. With
 * `hydrate: true` it is a `<button>` carrying `aria-expanded` and
 * `aria-controls` over a region the server already drew; the `collapsible`
 * enhancement island (which renders nothing) wires the button. The button is
 * drawn disabled until then, so an early press is never lost.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/collapsible.ts
 */

/** A short, stable id for the region, derived from the component itself. */
const regionIdOf = (seed: string): string => {
  const hash = [...seed].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), 16_777_619),
    2_166_136_261
  )
  return `sv-collapsible-${(hash >>> 0).toString(36)}`
}

/** The chevron after the label, turned while the region is open. */
const chevron = (): ReactElement => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={computeCollapsibleChevronClasses()}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

interface CollapsibleView {
  readonly rest: Readonly<Record<string, unknown>>
  readonly className: string
  readonly label: string
  readonly open: boolean
  readonly children: readonly ReactElement[]
}

/** The zero-script form: the root holds the browser's own disclosure. */
const renderDetails = ({ rest, className, label, open, children }: CollapsibleView) => (
  <div
    {...rest}
    data-slot="collapsible"
    className={className}
  >
    <details
      open={open}
      className={computeCollapsibleClasses()}
    >
      <summary
        data-slot="collapsible-trigger"
        className={computeCollapsibleTriggerClasses()}
      >
        {label}
        {chevron()}
      </summary>
      <div
        data-slot="collapsible-content"
        className={computeCollapsibleContentClasses()}
      >
        {children}
      </div>
    </details>
  </div>
)

/** The hydrated form: a button over a region, wired by the enhancement island. */
const renderHydrated = (
  { rest, className, label, open, children }: CollapsibleView,
  regionId: string
) => (
  <div
    {...rest}
    data-slot="collapsible"
    data-state={open ? 'open' : 'closed'}
    className={className}
  >
    <button
      type="button"
      data-slot="collapsible-trigger"
      aria-expanded={open}
      aria-controls={regionId}
      disabled
      className={computeCollapsibleTriggerClasses()}
    >
      {label}
      {chevron()}
    </button>
    <div
      id={regionId}
      data-slot="collapsible-content"
      hidden={!open}
      className={computeCollapsibleContentClasses()}
    >
      {children}
    </div>
    <span
      data-island="collapsible"
      data-island-props="{}"
      hidden
    />
  </div>
)

const collapsibleComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  renderedChildren,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const rawLabel = typeof source['triggerLabel'] === 'string' ? source['triggerLabel'] : ''
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  const view: CollapsibleView = {
    rest,
    className: mergePrestyle(computeCollapsibleClasses(), authorClassName as string | undefined),
    label: String(resolveTranslationTokensDeep(rawLabel, currentLang, languages)),
    open: source['defaultOpen'] === true,
    children: renderedChildren,
  }
  if (source['hydrate'] !== true) return renderDetails(view)
  const base = typeof rest['id'] === 'string' ? rest['id'] : regionIdOf(JSON.stringify(source))
  return renderHydrated(view, `${base}-content`)
}

/** The collapsible renderer, keyed by type. */
export const collapsibleComponents = {
  collapsible: collapsibleComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
