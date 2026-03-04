/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutWarning, codeBlock, docsPage, propertyTable, sectionHeader } from './shared'

export const docsAuth = docsPage({
  activeId: 'auth',
  path: '/docs/auth',
  metaTitle: '$t:docs.auth.meta.title',
  metaDescription: '$t:docs.auth.meta.description',
  keywords:
    'sovrium, authentication, OAuth, email password, magic link, roles, RBAC, two-factor, SSO',
  toc: [
    { label: '$t:docs.auth.basic.title', anchor: 'basic-setup' },
    { label: '$t:docs.auth.strategies.title', anchor: 'strategies' },
    { label: '$t:docs.auth.oauth.title', anchor: 'oauth' },
    { label: '$t:docs.auth.roles.title', anchor: 'roles' },
    { label: '$t:docs.auth.twoFactor.title', anchor: 'two-factor' },
    { label: '$t:docs.auth.emails.title', anchor: 'email-templates' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.auth.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.auth.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Basic Setup ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.auth.basic.title', '$t:docs.auth.basic.description', 'basic-setup'),
        codeBlock(
          'auth:\n  strategies:\n    - type: email-password\n  defaultRole: member',
          'yaml'
        ),
      ],
    },

    // ── Strategy Comparison ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.auth.strategies.title',
          '$t:docs.auth.strategies.description',
          'strategies'
        ),
        propertyTable([
          { name: 'email-password', description: '$t:docs.auth.strategies.emailPassword' },
          { name: 'magic-link', description: '$t:docs.auth.strategies.magicLink' },
          { name: 'oauth', description: '$t:docs.auth.strategies.oauth' },
        ]),
      ],
    },

    // ── Adding OAuth ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.auth.oauth.title', '$t:docs.auth.oauth.description', 'oauth'),
        codeBlock(
          'auth:\n  strategies:\n    - type: email-password\n    - type: magic-link\n    - type: oauth\n      provider: google\n    - type: oauth\n      provider: github',
          'yaml'
        ),
        calloutWarning('$t:docs.auth.oauth.warning.title', '$t:docs.auth.oauth.warning.body'),
      ],
    },

    // ── Roles & Permissions ──────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.auth.roles.title', '$t:docs.auth.roles.description', 'roles'),
        codeBlock(
          'auth:\n  strategies:\n    - type: email-password\n  defaultRole: member\n  roles:\n    - name: editor\n      description: Can edit content\n    - name: reviewer\n      description: Can approve changes',
          'yaml'
        ),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6' },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: 'admin',
                description: '$t:docs.auth.roles.admin',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: 'member',
                description: '$t:docs.auth.roles.member',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: 'viewer',
                description: '$t:docs.auth.roles.viewer',
              },
            },
          ],
        },
      ],
    },

    // ── Two-Factor Auth ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.auth.twoFactor.title',
          '$t:docs.auth.twoFactor.description',
          'two-factor'
        ),
        codeBlock('auth:\n  strategies:\n    - type: email-password\n  twoFactor: true', 'yaml'),
      ],
    },

    // ── Email Templates ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.auth.emails.title',
          '$t:docs.auth.emails.description',
          'email-templates'
        ),
        codeBlock(
          'auth:\n  strategies:\n    - type: email-password\n  emails:\n    verification:\n      subject: "Verify your email, $name"\n      body: "Click here to verify: $url"\n    passwordReset:\n      subject: "Reset your password"\n      body: "Hi $name, reset here: $url"\n    magicLink:\n      subject: "Your sign-in link"\n      body: "Click to sign in: $url"',
          'yaml'
        ),
        propertyTable([
          { name: '$name', description: '$t:docs.auth.emails.var.name' },
          { name: '$url', description: '$t:docs.auth.emails.var.url' },
          { name: '$email', description: '$t:docs.auth.emails.var.email' },
          { name: '$organizationName', description: '$t:docs.auth.emails.var.org' },
          { name: '$inviterName', description: '$t:docs.auth.emails.var.inviter' },
        ]),
      ],
    },
  ],
})
