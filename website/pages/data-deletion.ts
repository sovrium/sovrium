/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footer } from './footer'
import { navbar } from './navbar'
import type { Page } from '@/index'

export const dataDeletion: Page = {
  name: 'data-deletion',
  path: '/data-deletion',
  meta: {
    title: 'Data Deletion Request - Sovrium',
    description:
      'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
    canonical: 'https://sovrium.com/data-deletion',
    openGraph: {
      title: 'Data Deletion Request - Sovrium',
      description:
        'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
      url: 'https://sovrium.com/data-deletion',
      image: 'https://sovrium.com/favicon/android-chrome-512x512.png',
      siteName: 'Sovrium',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Data Deletion Request - Sovrium',
      description:
        'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
      image: 'https://sovrium.com/favicon/android-chrome-512x512.png',
    },
    favicons,
  },
  sections: [
    // Navigation Bar
    navbar,

    // Header
    {
      type: 'section',
      props: {
        className:
          'py-16 md:py-24 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h1',
              content: 'Data Deletion Request',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: 'Last Updated: February 20, 2026',
              props: { className: 'text-sovereignty-gray-400' },
            },
          ],
        },
      ],
    },

    // Content
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            // Introduction
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'paragraph',
                  content:
                    'This page explains how to request the deletion of your personal data in connection with Sovrium software and services operated by ESSENTIAL SERVICES. Depending on how you interact with Sovrium, the process may differ.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 1 - Sovrium Software (Self-Hosted)
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '1. Sovrium Software (Self-Hosted Installations)',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium is a self-hosted, configuration-driven application platform. When an organization deploys Sovrium on their own infrastructure, they are the data controller for all user data processed by that installation. ESSENTIAL SERVICES does not have access to data stored in self-hosted Sovrium instances.',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: 'If you are a user of a Sovrium-powered application:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content:
                        '• Contact the administrator of the organization that operates the application',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• The organization is responsible for handling your data deletion request under applicable data protection laws (e.g., GDPR)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• ESSENTIAL SERVICES cannot delete data from self-hosted installations as we do not have access to them',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 2 - Facebook Login / Social Authentication
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '2. Facebook Login and Social Authentication',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium-powered applications may integrate Facebook Login as an authentication method. When you use Facebook Login to sign in to a Sovrium-powered application, certain data from your Facebook profile may be shared with that application.',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'The following data types may be stored and are subject to deletion upon request:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '\u2022 Your name (as provided by Facebook)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '\u2022 Your email address',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '\u2022 Your profile picture URL',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '\u2022 Your Facebook user ID',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 Any application-specific data created during your use of the Sovrium-powered application',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: 'To delete your data associated with Facebook Login:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },

                {
                  type: 'h3',
                  content: 'Step 1: Remove the app from Facebook',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Go to your Facebook Settings',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Navigate to Settings & Privacy > Settings > Apps and Websites',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• Find the Sovrium-powered application and click "Remove" to revoke access',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• Check the box to delete any data the app may have received from Facebook',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: 'Step 2: Contact the application administrator',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content:
                        '• Contact the organization that operates the Sovrium-powered application',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• Request deletion of all personal data stored in their Sovrium installation, including data received via Facebook Login',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: 'Step 3: For applications operated by ESSENTIAL SERVICES',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'If the application is directly operated by ESSENTIAL SERVICES, you can request data deletion by emailing privacy@sovrium.com with the subject line "Data Deletion Request". Please include the email address associated with your account.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 3 - sovrium.com Website
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '3. sovrium.com Website',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'The sovrium.com website collects minimal data. We do not use cookies, do not require user accounts, and do not collect personal information through our website. If you believe we hold any personal data about you from your interactions with our website, you may contact us at privacy@sovrium.com to request its deletion.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 4 - Data Deletion Confirmation
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '4. Data Deletion Confirmation',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'When we receive a valid data deletion request for services operated by ESSENTIAL SERVICES:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• We will process your request within 30 days of receipt',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• We will send you a confirmation once your data has been deleted',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• Some data may be retained if required by law or legitimate legal obligations',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '• You will receive a confirmation code via email that you can use to verify the status of your deletion request',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 5 - Contact
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '5. Contact',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: 'For data deletion requests or questions about your data:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Email: privacy@sovrium.com',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• RCS Paris \u2014 SIREN: 834 241 481',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• SIRET: 834 241 481 00029',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• TVA: FR04834241481',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• President: Thomas Jeanneau',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // Footer
    footer,
  ],
}
