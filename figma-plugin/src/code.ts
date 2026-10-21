/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/// <reference types="@figma/plugin-typings" />

/**
 * The plugin's sandbox entry, built to `dist/code.js`. It only wires the real
 * `figma` global to the dispatcher: everything else is written against the
 * port, and this assignment is what makes the package's typecheck prove that
 * the pinned Plugin API still satisfies it.
 */

// First: it provides what the bundle's later modules need while they load.
import './sandbox-globals'
import type { FigmaPort } from './figma-port'
import { handleMessage } from './handle-message'
import { isUiMessage } from './messages'

const port: FigmaPort = figma

figma.showUI(__html__, { width: 420, height: 560, themeColors: true })

figma.ui.onmessage = async (message: unknown) => {
  if (!isUiMessage(message)) return
  const handled = await handleMessage(port, message)
  if ('reply' in handled) {
    figma.ui.postMessage(handled.reply)
    return
  }
  // Selecting is the one thing the check does to the canvas, and it changes no layer.
  const layers = figma.currentPage.findAll((node) => handled.select.has(node.id))
  figma.currentPage.selection = layers
  if (layers.length > 0) figma.viewport.scrollAndZoomIntoView(layers)
}
