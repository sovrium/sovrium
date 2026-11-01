/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `$extensions` block of the design-system document: the guidance prose
 * mirrored out of `design.*` (principles, logo, imagery, voice, colour roles,
 * component guidance, zones), the elevation ramp with its provenance, the
 * platform catalogue, and the `unmappable` / `inert` reports.
 *
 * The token groups and the document assembly are `design-system-service.ts`;
 * the confidentiality bound and the honesty contract stated there hold here
 * too — this reads `app.design.*` and the component templates, nothing else.
 */

import { projectCatalogue } from '@/domain/models/app/design/design-system-catalogue-export-service'
import { INHERITED_SHADOW_TOKENS } from '@/domain/models/app/design/inherited-tokens'
import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'
import type { InertEntry } from '@/domain/models/app/design/design-system-typography-service'

/**
 * Spread one key only when its value is present.
 *
 * The guidance layer is entirely optional, and an explicit `undefined` is NOT
 * the same as an absent key here: the contract is `.strict()`, so a key present
 * with no value would serialise as `null` and tell a consumer the author
 * declared something empty rather than declared nothing.
 */
const optional = <T>(key: string, value: T | undefined): Readonly<Record<string, T>> =>
  value === undefined ? {} : { [key]: value }

/** Voice, with its readonly arrays copied into the mutable shape the contract types. */
const projectVoice = (
  voice: NonNullable<NonNullable<App['design']>['voice']>
): Readonly<Record<string, unknown>> => ({
  ...optional('personality', voice.personality ? [...voice.personality] : undefined),
  ...optional('pronoun', voice.pronoun),
  ...optional('prefer', voice.prefer ? [...voice.prefer] : undefined),
  ...optional('avoid', voice.avoid ? [...voice.avoid] : undefined),
  ...optional('tone', voice.tone ? { ...voice.tone } : undefined),
})

/**
 * The zone map, each entry's override projected through {@link projectVoice}.
 *
 * Reusing `projectVoice` rather than writing a second projection is what keeps
 * an override the SAME SHAPE as the base it departs from: a consumer that can
 * read `voice.avoid` reads `zones[].voice.avoid` with no second code path, and
 * a field later added to `design.voice` cannot reach the base while silently
 * missing from the overrides. It type-checks because the override schema is the
 * base minus `personality`, which is optional here.
 *
 * `pattern` and `zone` are required by `DesignZoneSchema` and spread
 * unconditionally; `voice` goes through {@link optional} for
 * the reason stated there.
 */
const projectZones = (
  zones: NonNullable<NonNullable<App['design']>['zones']>
): readonly Readonly<Record<string, unknown>>[] =>
  zones.map((entry) => ({
    pattern: entry.pattern,
    zone: entry.zone,
    ...optional('voice', entry.voice ? projectVoice(entry.voice) : undefined),
  }))

/** Whether the app or any of its zones names a pronoun. */
const declaresPronoun = (design: App['design']): boolean =>
  design?.voice?.pronoun !== undefined ||
  (design?.zones ?? []).some((entry) => entry.voice?.pronoun !== undefined)

/**
 * The language the app's pronouns are written in: its default language, named
 * only when the app declares several, and only when there is a pronoun to
 * qualify. With one language a bare pronoun is already true, and a language
 * beside nothing would describe no value in the document.
 */
const projectVoiceLanguage = (app: App): string | undefined =>
  declaresPronoun(app.design) && (app.languages?.supported.length ?? 0) > 1
    ? app.languages?.default
    : undefined

/**
 * Component guidance, gathered off the TEMPLATES and re-keyed by name.
 *
 * The published `$extensions.components` shape is unchanged — a record of
 * component name → guidance — because that is the shape every consumer of the
 * document reads (the markdown projection, the console's Components page, an
 * agent). What moved is the SOURCE: guidance now lives on the template it
 * describes (`components[].guidance`) rather than in a parallel
 * `design.components` record keyed by name.
 *
 * Templates without guidance are omitted rather than emitted empty, so the
 * document distinguishes "documented and says nothing" from "not documented" —
 * and so an app that documents none produces no key at all, which is what the
 * console's emptiness registry reads.
 */
