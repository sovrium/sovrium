/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, propertyTable, sectionHeader } from './shared'

export const docsTheme = docsPage({
  activeId: 'theme',
  path: '/docs/theme',
  metaTitle: '$t:docs.theme.meta.title',
  metaDescription: '$t:docs.theme.meta.description',
  toc: [
    { label: '$t:docs.theme.colors.title', anchor: 'colors' },
    { label: '$t:docs.theme.fonts.title', anchor: 'fonts' },
    { label: '$t:docs.theme.spacing.title', anchor: 'spacing' },
    { label: '$t:docs.theme.advanced.title', anchor: 'advanced' },
    { label: '$t:docs.theme.fullExample.title', anchor: 'full-example' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.theme.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.theme.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Colors ───────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.theme.colors.title', '$t:docs.theme.colors.description', 'colors'),
        propertyTable([
          { name: '{name}', description: '$t:docs.theme.colors.props.name' },
          { name: 'CSS output', description: '$t:docs.theme.colors.props.output' },
        ]),
        codeBlock(
          'theme:\n  colors:\n    primary: "#3b82f6"\n    secondary: "#8b5cf6"\n    accent: "#f59e0b"\n    background: "#0a0e1a"\n    text: "#e8ecf4"\n    muted: "#64748b"',
          'yaml'
        ),
      ],
    },

    // ── Fonts ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.theme.fonts.title', '$t:docs.theme.fonts.description', 'fonts'),
        propertyTable([
          { name: 'family', description: '$t:docs.theme.fonts.props.family' },
          { name: 'fallback', description: '$t:docs.theme.fonts.props.fallback' },
          { name: 'weights', description: '$t:docs.theme.fonts.props.weights' },
          { name: 'size', description: '$t:docs.theme.fonts.props.size' },
          { name: 'lineHeight', description: '$t:docs.theme.fonts.props.lineHeight' },
          { name: 'googleFontsUrl', description: '$t:docs.theme.fonts.props.googleFontsUrl' },
        ]),
        codeBlock(
          'theme:\n  fonts:\n    heading:\n      family: Inter\n      weights: [600, 700]\n      lineHeight: "1.2"\n    body:\n      family: Inter\n      size: "16px"\n      googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"',
          'yaml'
        ),
        calloutTip('$t:docs.theme.fonts.tip.title', '$t:docs.theme.fonts.tip.body'),
      ],
    },

    // ── Spacing ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.theme.spacing.title',
          '$t:docs.theme.spacing.description',
          'spacing'
        ),
        codeBlock(
          'theme:\n  spacing:\n    container: "max-w-7xl mx-auto px-4"\n    section: "py-16 sm:py-20"\n    card: "p-6"\n    gap: "gap-8"',
          'yaml'
        ),
      ],
    },

    // ── Shadows, Animations, Breakpoints, Border Radius ──────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.theme.advanced.title',
          '$t:docs.theme.advanced.description',
          'advanced'
        ),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6' },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.shadows.title',
                description: '$t:docs.theme.shadows.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.animations.title',
                description: '$t:docs.theme.animations.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.breakpoints.title',
                description: '$t:docs.theme.breakpoints.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.borderRadius.title',
                description: '$t:docs.theme.borderRadius.description',
              },
            },
          ],
        },
        codeBlock(
          'theme:\n  shadows:\n    card: "0 4px 6px rgba(0, 0, 0, 0.1)"\n    elevated: "0 10px 30px rgba(0, 0, 0, 0.2)"\n  borderRadius:\n    card: "0.75rem"\n    button: "0.5rem"\n  breakpoints:\n    tablet: 768\n    desktop: 1024',
          'yaml'
        ),
      ],
    },

    // ── Full Example ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.theme.fullExample.title',
          '$t:docs.theme.fullExample.description',
          'full-example'
        ),
        codeBlock(
          'theme:\n  colors:\n    primary: "#6366f1"\n    secondary: "#8b5cf6"\n    accent: "#f59e0b"\n    background: "#0f172a"\n    surface: "#1e293b"\n    text: "#f8fafc"\n    muted: "#94a3b8"\n  fonts:\n    heading:\n      family: Inter\n      weights: [600, 700]\n      url: "https://fonts.googleapis.com/css2?family=Inter:wght@600;700&display=swap"\n    body:\n      family: Inter\n      weights: [400, 500]\n  spacing:\n    container: "max-w-6xl mx-auto px-4"\n    section: "py-16 sm:py-20"',
          'yaml'
        ),
        {
          $ref: 'docs-screenshot',
          vars: {
            src: '/docs/screenshots/app-page-en.png',
            alt: '$t:docs.theme.screenshot.alt',
            caption: '$t:docs.theme.screenshot.caption',
          },
        },
      ],
    },
  ],
})
