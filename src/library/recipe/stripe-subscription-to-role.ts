/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** The Stripe event types the recipe answers, and the branch each one takes. */
const event = (type: string) => ({
  conditions: [{ field: '{{trigger.data.body.type}}', operator: 'equals', value: type }],
})

/** The row of the subscriptions table that one Stripe subscription id names. */
const bySubscription = (id: string) => ({
  conditions: [{ field: 'stripe_subscription', operator: 'equals', value: id }],
})

/** A completed checkout: save the subscription, give the paying account the role. */
const checkoutCompleted = (table: string, role: string) => ({
  name: 'checkout-completed',
  condition: event('checkout.session.completed'),
  actions: [
    {
      name: 'saveSubscription',
      type: 'record' as const,
      operator: 'upsert' as const,
      props: {
        table,
        filter: bySubscription('{{trigger.data.body.data.object.subscription}}'),
        data: {
          user_id: '{{trigger.data.body.data.object.client_reference_id}}',
          stripe_customer: '{{trigger.data.body.data.object.customer}}',
          stripe_subscription: '{{trigger.data.body.data.object.subscription}}',
          status: 'active',
        },
      },
    },
    {
      name: 'grantRole',
      type: 'auth' as const,
      operator: 'assignRole' as const,
      props: { userId: '{{trigger.data.body.data.object.client_reference_id}}', role },
    },
  ],
})

/** A renewal or a change: keep the row's status and period end current. */
const subscriptionUpdated = (table: string) => ({
  name: 'subscription-updated',
  condition: event('customer.subscription.updated'),
  actions: [
    {
      name: 'updateSubscription',
      type: 'record' as const,
      operator: 'upsert' as const,
      props: {
        table,
        filter: bySubscription('{{trigger.data.body.data.object.id}}'),
        data: {
          stripe_subscription: '{{trigger.data.body.data.object.id}}',
          status: '{{trigger.data.body.data.object.status}}',
          current_period_end: '{{trigger.data.body.data.object.current_period_end}}',
        },
      },
    },
  ],
})

/** Stripe ended the subscription: close the row, return the account to the fallback role. */
const subscriptionEnded = (table: string, fallbackRole: string) => ({
  name: 'subscription-ended',
  condition: event('customer.subscription.deleted'),
  actions: [
    {
      name: 'findSubscription',
      type: 'record' as const,
      operator: 'list' as const,
      props: { table, filter: bySubscription('{{trigger.data.body.data.object.id}}'), limit: 1 },
    },
    {
      name: 'closeSubscription',
      type: 'record' as const,
      operator: 'update' as const,
      props: {
        table,
        filter: bySubscription('{{trigger.data.body.data.object.id}}'),
        data: { status: 'canceled' },
      },
    },
    {
      name: 'revokeRole',
      type: 'auth' as const,
      operator: 'assignRole' as const,
      props: { userId: '{{findSubscription.record.user_id}}', role: fallbackRole },
    },
  ],
})

/** A failed payment: mark the row past due and tell the customer; access stays. */
const paymentFailed = (table: string) => ({
  name: 'payment-failed',
  condition: event('invoice.payment_failed'),
  actions: [
    {
      name: 'markPastDue',
      type: 'record' as const,
      operator: 'update' as const,
      props: {
        table,
        filter: bySubscription('{{trigger.data.body.data.object.subscription}}'),
        data: { status: 'past_due' },
      },
    },
    {
      name: 'notifyMember',
      type: 'email' as const,
      operator: 'send' as const,
      props: {
        to: '{{trigger.data.body.data.object.customer_email}}',
        subject: 'Your payment did not go through',
        body: '<p>We could not take your membership payment. Please update your card from your billing page; your access stays open while we retry.</p>',
      },
    },
  ],
})

/**
 * Paid memberships with Stripe: a verified Stripe webhook keeps a row per
 * subscription in a table the operator owns and gives or takes the member
 * role. A completed checkout grants the role; Stripe ends a subscription
 * cancelled at period end with `customer.subscription.deleted` when the period
 * is over, which revokes it; a failed payment mails the member and keeps the
 * access until Stripe ends the subscription.
 *
 * The role is a parameter written in the config, never read from the request,
 * and the person is the `client_reference_id` the operator's own checkout link
 * carried — so a signed event can only give the configured role to the account
 * that paid.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'stripe-subscription-to-role',
  title: 'Grant a role to paying members with Stripe',
  category: 'finance',
  tags: ['stripe', 'subscription', 'membership', 'payment', 'role', 'paywall'],
  description:
    'An automation that gives a member a role when their Stripe subscription starts, takes it back when it ends, and mails them when a payment fails.',
  notes: [
    'Point a Stripe webhook endpoint at `/api/automations/<name>/webhook` and subscribe it to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`. Every event is verified with the endpoint’s signing secret, read from `STRIPE_WEBHOOK_SECRET`; an unsigned or wrongly signed request is refused and runs nothing.',
    'Create each checkout with `client_reference_id` set to the signed-in member’s account id. A completed checkout then writes the subscription to the table named by `table` and gives that account the role named by `role`.',
    'When Stripe ends a subscription (a cancellation at the end of the period ends it then), the row is marked `canceled` and the account goes back to `fallbackRole`. A renewal or a change updates the row’s `status` and `current_period_end` (Unix seconds).',
    'A failed payment marks the row `past_due` and mails the customer, who keeps the role until Stripe ends the subscription after its retries.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table holding one row per Stripe subscription.',
      type: 'string',
      default: 'subscriptions',
    },
    {
      name: 'role',
      description: 'The role a paying member gets.',
      type: 'string',
      default: 'member',
    },
    {
      name: 'fallbackRole',
      description: 'The role a member goes back to when the subscription ends.',
      type: 'string',
      default: 'viewer',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'user_id', type: 'single-line-text' },
        { name: 'stripe_customer', type: 'single-line-text' },
        { name: 'stripe_subscription', type: 'single-line-text' },
        { name: 'status', type: 'single-line-text' },
        { name: 'current_period_end', type: 'integer' },
      ],
    },
  ],
  env: ['STRIPE_WEBHOOK_SECRET'],
  requires: [],
  provider: {
    name: 'Stripe',
    docsUrl: 'https://docs.stripe.com/billing/subscriptions/webhooks',
    verifiedOn: '2026-10-24',
  },
  build: ({ name, params }) => {
    const table = String(params['table'] ?? 'subscriptions')
    return {
      name,
      trigger: {
        type: 'webhook',
        method: 'POST',
        auth: { type: 'hmac', scheme: 'stripe', secret: '$env.STRIPE_WEBHOOK_SECRET' },
      },
      actions: [
        {
          name: 'route',
          type: 'path',
          operator: 'branch',
          props: {
            mode: 'first-match',
            paths: [
              checkoutCompleted(table, String(params['role'] ?? 'member')),
              subscriptionUpdated(table),
              subscriptionEnded(table, String(params['fallbackRole'] ?? 'viewer')),
              paymentFailed(table),
            ],
          },
        },
      ],
    }
  },
})
