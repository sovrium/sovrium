/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, sectionHeader, step } from './shared'

export const docsLanguages = docsPage({
  activeId: 'languages',
  path: '/docs/languages',
  metaTitle: '$t:docs.languages.meta.title',
  metaDescription: '$t:docs.languages.meta.description',
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.languages.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.languages.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
      ],
    },

    // ── Defining Languages ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.languages.defining.title',
          '$t:docs.languages.defining.description',
          'defining-languages'
        ),
        codeBlock(
          'languages:\n  default: en\n  supported:\n    - code: en\n      locale: en-US\n      label: English\n      direction: ltr\n    - code: fr\n      locale: fr-FR\n      label: "Fran\u00E7ais"\n      direction: ltr\n    - code: ar\n      locale: ar-SA\n      label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629"\n      direction: rtl',
          'yaml'
        ),
      ],
    },

    // ── Translation Keys ─────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.languages.translations.title',
          '$t:docs.languages.translations.description',
          'translation-keys'
        ),
        codeBlock(
          'languages:\n  translations:\n    en:\n      hero.title: "Welcome to My App"\n      hero.description: "Build faster with Sovrium"\n      nav.home: "Home"\n      nav.about: "About"\n    fr:\n      hero.title: "Bienvenue sur Mon App"\n      hero.description: "Construisez plus vite avec Sovrium"\n      nav.home: "Accueil"\n      nav.about: "\u00C0 propos"',
          'yaml'
        ),
      ],
    },

    // ── Using Translations ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.languages.usage.title',
          '$t:docs.languages.usage.description',
          'using-translations'
        ),
        codeBlock(
          '# Reference translations with $t: prefix\npages:\n  - name: home\n    path: /\n    sections:\n      - type: section\n        children:\n          - type: h1\n            content: "$t:hero.title"\n          - type: paragraph\n            content: "$t:hero.description"',
          'yaml'
        ),
        calloutTip('$t:docs.languages.syntax.title', '$t:docs.languages.syntax.description'),

        // Translation comparison screenshots
        {
          type: 'div',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6' },
          children: [
            {
              $ref: 'docs-screenshot',
              vars: {
                src: '/docs/screenshots/app-translation-en.png',
                alt: '$t:docs.languages.screenshot.en.alt',
                caption: '$t:docs.languages.screenshot.en.caption',
              },
            },
            {
              $ref: 'docs-screenshot',
              vars: {
                src: '/docs/screenshots/app-translation-fr.png',
                alt: '$t:docs.languages.screenshot.fr.alt',
                caption: '$t:docs.languages.screenshot.fr.caption',
              },
            },
          ],
        },
      ],
    },

    // ── Adding a New Language ─────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.languages.adding.title',
          '$t:docs.languages.adding.description',
          'adding-language'
        ),
        step(
          '1',
          '$t:docs.languages.adding.step1.title',
          '$t:docs.languages.adding.step1.description'
        ),
        step(
          '2',
          '$t:docs.languages.adding.step2.title',
          '$t:docs.languages.adding.step2.description'
        ),
        step(
          '3',
          '$t:docs.languages.adding.step3.title',
          '$t:docs.languages.adding.step3.description'
        ),
      ],
    },
  ],
})
