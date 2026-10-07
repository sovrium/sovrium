/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext, type ReactElement } from 'react'
import { CORE_RUNTIME_FEATURES } from '@/presentation/render/page/page-interactivity'

/**
 * Stable client-script path → the content-hashed path the document references
 * instead (`/assets/client.js` → `/assets/client-<hash>.js`).
 *
 * Provided once per document by `renderPageHtml`, from the map the server
 * resolved for the release it is running. A context rather than a prop because
 * the scripts it names are emitted three components deep, by renderers that
 * otherwise have no reason to know about asset names. Empty by default, so a
 * document rendered without it (a source checkout, an error page) keeps the
 * stable names — which the server still answers.
 */
// eslint-disable-next-line react-refresh/only-export-components -- server-rendered only (renderToString), never hot-reloaded; the context and its one consumer belong together
export const ClientScriptPathsContext = createContext<Readonly<Record<string, string>>>({})

/**
 * A `<script>` for one of the stable-named client entries, emitted under its
 * content-hashed path when the server published one.
 *
 * Without `runtimeFeatures` it is a deferred classic script. With them it is
 * the client runtime's loader: a module script (its split build imports its
 * chunks, which only a module can do) whose `data-sovrium-runtime` names the
 * features it should load. A module script is deferred by definition.
 */
export function ClientEntryScript({
  path,
  runtimeFeatures,
}: {
  readonly path: string
  readonly runtimeFeatures?: readonly string[]
}): ReactElement {
  const src = useContext(ClientScriptPathsContext)[path] ?? path
  return runtimeFeatures === undefined ? (
    <script
      src={src}
      defer={true}
    />
  ) : (
    <script
      type="module"
      src={src}
      data-sovrium-runtime={runtimeFeatures.join(' ')}
    />
  )
}

/**
 * The client runtime's loader tag (`/assets/client.js`), asking for the
 * features an interactive page loads. See `islands/client.ts`.
 */
export function ClientRuntimeScript(): ReactElement {
  return (
    <ClientEntryScript
      path="/assets/client.js"
      runtimeFeatures={CORE_RUNTIME_FEATURES}
    />
  )
}
