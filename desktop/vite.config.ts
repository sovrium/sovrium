/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Vite config for the desktop shell's own UI.
 *
 * This bundles the SHELL's chrome — the splash, the project picker, the error
 * panel, the settings page. It does NOT bundle anything the Sovrium binary
 * serves: the app itself is rendered by the sidecar and shown in this window at
 * its loopback origin. Two bundlers, two jobs, and no import crosses between
 * them.
 *
 * `clearScreen: false` because the Tauri CLI multiplexes this process's output
 * with cargo's, and a Vite screen-clear eats the Rust compiler's errors.
 */

import { defineConfig } from 'vite'

// With the `.ts` extension, against this repository's usual extensionless rule:
// Vite's native config loader resolves this import itself rather than through
// the bundler, and warns that an extensionless specifier will stop working when
// `configLoader: 'native'` becomes the default.
import { sovriumTemplates } from './vite-plugin-templates.ts'

export default defineConfig({
  // The engine's `templates/catalog.json`, inlined as a virtual module so the
  // first-run gallery and the binary's embedded templates cannot disagree.
  plugins: [sovriumTemplates()],
  clearScreen: false,
  server: {
    // Fixed and strict: `tauri dev` waits for exactly this URL, so a port that
    // silently moves leaves the shell waiting on a dev server that is running
    // somewhere else.
    port: 1420,
    strictPort: true,
  },
  // `TAURI_ENV_*` is what the CLI exports into the frontend build (platform,
  // arch, family, debug). Without the prefix Vite drops them and a build cannot
  // tell macOS from Windows.
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // The shell's webview is fixed per platform, so there is no legacy browser
    // to down-level for. Left explicit rather than inherited: Vite's default
    // target follows its own release cadence, and a silent change here changes
    // what ships inside an installer.
    target: 'es2022',
    // The Rust side is the only consumer, and it reads the directory by name.
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
