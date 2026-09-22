/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Component, ComponentType } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'
import type { ReactElement } from 'react'

/**
 * A type the renderer registry can be asked for that NO author can declare.
 *
 * `li` is synthesized at render time by `expandDataSourceChildren`
 * (`data-source-resolver.ts`), which wraps each record of a data-bound list in
 * one before substituting record vars — so it reaches the registry without ever
 * appearing in `ComponentTypeSchema`.
 *
 * Kept as a NAMED one-member union rather than widening the registry key back to
 * `string`: that widening is what let a typo'd key compile as a renderer nothing
 * would ever dispatch to. Anything added here must be a real synthesis site, and
 * the comment must name it.
 */
export type SynthesizedOnlyComponentType = 'li'

/** Every type {@link COMPONENT_REGISTRY} may be keyed on. */
export type DispatchableComponentType = ComponentType | SynthesizedOnlyComponentType

/**
 * Configuration object for component dispatching
 * Replaces multiple function parameters with a single config object
 */
export interface ComponentDispatchConfig {
  readonly type: DispatchableComponentType
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly content: string | undefined
  readonly renderedChildren: readonly ReactElement[]
  readonly languages: Languages | undefined
  /**
   * Active page language code (resolved from page `meta.lang` / detected
   * language). Forwarded to renderers that resolve `$t:key` translation
   * references server-side — notably the embedded auth form, which localizes
   * its built-in submit/field labels through `meta.lang` + app `languages`.
   */
  readonly currentLang?: string
  readonly interactions?: Component['interactions']
  readonly action?: Component['action']
  /** Original component definition (for element/variant routing) */
  readonly component?: Component
  /** Original component props before transformation (for island components) */
  readonly rawProps?: Record<string, unknown>
  readonly tables?: Tables
  /** Schema buckets — used by rich-text field renderer to pick the upload target */
  readonly buckets?: Buckets
  /**
   * App-level `auth.landingPath`. Forwarded
   * to the auth-form renderer so an `onSuccess.type=role-landing` login
   * redirects to the landingPath where the per-role resolver routes onward.
   */
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  /**
   * Request session. When present,
   * forwarded to island prop-builders so client-side islands gate
   * user-specific affordances (own-comment edit/delete, admin overrides,
   * sign-in vs. authenticated form). Absent for anonymous requests.
   */
  readonly session?: SessionInfo
  /**
   * `design.components[<this type>]`, already resolved against this instance's
   * variant.
   *
   * The ROOT part is NOT read from here by most renderers: it is already folded
   * into `elementProps.className` by `buildFinalClassName`, at the precedence
   * layer between the recipe and the author, so every renderer that honours
   * `className` — including every island, which forwards it through
   * `baseProps` — applies it without knowing this key exists.
   *
   * What renderers DO need from here is the half `className` cannot carry:
   * `replace`, which drops the recipe a renderer computes internally, and
   * `parts`, the classes for inner elements no `className` reaches.
   */
  readonly designStyles?: ComponentDesignResolution
  /**
   * The app-level `design` key, unresolved.
   *
   * `designStyles` above is `design.components[<THIS type>]` already resolved,
   * which is what every ordinary renderer needs. The design-console components
   * need the key ITSELF and cannot get there from the resolution: `swatch`
   * resolves a token name through `design.ramps`, and `specimen` reports the
   * provenance of a DIFFERENT type — the one it draws — so it has to re-resolve
   * against a type that is not its own.
   */
  readonly design?: Design
}

/**
 * Component renderer function type
 */
export type ComponentRenderer = (config: ComponentDispatchConfig) => ReactElement | null
