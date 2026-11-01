/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The config AS IT IS WRITTEN: `AppConfig` and the element type of each of its
 * list-valued keys. Part of the public `sovrium` type surface — `src/index.ts`
 * re-exports every name here, and `scripts/build/build-types.ts` extracts them
 * from that one entry into the shipped `sovrium.d.ts`.
 */

import type { AutomationConfig } from './automation-config'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Application configuration type for YAML/JSON/TypeScript config files.
 *
 * Every `*Config` type below describes the config AS IT IS WRITTEN — the
 * encoded side of the app schema, the one `sovrium validate` reads and
 * `sovrium schema` prints. The decoded side is what the engine works on after
 * defaults and normalisations ran: an automation's single `trigger` is gone
 * from it (it became a one-entry `triggers`), and a key with a decoding default
 * is required there. Typing an author's file against that side reports errors
 * on configs the binary accepts. So each element type is DERIVED from
 * `AppConfig` by position rather than from the domain model's decoded type: it
 * can never drift to the other side, and it names exactly what the position
 * accepts. The one exception is an automation's steps, whose encoded side is
 * erased to `unknown`; see `AuthoredAutomationAction`. `AppConfig` itself takes
 * its automations as `AutomationConfig`, so a step is checked the same way in a
 * whole app as in one automation typed on its own.
 *
 * The runtime functions of `src/index.ts` take the raw `AppEncoded` instead: what the CLI hands
 * them was parsed from a file, not authored against this type, and every
 * `AppConfig` is one.
 */
export type AppConfig = Omit<AppEncoded, 'automations'> & {
  readonly automations?: readonly AutomationConfig[]
}

/** An element of one of `AppConfig`'s list-valued keys, as it is written. */
export type AppConfigEntry<K extends keyof AppConfig> =
  NonNullable<AppConfig[K]> extends readonly (infer E)[] ? E : never

/** Single page configuration (element of `AppConfig['pages']`). */
export type PageConfig = AppConfigEntry<'pages'>

/** Single table configuration (element of `AppConfig['tables']`). */
export type TableConfig = AppConfigEntry<'tables'>

/** Reusable component template (element of `AppConfig['components']`). */
export type ComponentConfig = AppConfigEntry<'components'>

/**
 * Design / design tokens configuration.
 *
 * The canonical position is `AppConfig['design']['design']`; top-level
 * `AppConfig['design']` is a deprecated alias for the same type, removed at the
 * next major. The alias here is unchanged — one type serves both positions.
 */
export type ThemeConfig = NonNullable<AppConfig['design']>

/** Design-system configuration (`AppConfig['design']`) — tokens, principles, voice, usage rules. */
export type DesignConfig = NonNullable<AppConfig['design']>

/** Authentication configuration (`AppConfig['auth']`). */
export type AuthConfig = NonNullable<AppConfig['auth']>

/** Multi-language configuration (`AppConfig['languages']`). */
export type LanguageConfig = NonNullable<AppConfig['languages']>

/** Built-in analytics configuration (`AppConfig['analytics']`). */
export type AnalyticsConfig = NonNullable<AppConfig['analytics']>

/** Single external connection configuration (element of `AppConfig['connections']`). */
export type ConnectionConfig = AppConfigEntry<'connections'>

/** Single form configuration (element of `AppConfig['forms']`). */
export type FormConfig = AppConfigEntry<'forms'>

/** Single env-var declaration (element of `AppConfig['env']`). */
export type EnvConfig = AppConfigEntry<'env'>

/** Single autonomous AI agent configuration (element of `AppConfig['agents']`). */
export type AgentConfig = AppConfigEntry<'agents'>
