/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { GroupSchema, RoleDefinitionSchema } from '@/domain/models/app/auth'
import authAssignmentsBody from '@/domain/models/app/auth/auth-assignments.docs.md' with { type: 'file' }
import authGroupsBody from '@/domain/models/app/auth/auth-groups.docs.md' with { type: 'file' }
import authPostLoginBody from '@/domain/models/app/auth/auth-post-login.docs.md' with { type: 'file' }
import authRolesRbacBody from '@/domain/models/app/auth/auth-roles-rbac.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const authAccess = defineSection({
  slug: 'auth-access',
  title: 'Access Control',
  order: 7200,
  tab: 'auth',
  articles: [
    defineArticle({
      slug: 'auth-roles-rbac',
      title: 'Roles & RBAC',
      description:
        'Define custom roles, understand the built-in admin/member/viewer hierarchy, and learn how role levels drive permission resolution.',
      keywords: [
        'sovrium',
        'RBAC',
        'roles',
        'role hierarchy',
        'admin member viewer',
        'custom roles',
        'role level',
        'defaultRole',
        'permissions',
        'access control',
      ],
      order: 7200,
      sidebarLabel: 'Roles & RBAC',
      body: authRolesRbacBody,
      documents: [RoleDefinitionSchema],
      stories: ['US-AUTH-ADMIN-PLANE-ROLE-GUARD', 'US-AUTH-ROLE-DEFINITIONS'],
    }),
    defineArticle({
      slug: 'auth-groups',
      title: 'Groups',
      description:
        'Organize users into groups for many-to-many membership and group-based table and field permissions using the group prefix.',
      keywords: [
        'sovrium',
        'groups',
        'teams',
        'membership',
        'group permissions',
        'group prefix',
        'RBAC',
        'field-level permissions',
        'maxMembers',
      ],
      order: 7210,
      sidebarLabel: 'Groups',
      body: authGroupsBody,
      documents: [GroupSchema],
      stories: [
        'US-AUTH-GROUPS-001',
        'US-AUTH-GROUPS-002',
        'US-AUTH-GROUPS-003',
        'US-AUTH-GROUPS-005',
        'US-AUTH-GROUPS-006',
      ],
    }),
    defineArticle({
      slug: 'auth-post-login',
      title: 'Post-Login Landing',
      description:
        'Route users to the right page after sign-in — the landingPath mount, per-role defaultLanding and pickerLanding, and the noAccessPath fallback.',
      keywords: [
        'sovrium',
        'post-login landing',
        'defaultLanding',
        'pickerLanding',
        'landingPath',
        'noAccessPath',
        'per-role redirect',
        'multi-tenant portal',
        'declaration order',
      ],
      order: 7220,
      sidebarLabel: 'Post-Login Landing',
      body: authPostLoginBody,
      documents: [],
      stories: ['US-AUTH-POST-LOGIN-LANDING'],
    }),
    defineArticle({
      slug: 'auth-assignments',
      title: 'Assignments & Landing Guards',
      description:
        'The $currentUser.assignments token in landing URLs and dataSource filters, and why the landingPath page is the guard that keeps anonymous visitors out.',
      keywords: [
        'sovrium',
        'currentUser assignments',
        'assignment token',
        'user_access',
        'scope table',
        'dataSource filter',
        'landing guard',
        'co-located page',
        'access require authenticated',
      ],
      order: 7224,
      sidebarLabel: 'Assignments & Guards',
      body: authAssignmentsBody,
      documents: [],
      stories: ['US-AUTH-GROUPS-004'],
    }),
  ],
})