const projectComponentGuidance = (
  components: App['components']
): Readonly<Record<string, unknown>> | undefined => {
  // A transparent template is furniture, not a part an author browses.
  const documented = (components ?? []).flatMap((component) =>
    component.guidance && component.render !== 'transparent'
      ? [[component.name, structuredClone(component.guidance)] as const]
      : []
  )
  return documented.length === 0 ? undefined : Object.fromEntries(documented)
}

/** The Sovrium guidance layer, mirrored out of `design.*` with its readonly arrays copied. */
const projectGuidance = (app: App): Readonly<Record<string, unknown>> => {
  const declared = app.design ?? {}
  return {
    ...optional('principles', declared.principles ? [...declared.principles] : undefined),
    // Structural clones: the contract types mutable arrays, and these carry
    // readonly ones. `structuredClone` also guarantees the document holds no
    // live reference back into the decoded config.
    ...optional('logo', declared.logo ? structuredClone(declared.logo) : undefined),
    ...optional('imagery', declared.imagery ? structuredClone(declared.imagery) : undefined),
    ...optional('voice', declared.voice ? projectVoice(declared.voice) : undefined),
    ...optional('voiceLanguage', projectVoiceLanguage(app)),
    ...optional(
      'colorRoles',
      declared.colorRoles ? structuredClone(declared.colorRoles) : undefined
    ),
    ...optional('components', projectComponentGuidance(app.components)),
    ...optional('zones', declared.zones ? projectZones(declared.zones) : undefined),
  }
}

/**
 * The elevation ramp the app SHIPS, each step saying who chose it.
 *
 * ─── THE MERGE, AND WHY IT NEEDS PROVENANCE TO BE HONEST ───────────────────
 *
 * Foundations draws `{ ...INHERITED, ...declared }`, and an export reporting
 * only the subset the config names would document a different system than the
 * console does — the failure an admin design system spec already argues for
 * breakpoints, where inheritance is precisely what an author cannot learn from
 * their own config.
 *
 * But a BARE merge is worse than either half for the reader this export is for.
 * An agent handed five shadows cannot tell the one that was decided from the
 * four the platform supplied, so it preserves defaults as though they were
 * intentional. `provenance` is the whole difference.
 *
 * ─── THIS DOES NOT PUT A SHADOW IN THE TOKEN TREE ──────────────────────────
 *
 * A DTCG `shadow` needs a decomposed `{color, offsetX, offsetY, blur, spread}`
 * and three of the five inherited steps are two-layer, so the tree still emits
 * no `shadow` group and a declared value still reaches `unmappable` verbatim.
 * The extension is the reverse-domain escape hatch, not a DTCG mapping, so a
 * structured ramp here says nothing about the tree — `-015` asserts both halves
 * and both hold.
 */
const projectShadows = (
  design: Design | undefined
): Readonly<Record<string, { readonly value: string; readonly provenance: string }>> => {
  const declared = design?.elevation ?? {}
  return Object.fromEntries(
    Object.entries({ ...INHERITED_SHADOW_TOKENS, ...declared }).map(([name, value]) => [
      name,
      { value, provenance: name in declared ? 'declared' : 'inherited' },
    ])
  )
}

/**
 * Everything under the Sovrium extension key: the guidance prose, the shadows
 * that have no DTCG home, the platform catalogue, and the two report sections
 * that are omitted rather than emitted empty.
 *
 * Its own function so `buildDesignSystem` stays a flat projection. The two
 * omissions are the only branches in this document, and they are here.
 */
export const sovriumExtension = (
  app: App,
  design: Design | undefined,
  unmappable: Readonly<Record<string, string>>,
  inert: readonly InertEntry[]
): Readonly<Record<string, unknown>> => ({
  ...projectGuidance(app),
  shadows: projectShadows(design),
  // The catalogue is the PLATFORM's, not the operator's: it is the same for
  // every app on a given build, and it is here because it is the one thing an
  // agent building from this document cannot derive from the tokens — which
  // types exist, and which of them will render nothing.
  catalogue: [...projectCatalogue()],
  ...(Object.keys(unmappable).length > 0 ? { unmappable } : {}),
  ...(inert.length > 0 ? { inert: [...inert] } : {}),
})
