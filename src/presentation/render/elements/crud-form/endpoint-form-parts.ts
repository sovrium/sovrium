/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * One part of the form, by the name a hosted form gives it: the recipe, then the
 * author's `classes.parts.<name>`, then the part's accessibility floor.
 */
export type FormPart = (name: 'label' | 'input' | 'submit', recipe: string) => string

export const formPartOf =
  (styles: ComponentDesignResolution | undefined): FormPart =>
  (name, recipe) =>
    resolveClasses(recipe, styles?.parts[name], undefined, styles?.partFloors[name])
