/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, sectionHeader } from './shared'

export const docsInstallation = docsPage({
  activeId: 'installation',
  path: '/docs/installation',
  metaTitle: '$t:docs.installation.meta.title',
  metaDescription: '$t:docs.installation.meta.description',
  toc: [
    { label: '$t:docs.installation.global.title', anchor: 'global-installation' },
    { label: '$t:docs.installation.project.title', anchor: 'project-dependency' },
    { label: '$t:docs.installation.verify.title', anchor: 'verify-installation' },
    { label: '$t:docs.installation.config.title', anchor: 'create-config' },
    { label: '$t:docs.installation.database.title', anchor: 'database-setup' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.installation.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.installation.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Prerequisites ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'div',
          props: { className: 'mb-6' },
          children: [
            {
              type: 'h2',
              content: '$t:docs.installation.prerequisites.title',
              props: {
                id: 'prerequisites',
                className: 'text-2xl font-bold text-sovereignty-light mb-2 scroll-mt-20',
              },
            },
            {
              type: 'paragraph',
              props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
              children: [
                {
                  type: 'span',
                  content: '$t:docs.installation.prerequisites.descriptionBefore',
                  props: {},
                },
                {
                  type: 'link',
                  content: '$t:docs.installation.prerequisites.descriptionLink',
                  props: {
                    href: 'https://bun.sh',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'text-sovereignty-accent hover:text-sovereignty-accent/80 underline transition-colors duration-150',
                  },
                },
                {
                  type: 'span',
                  content: '$t:docs.installation.prerequisites.descriptionAfter',
                  props: {},
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Global Installation ─────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.installation.global.title',
          '$t:docs.installation.global.description',
          'global-installation'
        ),
        codeBlock('bun add -g sovrium', 'bash'),
      ],
    },

    // ── Project Dependency ──────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.installation.project.title',
          '$t:docs.installation.project.description',
          'project-dependency'
        ),
        codeBlock('bun add sovrium', 'bash'),
      ],
    },

    // ── Verify Installation ─────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.installation.verify.title',
          '$t:docs.installation.verify.description',
          'verify-installation'
        ),
        codeBlock('sovrium --help', 'bash'),
      ],
    },

    // ── Create a Config File ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.installation.config.title',
          '$t:docs.installation.config.description',
          'create-config'
        ),
        codeBlock('name: my-app', 'yaml'),
        calloutTip('$t:docs.installation.config.tip.title', '$t:docs.installation.config.tip.body'),
      ],
    },

    // ── Database Setup ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.installation.database.title',
          '$t:docs.installation.database.description',
          'database-setup'
        ),
        codeBlock('export DATABASE_URL="postgresql://user:password@localhost:5432/myapp"', 'bash'),
        calloutTip(
          '$t:docs.installation.database.tip.title',
          '$t:docs.installation.database.tip.body'
        ),
      ],
    },
  ],
})
