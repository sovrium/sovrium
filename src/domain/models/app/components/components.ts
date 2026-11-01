/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentTemplateSchema } from './component'
import type {
  ComponentTemplateNameSchema,
  TemplateInputsSchema,
  TemplateRenderSchema,
} from './component'
import type { ComponentGuidanceSchema } from './guidance'
import type {
  ComponentSlotKey,
  ComponentUnionEncoded,
  ContainerComponentType,
  SingleComponentSlot,
} from '../pages/components/component-types'

/**
 * Array of reusable UI component templates
 *
 * Components provide a library that can be referenced across pages
 * using the $ref pattern. Each component defines a template with variable
 * placeholders ($variable) that are substituted when the component is instantiated.
 *
 * Benefits:
 * - DRY: Define once, reuse multiple times
 * - Consistency: Centralized updates affect all instances
 * - Maintainability: Single source of truth for UI patterns
 *
 * @example
 * ```typescript
 * const components = [
 *   {
 *     name: 'icon-badge',
 *     type: 'badge',
 *     props: { color: '$color' },
 *     children: [
 *       { type: 'icon', props: { name: '$icon' } },
 *       { type: 'text', content: '$text' }
 *     ]
 *   },
 *   {
 *     name: 'section-header',
 *     type: 'container',
 *     props: { className: 'text-center mb-12' },
 *     children: [
 *       { type: 'text', props: { level: 'h2' }, content: '$title' },
 *       { type: 'text', props: { level: 'p' }, content: '$subtitle' }
 *     ]
 *   }
 * ]
 * ```
 *
 */
export const ComponentsSchema = Schema.Array(ComponentTemplateSchema).pipe(
  Schema.annotate({
    identifier: 'Components',
    title: 'Reusable Components',
    description:
      'Array of reusable UI component templates with variable substitution for use across pages',
  }),
  Schema.check(
    Schema.makeFilter((components) => {
      const names = components.map((component) => component.name)
      const uniqueNames = new Set(names)
      return (
        names.length === uniqueNames.size ||
        'Component names must be unique within the components array'
      )
    })
  )
)

export type Components = Schema.Schema.Type<typeof ComponentsSchema>

// ─── Typed templates, with input placeholders ───────────────────────────────

/** A template input written where a value belongs: `$label`, `$columns`. */
type InputPlaceholder = `$${string}`

/**
 * `T` with every value position also admitting an input placeholder, at any
 * depth: a template that declares `inputs` may write `$name` as the whole value
 * of any field — `columns: '$columns'`, `panels: '$panels'` — and the placement
 * passes the value. Object keys are kept as declared, so a misspelt key or a
 * wrong-typed literal still fails.
 */
export type WithPlaceholders<T> =
  | InputPlaceholder
  | (T extends string | number | boolean | bigint | null | undefined
      ? T
      : T extends ReadonlyArray<infer E>
        ? ReadonlyArray<WithPlaceholders<E>>
        : T extends object
          ? { readonly [K in keyof T]: WithPlaceholders<T[K]> }
          : T)

/** `$children`, or a named slot `$slots.<name>` (see `ComponentSlotSchema`). */
type TemplateSlotMarker = '$children' | `$slots.${string}`

/**
 * The values a nesting key holds. Written as interfaces on purpose: the node
 * union refers back to itself through `children`, and only an interface defers
 * that reference — the same alias spelled as a type is reported circular by the
 * declaration emitter (TS2456).
 */
interface TemplateNodeList extends ReadonlyArray<TemplateNodeEncoded | string> {
  readonly [index: number]: TemplateNodeEncoded | string
}

interface TemplateNestingValues {
  /** Nodes and text, a slot marker, or an input. */
  readonly list: TemplateNodeList | TemplateSlotMarker | InputPlaceholder
  /** One node, or an input (an item's `media`, a card's `action`). */
  readonly single: TemplateNodeEncoded | InputPlaceholder
}

interface TemplateContainerKeys {
  readonly children?: TemplateNestingValues['list']
}

interface TemplateSpecimenKeys {
  readonly component?: TemplateNestingValues['single']
}

/** The nesting keys component type `T` takes: `children` on a container, and its slots. */
type TemplateNesting<T> = (T extends ContainerComponentType ? TemplateContainerKeys : unknown) & {
  readonly [
    S in ComponentSlotKey<T>
  ]?: TemplateNestingValues[`${T & string}.${S}` extends SingleComponentSlot ? 'single' : 'list']
} & (T extends 'specimen' ? TemplateSpecimenKeys : unknown)

type TemplateNodeOf<C> = C extends { readonly type: infer T }
  ? { readonly type: T } & {
      readonly [K in keyof C as Exclude<K, 'type'>]: WithPlaceholders<C[K]>
    } & TemplateNesting<T>
  : never

/** One node of a component template, as written: any component, inputs admitted anywhere. */
export type TemplateNodeEncoded = TemplateNodeOf<ComponentUnionEncoded>

/**
 * A component template as a config writes it — one entry of `components` —
 * with an input placeholder (`$name`) admitted at every value position.
 *
 * The decoded side of `ComponentTemplateSchema` is `any` (the component union
 * is too large to serialise, TS7056), so a typed template is checked against
 * this instead: `export const card = { … } satisfies TemplateEncoded`. Every
 * key is typed by the component type's own schema, so a misspelt key, a wrong
 * literal or an object where a list belongs still fails; only a `$name` placed
 * where another shape belongs is let through, exactly as the decoder lets it
 * through and checks each placement once it is filled.
 */
export type TemplateEncoded = TemplateNodeEncoded & {
  readonly name: Schema.Codec.Encoded<typeof ComponentTemplateNameSchema>
  readonly guidance?: Schema.Codec.Encoded<typeof ComponentGuidanceSchema>
  readonly render?: Schema.Codec.Encoded<typeof TemplateRenderSchema>
  readonly inputs?: Schema.Codec.Encoded<typeof TemplateInputsSchema>
}
