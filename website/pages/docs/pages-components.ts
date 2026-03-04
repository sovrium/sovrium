/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  badgeGroup,
  calloutTip,
  codeBlock,
  docsPage,
  propertyTable,
  sectionHeader,
  subsectionHeader,
} from './shared'

export const docsPages = docsPage({
  activeId: 'pages',
  path: '/docs/pages',
  metaTitle: '$t:docs.pages.meta.title',
  metaDescription: '$t:docs.pages.meta.description',
  toc: [
    { label: '$t:docs.pages.structure.title', anchor: 'page-structure' },
    { label: '$t:docs.pages.pageProps.title', anchor: 'page-properties' },
    { label: '$t:docs.pages.metaSeo.title', anchor: 'meta-seo' },
    { label: '$t:docs.pages.componentModel.title', anchor: 'component-model' },
    {
      label: '$t:docs.pages.componentTypes.title',
      anchor: 'component-types',
      children: [
        { label: '$t:docs.pages.componentTypes.layout', anchor: 'comp-layout' },
        { label: '$t:docs.pages.componentTypes.typography', anchor: 'comp-typography' },
        { label: '$t:docs.pages.componentTypes.media', anchor: 'comp-media' },
        { label: '$t:docs.pages.componentTypes.interactive', anchor: 'comp-interactive' },
        { label: '$t:docs.pages.componentTypes.display', anchor: 'comp-display' },
        { label: '$t:docs.pages.componentTypes.feedback', anchor: 'comp-feedback' },
      ],
    },
    { label: '$t:docs.pages.interactions.title', anchor: 'interactions' },
    { label: '$t:docs.pages.templates.title', anchor: 'templates' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.pages.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.pages.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Page Structure ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.structure.title',
          '$t:docs.pages.structure.description',
          'page-structure'
        ),
        codeBlock(
          'pages:\n  - name: home\n    path: /\n    meta:\n      title: "My App - Home"\n      description: "Welcome to my application"\n      openGraph:\n        title: "My App"\n        description: "A Sovrium-powered application"\n        image: "/og-image.png"\n    sections:\n      - type: section\n        props:\n          className: "py-20 bg-gray-900"\n        children:\n          - type: h1\n            content: "Welcome"\n          - type: paragraph\n            content: "Built with Sovrium"',
          'yaml'
        ),
      ],
    },

    // ── Page Properties ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.pageProps.title',
          '$t:docs.pages.pageProps.description',
          'page-properties'
        ),
        propertyTable([
          { name: 'name', description: '$t:docs.pages.pageProps.name' },
          { name: 'path', description: '$t:docs.pages.pageProps.path' },
          { name: 'meta', description: '$t:docs.pages.pageProps.meta' },
          { name: 'sections', description: '$t:docs.pages.pageProps.sections' },
          { name: 'scripts', description: '$t:docs.pages.pageProps.scripts' },
        ]),
      ],
    },

    // ── Meta & SEO ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.metaSeo.title',
          '$t:docs.pages.metaSeo.description',
          'meta-seo'
        ),
        propertyTable([
          { name: 'meta.title', description: '$t:docs.pages.meta.props.title' },
          { name: 'meta.description', description: '$t:docs.pages.meta.props.description' },
          { name: 'meta.openGraph', description: '$t:docs.pages.meta.props.openGraph' },
          { name: 'meta.twitter', description: '$t:docs.pages.meta.props.twitter' },
          { name: 'meta.structuredData', description: '$t:docs.pages.meta.props.structuredData' },
          { name: 'meta.favicon', description: '$t:docs.pages.meta.props.favicon' },
          { name: 'meta.canonical', description: '$t:docs.pages.meta.props.canonical' },
        ]),
        codeBlock(
          'meta:\n  title: "My App - Home"\n  description: "Welcome to my application"\n  canonical: "https://myapp.com"\n  favicon: "/favicon.ico"\n  openGraph:\n    title: "My App"\n    description: "A powerful application"\n    image: "/og-image.png"\n    type: website\n  twitter:\n    card: summary_large_image\n    site: "@myapp"\n  structuredData:\n    type: WebApplication\n    name: "My App"',
          'yaml'
        ),
      ],
    },

    // ── Component Model ─────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.componentModel.title',
          '$t:docs.pages.componentModel.description',
          'component-model'
        ),
        propertyTable([
          { name: 'type', description: '$t:docs.pages.componentModel.type' },
          { name: 'content', description: '$t:docs.pages.componentModel.content' },
          { name: 'props', description: '$t:docs.pages.componentModel.props' },
          { name: 'children', description: '$t:docs.pages.componentModel.children' },
          { name: 'interactions', description: '$t:docs.pages.componentModel.interactions' },
          { name: '$ref', description: '$t:docs.pages.componentModel.ref' },
          { name: 'vars', description: '$t:docs.pages.componentModel.vars' },
        ]),
        calloutTip(
          '$t:docs.pages.componentModel.tip.title',
          '$t:docs.pages.componentModel.tip.body'
        ),
      ],
    },

    // ── Screenshot: Page Output Example ────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          $ref: 'docs-screenshot',
          vars: {
            src: '/docs/screenshots/app-hero-section.png',
            alt: '$t:docs.pages.screenshot.hero.alt',
            caption: '$t:docs.pages.screenshot.hero.caption',
          },
        },
        {
          $ref: 'docs-screenshot',
          vars: {
            src: '/docs/screenshots/app-features-section.png',
            alt: '$t:docs.pages.screenshot.features.alt',
            caption: '$t:docs.pages.screenshot.features.caption',
          },
        },
      ],
    },

    // ── Component Types ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.componentTypes.title',
          '$t:docs.pages.componentTypes.description',
          'component-types'
        ),

        // Layout
        subsectionHeader(
          '$t:docs.pages.componentTypes.layout',
          '$t:docs.pages.componentTypes.layout.description',
          'comp-layout'
        ),
        badgeGroup('', [
          'section',
          'container',
          'flex',
          'grid',
          'responsive-grid',
          'div',
          'span',
          'header',
          'footer',
          'main',
          'article',
          'aside',
          'nav',
          'modal',
          'sidebar',
        ]),
        codeBlock(
          'sections:\n  - type: section\n    props:\n      className: "py-20 bg-gray-900"\n    children:\n      - type: container\n        props:\n          className: "max-w-4xl mx-auto px-4"\n        children:\n          - type: grid\n            props:\n              className: "grid grid-cols-3 gap-8"',
          'yaml'
        ),

        // Typography
        subsectionHeader(
          '$t:docs.pages.componentTypes.typography',
          '$t:docs.pages.componentTypes.typography.description',
          'comp-typography'
        ),
        badgeGroup('', [
          'heading',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'text',
          'single-line-text',
          'paragraph',
          'p',
          'code',
          'pre',
        ]),

        // Media
        subsectionHeader(
          '$t:docs.pages.componentTypes.media',
          '$t:docs.pages.componentTypes.media.description',
          'comp-media'
        ),
        badgeGroup('', [
          'image',
          'img',
          'icon',
          'avatar',
          'thumbnail',
          'hero-image',
          'video',
          'audio',
          'iframe',
        ]),
        codeBlock(
          'children:\n  - type: image\n    props:\n      src: "/hero.jpg"\n      alt: "Hero image"\n      className: "w-full rounded-lg"',
          'yaml'
        ),

        // Interactive
        subsectionHeader(
          '$t:docs.pages.componentTypes.interactive',
          '$t:docs.pages.componentTypes.interactive.description',
          'comp-interactive'
        ),
        badgeGroup('', [
          'button',
          'link',
          'a',
          'accordion',
          'dropdown',
          'navigation',
          'form',
          'input',
        ]),

        // Display
        subsectionHeader('$t:docs.pages.componentTypes.display', '', 'comp-display'),
        badgeGroup('', [
          'card',
          'card-with-header',
          'card-header',
          'card-body',
          'card-footer',
          'badge',
          'hero',
          'hero-section',
          'timeline',
          'list',
          'list-item',
          'speech-bubble',
        ]),

        // Feedback
        subsectionHeader('$t:docs.pages.componentTypes.feedback', '', 'comp-feedback'),
        badgeGroup('', ['toast', 'alert', 'spinner', 'fab', 'customHTML']),
      ],
    },

    // ── Interactions ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.interactions.title',
          '$t:docs.pages.interactions.description',
          'interactions'
        ),
        codeBlock(
          'children:\n  - type: button\n    content: "Get Started"\n    props:\n      className: "bg-blue-600 text-white px-6 py-3 rounded-lg"\n    interactions:\n      hover:\n        scale: 1.05\n        shadow: "0 10px 30px rgba(59, 130, 246, 0.3)"\n      click:\n        action: navigate\n        target: "/signup"',
          'yaml'
        ),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6' },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.hover.title',
                description: '$t:docs.pages.interactions.hover.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.click.title',
                description: '$t:docs.pages.interactions.click.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.scroll.title',
                description: '$t:docs.pages.interactions.scroll.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.entrance.title',
                description: '$t:docs.pages.interactions.entrance.description',
              },
            },
          ],
        },
      ],
    },

    // ── Component Templates ──────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.templates.title',
          '$t:docs.pages.templates.description',
          'templates'
        ),
        codeBlock(
          '# Define reusable templates\ncomponents:\n  - name: feature-card\n    type: div\n    props:\n      className: "p-6 rounded-lg border"\n    children:\n      - type: h3\n        content: "$title"\n      - type: paragraph\n        content: "$description"\n\n# Use with $ref\npages:\n  - name: home\n    path: /\n    sections:\n      - type: section\n        children:\n          - $ref: feature-card\n            vars:\n              title: "Fast"\n              description: "Built for speed"',
          'yaml'
        ),
      ],
    },
  ],
})
