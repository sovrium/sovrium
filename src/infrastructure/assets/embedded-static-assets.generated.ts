/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// @ts-nocheck

import _a0 from '../../../drizzle/meta/_journal.json' with { type: 'file' }
import _a1 from '../../../drizzle/0000_icy_northstar.sql' with { type: 'file' }
import _a2 from '../../../drizzle/0001_glossy_squadron_supreme.sql' with { type: 'file' }
import _a3 from '../../../drizzle/0002_bitter_calypso.sql' with { type: 'file' }
import _a4 from '../../../drizzle/0003_magenta_the_anarchist.sql' with { type: 'file' }
import _a5 from '../../../drizzle/0004_absurd_zaran.sql' with { type: 'file' }
import _a6 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a7 from '../../../drizzle/sqlite/0000_mute_cassandra_nova.sql' with { type: 'file' }
import _a8 from '../../../drizzle/sqlite/0001_famous_leper_queen.sql' with { type: 'file' }
import _a9 from '../../../drizzle/sqlite/0002_quick_texas_twister.sql' with { type: 'file' }
import _a10 from '../../../drizzle/sqlite/0003_absent_dakota_north.sql' with { type: 'file' }
import _a11 from '../../../drizzle/sqlite/0004_shocking_lyja.sql' with { type: 'file' }
import _a12 from '../../../agents/README.md' with { type: 'file' }
import _a13 from '../../../agents/api-editor.md' with { type: 'file' }
import _a14 from '../../../agents/app-editor.md' with { type: 'file' }
import _a15 from '../../../agents/blog-editor.md' with { type: 'file' }
import _a16 from '../../../agents/crm-editor.md' with { type: 'file' }
import _a17 from '../../../agents/intranet-editor.md' with { type: 'file' }
import _a18 from '../../../agents/mcp-editor.md' with { type: 'file' }
import _a19 from '../../../agents/website-editor.md' with { type: 'file' }
import _a20 from '../../../templates/api-only/.buildpacks' with { type: 'file' }
import _a21 from '../../../templates/api-only/.env.example' with { type: 'file' }
import _a22 from '../../../templates/api-only/app.yaml' with { type: 'file' }
import _a23 from '../../../templates/api-only/config/auth.yaml' with { type: 'file' }
import _a24 from '../../../templates/api-only/config/tables/projects.yaml' with { type: 'file' }
import _a25 from '../../../templates/api-only/config/tables/tasks.yaml' with { type: 'file' }
import _a26 from '../../../templates/api-only/LICENSE' with { type: 'file' }
import _a27 from '../../../templates/api-only/Procfile' with { type: 'file' }
import _a28 from '../../../templates/api-only/README.md' with { type: 'file' }
import _a29 from '../../../templates/api-only/scalingo.json' with { type: 'file' }
import _a30 from '../../../templates/assets/.buildpacks' with { type: 'file' }
import _a31 from '../../../templates/assets/.env.example' with { type: 'file' }
import _a32 from '../../../templates/assets/app.yaml' with { type: 'file' }
import _a33 from '../../../templates/assets/config/auth.yaml' with { type: 'file' }
import _a34 from '../../../templates/assets/config/automations/quarterly-inventory-check.yaml' with { type: 'file' }
import _a35 from '../../../templates/assets/config/pages/_nav.yaml' with { type: 'file' }
import _a36 from '../../../templates/assets/config/pages/board.yaml' with { type: 'file' }
import _a37 from '../../../templates/assets/config/pages/gallery.yaml' with { type: 'file' }
import _a38 from '../../../templates/assets/config/pages/inventory.yaml' with { type: 'file' }
import _a39 from '../../../templates/assets/config/pages/sign-in.yaml' with { type: 'file' }
import _a40 from '../../../templates/assets/config/tables/assets.yaml' with { type: 'file' }
import _a41 from '../../../templates/assets/config/tables/locations.yaml' with { type: 'file' }
import _a42 from '../../../templates/assets/config/theme.yaml' with { type: 'file' }
import _a43 from '../../../templates/assets/LICENSE' with { type: 'file' }
import _a44 from '../../../templates/assets/Procfile' with { type: 'file' }
import _a45 from '../../../templates/assets/public/.gitkeep' with { type: 'file' }
import _a46 from '../../../templates/assets/public/README.md' with { type: 'file' }
import _a47 from '../../../templates/assets/README.md' with { type: 'file' }
import _a48 from '../../../templates/assets/scalingo.json' with { type: 'file' }
import _a49 from '../../../templates/automation-recipes/.buildpacks' with { type: 'file' }
import _a50 from '../../../templates/automation-recipes/.env.example' with { type: 'file' }
import _a51 from '../../../templates/automation-recipes/app.yaml' with { type: 'file' }
import _a52 from '../../../templates/automation-recipes/config/auth.yaml' with { type: 'file' }
import _a53 from '../../../templates/automation-recipes/config/automations/alert-on-failure.yaml' with { type: 'file' }
import _a54 from '../../../templates/automation-recipes/config/automations/capture-lead-from-webhook.yaml' with { type: 'file' }
import _a55 from '../../../templates/automation-recipes/config/automations/daily-digest.yaml' with { type: 'file' }
import _a56 from '../../../templates/automation-recipes/config/automations/log-new-lead.yaml' with { type: 'file' }
import _a57 from '../../../templates/automation-recipes/config/pages/_nav.yaml' with { type: 'file' }
import _a58 from '../../../templates/automation-recipes/config/pages/activity.yaml' with { type: 'file' }
import _a59 from '../../../templates/automation-recipes/config/pages/home.yaml' with { type: 'file' }
import _a60 from '../../../templates/automation-recipes/config/pages/sign-in.yaml' with { type: 'file' }
import _a61 from '../../../templates/automation-recipes/config/tables/activity_log.yaml' with { type: 'file' }
import _a62 from '../../../templates/automation-recipes/config/tables/leads.yaml' with { type: 'file' }
import _a63 from '../../../templates/automation-recipes/config/theme.yaml' with { type: 'file' }
import _a64 from '../../../templates/automation-recipes/LICENSE' with { type: 'file' }
import _a65 from '../../../templates/automation-recipes/Procfile' with { type: 'file' }
import _a66 from '../../../templates/automation-recipes/public/.gitkeep' with { type: 'file' }
import _a67 from '../../../templates/automation-recipes/public/README.md' with { type: 'file' }
import _a68 from '../../../templates/automation-recipes/README.md' with { type: 'file' }
import _a69 from '../../../templates/automation-recipes/scalingo.json' with { type: 'file' }
import _a70 from '../../../templates/blog/.buildpacks' with { type: 'file' }
import _a71 from '../../../templates/blog/.env.example' with { type: 'file' }
import _a72 from '../../../templates/blog/app.yaml' with { type: 'file' }
import _a73 from '../../../templates/blog/config/agents/blog-editor.yaml' with { type: 'file' }
import _a74 from '../../../templates/blog/config/auth.yaml' with { type: 'file' }
import _a75 from '../../../templates/blog/config/pages/admin-ai-editor.yaml' with { type: 'file' }
import _a76 from '../../../templates/blog/config/pages/admin-authors.yaml' with { type: 'file' }
import _a77 from '../../../templates/blog/config/pages/admin-dashboard.yaml' with { type: 'file' }
import _a78 from '../../../templates/blog/config/pages/admin-login.yaml' with { type: 'file' }
import _a79 from '../../../templates/blog/config/pages/admin-post-edit.yaml' with { type: 'file' }
import _a80 from '../../../templates/blog/config/pages/admin-post-new.yaml' with { type: 'file' }
import _a81 from '../../../templates/blog/config/pages/admin-register.yaml' with { type: 'file' }
import _a82 from '../../../templates/blog/config/pages/admin-tags.yaml' with { type: 'file' }
import _a83 from '../../../templates/blog/config/pages/index.yaml' with { type: 'file' }
import _a84 from '../../../templates/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a85 from '../../../templates/blog/config/tables/authors.yaml' with { type: 'file' }
import _a86 from '../../../templates/blog/config/tables/posts.yaml' with { type: 'file' }
import _a87 from '../../../templates/blog/config/tables/tags.yaml' with { type: 'file' }
import _a88 from '../../../templates/blog/LICENSE' with { type: 'file' }
import _a89 from '../../../templates/blog/Procfile' with { type: 'file' }
import _a90 from '../../../templates/blog/public/.gitkeep' with { type: 'file' }
import _a91 from '../../../templates/blog/public/README.md' with { type: 'file' }
import _a92 from '../../../templates/blog/README.md' with { type: 'file' }
import _a93 from '../../../templates/blog/scalingo.json' with { type: 'file' }
import _a94 from '../../../templates/catalog.json' with { type: 'file' }
import _a95 from '../../../templates/company-os/.buildpacks' with { type: 'file' }
import _a96 from '../../../templates/company-os/.env.example' with { type: 'file' }
import _a97 from '../../../templates/company-os/app.yaml' with { type: 'file' }
import _a98 from '../../../templates/company-os/config/agents/ops-assistant.yaml' with { type: 'file' }
import _a99 from '../../../templates/company-os/config/auth.yaml' with { type: 'file' }
import _a100 from '../../../templates/company-os/config/automations/approve-time-off.yaml' with { type: 'file' }
import _a101 from '../../../templates/company-os/config/automations/create-project-on-won-deal.yaml' with { type: 'file' }
import _a102 from '../../../templates/company-os/config/automations/notify-contact-on-resolved-ticket.yaml' with { type: 'file' }
import _a103 from '../../../templates/company-os/config/pages/_nav.yaml' with { type: 'file' }
import _a104 from '../../../templates/company-os/config/pages/assistant.yaml' with { type: 'file' }
import _a105 from '../../../templates/company-os/config/pages/dashboard.yaml' with { type: 'file' }
import _a106 from '../../../templates/company-os/config/pages/delivery.yaml' with { type: 'file' }
import _a107 from '../../../templates/company-os/config/pages/people.yaml' with { type: 'file' }
import _a108 from '../../../templates/company-os/config/pages/sales.yaml' with { type: 'file' }
import _a109 from '../../../templates/company-os/config/pages/sign-in.yaml' with { type: 'file' }
import _a110 from '../../../templates/company-os/config/pages/support.yaml' with { type: 'file' }
import _a111 from '../../../templates/company-os/config/tables/companies.yaml' with { type: 'file' }
import _a112 from '../../../templates/company-os/config/tables/contacts.yaml' with { type: 'file' }
import _a113 from '../../../templates/company-os/config/tables/deals.yaml' with { type: 'file' }
import _a114 from '../../../templates/company-os/config/tables/employees.yaml' with { type: 'file' }
import _a115 from '../../../templates/company-os/config/tables/project_tasks.yaml' with { type: 'file' }
import _a116 from '../../../templates/company-os/config/tables/projects.yaml' with { type: 'file' }
import _a117 from '../../../templates/company-os/config/tables/tickets.yaml' with { type: 'file' }
import _a118 from '../../../templates/company-os/config/tables/time_off_requests.yaml' with { type: 'file' }
import _a119 from '../../../templates/company-os/config/theme.yaml' with { type: 'file' }
import _a120 from '../../../templates/company-os/LICENSE' with { type: 'file' }
import _a121 from '../../../templates/company-os/Procfile' with { type: 'file' }
import _a122 from '../../../templates/company-os/public/.gitkeep' with { type: 'file' }
import _a123 from '../../../templates/company-os/public/README.md' with { type: 'file' }
import _a124 from '../../../templates/company-os/README.md' with { type: 'file' }
import _a125 from '../../../templates/company-os/scalingo.json' with { type: 'file' }
import _a126 from '../../../templates/content-calendar/.buildpacks' with { type: 'file' }
import _a127 from '../../../templates/content-calendar/.env.example' with { type: 'file' }
import _a128 from '../../../templates/content-calendar/app.yaml' with { type: 'file' }
import _a129 from '../../../templates/content-calendar/config/auth.yaml' with { type: 'file' }
import _a130 from '../../../templates/content-calendar/config/automations/weekly-digest.yaml' with { type: 'file' }
import _a131 from '../../../templates/content-calendar/config/pages/_nav.yaml' with { type: 'file' }
import _a132 from '../../../templates/content-calendar/config/pages/calendar.yaml' with { type: 'file' }
import _a133 from '../../../templates/content-calendar/config/pages/grid.yaml' with { type: 'file' }
import _a134 from '../../../templates/content-calendar/config/pages/pipeline.yaml' with { type: 'file' }
import _a135 from '../../../templates/content-calendar/config/pages/sign-in.yaml' with { type: 'file' }
import _a136 from '../../../templates/content-calendar/config/tables/campaigns.yaml' with { type: 'file' }
import _a137 from '../../../templates/content-calendar/config/tables/content.yaml' with { type: 'file' }
import _a138 from '../../../templates/content-calendar/config/theme.yaml' with { type: 'file' }
import _a139 from '../../../templates/content-calendar/LICENSE' with { type: 'file' }
import _a140 from '../../../templates/content-calendar/Procfile' with { type: 'file' }
import _a141 from '../../../templates/content-calendar/public/.gitkeep' with { type: 'file' }
import _a142 from '../../../templates/content-calendar/public/README.md' with { type: 'file' }
import _a143 from '../../../templates/content-calendar/README.md' with { type: 'file' }
import _a144 from '../../../templates/content-calendar/scalingo.json' with { type: 'file' }
import _a145 from '../../../templates/crm/.buildpacks' with { type: 'file' }
import _a146 from '../../../templates/crm/.env.example' with { type: 'file' }
import _a147 from '../../../templates/crm/app.yaml' with { type: 'file' }
import _a148 from '../../../templates/crm/config/agents/records-assistant.yaml' with { type: 'file' }
import _a149 from '../../../templates/crm/config/auth.yaml' with { type: 'file' }
import _a150 from '../../../templates/crm/config/automations/deal-won-notification.yaml' with { type: 'file' }
import _a151 from '../../../templates/crm/config/pages/_nav.yaml' with { type: 'file' }
import _a152 from '../../../templates/crm/config/pages/assistant.yaml' with { type: 'file' }
import _a153 from '../../../templates/crm/config/pages/companies.yaml' with { type: 'file' }
import _a154 from '../../../templates/crm/config/pages/contacts.yaml' with { type: 'file' }
import _a155 from '../../../templates/crm/config/pages/deals.yaml' with { type: 'file' }
import _a156 from '../../../templates/crm/config/pages/sign-in.yaml' with { type: 'file' }
import _a157 from '../../../templates/crm/config/pages/tasks.yaml' with { type: 'file' }
import _a158 from '../../../templates/crm/config/tables/companies.yaml' with { type: 'file' }
import _a159 from '../../../templates/crm/config/tables/contacts.yaml' with { type: 'file' }
import _a160 from '../../../templates/crm/config/tables/deals.yaml' with { type: 'file' }
import _a161 from '../../../templates/crm/config/tables/tasks.yaml' with { type: 'file' }
import _a162 from '../../../templates/crm/config/theme.yaml' with { type: 'file' }
import _a163 from '../../../templates/crm/LICENSE' with { type: 'file' }
import _a164 from '../../../templates/crm/Procfile' with { type: 'file' }
import _a165 from '../../../templates/crm/public/.gitkeep' with { type: 'file' }
import _a166 from '../../../templates/crm/public/README.md' with { type: 'file' }
import _a167 from '../../../templates/crm/README.md' with { type: 'file' }
import _a168 from '../../../templates/crm/scalingo.json' with { type: 'file' }
import _a169 from '../../../templates/docs-site/.buildpacks' with { type: 'file' }
import _a170 from '../../../templates/docs-site/.env.example' with { type: 'file' }
import _a171 from '../../../templates/docs-site/app.yaml' with { type: 'file' }
import _a172 from '../../../templates/docs-site/config/pages/docs.yaml' with { type: 'file' }
import _a173 from '../../../templates/docs-site/config/pages/home.yaml' with { type: 'file' }
import _a174 from '../../../templates/docs-site/config/theme.yaml' with { type: 'file' }
import _a175 from '../../../templates/docs-site/content/docs/guides/configuration.md' with { type: 'file' }
import _a176 from '../../../templates/docs-site/content/docs/guides/deployment.md' with { type: 'file' }
import _a177 from '../../../templates/docs-site/content/docs/installation.md' with { type: 'file' }
import _a178 from '../../../templates/docs-site/content/docs/introduction.md' with { type: 'file' }
import _a179 from '../../../templates/docs-site/content/docs/quick-start.md' with { type: 'file' }
import _a180 from '../../../templates/docs-site/LICENSE' with { type: 'file' }
import _a181 from '../../../templates/docs-site/Procfile' with { type: 'file' }
import _a182 from '../../../templates/docs-site/public/.gitkeep' with { type: 'file' }
import _a183 from '../../../templates/docs-site/public/README.md' with { type: 'file' }
import _a184 from '../../../templates/docs-site/README.md' with { type: 'file' }
import _a185 from '../../../templates/docs-site/scalingo.json' with { type: 'file' }
import _a186 from '../../../templates/events/.buildpacks' with { type: 'file' }
import _a187 from '../../../templates/events/.env.example' with { type: 'file' }
import _a188 from '../../../templates/events/app.yaml' with { type: 'file' }
import _a189 from '../../../templates/events/config/auth.yaml' with { type: 'file' }
import _a190 from '../../../templates/events/config/automations/confirm-registration.yaml' with { type: 'file' }
import _a191 from '../../../templates/events/config/forms/register.yaml' with { type: 'file' }
import _a192 from '../../../templates/events/config/pages/_nav.yaml' with { type: 'file' }
import _a193 from '../../../templates/events/config/pages/calendar.yaml' with { type: 'file' }
import _a194 from '../../../templates/events/config/pages/home.yaml' with { type: 'file' }
import _a195 from '../../../templates/events/config/pages/registrations.yaml' with { type: 'file' }
import _a196 from '../../../templates/events/config/pages/sign-in.yaml' with { type: 'file' }
import _a197 from '../../../templates/events/config/pages/thanks.yaml' with { type: 'file' }
import _a198 from '../../../templates/events/config/tables/events.yaml' with { type: 'file' }
import _a199 from '../../../templates/events/config/tables/registrations.yaml' with { type: 'file' }
import _a200 from '../../../templates/events/config/theme.yaml' with { type: 'file' }
import _a201 from '../../../templates/events/LICENSE' with { type: 'file' }
import _a202 from '../../../templates/events/Procfile' with { type: 'file' }
import _a203 from '../../../templates/events/public/.gitkeep' with { type: 'file' }
import _a204 from '../../../templates/events/public/README.md' with { type: 'file' }
import _a205 from '../../../templates/events/README.md' with { type: 'file' }
import _a206 from '../../../templates/events/scalingo.json' with { type: 'file' }
import _a207 from '../../../templates/expenses/.buildpacks' with { type: 'file' }
import _a208 from '../../../templates/expenses/.env.example' with { type: 'file' }
import _a209 from '../../../templates/expenses/app.yaml' with { type: 'file' }
import _a210 from '../../../templates/expenses/config/auth.yaml' with { type: 'file' }
import _a211 from '../../../templates/expenses/config/automations/approve-expense.yaml' with { type: 'file' }
import _a212 from '../../../templates/expenses/config/buckets/receipts.yaml' with { type: 'file' }
import _a213 from '../../../templates/expenses/config/pages/_nav.yaml' with { type: 'file' }
import _a214 from '../../../templates/expenses/config/pages/my-expenses.yaml' with { type: 'file' }
import _a215 from '../../../templates/expenses/config/pages/review.yaml' with { type: 'file' }
import _a216 from '../../../templates/expenses/config/pages/sign-in.yaml' with { type: 'file' }
import _a217 from '../../../templates/expenses/config/tables/expenses.yaml' with { type: 'file' }
import _a218 from '../../../templates/expenses/config/theme.yaml' with { type: 'file' }
import _a219 from '../../../templates/expenses/LICENSE' with { type: 'file' }
import _a220 from '../../../templates/expenses/Procfile' with { type: 'file' }
import _a221 from '../../../templates/expenses/public/.gitkeep' with { type: 'file' }
import _a222 from '../../../templates/expenses/public/README.md' with { type: 'file' }
import _a223 from '../../../templates/expenses/README.md' with { type: 'file' }
import _a224 from '../../../templates/expenses/scalingo.json' with { type: 'file' }
import _a225 from '../../../templates/hello-world/.buildpacks' with { type: 'file' }
import _a226 from '../../../templates/hello-world/.env.example' with { type: 'file' }
import _a227 from '../../../templates/hello-world/app.yaml' with { type: 'file' }
import _a228 from '../../../templates/hello-world/LICENSE' with { type: 'file' }
import _a229 from '../../../templates/hello-world/Procfile' with { type: 'file' }
import _a230 from '../../../templates/hello-world/public/.gitkeep' with { type: 'file' }
import _a231 from '../../../templates/hello-world/public/README.md' with { type: 'file' }
import _a232 from '../../../templates/hello-world/README.md' with { type: 'file' }
import _a233 from '../../../templates/hello-world/scalingo.json' with { type: 'file' }
import _a234 from '../../../templates/helpdesk/.buildpacks' with { type: 'file' }
import _a235 from '../../../templates/helpdesk/.env.example' with { type: 'file' }
import _a236 from '../../../templates/helpdesk/app.yaml' with { type: 'file' }
import _a237 from '../../../templates/helpdesk/config/auth.yaml' with { type: 'file' }
import _a238 from '../../../templates/helpdesk/config/automations/confirm-new-ticket.yaml' with { type: 'file' }
import _a239 from '../../../templates/helpdesk/config/automations/notify-requester-on-resolved.yaml' with { type: 'file' }
import _a240 from '../../../templates/helpdesk/config/forms/submit-ticket.yaml' with { type: 'file' }
import _a241 from '../../../templates/helpdesk/config/pages/_nav.yaml' with { type: 'file' }
import _a242 from '../../../templates/helpdesk/config/pages/home.yaml' with { type: 'file' }
import _a243 from '../../../templates/helpdesk/config/pages/sign-in.yaml' with { type: 'file' }
import _a244 from '../../../templates/helpdesk/config/pages/thanks.yaml' with { type: 'file' }
import _a245 from '../../../templates/helpdesk/config/pages/tickets.yaml' with { type: 'file' }
import _a246 from '../../../templates/helpdesk/config/pages/triage.yaml' with { type: 'file' }
import _a247 from '../../../templates/helpdesk/config/tables/tickets.yaml' with { type: 'file' }
import _a248 from '../../../templates/helpdesk/config/theme.yaml' with { type: 'file' }
import _a249 from '../../../templates/helpdesk/LICENSE' with { type: 'file' }
import _a250 from '../../../templates/helpdesk/Procfile' with { type: 'file' }
import _a251 from '../../../templates/helpdesk/public/.gitkeep' with { type: 'file' }
import _a252 from '../../../templates/helpdesk/public/README.md' with { type: 'file' }
import _a253 from '../../../templates/helpdesk/README.md' with { type: 'file' }
import _a254 from '../../../templates/helpdesk/scalingo.json' with { type: 'file' }
import _a255 from '../../../templates/intranet/.buildpacks' with { type: 'file' }
import _a256 from '../../../templates/intranet/.env.example' with { type: 'file' }
import _a257 from '../../../templates/intranet/app.yaml' with { type: 'file' }
import _a258 from '../../../templates/intranet/config/auth.yaml' with { type: 'file' }
import _a259 from '../../../templates/intranet/config/pages/home.yaml' with { type: 'file' }
import _a260 from '../../../templates/intranet/config/pages/portal.yaml' with { type: 'file' }
import _a261 from '../../../templates/intranet/config/pages/sign-in.yaml' with { type: 'file' }
import _a262 from '../../../templates/intranet/config/tables/members.yaml' with { type: 'file' }
import _a263 from '../../../templates/intranet/config/tables/posts.yaml' with { type: 'file' }
import _a264 from '../../../templates/intranet/config/tables/resources.yaml' with { type: 'file' }
import _a265 from '../../../templates/intranet/config/theme.yaml' with { type: 'file' }
import _a266 from '../../../templates/intranet/LICENSE' with { type: 'file' }
import _a267 from '../../../templates/intranet/Procfile' with { type: 'file' }
import _a268 from '../../../templates/intranet/public/.gitkeep' with { type: 'file' }
import _a269 from '../../../templates/intranet/public/README.md' with { type: 'file' }
import _a270 from '../../../templates/intranet/README.md' with { type: 'file' }
import _a271 from '../../../templates/intranet/scalingo.json' with { type: 'file' }
import _a272 from '../../../templates/knowledge-base/.buildpacks' with { type: 'file' }
import _a273 from '../../../templates/knowledge-base/.env.example' with { type: 'file' }
import _a274 from '../../../templates/knowledge-base/app.yaml' with { type: 'file' }
import _a275 from '../../../templates/knowledge-base/config/auth.yaml' with { type: 'file' }
import _a276 from '../../../templates/knowledge-base/config/pages/home.yaml' with { type: 'file' }
import _a277 from '../../../templates/knowledge-base/config/pages/kb.yaml' with { type: 'file' }
import _a278 from '../../../templates/knowledge-base/config/pages/sign-in.yaml' with { type: 'file' }
import _a279 from '../../../templates/knowledge-base/config/theme.yaml' with { type: 'file' }
import _a280 from '../../../templates/knowledge-base/content/kb/expense-policy.md' with { type: 'file' }
import _a281 from '../../../templates/knowledge-base/content/kb/it-setup.md' with { type: 'file' }
import _a282 from '../../../templates/knowledge-base/content/kb/onboarding.md' with { type: 'file' }
import _a283 from '../../../templates/knowledge-base/content/kb/security-policy.md' with { type: 'file' }
import _a284 from '../../../templates/knowledge-base/content/kb/welcome.md' with { type: 'file' }
import _a285 from '../../../templates/knowledge-base/LICENSE' with { type: 'file' }
import _a286 from '../../../templates/knowledge-base/Procfile' with { type: 'file' }
import _a287 from '../../../templates/knowledge-base/public/.gitkeep' with { type: 'file' }
import _a288 from '../../../templates/knowledge-base/public/README.md' with { type: 'file' }
import _a289 from '../../../templates/knowledge-base/README.md' with { type: 'file' }
import _a290 from '../../../templates/knowledge-base/scalingo.json' with { type: 'file' }
import _a291 from '../../../templates/landing-page/.buildpacks' with { type: 'file' }
import _a292 from '../../../templates/landing-page/.env.example' with { type: 'file' }
import _a293 from '../../../templates/landing-page/app.yaml' with { type: 'file' }
import _a294 from '../../../templates/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a295 from '../../../templates/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a296 from '../../../templates/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a297 from '../../../templates/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a298 from '../../../templates/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a299 from '../../../templates/landing-page/config/languages.yaml' with { type: 'file' }
import _a300 from '../../../templates/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a301 from '../../../templates/landing-page/config/theme.yaml' with { type: 'file' }
import _a302 from '../../../templates/landing-page/LICENSE' with { type: 'file' }
import _a303 from '../../../templates/landing-page/Procfile' with { type: 'file' }
import _a304 from '../../../templates/landing-page/public/.gitkeep' with { type: 'file' }
import _a305 from '../../../templates/landing-page/public/README.md' with { type: 'file' }
import _a306 from '../../../templates/landing-page/README.md' with { type: 'file' }
import _a307 from '../../../templates/landing-page/scalingo.json' with { type: 'file' }
import _a308 from '../../../templates/mcp-server/.buildpacks' with { type: 'file' }
import _a309 from '../../../templates/mcp-server/.env.example' with { type: 'file' }
import _a310 from '../../../templates/mcp-server/app.yaml' with { type: 'file' }
import _a311 from '../../../templates/mcp-server/config/auth.yaml' with { type: 'file' }
import _a312 from '../../../templates/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a313 from '../../../templates/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a314 from '../../../templates/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a315 from '../../../templates/mcp-server/LICENSE' with { type: 'file' }
import _a316 from '../../../templates/mcp-server/Procfile' with { type: 'file' }
import _a317 from '../../../templates/mcp-server/README.md' with { type: 'file' }
import _a318 from '../../../templates/mcp-server/scalingo.json' with { type: 'file' }
import _a319 from '../../../templates/people/.buildpacks' with { type: 'file' }
import _a320 from '../../../templates/people/.env.example' with { type: 'file' }
import _a321 from '../../../templates/people/app.yaml' with { type: 'file' }
import _a322 from '../../../templates/people/config/auth.yaml' with { type: 'file' }
import _a323 from '../../../templates/people/config/automations/approve-time-off.yaml' with { type: 'file' }
import _a324 from '../../../templates/people/config/pages/_nav.yaml' with { type: 'file' }
import _a325 from '../../../templates/people/config/pages/directory.yaml' with { type: 'file' }
import _a326 from '../../../templates/people/config/pages/requests.yaml' with { type: 'file' }
import _a327 from '../../../templates/people/config/pages/sign-in.yaml' with { type: 'file' }
import _a328 from '../../../templates/people/config/pages/time-off.yaml' with { type: 'file' }
import _a329 from '../../../templates/people/config/tables/employees.yaml' with { type: 'file' }
import _a330 from '../../../templates/people/config/tables/time_off_requests.yaml' with { type: 'file' }
import _a331 from '../../../templates/people/config/theme.yaml' with { type: 'file' }
import _a332 from '../../../templates/people/LICENSE' with { type: 'file' }
import _a333 from '../../../templates/people/Procfile' with { type: 'file' }
import _a334 from '../../../templates/people/public/.gitkeep' with { type: 'file' }
import _a335 from '../../../templates/people/public/README.md' with { type: 'file' }
import _a336 from '../../../templates/people/README.md' with { type: 'file' }
import _a337 from '../../../templates/people/scalingo.json' with { type: 'file' }
import _a338 from '../../../templates/projects/.buildpacks' with { type: 'file' }
import _a339 from '../../../templates/projects/.env.example' with { type: 'file' }
import _a340 from '../../../templates/projects/app.yaml' with { type: 'file' }
import _a341 from '../../../templates/projects/config/auth.yaml' with { type: 'file' }
import _a342 from '../../../templates/projects/config/automations/notify-assignee-on-blocked.yaml' with { type: 'file' }
import _a343 from '../../../templates/projects/config/pages/_nav.yaml' with { type: 'file' }
import _a344 from '../../../templates/projects/config/pages/board.yaml' with { type: 'file' }
import _a345 from '../../../templates/projects/config/pages/calendar.yaml' with { type: 'file' }
import _a346 from '../../../templates/projects/config/pages/dashboard.yaml' with { type: 'file' }
import _a347 from '../../../templates/projects/config/pages/sign-in.yaml' with { type: 'file' }
import _a348 from '../../../templates/projects/config/pages/timeline.yaml' with { type: 'file' }
import _a349 from '../../../templates/projects/config/tables/projects.yaml' with { type: 'file' }
import _a350 from '../../../templates/projects/config/tables/tasks.yaml' with { type: 'file' }
import _a351 from '../../../templates/projects/config/theme.yaml' with { type: 'file' }
import _a352 from '../../../templates/projects/LICENSE' with { type: 'file' }
import _a353 from '../../../templates/projects/Procfile' with { type: 'file' }
import _a354 from '../../../templates/projects/public/.gitkeep' with { type: 'file' }
import _a355 from '../../../templates/projects/public/README.md' with { type: 'file' }
import _a356 from '../../../templates/projects/README.md' with { type: 'file' }
import _a357 from '../../../templates/projects/scalingo.json' with { type: 'file' }
import _a358 from '../../../templates/README.md' with { type: 'file' }
import _a359 from './dashboard/dashboard-app.yaml' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_icy_northstar.sql": _a1,
      "0001_glossy_squadron_supreme.sql": _a2,
      "0002_bitter_calypso.sql": _a3,
      "0003_magenta_the_anarchist.sql": _a4,
      "0004_absurd_zaran.sql": _a5,
    },
  },
  sqlite: {
    journal: _a6,
    migrations: {
      "0000_mute_cassandra_nova.sql": _a7,
      "0001_famous_leper_queen.sql": _a8,
      "0002_quick_texas_twister.sql": _a9,
      "0003_absent_dakota_north.sql": _a10,
      "0004_shocking_lyja.sql": _a11,
    },
  },
}

