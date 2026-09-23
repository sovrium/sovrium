/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design system every Sovrium app inherits without declaring anything.
 *
 * ─── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
 *
 * An app with no `design` block is the COMMON case, and D2 the
 * shipped default IS "the opinion every downstream Sovrium app inherits" — the
 * v1 token layer is emitted into its CSS whether or not it asked. Exporting an
 * empty document for such an app would report that it has no design system,
 * which is false, and would leave its author with nothing to hand an agent.
 *
 * ─── WHY THE VALUES ARE REPEATED HERE, STATED HONESTLY ──────────────────────
 *
 * They no longer are. Every table below is GENERATED from the ONE source at
 * `src/admin/config/design.ts` — the same source the
 * CSS token layer and the island `TOKENS` catalogue are emitted from — and
 * `[internal ref]` now compares three DERIVATIONS against that
 * source rather than three copies against each other. Regenerate with
 * `bun run build:default-design`.
 *
 * This module used to be a THIRD copy. Two constraints forced it, and both are
 * still true of the module — they are simply no longer paid in duplicated
 * VALUES, because the projection is derived:
 *
 *  - **Layering.** The export is an application-layer projection. It may not
 *    import `src/presentation/**`, so the `TOKENS` catalog is out of reach; and
 *    the theme layer is CSS TEXT, so reading it would mean parsing stylesheets
 *    at request time to answer a question about the config.
 *  - **Naming.** Neither existing surface is in the vocabulary this export
 *    needs. Both speak `--sv-bg` / `bgRaised`; an author writes `background`
 *    and `background-raised`. Publishing the internal spelling would hand an
 *    agent token names that cannot be written back into `design.colors`.
 *
 * The set is therefore kept DELIBERATELY SMALL — only the role tokens an author
 * can actually override, in the names they would use — rather than mirroring
 * the whole ~100-entry catalog. Values are the LIGHT cascade (`:root`), which
 * is what a single-mode DTCG document can describe.
 *
 * That follow-up is DONE: `check-design-tokens.ts` covers all three surfaces,
 * because all three are now derivations of one source.
 */

import {
  INHERITED_BREAKPOINT_TOKENS as GENERATED_INHERITED_BREAKPOINT_TOKENS,
  INHERITED_COLOR_TOKENS as GENERATED_INHERITED_COLOR_TOKENS,
  INHERITED_DURATION_TOKENS as GENERATED_INHERITED_DURATION_TOKENS,
  INHERITED_EASING_TOKENS as GENERATED_INHERITED_EASING_TOKENS,
  INHERITED_FONT_TOKENS as GENERATED_INHERITED_FONT_TOKENS,
  INHERITED_RADIUS_TOKENS as GENERATED_INHERITED_RADIUS_TOKENS,
  INHERITED_SHADOW_TOKENS as GENERATED_INHERITED_SHADOW_TOKENS,
  INHERITED_SPACING_TOKENS as GENERATED_INHERITED_SPACING_TOKENS,
  PLATFORM_TYPE_LADDER as GENERATED_PLATFORM_TYPE_LADDER,
  ROLE_COLOR_PROPERTY as GENERATED_ROLE_COLOR_PROPERTY,
} from './inherited-tokens.generated'

/**
 * The v1 colour roles, keyed by the name an author writes in
 * `design.colors` and valued as the light cascade resolves them.
 *
 * Only CANONICAL spellings appear. `COLOR_TO_SV_TOKEN` also accepts aliases
 * that collapse onto the same `--sv-*` slot — `muted` for `background-subtle`,
 * `card` for `background-raised`, `destructive` for `error` — and publishing
 * both spellings of one token would read as two different colours.
 */
export const INHERITED_COLOR_TOKENS = GENERATED_INHERITED_COLOR_TOKENS

/** The v1 radius scale. */
export const INHERITED_RADIUS_TOKENS = GENERATED_INHERITED_RADIUS_TOKENS

/** The v1 motion scale. */
export const INHERITED_DURATION_TOKENS = GENERATED_INHERITED_DURATION_TOKENS

