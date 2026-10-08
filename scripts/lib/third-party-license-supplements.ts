/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * License texts for dependencies that do not ship their own.
 *
 * Every npm package and Cargo crate Sovrium redistributes is attributed with
 * the notice from its OWN license file (`extractNotice`). A few dozen publish
 * none, so their text is kept under `licenses/supplements/`, one row each:
 *
 *   - an upstream repository's license file, fetched once and committed
 *     (`files` names it; `source` says where it came from); or
 *   - when the repository has none either, the canonical SPDX text of the
 *     license the manifest declares, with the copyright `holder` the manifest
 *     names (`files: ['spdx-<id>.txt']`). Electing one alternative of an `OR`
 *     is allowed; the elected id is the one named.
 *
 * Fetched 2026-10-07. A new dependency with no license file fails
 * `Third-Party License Drift` until it has a row here — never an empty notice.
 */

export interface LicenseSupplement {
  readonly ecosystem: 'npm' | 'cargo'
  /** Package or crate names covered, any version. */
  readonly packages: readonly string[]
  /** Files under `licenses/supplements/`, concatenated in order. */
  readonly files: readonly string[]
  /** Where the text came from, in one line. */
  readonly source: string
  /** For a canonical SPDX text: the copyright holder the manifest names. */
  readonly holder?: string
}