export const AGENT_FILES = {
  "README.md": _a12,
  "api-editor.md": _a13,
  "app-editor.md": _a14,
  "blog-editor.md": _a15,
  "crm-editor.md": _a16,
  "intranet-editor.md": _a17,
  "mcp-editor.md": _a18,
  "website-editor.md": _a19,
}

export const TEMPLATE_FILES = {
  "api-only/.buildpacks": _a20,
  "api-only/.env.example": _a21,
  "api-only/app.yaml": _a22,
  "api-only/config/auth.yaml": _a23,
  "api-only/config/tables/projects.yaml": _a24,
  "api-only/config/tables/tasks.yaml": _a25,
  "api-only/LICENSE": _a26,
  "api-only/Procfile": _a27,
  "api-only/README.md": _a28,
  "api-only/scalingo.json": _a29,
  "assets/.buildpacks": _a30,
  "assets/.env.example": _a31,
  "assets/app.yaml": _a32,
  "assets/config/auth.yaml": _a33,
  "assets/config/automations/quarterly-inventory-check.yaml": _a34,
  "assets/config/pages/_nav.yaml": _a35,
  "assets/config/pages/board.yaml": _a36,
  "assets/config/pages/gallery.yaml": _a37,
  "assets/config/pages/inventory.yaml": _a38,
  "assets/config/pages/sign-in.yaml": _a39,
  "assets/config/tables/assets.yaml": _a40,
  "assets/config/tables/locations.yaml": _a41,
  "assets/config/theme.yaml": _a42,
  "assets/LICENSE": _a43,
  "assets/Procfile": _a44,
  "assets/public/.gitkeep": _a45,
  "assets/public/README.md": _a46,
  "assets/README.md": _a47,
  "assets/scalingo.json": _a48,
  "automation-recipes/.buildpacks": _a49,
  "automation-recipes/.env.example": _a50,
  "automation-recipes/app.yaml": _a51,
  "automation-recipes/config/auth.yaml": _a52,
  "automation-recipes/config/automations/alert-on-failure.yaml": _a53,
  "automation-recipes/config/automations/capture-lead-from-webhook.yaml": _a54,
  "automation-recipes/config/automations/daily-digest.yaml": _a55,
  "automation-recipes/config/automations/log-new-lead.yaml": _a56,
  "automation-recipes/config/pages/_nav.yaml": _a57,
  "automation-recipes/config/pages/activity.yaml": _a58,
  "automation-recipes/config/pages/home.yaml": _a59,
  "automation-recipes/config/pages/sign-in.yaml": _a60,
  "automation-recipes/config/tables/activity_log.yaml": _a61,
  "automation-recipes/config/tables/leads.yaml": _a62,
  "automation-recipes/config/theme.yaml": _a63,
  "automation-recipes/LICENSE": _a64,
  "automation-recipes/Procfile": _a65,
  "automation-recipes/public/.gitkeep": _a66,
  "automation-recipes/public/README.md": _a67,
  "automation-recipes/README.md": _a68,
  "automation-recipes/scalingo.json": _a69,
  "blog/.buildpacks": _a70,
  "blog/.env.example": _a71,
  "blog/app.yaml": _a72,
  "blog/config/agents/blog-editor.yaml": _a73,
  "blog/config/auth.yaml": _a74,
  "blog/config/pages/admin-ai-editor.yaml": _a75,
  "blog/config/pages/admin-authors.yaml": _a76,
  "blog/config/pages/admin-dashboard.yaml": _a77,
  "blog/config/pages/admin-login.yaml": _a78,
  "blog/config/pages/admin-post-edit.yaml": _a79,
  "blog/config/pages/admin-post-new.yaml": _a80,
  "blog/config/pages/admin-register.yaml": _a81,
  "blog/config/pages/admin-tags.yaml": _a82,
  "blog/config/pages/index.yaml": _a83,
  "blog/config/pages/post-detail.yaml": _a84,
  "blog/config/tables/authors.yaml": _a85,
  "blog/config/tables/posts.yaml": _a86,
  "blog/config/tables/tags.yaml": _a87,
  "blog/LICENSE": _a88,
  "blog/Procfile": _a89,
  "blog/public/.gitkeep": _a90,
  "blog/public/README.md": _a91,
  "blog/README.md": _a92,
  "blog/scalingo.json": _a93,
  "catalog.json": _a94,
  "company-os/.buildpacks": _a95,
  "company-os/.env.example": _a96,
  "company-os/app.yaml": _a97,
  "company-os/config/agents/ops-assistant.yaml": _a98,
  "company-os/config/auth.yaml": _a99,
  "company-os/config/automations/approve-time-off.yaml": _a100,
  "company-os/config/automations/create-project-on-won-deal.yaml": _a101,
  "company-os/config/automations/notify-contact-on-resolved-ticket.yaml": _a102,
  "company-os/config/pages/_nav.yaml": _a103,
  "company-os/config/pages/assistant.yaml": _a104,
  "company-os/config/pages/dashboard.yaml": _a105,
  "company-os/config/pages/delivery.yaml": _a106,
  "company-os/config/pages/people.yaml": _a107,
  "company-os/config/pages/sales.yaml": _a108,
  "company-os/config/pages/sign-in.yaml": _a109,
  "company-os/config/pages/support.yaml": _a110,
  "company-os/config/tables/companies.yaml": _a111,
  "company-os/config/tables/contacts.yaml": _a112,
  "company-os/config/tables/deals.yaml": _a113,
  "company-os/config/tables/employees.yaml": _a114,
  "company-os/config/tables/project_tasks.yaml": _a115,
  "company-os/config/tables/projects.yaml": _a116,
  "company-os/config/tables/tickets.yaml": _a117,
  "company-os/config/tables/time_off_requests.yaml": _a118,
  "company-os/config/theme.yaml": _a119,
  "company-os/LICENSE": _a120,
  "company-os/Procfile": _a121,
  "company-os/public/.gitkeep": _a122,
  "company-os/public/README.md": _a123,
  "company-os/README.md": _a124,
  "company-os/scalingo.json": _a125,
  "content-calendar/.buildpacks": _a126,
  "content-calendar/.env.example": _a127,
  "content-calendar/app.yaml": _a128,
  "content-calendar/config/auth.yaml": _a129,
  "content-calendar/config/automations/weekly-digest.yaml": _a130,
  "content-calendar/config/pages/_nav.yaml": _a131,
  "content-calendar/config/pages/calendar.yaml": _a132,
  "content-calendar/config/pages/grid.yaml": _a133,
  "content-calendar/config/pages/pipeline.yaml": _a134,
  "content-calendar/config/pages/sign-in.yaml": _a135,
  "content-calendar/config/tables/campaigns.yaml": _a136,
  "content-calendar/config/tables/content.yaml": _a137,
  "content-calendar/config/theme.yaml": _a138,
  "content-calendar/LICENSE": _a139,
  "content-calendar/Procfile": _a140,
  "content-calendar/public/.gitkeep": _a141,
  "content-calendar/public/README.md": _a142,
  "content-calendar/README.md": _a143,
  "content-calendar/scalingo.json": _a144,
  "crm/.buildpacks": _a145,
  "crm/.env.example": _a146,
  "crm/app.yaml": _a147,
  "crm/config/agents/records-assistant.yaml": _a148,
  "crm/config/auth.yaml": _a149,
  "crm/config/automations/deal-won-notification.yaml": _a150,
  "crm/config/pages/_nav.yaml": _a151,
  "crm/config/pages/assistant.yaml": _a152,
  "crm/config/pages/companies.yaml": _a153,
  "crm/config/pages/contacts.yaml": _a154,
  "crm/config/pages/deals.yaml": _a155,
  "crm/config/pages/sign-in.yaml": _a156,
  "crm/config/pages/tasks.yaml": _a157,
  "crm/config/tables/companies.yaml": _a158,
  "crm/config/tables/contacts.yaml": _a159,
  "crm/config/tables/deals.yaml": _a160,
  "crm/config/tables/tasks.yaml": _a161,
  "crm/config/theme.yaml": _a162,
  "crm/LICENSE": _a163,
  "crm/Procfile": _a164,
  "crm/public/.gitkeep": _a165,
  "crm/public/README.md": _a166,
  "crm/README.md": _a167,
  "crm/scalingo.json": _a168,
  "docs-site/.buildpacks": _a169,
  "docs-site/.env.example": _a170,
  "docs-site/app.yaml": _a171,
  "docs-site/config/pages/docs.yaml": _a172,
  "docs-site/config/pages/home.yaml": _a173,
  "docs-site/config/theme.yaml": _a174,
  "docs-site/content/docs/guides/configuration.md": _a175,
  "docs-site/content/docs/guides/deployment.md": _a176,
  "docs-site/content/docs/installation.md": _a177,
  "docs-site/content/docs/introduction.md": _a178,
  "docs-site/content/docs/quick-start.md": _a179,
  "docs-site/LICENSE": _a180,
  "docs-site/Procfile": _a181,
  "docs-site/public/.gitkeep": _a182,
  "docs-site/public/README.md": _a183,
  "docs-site/README.md": _a184,
  "docs-site/scalingo.json": _a185,
  "events/.buildpacks": _a186,
  "events/.env.example": _a187,
  "events/app.yaml": _a188,
  "events/config/auth.yaml": _a189,
  "events/config/automations/confirm-registration.yaml": _a190,
  "events/config/forms/register.yaml": _a191,
  "events/config/pages/_nav.yaml": _a192,
  "events/config/pages/calendar.yaml": _a193,
  "events/config/pages/home.yaml": _a194,
  "events/config/pages/registrations.yaml": _a195,
  "events/config/pages/sign-in.yaml": _a196,
  "events/config/pages/thanks.yaml": _a197,
  "events/config/tables/events.yaml": _a198,
  "events/config/tables/registrations.yaml": _a199,
  "events/config/theme.yaml": _a200,
  "events/LICENSE": _a201,
  "events/Procfile": _a202,
  "events/public/.gitkeep": _a203,
  "events/public/README.md": _a204,
  "events/README.md": _a205,
  "events/scalingo.json": _a206,
  "expenses/.buildpacks": _a207,
  "expenses/.env.example": _a208,
  "expenses/app.yaml": _a209,
  "expenses/config/auth.yaml": _a210,
  "expenses/config/automations/approve-expense.yaml": _a211,
  "expenses/config/buckets/receipts.yaml": _a212,
  "expenses/config/pages/_nav.yaml": _a213,
  "expenses/config/pages/my-expenses.yaml": _a214,
  "expenses/config/pages/review.yaml": _a215,
  "expenses/config/pages/sign-in.yaml": _a216,
  "expenses/config/tables/expenses.yaml": _a217,
  "expenses/config/theme.yaml": _a218,
  "expenses/LICENSE": _a219,
  "expenses/Procfile": _a220,
  "expenses/public/.gitkeep": _a221,
  "expenses/public/README.md": _a222,
  "expenses/README.md": _a223,
  "expenses/scalingo.json": _a224,
  "hello-world/.buildpacks": _a225,
  "hello-world/.env.example": _a226,
  "hello-world/app.yaml": _a227,
  "hello-world/LICENSE": _a228,
  "hello-world/Procfile": _a229,
  "hello-world/public/.gitkeep": _a230,
  "hello-world/public/README.md": _a231,
  "hello-world/README.md": _a232,
  "hello-world/scalingo.json": _a233,
  "helpdesk/.buildpacks": _a234,
  "helpdesk/.env.example": _a235,
  "helpdesk/app.yaml": _a236,
  "helpdesk/config/auth.yaml": _a237,
  "helpdesk/config/automations/confirm-new-ticket.yaml": _a238,
  "helpdesk/config/automations/notify-requester-on-resolved.yaml": _a239,
  "helpdesk/config/forms/submit-ticket.yaml": _a240,
  "helpdesk/config/pages/_nav.yaml": _a241,
  "helpdesk/config/pages/home.yaml": _a242,
  "helpdesk/config/pages/sign-in.yaml": _a243,
  "helpdesk/config/pages/thanks.yaml": _a244,
  "helpdesk/config/pages/tickets.yaml": _a245,
  "helpdesk/config/pages/triage.yaml": _a246,
  "helpdesk/config/tables/tickets.yaml": _a247,
  "helpdesk/config/theme.yaml": _a248,
  "helpdesk/LICENSE": _a249,
  "helpdesk/Procfile": _a250,
  "helpdesk/public/.gitkeep": _a251,
  "helpdesk/public/README.md": _a252,
  "helpdesk/README.md": _a253,
  "helpdesk/scalingo.json": _a254,
  "intranet/.buildpacks": _a255,
  "intranet/.env.example": _a256,
  "intranet/app.yaml": _a257,
  "intranet/config/auth.yaml": _a258,
  "intranet/config/pages/home.yaml": _a259,
  "intranet/config/pages/portal.yaml": _a260,
  "intranet/config/pages/sign-in.yaml": _a261,
  "intranet/config/tables/members.yaml": _a262,
  "intranet/config/tables/posts.yaml": _a263,
  "intranet/config/tables/resources.yaml": _a264,
  "intranet/config/theme.yaml": _a265,
  "intranet/LICENSE": _a266,
  "intranet/Procfile": _a267,
  "intranet/public/.gitkeep": _a268,
  "intranet/public/README.md": _a269,
  "intranet/README.md": _a270,
  "intranet/scalingo.json": _a271,
  "knowledge-base/.buildpacks": _a272,
  "knowledge-base/.env.example": _a273,
  "knowledge-base/app.yaml": _a274,
  "knowledge-base/config/auth.yaml": _a275,
  "knowledge-base/config/pages/home.yaml": _a276,
  "knowledge-base/config/pages/kb.yaml": _a277,
  "knowledge-base/config/pages/sign-in.yaml": _a278,
  "knowledge-base/config/theme.yaml": _a279,
  "knowledge-base/content/kb/expense-policy.md": _a280,
  "knowledge-base/content/kb/it-setup.md": _a281,
  "knowledge-base/content/kb/onboarding.md": _a282,
  "knowledge-base/content/kb/security-policy.md": _a283,
  "knowledge-base/content/kb/welcome.md": _a284,
  "knowledge-base/LICENSE": _a285,
  "knowledge-base/Procfile": _a286,
  "knowledge-base/public/.gitkeep": _a287,
  "knowledge-base/public/README.md": _a288,
  "knowledge-base/README.md": _a289,
  "knowledge-base/scalingo.json": _a290,
  "landing-page/.buildpacks": _a291,
  "landing-page/.env.example": _a292,
  "landing-page/app.yaml": _a293,
  "landing-page/config/components/cta-button.yaml": _a294,
  "landing-page/config/components/feature-card.yaml": _a295,
  "landing-page/config/components/hero-section.yaml": _a296,
  "landing-page/config/components/language-switcher.yaml": _a297,
  "landing-page/config/components/step-card.yaml": _a298,
  "landing-page/config/languages.yaml": _a299,
  "landing-page/config/pages/home.yaml": _a300,
  "landing-page/config/theme.yaml": _a301,
  "landing-page/LICENSE": _a302,
  "landing-page/Procfile": _a303,
  "landing-page/public/.gitkeep": _a304,
  "landing-page/public/README.md": _a305,
  "landing-page/README.md": _a306,
  "landing-page/scalingo.json": _a307,
  "mcp-server/.buildpacks": _a308,
  "mcp-server/.env.example": _a309,
  "mcp-server/app.yaml": _a310,
  "mcp-server/config/auth.yaml": _a311,
  "mcp-server/config/mcp.yaml": _a312,
  "mcp-server/config/tables/documents.yaml": _a313,
  "mcp-server/config/tables/tags.yaml": _a314,
  "mcp-server/LICENSE": _a315,
  "mcp-server/Procfile": _a316,
  "mcp-server/README.md": _a317,
  "mcp-server/scalingo.json": _a318,
  "people/.buildpacks": _a319,
  "people/.env.example": _a320,
  "people/app.yaml": _a321,
  "people/config/auth.yaml": _a322,
  "people/config/automations/approve-time-off.yaml": _a323,
  "people/config/pages/_nav.yaml": _a324,
  "people/config/pages/directory.yaml": _a325,
  "people/config/pages/requests.yaml": _a326,
  "people/config/pages/sign-in.yaml": _a327,
  "people/config/pages/time-off.yaml": _a328,
  "people/config/tables/employees.yaml": _a329,
  "people/config/tables/time_off_requests.yaml": _a330,
  "people/config/theme.yaml": _a331,
  "people/LICENSE": _a332,
  "people/Procfile": _a333,
  "people/public/.gitkeep": _a334,
  "people/public/README.md": _a335,
  "people/README.md": _a336,
  "people/scalingo.json": _a337,
  "projects/.buildpacks": _a338,
  "projects/.env.example": _a339,
  "projects/app.yaml": _a340,
  "projects/config/auth.yaml": _a341,
  "projects/config/automations/notify-assignee-on-blocked.yaml": _a342,
  "projects/config/pages/_nav.yaml": _a343,
  "projects/config/pages/board.yaml": _a344,
  "projects/config/pages/calendar.yaml": _a345,
  "projects/config/pages/dashboard.yaml": _a346,
  "projects/config/pages/sign-in.yaml": _a347,
  "projects/config/pages/timeline.yaml": _a348,
  "projects/config/tables/projects.yaml": _a349,
  "projects/config/tables/tasks.yaml": _a350,
  "projects/config/theme.yaml": _a351,
  "projects/LICENSE": _a352,
  "projects/Procfile": _a353,
  "projects/public/.gitkeep": _a354,
  "projects/public/README.md": _a355,
  "projects/README.md": _a356,
  "projects/scalingo.json": _a357,
  "README.md": _a358,
}

export const DASHBOARD_FILES = {
  "dashboard-app.yaml": _a359,
}