/**
 * The v1 elevation ramp — the three shadows every Sovrium app CASTS, declared
 * or not.
 *
 * ─── WHY THIS TABLE EXISTS, AND WHY IT STOPS AT THE CONSOLE ─────────────────
 *
 * Elevation was the one token family an operator could not see. The Foundations
 * panel read its shadows out of `unmappable['design.elevation.*']`, which is
 * empty for an app that declares none — and neither shipped Sovrium app declares
 * any — so the section rendered as nothing at all. That is the same defect
 * `INHERITED_BREAKPOINT_TOKENS` fixed for thresholds: the panel reported what the
 * author had WRITTEN rather than what the app SHIPS, and inheritance is exactly
 * the half they cannot learn by re-reading their own config.
 *
 * ─── IT IS DELIBERATELY NOT IN THE EXPORT ──────────────────────────────────
 *
 * Unlike every other table here, this one is NOT merged into the DTCG document.
 * `[internal ref]` asserts the document has no `shadow` group on
 * purpose: DTCG's `shadow` type wants a decomposed
 * `{color, offsetX, offsetY, blur, spread}`, and parsing an arbitrary
 * `box-shadow` back into that shape fails precisely on the multi-layer values
 * below. Publishing a lossy shadow group would be worse than publishing none.
 *
 * So the sole consumer is the Foundations SURFACE, which casts each value on a
 * real card rather than printing it — the only honest rendering of a family
 * whose value string tells an operator nothing about whether their cards lift.
 * Promoting these into `buildDesignSystem` is a separate, larger decision.
 *
 * ─── AND THE MIRROR THIS CREATES, STATED RATHER THAN HIDDEN ────────────────
 *
 * These three values now exist here, as `shadowSm`..`shadowLg` in
 * `src/presentation/utils/design/css-var.ts`, and as `--shadow-*` in the theme
 * layer. That is the same three-way mirror the colour, radius and duration
 * tables above already live with, for the same layering reason: a domain service
 * may not import `src/presentation/**`, and the theme layer is CSS text.
 *
 * The ramp was six steps and is three (plus `shadowNone`, which casts nothing
 * and so needs no row here). `shadowXs` went because every surface that used it
 * was already bounded by a border, and `shadowXl` because nothing in the system
 * renders above a dialog — a top step with no tenant orders nothing.
 */
export const INHERITED_SHADOW_TOKENS = GENERATED_INHERITED_SHADOW_TOKENS

/**
 * The three easing curves every Sovrium app MOVES ON, declared or not.
 *
 * ─── THIS TABLE'S ABSENCE WAS ARGUED FOR, AND THE ARGUMENT WAS WRONG ───────
 *
 * The Foundations panel used to say these curves "are not published as tokens,
 * so there is nothing here to override". Both halves are false, and the error is
 * worth recording because it was reasoned rather than mistyped:
 * `default-theme-layer.ts` declares all three `--ease-*`, and a recipe animates
 * with one of them — `specialty-ssr-default-classes.ts`, twice, as
 * `ease-[var(--sv-ease-default, …)]` on a real transition. (It was three sites
 * across two files when this was written; the island half went with the
 * ai-chat send button, which is the shared button recipe now. Recount rather
 * than trusting the number: `grep -rn "sv-ease-default" src/presentation
 * --include="*-default-classes.ts"`.) So every Sovrium
 * surface moves on a curve its operator could not see, under a sentence telling
 * them there was nothing to look at.
 *
 * ─── SAME SHAPE AS THE ELEVATION RAMP, AND NOT THE SAME BOUND ──────────────
 *
 * Merged UNDER any declared curve — `{ ...INHERITED, ...declared }` — so an app
 * redefining one keeps the other two rather than dropping to a section showing
 * one curve where it ships three.
 *
 * ─── THIS PARAGRAPH USED TO SAY THE OPPOSITE, AND IT WAS WRONG ─────────────
 *
 * It read: *"An easing has no DTCG form at all … publishing an inherited one as
 * a token would invent a type DTCG does not have."* Both halves are false. DTCG
 * has a `cubicBezier` type, it is a four-number array, and
 * `design-system-foundation-motion.ts` already parses those four numbers out of
 * these very strings in order to DRAW the curve. All three values below are
 * `cubic-bezier(...)`, so all three have a faithful form.
 *
 * So unlike {@link INHERITED_SHADOW_TOKENS}, this ramp reaches the EXPORT as
 * well as the Foundations surface: it is projected into the document's `easing`
 * token group by `parseCubicBezierValue`. What still reaches `unmappable` is a
 * declared curve that cannot parse — a CSS keyword such as `ease-in-out`, which
 * a four-number array genuinely cannot carry. That is the real bound, and it is
 * narrower than the one this comment used to claim.
 */
export const INHERITED_EASING_TOKENS = GENERATED_INHERITED_EASING_TOKENS

/**
 * The v1 font stacks, as ordered fallback lists.
 *
 * DTCG's `fontFamily` accepts a single name or an ordered stack, and a stack is
 * the honest form here: the first entry is a webfont the platform ships, and
 * everything after it is what a reader actually sees while that font loads.
 *
 * TWO FAMILIES, AND THERE IS DELIBERATELY NO `serif`. [internal ref] amendment A2
 * withdrew the serif grace note and deleted the `--font-serif` token and the
 * Source Serif face with it, so a `serif` entry here would publish a family the
 * runtime cannot paint — through the DTCG document, the markdown brief an agent
 * reads, the Foundations specimens and every count derived from them. An
 * inherited token is a claim about what the ENGINE emits; a claim it cannot
 * honour is worse than a missing one, because an agent handed it will set
 * headings in a face the app never serves and be right to.
 *
 * An app is still free to DECLARE its own `serif` face in `theme.fonts` — that
 * emits `--font-serif` and genuinely ships. This is the inherited layer only.
 */
