/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Install the `Reflect.getMetadata` polyfill before the passkey plugin loads.
 *
 * `@better-auth/passkey` reaches `@peculiar/x509` (through
 * `@simplewebauthn/server`), whose entry imports `reflect-metadata` and then
 * `tsyringe`, and `tsyringe` throws at load time when the polyfill is absent.
 * Run from source, the imports execute in written order and nothing goes wrong.
 *
 * In the compiled binary they do not. The auth layer is reached through a
 * dynamic `import()`, so the bundler wraps every module of that subgraph in a
 * lazy initialiser, and inside `x509`'s initialiser it calls the ES-module
 * dependencies (`tsyringe` among them) BEFORE the CommonJS `reflect-metadata`,
 * whatever the source order. `tsyringe` then throws, the auth layer import
 * rejects, and every app that declares `auth:` refuses to start.
 *
 * Importing the polyfill from THIS ES module, first in `passkey.ts`, gives it
 * an ES-module initialiser of its own, which the bundler keeps in source
 * order: it runs, and `Reflect.getMetadata` exists, before the passkey package
 * is initialised. Held by `[internal ref]` (an
 * auth-enabled app booting from a copied-out binary).
 */
import 'reflect-metadata'
