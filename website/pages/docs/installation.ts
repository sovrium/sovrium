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
        sectionHeader(
          '$t:docs.installation.prerequisites.title',
          '$t:docs.installation.prerequisites.description',
          'prerequisites'
        ),
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
        codeBlock(
          '# With npm\nnpm install -g sovrium\n\n# With Bun (recommended)\nbun add -g sovrium',
          'bash'
        ),
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
        codeBlock(
          '# With npm\nnpm install sovrium\n\n# With Bun (recommended)\nbun add sovrium\n\n# With yarn\nyarn add sovrium\n\n# With pnpm\npnpm add sovrium',
          'bash'
        ),
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
        codeBlock('sovrium --version', 'bash'),
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
        codeBlock(
          'name: my-app\nversion: 1.0.0\ndescription: My first Sovrium application',
          'yaml'
        ),
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
