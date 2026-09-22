/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Sovrium Native Admin Dashboard — the dogfooded operator console, as a
// first-class Sovrium app (founder decision D1).
//
// This is the console the binary embeds and mounts into every running app. It
// left `src/` to become an app like any other: a declarative config, restyled by
// editing `config/design.ts` and hot-reloading `bun run app:admin`, rather than
// synthesised from TypeScript builders.
//
// It stays PLATFORM-OWNED. It is version-locked to the release, compiled into the
// binary as a preset, and the operator's config never contains it — only WHETHER
// it is served (`admin`, a plain boolean: absent or `true` serves it at the fixed
// `/_admin`, `false` serves it nowhere, and `SOVRIUM_ADMIN=off` is the env-level
// kill switch). That is the whole of D4: the `design` key cascades onto it, page
// structure and backend do not.
//
// `name` IS LOAD-BEARING AND MUST NOT CHANGE. `isOperatorConsoleApp`
// (`src/domain/utils/admin-data-nav.ts`) keys on this exact string to recognise a
// console surface — it is what collapses every console page onto one stylesheet
// identity instead of a per-surface hash. Renaming it silently repaints the
// console with the operator's design.
//
// Type-only import (no value import of the types): the standalone sovrium binary
// loads this config with bare-package imports left unresolved, so only type-only
// imports — erased at transpile time — are safe. This is the enforced contract:
// the generated declaration `sovrium types` writes exports types and nothing
// else, so a value import cannot type-check in the first place.

import type { AppConfig } from 'sovrium'
import design from './config/design'
import templates from './config/components/templates'
import chromeStrings from './config/i18n/chrome'
import dataStrings from './config/i18n/data'
import developerStrings from './config/i18n/developers'
import consoleStrings from './config/i18n/console'
import frStrings from './config/i18n/fr'
import apiKeys from './config/pages/api-keys'
import { dataPages } from './config/pages/data'
import { decisionPages } from './config/pages/decisions'
import { designSystemPages } from './config/pages/design-system'
import { developerPages } from './config/pages/developers'
import env from './config/pages/env'
import gdpr from './config/pages/gdpr'
import home from './config/pages/home'
import login from './config/pages/login'
import profile from './config/pages/profile'
import forgotPassword from './config/pages/forgot-password'
import resetPassword from './config/pages/reset-password'

export default {
  name: 'sovrium-admin-dashboard',
  description: 'Sovrium Native Admin Dashboard — the dogfooded operator console.',

  // One locale, and no plan for more yet. The console's chrome is English
  // throughout, so declaring a second supported locale would advertise a
  // translation that does not exist. Localising later means adding the code here
  // and its table beside the ones below — there is no per-deployment override
  // seam, and deliberately none: the console is platform-owned and reads the
  // same on every install of a release.
  //
  // Carried over VERBATIM, down to `detectBrowser: false`, from the
  // `OPERATOR_CONSOLE_LANGUAGES` constant the deleted `dashboard-surface-builder.ts`
  // pinned on every synthesised surface. Neither the constant nor the file
  // exists any more — this declaration IS the pin, and there is no second copy
  // to agree with. The three parts are load-bearing together: `default`
  // is the CODE `en` (`LanguageConfig` takes ISO 639-1, so `en-US` is refused
  // there), the `locale` `en-US` is what reaches `<html lang>`, and disabling
  // browser detection is what stops an operator's French Chrome from negotiating
  // the console into a language it does not have. Dropping any one of the three
  // changes the rendered document.
  //
  // `translations` carries the console's OWN string table, keyed under the one
  // supported code. It is what makes a `$t:admin.*` token in a preset page
  // resolve through the ordinary interpreter path — no console special-casing in
  // the renderer, and one place to name a second locale from.
  //
  // The table is SPLIT BY AREA and merged here: `en.ts` holds the shell and the
  // account cluster, `data.ts` the operator-data surfaces. One alphabetised
  // object appended to by every migration in flight is a merge conflict per
  // commit; the merge is what keeps a key's address stable while its HOME stays
  // an authoring convenience. Keys are namespaced `admin.<surface>.<slot>`, so
  // the two halves cannot collide.
  languages: {
    default: 'en',
    supported: [
      { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
      { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' },
    ],
    detectBrowser: false,
    translations: {
      en: {
        ...chromeStrings,
        ...consoleStrings,
        ...dataStrings,
        ...developerStrings,
      },
      fr: frStrings,
    },
  },

  // No "Built with Sovrium" badge. The console IS Sovrium — a badge here would
  // credit the operator's own product to its vendor, on the one surface where the
  // operator is unambiguously not the audience.
  badge: false,

  // No palette. The ⌘K command palette the console ships is its own surface,
  // wired by the shell rather than by the generic page-level palette, and enabling
  // both would give the operator two overlapping keyboard entry points.
  palette: { enabled: false },

  design,

  // Every page MOUNT-RELATIVE. The console is served at one fixed base,
  // `/_admin`, and the mount primitive prefixes each path with it at render
  // time — `/login` is what is authored here, `/_admin/login` is what ships.
  // Writing the base into the config would double it.
  //
  // The three account surfaces — profile, gdpr, api-keys — were TypeScript
  // builders synthesised per request until the shell became config. They are
  // static bodies over existing endpoints, so nothing about them needed a
  // builder except the shell they had no other way to reach. `api-keys` carries
  // `requires: ['auth.apiKeys']`, which replaces the hand-written capability
  // `if` the builder registry used to run.
  //
  // The operator-DATA surfaces arrive as ONE area barrel (`config/pages/data`)
  // rather than page by page, for the same reason the string table is split:
  // several migrations are in flight at once, and a per-page list here makes
  // every landing a diff on these lines.
  // The console's own reusable templates — four console-shaped parts it draws
  // on many of its pages, named so `/design-system/components` has something to
  // document on the app whose job is to show what a Sovrium app looks like.
  //
  // The mount merges these BEFORE an operator's own, and reference resolution
  // takes the first match, so an operator cannot shadow one of these by
  // declaring the same name.
  components: [...templates],

  pages: [
    home,
    profile,
    gdpr,
    apiKeys,
    env,
    // The register and its one document. A PAIR rather than a single page
    // because the ids in `app.decisions[]` belong to the host app, and
    // `page.query` needs a closed `enum` it could never be given — so the
    // document is a path segment. The reasoning is at the top of the module.
    ...decisionPages,
    ...developerPages,
    ...dataPages,
    ...designSystemPages,
    login,
    forgotPassword,
    resetPassword,
  ],
} satisfies AppConfig
