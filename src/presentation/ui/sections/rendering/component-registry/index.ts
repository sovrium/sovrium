/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { aiChatComponent } from './ai-chat-component'
import { commandPaletteComponent } from './command-palette-component'
import { favoritesButtonComponent } from './favorites-button-component'
import { interactiveComponents } from './interactive-components'
import { islandComponents } from './island-components'
import { mediaComponents } from './media-components'
import { reorderableListComponent } from './reorderable-list-component'
import { specialComponents } from './special-components'
import { structuralComponents } from './structural-components'
import { textComponents } from './text-components'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

export const COMPONENT_REGISTRY: Partial<Record<Component['type'], ComponentRenderer>> = {
  ...structuralComponents,
  ...textComponents,
  ...mediaComponents,
  ...interactiveComponents,
  ...specialComponents,
  ...islandComponents,
  'ai-chat': aiChatComponent,
  'reorderable-list': reorderableListComponent,
  'favorites-button': favoritesButtonComponent,
  'command-palette': commandPaletteComponent,
} as Partial<Record<Component['type'], ComponentRenderer>> & Record<string, ComponentRenderer>

export { structuralComponents } from './structural-components'
export { textComponents } from './text-components'
export { mediaComponents } from './media-components'
export { interactiveComponents } from './interactive-components'
export { specialComponents } from './special-components'
export { islandComponents } from './island-components'
