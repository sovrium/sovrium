/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_DESIGN_LAYER` env var — operator toggle for emitting the always-on
 * design token layer (`V1_TOKEN_LAYER` / `NEUTRAL_FLOOR_LAYER` +
 * `ROLE_TOKEN_BRIDGE`) into the compiled CSS bundle.
 *
 * The prestyled-by-default islands carry their own OKLCH / radius / shadow
 * defaults inline via `withVarFallback`. The default layer is
 * therefore an OVERRIDE surface, not a load-bearing default — every styled
 * surface still renders correctly when the layer is absent because the
 * fallback literal inside `var(--sv-X, <literal>)` resolves at the browser.
 *
 * This env var is the deployable proof of that contract:
 *   - `on` (default): emit the layer, `--sv-*` overrides win at the cascade.
 *   - `off`: skip the layer entirely; every island falls through to the
 *     inline OKLCH literal. The visual baseline MUST match the `on` baseline
 *     pixel-for-pixel — that's the prestyled-default contract.
 *
 * Used by the contract smoke tests (`[internal ref]*.spec.ts`)
 * to prove the contract holds. Also lets an operator demote the layer in prod
 * to confirm the binary doesn't depend on it.
 *
 * Frugal-by-default: shipping the layer is the default; operators opt out
 * (saves ~30KB on the compiled CSS but means tenants cannot override role
 * tokens via the `--sv-*` channel).
 */
import { parseEcoEnum } from './eco-env-parsing'

export type EcoDesignLayerMode = 'on' | 'off'

const ECO_DESIGN_LAYER_MODES: readonly EcoDesignLayerMode[] = ['on', 'off']

/** Default when `ECO_DESIGN_LAYER` is unset (override-channel-aligned). */
export const DEFAULT_ECO_DESIGN_LAYER: EcoDesignLayerMode = 'on'

/**
 * Resolve `ECO_DESIGN_LAYER` from a snapshot of env vars. An unset or empty
 * value resolves to the override-channel-aligned default (`on`); only an
 * explicit `off` (case-insensitive, surrounding whitespace ignored) disables
 * the layer.
 *
 * A SET-but-unrecognised value throws — `ECO_DESIGN_LAYER=false`
 * used to read as `on`, so an operator disabling the layer got the opposite of
 * what they asked for, with a ~30KB CSS bundle as the only evidence.
 *
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseEcoDesignLayer = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoDesignLayerMode =>
  parseEcoEnum('ECO_DESIGN_LAYER', processEnv['ECO_DESIGN_LAYER'], {
    allowed: ECO_DESIGN_LAYER_MODES,
    fallback: DEFAULT_ECO_DESIGN_LAYER,
  })
