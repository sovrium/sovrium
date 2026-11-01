/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CalculationFieldSchema,
  FormAccessSchema,
  FormFieldGroupSchema,
  FormSchema,
  InlinePrefillSchema,
  SectionFieldSchema,
  SignatureFieldSchema,
  StandaloneFieldSchema,
  SubmitToSchema,
  TableBoundFieldSchema,
} from '@/domain/models/app/forms'
import formFieldGroupsBody from '@/domain/models/app/forms/form-field-groups.docs.md' with { type: 'file' }
import formFieldsBody from '@/domain/models/app/forms/form-fields.docs.md' with { type: 'file' }
import formPrefillBody from '@/domain/models/app/forms/form-prefill.docs.md' with { type: 'file' }
import formsOverviewBody from '@/domain/models/app/forms/forms-overview.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Forms — the `forms` and `form-fields` section manifests. The behaviour
 * sections (`form-logic`, `form-delivery`) live in `./forms-behaviour`.
 */

export const forms = defineSection({
  slug: 'forms',
  title: 'Forms',
  order: 4000,
  tab: 'forms',
  articles: [
    defineArticle({
      slug: 'forms-overview',
      title: 'Forms Overview',
      description:
        'Define standalone forms in the top-level app.forms array — metadata, submit targets, public routes, and access control.',
      keywords: [
        'sovrium',
        'forms',
        'form builder',
        'submitTo',
        'form_submissions',
        'public routes',
        'access control',
        'formRef',
      ],
      order: 4000,
      sidebarLabel: 'Forms Overview',
      body: formsOverviewBody,
      documents: [FormSchema, SubmitToSchema, FormAccessSchema],
      stories: [
        'US-FORMS-EMBEDDED-IN-PAGES',
        'US-FORMS-PUBLIC-ROUTES',
        'US-FORMS-STANDALONE-FORMS',
      ],
    }),
    defineArticle({
      slug: 'form-fields',
      title: 'Form Fields',
      description:
        'Standalone and table-bound form fields — field kinds, common properties, prefill, and inline relationship create.',
      keywords: [
        'sovrium',
        'form fields',
        'table-field',
        'standalone',
        'calculation',
        'signature',
        'prefill',
        '$query',
        '$user',
        '$parent',
        'inline relationship',
        'placeholder',
        'dropdown empty option',
      ],
      order: 4010,
      sidebarLabel: 'Form Fields',
      body: formFieldsBody,
      documents: [
        TableBoundFieldSchema,
        StandaloneFieldSchema,
        CalculationFieldSchema,
        SectionFieldSchema,
        SignatureFieldSchema,
        InlinePrefillSchema,
      ],
      stories: [
        'US-FORMS-FIELDS',
        'US-FORMS-FIELDS-OPTION-SUBSET',
        'US-FORMS-INLINE-RELATIONSHIP-CREATE',
        'US-FORMS-PREFILL',
      ],
    }),
  ],
})

export const formFields = defineSection({
  slug: 'form-fields',
  title: 'Form Fields',
  order: 4100,
  tab: 'forms',
  articles: [
    defineArticle({
      slug: 'form-field-groups',
      title: 'Form Field Groups',
      description:
        'Break a long single-page form into labeled sections with fieldGroups, and hide a whole section behind a condition.',
      keywords: [
        'sovrium',
        'form field groups',
        'fieldGroups',
        'section divider',
        'form sections',
        'visibleWhen',
        'conditional section',
      ],
      order: 4100,
      sidebarLabel: 'Field Groups',
      body: formFieldGroupsBody,
      documents: [FormFieldGroupSchema],
      stories: ['US-FORMS-FIELD-GROUPS'],
    }),
    defineArticle({
      slug: 'form-prefill',
      title: 'Form Prefill',
      description:
        'Seed form fields at render time from the URL query string, the signed-in user, or a literal default — declared once in a prefill map.',
      keywords: [
        'sovrium',
        'form prefill',
        'prefill map',
        '$query',
        '$user',
        'utm tracking',
        'hidden field',
        'default value',
        'campaign attribution',
      ],
      order: 4110,
      sidebarLabel: 'Prefill',
      body: formPrefillBody,
      documents: [],
      stories: [],
    }),
  ],
})