export const INHERITED_FONT_TOKENS = GENERATED_INHERITED_FONT_TOKENS

/**
 * The type ladder in force when an app declares none, as `[utility, size,
 * leading]` in px.
 *
 * ─── IT IS SOVRIUM'S LADDER NOW, NOT TAILWIND'S ────────────────────────────
 *
 * Until 2026-09-09 these rows were a hand-written copy of TAILWIND's defaults,
 * which was the honest thing to publish: the platform ladder emitted
 * `--font-size-*`, a namespace no utility reads, so `text-base` really did
 * resolve to Tailwind's `1rem` and an operator asking "what size is my text"
 * had to be told a third party's answer.
 *
 * The ladder now emits `--text-*` — Tailwind's own font-size namespace — so
 * every rung here is a Sovrium value, and this table is an inherited-token
 * table like every other one on this page rather than the exception it used to
 * be. All twelve rungs are published, not five, because all twelve are now ours
 * to answer for.
 *
 * The rows still render UNDER the sentence stating the app declares no type
 * scale, behind the `data-design-platform-step` hook: the absence and the
 * answer belong in the same breath. What changed is that the answer is no
 * longer borrowed.
 *
 * ─── AND UNLIKE THE SHADOW RAMP, THIS COPY HAS A REAL GATE ─────────────────
 *
 * `-052` reads each row's COMPUTED font-size and line-height off a live element
 * carrying the real utility, and compares them against the numbers printed
 * beside it — plus two clauses that stop a build satisfying that circularly (the
 * row must carry the class, and must not set the size inline). So a rung that
 * moves in `FONT_SIZES` without moving here fails the spec rather than rotting
 * silently, which is the guarantee `INHERITED_SHADOW_TOKENS` does NOT have. It
 * caught exactly that when the ladder moved into `--text-*`: the sizes changed
 * under a table still printing Tailwind's.
 *
 * ─── THE UTILITY IS A LITERAL, AND THAT IS NOT A STYLE CHOICE ──────────────
 *
 * The class is stored spelled out rather than composed as `text-${step}` at the
 * call site. Tailwind's candidate corpus is harvested by SCANNING SOURCE for
 * class strings, and a runtime-composed class never enters it — it is dropped
 * from the compiled CSS with no error, in dev and in the compiled binary alike.
 * A ladder whose utilities silently resolved to nothing would fail `-052` on
 * `text-xs resolves to nothing`, which is the good outcome; the bad one is the
 * same defect on a row added later by someone who did not know.
 */
export const PLATFORM_TYPE_LADDER = GENERATED_PLATFORM_TYPE_LADDER

/**
 * There is deliberately NO inherited spacing scale.
 *
 * Sovrium's components take spacing from raw Tailwind utilities rather than
 * from `--sv-*` variables, so there is no platform spacing token an author
 * could override — and inventing one here would publish a token that overriding
 * changes nothing about. An app's spacing group is exactly what it declared.
 */
export const INHERITED_SPACING_TOKENS = GENERATED_INHERITED_SPACING_TOKENS

/**
 * The responsive thresholds every app RESPONDS AT, declared or not.
 *
 * Breakpoints are the opposite case to spacing above, and were wrongly grouped
 * with it. `theme.breakpoints` writes `--breakpoint-<name>` into the `@theme`
 * block, which OVERRIDES one entry of Tailwind's default scale and leaves the
 * rest standing — so `md:` and `lg:` fire in an app that declared neither.
 * Reporting only the declared entries told an author what they had WRITTEN
 * rather than what their app SHIPS, and inheritance is precisely the half they
 * cannot learn by re-reading their own config.
 *
 * Values are Tailwind v4's defaults, in the `rem` spelling Tailwind itself uses.
 * This is the one table here describing what TAILWIND resolves rather than what
 * Sovrium emits, which is why the source carries it explicitly instead of
 * deriving it from a block.
 */
export const INHERITED_BREAKPOINT_TOKENS = GENERATED_INHERITED_BREAKPOINT_TOKENS

/**
 * The `--color-*` custom property a canonical role name resolves through, for
 * the seven names where the registered property is spelled differently from the
 * name an author writes.
 *
 * `bg-<name>` is minted from `--color-<name>`, and for most roles those two
 * spellings agree. They do not for the semantic quartet (an author's `error`
 * drives the `error-solid` SLOT, which is the one a surface actually paints)
 * nor for the two `-foreground` roles and `ring`, which the token layer
 * abbreviates. A specimen that wants to paint what the app paints has to follow
 * the same indirection; every name absent from this map is its own property.
 *
 * This is the subset of `COLOR_TO_SV_TOKEN` whose slot name differs. It is not
 * a copy of that map any more: both are emitted from the same source, and the
 * layering constraint that used to force the duplication (a domain service may
 * not import `src/infrastructure/css`) is satisfied by the source living in
 * `src/domain/models/app/design/`.
 */
export const ROLE_COLOR_PROPERTY = GENERATED_ROLE_COLOR_PROPERTY