export const LICENSE_SUPPLEMENTS: readonly LicenseSupplement[] = [
  {
    ecosystem: 'npm',
    packages: ['@hono/zod-openapi', '@hono/zod-validator'],
    files: ['honojs-middleware.txt'],
    source:
      'https://github.com/honojs/middleware (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: [
      '@react-pdf/fns',
      '@react-pdf/font',
      '@react-pdf/hyphenate',
      '@react-pdf/image',
      '@react-pdf/layout',
      '@react-pdf/paginate',
      '@react-pdf/primitives',
      '@react-pdf/reconciler',
      '@react-pdf/render',
      '@react-pdf/renderer',
      '@react-pdf/stylesheet',
      '@react-pdf/svg',
      '@react-pdf/textkit',
      '@react-pdf/types',
    ],
    files: ['diegomura-react-pdf.txt'],
    source:
      'https://github.com/diegomura/react-pdf (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['@uiw/codemirror-extensions-basic-setup', '@uiw/react-codemirror'],
    files: ['uiwjs-react-codemirror.txt'],
    source:
      'https://github.com/uiwjs/react-codemirror (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['drizzle-orm'],
    files: ['drizzle-team-drizzle-orm.txt'],
    source:
      'https://github.com/drizzle-team/drizzle-orm (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['sqlite-vec'],
    files: ['asg017-sqlite-vec.txt'],
    source:
      'https://github.com/asg017/sqlite-vec (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['mitt'],
    files: ['developit-mitt.txt'],
    source:
      'https://github.com/developit/mitt (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['@better-auth/utils'],
    files: ['better-auth-utils.txt'],
    source:
      'https://github.com/better-auth/utils (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['@nodable/entities'],
    files: ['nodable-val-parsers.txt'],
    source:
      'https://github.com/nodable/val-parsers (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['node-rsa'],
    files: ['rzcoder-node-rsa.txt'],
    source:
      'https://github.com/rzcoder/node-rsa (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['yoga-layout'],
    files: ['facebook-yoga.txt'],
    source:
      'https://github.com/facebook/yoga (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['@scalar/schemas'],
    files: ['scalar-scalar.txt'],
    source:
      'https://github.com/scalar/scalar (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['base64-js'],
    files: ['beatgammit-base64-js.txt'],
    source:
      'https://github.com/beatgammit/base64-js (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: [
      '@tauri-apps/plugin-deep-link',
      '@tauri-apps/plugin-dialog',
      '@tauri-apps/plugin-log',
      '@tauri-apps/plugin-opener',
      '@tauri-apps/plugin-shell',
      '@tauri-apps/plugin-store',
      '@tauri-apps/plugin-updater',
    ],
    files: ['tauri-apps-plugins-workspace.txt'],
    source:
      'https://github.com/tauri-apps/plugins-workspace (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'npm',
    packages: ['pg-types'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/brianc/node-pg-types declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Brian M. Carlson',
  },
  {
    ecosystem: 'npm',
    packages: ['pgpass'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/hoegaarden/pgpass declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Hannes Hörl',
  },
  {
    ecosystem: 'npm',
    packages: ['fontkit'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/foliojs/fontkit declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Devon Govett',
  },
  {
    ecosystem: 'npm',
    packages: ['abs-svg-path'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/jkroso/abs-svg-path declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Jake Rosoman',
  },
  {
    ecosystem: 'npm',
    packages: ['brotli'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/devongovett/brotli.js declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Devon Govett',
  },
  {
    ecosystem: 'npm',
    packages: ['dfa'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/devongovett/dfa declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Devon Govett',
  },
  {
    ecosystem: 'npm',
    packages: ['hsl-to-hex'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/davidmarkclements/hsl-to-hex declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'David Mark Clements',
  },
  {
    ecosystem: 'npm',
    packages: ['media-engine'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/diegomura/media-engine declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Diego Muracciole',
  },
  {
    ecosystem: 'npm',
    packages: ['hsl-to-rgb-for-reals'],
    files: ['spdx-isc.txt'],
    source:
      'https://github.com/davidmarkclements/hsl_rgb_converter declares ISC but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'David Mark Clements',
  },
  {
    ecosystem: 'npm',
    packages: ['boolbase'],
    files: ['fb55-boolbase.txt'],
    source:
      'https://github.com/fb55/boolbase (repository license file, ISC; the published 1.0.0 package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: [
      'tauri-plugin-deep-link',
      'tauri-plugin-dialog',
      'tauri-plugin-fs',
      'tauri-plugin-log',
      'tauri-plugin-opener',
      'tauri-plugin-shell',
      'tauri-plugin-single-instance',
      'tauri-plugin-store',
      'tauri-plugin-updater',
    ],
    files: ['tauri-apps-plugins-workspace.txt'],
    source:
      'https://github.com/tauri-apps/plugins-workspace (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: [
      'block2',
      'dispatch2',
      'objc2',
      'objc2-app-kit',
      'objc2-cloud-kit',
      'objc2-core-data',
      'objc2-core-foundation',
      'objc2-core-graphics',
      'objc2-core-image',
      'objc2-core-location',
      'objc2-core-text',
      'objc2-encode',
      'objc2-exception-helper',
      'objc2-foundation',
      'objc2-io-surface',
      'objc2-osa-kit',
      'objc2-quartz-core',
      'objc2-ui-kit',
      'objc2-user-notifications',
      'objc2-web-kit',
    ],
    files: ['madsmtm-objc2.txt'],
    source:
      'https://github.com/madsmtm/objc2 (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['webview2-com', 'webview2-com-macros', 'webview2-com-sys'],
    files: ['wravery-webview2-rs.txt'],
    source:
      'https://github.com/wravery/webview2-rs (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['jni', 'jni-macros'],
    files: ['jni-rs-jni-rs.txt'],
    source:
      'https://github.com/jni-rs/jni-rs (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['jni-sys-macros'],
    files: ['jni-rs-jni-sys.txt'],
    source:
      'https://github.com/jni-rs/jni-sys (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['rustls-platform-verifier-android'],
    files: ['rustls-rustls-platform-verifier.txt'],
    source:
      'https://github.com/rustls/rustls-platform-verifier (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['ndk', 'ndk-sys'],
    files: ['rust-mobile-ndk.txt'],
    source:
      'https://github.com/rust-mobile/ndk (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['ndk-context'],
    files: ['rust-windowing-android-ndk-rs.txt'],
    source:
      'https://github.com/rust-windowing/android-ndk-rs (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['dlopen2', 'dlopen2_derive'],
    files: ['openbytedev-dlopen2.txt'],
    source:
      'https://github.com/OpenByteDev/dlopen2 (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['alloc-stdlib'],
    files: ['dropbox-rust-alloc-no-stdlib.txt'],
    source:
      'https://github.com/dropbox/rust-alloc-no-stdlib (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['libappindicator-sys'],
    files: ['tauri-apps-libappindicator-rs.txt'],
    source:
      'https://github.com/tauri-apps/libappindicator-rs (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['winapi-i686-pc-windows-gnu', 'winapi-x86_64-pc-windows-gnu'],
    files: ['retep998-winapi-rs.txt'],
    source:
      'https://github.com/retep998/winapi-rs (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['defmt-parser'],
    files: ['knurling-rs-defmt.txt'],
    source:
      'https://github.com/knurling-rs/defmt (repository license file; the published package ships none)',
  },
  {
    ecosystem: 'cargo',
    packages: ['r-efi'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/r-efi/r-efi declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'the r-efi authors',
  },
  {
    ecosystem: 'cargo',
    packages: ['cesu8'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/emk/cesu8-rs declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'Eric Kidd',
  },
  {
    ecosystem: 'cargo',
    packages: ['sigchld'],
    files: ['spdx-mit.txt'],
    source:
      'https://github.com/oconnor663/sigchld.rs declares MIT but ships no license file; canonical SPDX text, holder from the manifest',
    holder: "Jack O'Connor",
  },
  {
    ecosystem: 'cargo',
    packages: ['selectors'],
    files: ['spdx-mpl-2.0.txt'],
    source:
      'https://github.com/servo/stylo declares MPL-2.0 but ships no license file; canonical SPDX text, holder from the manifest',
    holder: 'The Servo Project Developers',
  },
  {
    ecosystem: 'cargo',
    packages: ['brotli'],
    files: ['dropbox-rust-brotli.txt', 'dropbox-rust-brotli-bsd.txt'],
    source:
      'https://github.com/dropbox/rust-brotli (LICENSE.MIT and LICENSE.BSD-3-Clause; the crate ships neither)',
  },
]
