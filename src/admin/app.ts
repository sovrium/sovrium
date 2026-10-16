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
// stopped being TypeScript builders and became an app like any other: a
// declarative config, previewed with `bun run app:admin` and hot-reloaded.
//
// It sits under `src/` because everything the binary ships lives under `src/`
// ([internal ref] D3, superseding [internal ref] D1 in its LOCATION only). Being an app has
// never meant living beside the apps Sovrium merely deploys: `apps/website` and
// `apps/partner` are Sovrium's own surfaces, run by nobody else, while this one
// renders on every operator's instance.
//
// It stays PLATFORM-OWNED. It is version-locked to the release, compiled into the
// binary as a preset, and the operator's config never contains it — only WHETHER
// it is served (`admin`, a plain boolean: absent or `true` serves it at the fixed
// `/_admin`, `false` serves it nowhere, and `SOVRIUM_ADMIN=off` is the env-level
// kill switch). That is the whole of D4: the host's `design` cascades onto it, page
// structure and backend do not.
//
// `name` IS LOAD-BEARING AND MUST NOT CHANGE. `isOperatorConsoleApp`
// (`src/domain/models/app/admin/admin-data-nav.ts`) keys on this exact string to recognise a
// console surface — it is what collapses every console page onto one stylesheet
// identity instead of a per-surface hash. Renaming it silently repaints the
// console with the operator's design.
//
// THE CONFIG TYPES ARE IMPORTED UNDER THE NAMES AN OPERATOR WRITES, and the
// aliasing is deliberate rather than cosmetic. A config outside the repo names
// the `sovrium` package; under `src/` that specifier is the wrong one to reach
// for, so these sites name `@/domain/models/app` — which is where `sovrium`'s
// own declaration is generated FROM, so the types are identical. What the alias preserves
// is the property [internal ref] D5 rests on: this console is authored in exactly the
// surface an operator authors, down to the spelling. An operator writes
// `PageConfig`; so does this tree.
//
// The imports stay TYPE-ONLY. The standalone binary loads this config with
// module specifiers left unresolved, so only type-only imports — erased at
// transpile time — are safe. The `admin-config` boundary element holds that
// property mechanically: it permits `domain-app-root` and `domain-feature`,
// type-only, and nothing else.

import templates from './config/components/templates'
import chromeStrings from './config/i18n/chrome'
import commonStrings from './config/i18n/common'
import consoleStrings from './config/i18n/console'
import dataStrings from './config/i18n/data'
import designSystemStrings from './config/i18n/design-system'
import developerStrings from './config/i18n/developers'
import frStrings from './config/i18n/fr'
import surfaceStrings from './config/i18n/surfaces'
import acceptInvitation from './config/pages/accept-invitation'
import apiKeys from './config/pages/api-keys'
import { dataPages } from './config/pages/data/data-pages'
import { decisionPages } from './config/pages/decisions'
import { designSystemPages } from './config/pages/design-system/design-system-pages'
import { developerPages } from './config/pages/developers/developer-pages'
import env from './config/pages/env'
import forgotPassword from './config/pages/forgot-password'
import gdpr from './config/pages/gdpr'
import home from './config/pages/home'
import login from './config/pages/login'
import notFound from './config/pages/not-found'
import profile from './config/pages/profile'
import resetPassword from './config/pages/reset-password'
import { consoleRedirects } from './config/redirects'
import type { AppEncoded as AppConfig } from '@/domain/models/app'

export default {
  name: 'sovrium-admin-dashboard',
  description: 'Sovrium Native Admin Dashboard — the dogfooded operator console.',

  // Two locales, English and French. Every string the console renders is a
  // `$t:` key with a value in both tables — `config/i18n/parity.test.ts` holds
  // the key sets equal and every referenced key present — so the operator's
  // saved language reaches the whole console, not part of it. There is no
  // per-deployment override seam, and deliberately none: the console is
  // platform-owned and reads the same on every install of a release.
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
  // `translations` carries the console's OWN string tables, one per supported
  // code. They are what make a `$t:admin.*` token in a preset page resolve
  // through the ordinary interpreter path — no console special-casing in the
  // renderer.
  //
  // The English table is SPLIT BY AREA and merged here (`chrome`, `console`,
  // `data`, `developers`, `common`, `surfaces`, `design-system`); French
  // mirrors it file for file and merges in `fr.ts`. One object appended to by
  // every migration in flight is a merge conflict per commit; the merge keeps
  // a key's address stable while its HOME stays an authoring convenience. Keys
  // are namespaced `admin.<surface>.<slot>`, so the files cannot collide.
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
        ...commonStrings,
        ...surfaceStrings,
        ...designSystemStrings,
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

  // No `design`. The console renders on the binary's native default — shadcn/ui,
  // base-nova with Geist — and inherits the host app's design like every page
  // that instance serves. Its scheme follows the operator (the engine default
  // `colorScheme` is `system`) and its code blocks pair a light and a dark
  // theme (the engine default `codeBlock`), so declaring either here would
  // restate the default. `app.test.ts` holds the key absent.

  // Every page MOUNT-RELATIVE. The console is served at one fixed base,
  // `/_admin`, and the mount primitive prefixes each path with it at render
  // time — `/login` is what is authored here, `/_admin/login` is what ships.
  // Writing the base into the config would double it.
  //
  // The three account surfaces — profile, gdpr, api-keys — were TypeScript
  // builders synthesised per request until the shell became config. They are
  // static bodies over existing endpoints, so nothing about them needed a
  // builder except the shell they had no other way to reach. `api-keys` carries
  // `requires: ['auth.apiKeys']`, so the capability gate is declared in config
  // rather than hand-written.
  //
  // The operator-DATA surfaces arrive as ONE area module
  // (`config/pages/data/data-pages.ts`)
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
    acceptInvitation,
    // Inside the shell, for a signed-in operator on an address no page answers.
    notFound,
  ],

  // The addresses the console retired when its sections took the names the
  // sidebar gives them, each answering a permanent move to its new home. The
  // table and why it is shaped the way it is: `config/redirects.ts`.
  redirects: consoleRedirects,
} satisfies AppConfig
