/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Stripe's API with a secret or restricted key. Stripe accepts the key as a
 * bearer as well as a Basic username; the bearer form needs no empty password.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'stripe',
  title: 'Payments with Stripe (secret key)',
  category: 'finance',
  tags: ['stripe', 'payments', 'customers', 'invoices', 'subscriptions', 'billing'],
  description: 'Authenticated calls to the Stripe API with a secret or restricted key.',
  notes: [
    'Create a restricted key in the Stripe Dashboard under Developers, API keys, grant it only the resources your automations use, and set it as the environment variable. A test-mode key (`sk_test_` or `rk_test_`) keeps every call in your sandbox.',
    'The connection declares no operation yet: add the endpoints you need with `sovrium library add stripe/<operation>`, for example `stripe/post-customers`. Stripe reads request bodies as form fields, which the added operations declare.',
  ],
  params: [],
  env: ['STRIPE_SECRET_KEY'],
  requires: [],
  provider: {
    name: 'Stripe',
    docsUrl: 'https://docs.stripe.com/api/authentication',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Stripe',
    description: 'Stripe API, authenticated with a secret or restricted key',
    props: { token: '$env.STRIPE_SECRET_KEY' },
    baseUrl: 'https://api.stripe.com',
  }),
})
