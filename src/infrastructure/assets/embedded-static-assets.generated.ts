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
import _a6 from '../../../drizzle/0005_greedy_smasher.sql' with { type: 'file' }
import _a7 from '../../../drizzle/0006_material_lizard.sql' with { type: 'file' }
import _a8 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a9 from '../../../drizzle/sqlite/0000_mute_cassandra_nova.sql' with { type: 'file' }
import _a10 from '../../../drizzle/sqlite/0001_famous_leper_queen.sql' with { type: 'file' }
import _a11 from '../../../drizzle/sqlite/0002_quick_texas_twister.sql' with { type: 'file' }
import _a12 from '../../../drizzle/sqlite/0003_absent_dakota_north.sql' with { type: 'file' }
import _a13 from '../../../drizzle/sqlite/0004_shocking_lyja.sql' with { type: 'file' }
import _a14 from '../../../drizzle/sqlite/0005_stormy_sersi.sql' with { type: 'file' }
import _a15 from '../../../drizzle/sqlite/0006_fantastic_mojo.sql' with { type: 'file' }
import _a16 from '../../../templates/api-only/.buildpacks' with { type: 'file' }
import _a17 from '../../../templates/api-only/.claude/agents/app-editor.md' with { type: 'file' }
import _a18 from '../../../templates/api-only/.env.example' with { type: 'file' }
import _a19 from '../../../templates/api-only/app.yaml' with { type: 'file' }
import _a20 from '../../../templates/api-only/CLAUDE.md' with { type: 'file' }
import _a21 from '../../../templates/api-only/config/auth.yaml' with { type: 'file' }
import _a22 from '../../../templates/api-only/config/tables/projects.yaml' with { type: 'file' }
import _a23 from '../../../templates/api-only/config/tables/tasks.yaml' with { type: 'file' }
import _a24 from '../../../templates/api-only/LICENSE' with { type: 'file' }
import _a25 from '../../../templates/api-only/Procfile' with { type: 'file' }
import _a26 from '../../../templates/api-only/README.md' with { type: 'file' }
import _a27 from '../../../templates/api-only/scalingo.json' with { type: 'file' }
import _a28 from '../../../templates/assets/.buildpacks' with { type: 'file' }
import _a29 from '../../../templates/assets/.claude/agents/app-editor.md' with { type: 'file' }
import _a30 from '../../../templates/assets/.env.example' with { type: 'file' }
import _a31 from '../../../templates/assets/app.yaml' with { type: 'file' }
import _a32 from '../../../templates/assets/CLAUDE.md' with { type: 'file' }
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
import _a50 from '../../../templates/automation-recipes/.claude/agents/app-editor.md' with { type: 'file' }
import _a51 from '../../../templates/automation-recipes/.env.example' with { type: 'file' }
import _a52 from '../../../templates/automation-recipes/app.yaml' with { type: 'file' }
import _a53 from '../../../templates/automation-recipes/CLAUDE.md' with { type: 'file' }
import _a54 from '../../../templates/automation-recipes/config/auth.yaml' with { type: 'file' }
import _a55 from '../../../templates/automation-recipes/config/automations/alert-on-failure.yaml' with { type: 'file' }
import _a56 from '../../../templates/automation-recipes/config/automations/capture-lead-from-webhook.yaml' with { type: 'file' }
import _a57 from '../../../templates/automation-recipes/config/automations/daily-digest.yaml' with { type: 'file' }
import _a58 from '../../../templates/automation-recipes/config/automations/log-new-lead.yaml' with { type: 'file' }
import _a59 from '../../../templates/automation-recipes/config/pages/_nav.yaml' with { type: 'file' }
import _a60 from '../../../templates/automation-recipes/config/pages/activity.yaml' with { type: 'file' }
import _a61 from '../../../templates/automation-recipes/config/pages/home.yaml' with { type: 'file' }
import _a62 from '../../../templates/automation-recipes/config/pages/sign-in.yaml' with { type: 'file' }
import _a63 from '../../../templates/automation-recipes/config/tables/activity_log.yaml' with { type: 'file' }
import _a64 from '../../../templates/automation-recipes/config/tables/leads.yaml' with { type: 'file' }
import _a65 from '../../../templates/automation-recipes/config/theme.yaml' with { type: 'file' }
import _a66 from '../../../templates/automation-recipes/LICENSE' with { type: 'file' }
import _a67 from '../../../templates/automation-recipes/Procfile' with { type: 'file' }
import _a68 from '../../../templates/automation-recipes/public/.gitkeep' with { type: 'file' }
import _a69 from '../../../templates/automation-recipes/public/README.md' with { type: 'file' }
import _a70 from '../../../templates/automation-recipes/README.md' with { type: 'file' }
import _a71 from '../../../templates/automation-recipes/scalingo.json' with { type: 'file' }
import _a72 from '../../../templates/blog/.buildpacks' with { type: 'file' }
import _a73 from '../../../templates/blog/.claude/agents/app-editor.md' with { type: 'file' }
import _a74 from '../../../templates/blog/.env.example' with { type: 'file' }
import _a75 from '../../../templates/blog/app.yaml' with { type: 'file' }
import _a76 from '../../../templates/blog/CLAUDE.md' with { type: 'file' }
import _a77 from '../../../templates/blog/config/agents/blog-editor.yaml' with { type: 'file' }
import _a78 from '../../../templates/blog/config/auth.yaml' with { type: 'file' }
import _a79 from '../../../templates/blog/config/pages/admin-ai-editor.yaml' with { type: 'file' }
import _a80 from '../../../templates/blog/config/pages/admin-authors.yaml' with { type: 'file' }
import _a81 from '../../../templates/blog/config/pages/admin-dashboard.yaml' with { type: 'file' }
import _a82 from '../../../templates/blog/config/pages/admin-login.yaml' with { type: 'file' }
import _a83 from '../../../templates/blog/config/pages/admin-post-edit.yaml' with { type: 'file' }
import _a84 from '../../../templates/blog/config/pages/admin-post-new.yaml' with { type: 'file' }
import _a85 from '../../../templates/blog/config/pages/admin-register.yaml' with { type: 'file' }
import _a86 from '../../../templates/blog/config/pages/admin-tags.yaml' with { type: 'file' }
import _a87 from '../../../templates/blog/config/pages/index.yaml' with { type: 'file' }
import _a88 from '../../../templates/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a89 from '../../../templates/blog/config/tables/authors.yaml' with { type: 'file' }
import _a90 from '../../../templates/blog/config/tables/posts.yaml' with { type: 'file' }
import _a91 from '../../../templates/blog/config/tables/tags.yaml' with { type: 'file' }
import _a92 from '../../../templates/blog/LICENSE' with { type: 'file' }
import _a93 from '../../../templates/blog/Procfile' with { type: 'file' }
import _a94 from '../../../templates/blog/public/.gitkeep' with { type: 'file' }
import _a95 from '../../../templates/blog/public/README.md' with { type: 'file' }
import _a96 from '../../../templates/blog/README.md' with { type: 'file' }
import _a97 from '../../../templates/blog/scalingo.json' with { type: 'file' }
import _a98 from '../../../templates/catalog.json' with { type: 'file' }
import _a99 from '../../../templates/company-os/.buildpacks' with { type: 'file' }
import _a100 from '../../../templates/company-os/.claude/agents/app-editor.md' with { type: 'file' }
import _a101 from '../../../templates/company-os/.env.example' with { type: 'file' }
import _a102 from '../../../templates/company-os/app.yaml' with { type: 'file' }
import _a103 from '../../../templates/company-os/CLAUDE.md' with { type: 'file' }
import _a104 from '../../../templates/company-os/config/agents/ops-assistant.yaml' with { type: 'file' }
import _a105 from '../../../templates/company-os/config/auth.yaml' with { type: 'file' }
import _a106 from '../../../templates/company-os/config/automations/approve-time-off.yaml' with { type: 'file' }
import _a107 from '../../../templates/company-os/config/automations/create-project-on-won-deal.yaml' with { type: 'file' }
import _a108 from '../../../templates/company-os/config/automations/notify-contact-on-resolved-ticket.yaml' with { type: 'file' }
import _a109 from '../../../templates/company-os/config/pages/_nav.yaml' with { type: 'file' }
import _a110 from '../../../templates/company-os/config/pages/assistant.yaml' with { type: 'file' }
import _a111 from '../../../templates/company-os/config/pages/dashboard.yaml' with { type: 'file' }
import _a112 from '../../../templates/company-os/config/pages/delivery.yaml' with { type: 'file' }
import _a113 from '../../../templates/company-os/config/pages/people.yaml' with { type: 'file' }
import _a114 from '../../../templates/company-os/config/pages/sales.yaml' with { type: 'file' }
import _a115 from '../../../templates/company-os/config/pages/sign-in.yaml' with { type: 'file' }
import _a116 from '../../../templates/company-os/config/pages/support.yaml' with { type: 'file' }
import _a117 from '../../../templates/company-os/config/tables/companies.yaml' with { type: 'file' }
import _a118 from '../../../templates/company-os/config/tables/contacts.yaml' with { type: 'file' }
import _a119 from '../../../templates/company-os/config/tables/deals.yaml' with { type: 'file' }
import _a120 from '../../../templates/company-os/config/tables/employees.yaml' with { type: 'file' }
import _a121 from '../../../templates/company-os/config/tables/project_tasks.yaml' with { type: 'file' }
import _a122 from '../../../templates/company-os/config/tables/projects.yaml' with { type: 'file' }
import _a123 from '../../../templates/company-os/config/tables/tickets.yaml' with { type: 'file' }
import _a124 from '../../../templates/company-os/config/tables/time_off_requests.yaml' with { type: 'file' }
import _a125 from '../../../templates/company-os/config/theme.yaml' with { type: 'file' }
import _a126 from '../../../templates/company-os/LICENSE' with { type: 'file' }
import _a127 from '../../../templates/company-os/Procfile' with { type: 'file' }
import _a128 from '../../../templates/company-os/public/.gitkeep' with { type: 'file' }
import _a129 from '../../../templates/company-os/public/README.md' with { type: 'file' }
import _a130 from '../../../templates/company-os/README.md' with { type: 'file' }
import _a131 from '../../../templates/company-os/scalingo.json' with { type: 'file' }
import _a132 from '../../../templates/content-calendar/.buildpacks' with { type: 'file' }
import _a133 from '../../../templates/content-calendar/.claude/agents/app-editor.md' with { type: 'file' }
import _a134 from '../../../templates/content-calendar/.env.example' with { type: 'file' }
import _a135 from '../../../templates/content-calendar/app.yaml' with { type: 'file' }
import _a136 from '../../../templates/content-calendar/CLAUDE.md' with { type: 'file' }
import _a137 from '../../../templates/content-calendar/config/auth.yaml' with { type: 'file' }
import _a138 from '../../../templates/content-calendar/config/automations/weekly-digest.yaml' with { type: 'file' }
import _a139 from '../../../templates/content-calendar/config/pages/_nav.yaml' with { type: 'file' }
import _a140 from '../../../templates/content-calendar/config/pages/calendar.yaml' with { type: 'file' }
import _a141 from '../../../templates/content-calendar/config/pages/grid.yaml' with { type: 'file' }
import _a142 from '../../../templates/content-calendar/config/pages/pipeline.yaml' with { type: 'file' }
import _a143 from '../../../templates/content-calendar/config/pages/sign-in.yaml' with { type: 'file' }
import _a144 from '../../../templates/content-calendar/config/tables/campaigns.yaml' with { type: 'file' }
import _a145 from '../../../templates/content-calendar/config/tables/content.yaml' with { type: 'file' }
import _a146 from '../../../templates/content-calendar/config/theme.yaml' with { type: 'file' }
import _a147 from '../../../templates/content-calendar/LICENSE' with { type: 'file' }
import _a148 from '../../../templates/content-calendar/Procfile' with { type: 'file' }
import _a149 from '../../../templates/content-calendar/public/.gitkeep' with { type: 'file' }
import _a150 from '../../../templates/content-calendar/public/README.md' with { type: 'file' }
import _a151 from '../../../templates/content-calendar/README.md' with { type: 'file' }
import _a152 from '../../../templates/content-calendar/scalingo.json' with { type: 'file' }
import _a153 from '../../../templates/crm/.buildpacks' with { type: 'file' }
import _a154 from '../../../templates/crm/.claude/agents/app-editor.md' with { type: 'file' }
import _a155 from '../../../templates/crm/.env.example' with { type: 'file' }
import _a156 from '../../../templates/crm/app.yaml' with { type: 'file' }
import _a157 from '../../../templates/crm/CLAUDE.md' with { type: 'file' }
import _a158 from '../../../templates/crm/config/agents/records-assistant.yaml' with { type: 'file' }
import _a159 from '../../../templates/crm/config/auth.yaml' with { type: 'file' }
import _a160 from '../../../templates/crm/config/automations/deal-won-notification.yaml' with { type: 'file' }
import _a161 from '../../../templates/crm/config/pages/_nav.yaml' with { type: 'file' }
import _a162 from '../../../templates/crm/config/pages/assistant.yaml' with { type: 'file' }
import _a163 from '../../../templates/crm/config/pages/companies.yaml' with { type: 'file' }
import _a164 from '../../../templates/crm/config/pages/contacts.yaml' with { type: 'file' }
import _a165 from '../../../templates/crm/config/pages/deals.yaml' with { type: 'file' }
import _a166 from '../../../templates/crm/config/pages/sign-in.yaml' with { type: 'file' }
import _a167 from '../../../templates/crm/config/pages/tasks.yaml' with { type: 'file' }
import _a168 from '../../../templates/crm/config/tables/companies.yaml' with { type: 'file' }
import _a169 from '../../../templates/crm/config/tables/contacts.yaml' with { type: 'file' }
import _a170 from '../../../templates/crm/config/tables/deals.yaml' with { type: 'file' }
import _a171 from '../../../templates/crm/config/tables/tasks.yaml' with { type: 'file' }
import _a172 from '../../../templates/crm/config/theme.yaml' with { type: 'file' }
import _a173 from '../../../templates/crm/LICENSE' with { type: 'file' }
import _a174 from '../../../templates/crm/Procfile' with { type: 'file' }
import _a175 from '../../../templates/crm/public/.gitkeep' with { type: 'file' }
import _a176 from '../../../templates/crm/public/README.md' with { type: 'file' }
import _a177 from '../../../templates/crm/README.md' with { type: 'file' }
import _a178 from '../../../templates/crm/scalingo.json' with { type: 'file' }
import _a179 from '../../../templates/docs-site/.buildpacks' with { type: 'file' }
import _a180 from '../../../templates/docs-site/.claude/agents/app-editor.md' with { type: 'file' }
import _a181 from '../../../templates/docs-site/.env.example' with { type: 'file' }
import _a182 from '../../../templates/docs-site/app.yaml' with { type: 'file' }
import _a183 from '../../../templates/docs-site/CLAUDE.md' with { type: 'file' }
import _a184 from '../../../templates/docs-site/config/pages/docs.yaml' with { type: 'file' }
import _a185 from '../../../templates/docs-site/config/pages/home.yaml' with { type: 'file' }
import _a186 from '../../../templates/docs-site/config/theme.yaml' with { type: 'file' }
import _a187 from '../../../templates/docs-site/content/docs/guides/configuration.md' with { type: 'file' }
import _a188 from '../../../templates/docs-site/content/docs/guides/deployment.md' with { type: 'file' }
import _a189 from '../../../templates/docs-site/content/docs/installation.md' with { type: 'file' }
import _a190 from '../../../templates/docs-site/content/docs/introduction.md' with { type: 'file' }
import _a191 from '../../../templates/docs-site/content/docs/quick-start.md' with { type: 'file' }
import _a192 from '../../../templates/docs-site/LICENSE' with { type: 'file' }
import _a193 from '../../../templates/docs-site/Procfile' with { type: 'file' }
import _a194 from '../../../templates/docs-site/public/.gitkeep' with { type: 'file' }
import _a195 from '../../../templates/docs-site/public/README.md' with { type: 'file' }
import _a196 from '../../../templates/docs-site/README.md' with { type: 'file' }
import _a197 from '../../../templates/docs-site/scalingo.json' with { type: 'file' }
import _a198 from '../../../templates/events/.buildpacks' with { type: 'file' }
import _a199 from '../../../templates/events/.claude/agents/app-editor.md' with { type: 'file' }
import _a200 from '../../../templates/events/.env.example' with { type: 'file' }
import _a201 from '../../../templates/events/app.yaml' with { type: 'file' }
import _a202 from '../../../templates/events/CLAUDE.md' with { type: 'file' }
import _a203 from '../../../templates/events/config/auth.yaml' with { type: 'file' }
import _a204 from '../../../templates/events/config/automations/confirm-registration.yaml' with { type: 'file' }
import _a205 from '../../../templates/events/config/forms/register.yaml' with { type: 'file' }
import _a206 from '../../../templates/events/config/pages/_nav.yaml' with { type: 'file' }
import _a207 from '../../../templates/events/config/pages/calendar.yaml' with { type: 'file' }
import _a208 from '../../../templates/events/config/pages/home.yaml' with { type: 'file' }
import _a209 from '../../../templates/events/config/pages/registrations.yaml' with { type: 'file' }
import _a210 from '../../../templates/events/config/pages/sign-in.yaml' with { type: 'file' }
import _a211 from '../../../templates/events/config/pages/thanks.yaml' with { type: 'file' }
import _a212 from '../../../templates/events/config/tables/events.yaml' with { type: 'file' }
import _a213 from '../../../templates/events/config/tables/registrations.yaml' with { type: 'file' }
import _a214 from '../../../templates/events/config/theme.yaml' with { type: 'file' }
import _a215 from '../../../templates/events/LICENSE' with { type: 'file' }
import _a216 from '../../../templates/events/Procfile' with { type: 'file' }
import _a217 from '../../../templates/events/public/.gitkeep' with { type: 'file' }
import _a218 from '../../../templates/events/public/README.md' with { type: 'file' }
import _a219 from '../../../templates/events/README.md' with { type: 'file' }
import _a220 from '../../../templates/events/scalingo.json' with { type: 'file' }
import _a221 from '../../../templates/expenses/.buildpacks' with { type: 'file' }
import _a222 from '../../../templates/expenses/.claude/agents/app-editor.md' with { type: 'file' }
import _a223 from '../../../templates/expenses/.env.example' with { type: 'file' }
import _a224 from '../../../templates/expenses/app.yaml' with { type: 'file' }
import _a225 from '../../../templates/expenses/CLAUDE.md' with { type: 'file' }
import _a226 from '../../../templates/expenses/config/auth.yaml' with { type: 'file' }
import _a227 from '../../../templates/expenses/config/automations/approve-expense.yaml' with { type: 'file' }
import _a228 from '../../../templates/expenses/config/buckets/receipts.yaml' with { type: 'file' }
import _a229 from '../../../templates/expenses/config/pages/_nav.yaml' with { type: 'file' }
import _a230 from '../../../templates/expenses/config/pages/my-expenses.yaml' with { type: 'file' }
import _a231 from '../../../templates/expenses/config/pages/review.yaml' with { type: 'file' }
import _a232 from '../../../templates/expenses/config/pages/sign-in.yaml' with { type: 'file' }
import _a233 from '../../../templates/expenses/config/tables/expenses.yaml' with { type: 'file' }
import _a234 from '../../../templates/expenses/config/theme.yaml' with { type: 'file' }
import _a235 from '../../../templates/expenses/LICENSE' with { type: 'file' }
import _a236 from '../../../templates/expenses/Procfile' with { type: 'file' }
import _a237 from '../../../templates/expenses/public/.gitkeep' with { type: 'file' }
import _a238 from '../../../templates/expenses/public/README.md' with { type: 'file' }
import _a239 from '../../../templates/expenses/README.md' with { type: 'file' }
import _a240 from '../../../templates/expenses/scalingo.json' with { type: 'file' }
import _a241 from '../../../templates/hello-world/.buildpacks' with { type: 'file' }
import _a242 from '../../../templates/hello-world/.claude/agents/app-editor.md' with { type: 'file' }
import _a243 from '../../../templates/hello-world/.env.example' with { type: 'file' }
import _a244 from '../../../templates/hello-world/app.yaml' with { type: 'file' }
import _a245 from '../../../templates/hello-world/CLAUDE.md' with { type: 'file' }
import _a246 from '../../../templates/hello-world/LICENSE' with { type: 'file' }
import _a247 from '../../../templates/hello-world/Procfile' with { type: 'file' }
import _a248 from '../../../templates/hello-world/public/.gitkeep' with { type: 'file' }
import _a249 from '../../../templates/hello-world/public/README.md' with { type: 'file' }
import _a250 from '../../../templates/hello-world/README.md' with { type: 'file' }
import _a251 from '../../../templates/hello-world/scalingo.json' with { type: 'file' }
import _a252 from '../../../templates/helpdesk/.buildpacks' with { type: 'file' }
import _a253 from '../../../templates/helpdesk/.claude/agents/app-editor.md' with { type: 'file' }
import _a254 from '../../../templates/helpdesk/.env.example' with { type: 'file' }
import _a255 from '../../../templates/helpdesk/app.yaml' with { type: 'file' }
import _a256 from '../../../templates/helpdesk/CLAUDE.md' with { type: 'file' }
import _a257 from '../../../templates/helpdesk/config/auth.yaml' with { type: 'file' }
import _a258 from '../../../templates/helpdesk/config/automations/confirm-new-ticket.yaml' with { type: 'file' }
import _a259 from '../../../templates/helpdesk/config/automations/notify-requester-on-resolved.yaml' with { type: 'file' }
import _a260 from '../../../templates/helpdesk/config/forms/submit-ticket.yaml' with { type: 'file' }
import _a261 from '../../../templates/helpdesk/config/pages/_nav.yaml' with { type: 'file' }
import _a262 from '../../../templates/helpdesk/config/pages/home.yaml' with { type: 'file' }
import _a263 from '../../../templates/helpdesk/config/pages/sign-in.yaml' with { type: 'file' }
import _a264 from '../../../templates/helpdesk/config/pages/thanks.yaml' with { type: 'file' }
import _a265 from '../../../templates/helpdesk/config/pages/tickets.yaml' with { type: 'file' }
import _a266 from '../../../templates/helpdesk/config/pages/triage.yaml' with { type: 'file' }
import _a267 from '../../../templates/helpdesk/config/tables/tickets.yaml' with { type: 'file' }
import _a268 from '../../../templates/helpdesk/config/theme.yaml' with { type: 'file' }
import _a269 from '../../../templates/helpdesk/LICENSE' with { type: 'file' }
import _a270 from '../../../templates/helpdesk/Procfile' with { type: 'file' }
import _a271 from '../../../templates/helpdesk/public/.gitkeep' with { type: 'file' }
import _a272 from '../../../templates/helpdesk/public/README.md' with { type: 'file' }
import _a273 from '../../../templates/helpdesk/README.md' with { type: 'file' }
import _a274 from '../../../templates/helpdesk/scalingo.json' with { type: 'file' }
import _a275 from '../../../templates/intranet/.buildpacks' with { type: 'file' }
import _a276 from '../../../templates/intranet/.claude/agents/app-editor.md' with { type: 'file' }
import _a277 from '../../../templates/intranet/.env.example' with { type: 'file' }
import _a278 from '../../../templates/intranet/app.yaml' with { type: 'file' }
import _a279 from '../../../templates/intranet/CLAUDE.md' with { type: 'file' }
import _a280 from '../../../templates/intranet/config/auth.yaml' with { type: 'file' }
import _a281 from '../../../templates/intranet/config/pages/home.yaml' with { type: 'file' }
import _a282 from '../../../templates/intranet/config/pages/portal.yaml' with { type: 'file' }
import _a283 from '../../../templates/intranet/config/pages/sign-in.yaml' with { type: 'file' }
import _a284 from '../../../templates/intranet/config/tables/members.yaml' with { type: 'file' }
import _a285 from '../../../templates/intranet/config/tables/posts.yaml' with { type: 'file' }
import _a286 from '../../../templates/intranet/config/tables/resources.yaml' with { type: 'file' }
import _a287 from '../../../templates/intranet/config/theme.yaml' with { type: 'file' }
import _a288 from '../../../templates/intranet/LICENSE' with { type: 'file' }
import _a289 from '../../../templates/intranet/Procfile' with { type: 'file' }
import _a290 from '../../../templates/intranet/public/.gitkeep' with { type: 'file' }
import _a291 from '../../../templates/intranet/public/README.md' with { type: 'file' }
import _a292 from '../../../templates/intranet/README.md' with { type: 'file' }
import _a293 from '../../../templates/intranet/scalingo.json' with { type: 'file' }
import _a294 from '../../../templates/knowledge-base/.buildpacks' with { type: 'file' }
import _a295 from '../../../templates/knowledge-base/.claude/agents/app-editor.md' with { type: 'file' }
import _a296 from '../../../templates/knowledge-base/.env.example' with { type: 'file' }
import _a297 from '../../../templates/knowledge-base/app.yaml' with { type: 'file' }
import _a298 from '../../../templates/knowledge-base/CLAUDE.md' with { type: 'file' }
import _a299 from '../../../templates/knowledge-base/config/auth.yaml' with { type: 'file' }
import _a300 from '../../../templates/knowledge-base/config/pages/home.yaml' with { type: 'file' }
import _a301 from '../../../templates/knowledge-base/config/pages/kb.yaml' with { type: 'file' }
import _a302 from '../../../templates/knowledge-base/config/pages/sign-in.yaml' with { type: 'file' }
import _a303 from '../../../templates/knowledge-base/config/theme.yaml' with { type: 'file' }
import _a304 from '../../../templates/knowledge-base/content/kb/expense-policy.md' with { type: 'file' }
import _a305 from '../../../templates/knowledge-base/content/kb/it-setup.md' with { type: 'file' }
import _a306 from '../../../templates/knowledge-base/content/kb/onboarding.md' with { type: 'file' }
import _a307 from '../../../templates/knowledge-base/content/kb/security-policy.md' with { type: 'file' }
import _a308 from '../../../templates/knowledge-base/content/kb/welcome.md' with { type: 'file' }
import _a309 from '../../../templates/knowledge-base/LICENSE' with { type: 'file' }
import _a310 from '../../../templates/knowledge-base/Procfile' with { type: 'file' }
import _a311 from '../../../templates/knowledge-base/public/.gitkeep' with { type: 'file' }
import _a312 from '../../../templates/knowledge-base/public/README.md' with { type: 'file' }
import _a313 from '../../../templates/knowledge-base/README.md' with { type: 'file' }
import _a314 from '../../../templates/knowledge-base/scalingo.json' with { type: 'file' }
import _a315 from '../../../templates/landing-page/.buildpacks' with { type: 'file' }
import _a316 from '../../../templates/landing-page/.claude/agents/app-editor.md' with { type: 'file' }
import _a317 from '../../../templates/landing-page/.env.example' with { type: 'file' }
import _a318 from '../../../templates/landing-page/app.yaml' with { type: 'file' }
import _a319 from '../../../templates/landing-page/CLAUDE.md' with { type: 'file' }
import _a320 from '../../../templates/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a321 from '../../../templates/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a322 from '../../../templates/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a323 from '../../../templates/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a324 from '../../../templates/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a325 from '../../../templates/landing-page/config/languages.yaml' with { type: 'file' }
import _a326 from '../../../templates/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a327 from '../../../templates/landing-page/config/theme.yaml' with { type: 'file' }
import _a328 from '../../../templates/landing-page/LICENSE' with { type: 'file' }
import _a329 from '../../../templates/landing-page/Procfile' with { type: 'file' }
import _a330 from '../../../templates/landing-page/public/.gitkeep' with { type: 'file' }
import _a331 from '../../../templates/landing-page/public/README.md' with { type: 'file' }
import _a332 from '../../../templates/landing-page/README.md' with { type: 'file' }
import _a333 from '../../../templates/landing-page/scalingo.json' with { type: 'file' }
import _a334 from '../../../templates/mcp-server/.buildpacks' with { type: 'file' }
import _a335 from '../../../templates/mcp-server/.claude/agents/app-editor.md' with { type: 'file' }
import _a336 from '../../../templates/mcp-server/.env.example' with { type: 'file' }
import _a337 from '../../../templates/mcp-server/app.yaml' with { type: 'file' }
import _a338 from '../../../templates/mcp-server/CLAUDE.md' with { type: 'file' }
import _a339 from '../../../templates/mcp-server/config/auth.yaml' with { type: 'file' }
import _a340 from '../../../templates/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a341 from '../../../templates/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a342 from '../../../templates/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a343 from '../../../templates/mcp-server/LICENSE' with { type: 'file' }
import _a344 from '../../../templates/mcp-server/Procfile' with { type: 'file' }
import _a345 from '../../../templates/mcp-server/README.md' with { type: 'file' }
import _a346 from '../../../templates/mcp-server/scalingo.json' with { type: 'file' }
import _a347 from '../../../templates/people/.buildpacks' with { type: 'file' }
import _a348 from '../../../templates/people/.claude/agents/app-editor.md' with { type: 'file' }
import _a349 from '../../../templates/people/.env.example' with { type: 'file' }
import _a350 from '../../../templates/people/app.yaml' with { type: 'file' }
import _a351 from '../../../templates/people/CLAUDE.md' with { type: 'file' }
import _a352 from '../../../templates/people/config/auth.yaml' with { type: 'file' }
import _a353 from '../../../templates/people/config/automations/approve-time-off.yaml' with { type: 'file' }
import _a354 from '../../../templates/people/config/pages/_nav.yaml' with { type: 'file' }
import _a355 from '../../../templates/people/config/pages/directory.yaml' with { type: 'file' }
import _a356 from '../../../templates/people/config/pages/requests.yaml' with { type: 'file' }
import _a357 from '../../../templates/people/config/pages/sign-in.yaml' with { type: 'file' }
import _a358 from '../../../templates/people/config/pages/time-off.yaml' with { type: 'file' }
import _a359 from '../../../templates/people/config/tables/employees.yaml' with { type: 'file' }
import _a360 from '../../../templates/people/config/tables/time_off_requests.yaml' with { type: 'file' }
import _a361 from '../../../templates/people/config/theme.yaml' with { type: 'file' }
import _a362 from '../../../templates/people/LICENSE' with { type: 'file' }
import _a363 from '../../../templates/people/Procfile' with { type: 'file' }
import _a364 from '../../../templates/people/public/.gitkeep' with { type: 'file' }
import _a365 from '../../../templates/people/public/README.md' with { type: 'file' }
import _a366 from '../../../templates/people/README.md' with { type: 'file' }
import _a367 from '../../../templates/people/scalingo.json' with { type: 'file' }
import _a368 from '../../../templates/projects/.buildpacks' with { type: 'file' }
import _a369 from '../../../templates/projects/.claude/agents/app-editor.md' with { type: 'file' }
import _a370 from '../../../templates/projects/.env.example' with { type: 'file' }
import _a371 from '../../../templates/projects/app.yaml' with { type: 'file' }
import _a372 from '../../../templates/projects/CLAUDE.md' with { type: 'file' }
import _a373 from '../../../templates/projects/config/auth.yaml' with { type: 'file' }
import _a374 from '../../../templates/projects/config/automations/notify-assignee-on-blocked.yaml' with { type: 'file' }
import _a375 from '../../../templates/projects/config/pages/_nav.yaml' with { type: 'file' }
import _a376 from '../../../templates/projects/config/pages/board.yaml' with { type: 'file' }
import _a377 from '../../../templates/projects/config/pages/calendar.yaml' with { type: 'file' }
import _a378 from '../../../templates/projects/config/pages/dashboard.yaml' with { type: 'file' }
import _a379 from '../../../templates/projects/config/pages/sign-in.yaml' with { type: 'file' }
import _a380 from '../../../templates/projects/config/pages/timeline.yaml' with { type: 'file' }
import _a381 from '../../../templates/projects/config/tables/projects.yaml' with { type: 'file' }
import _a382 from '../../../templates/projects/config/tables/tasks.yaml' with { type: 'file' }
import _a383 from '../../../templates/projects/config/theme.yaml' with { type: 'file' }
import _a384 from '../../../templates/projects/LICENSE' with { type: 'file' }
import _a385 from '../../../templates/projects/Procfile' with { type: 'file' }
import _a386 from '../../../templates/projects/public/.gitkeep' with { type: 'file' }
import _a387 from '../../../templates/projects/public/README.md' with { type: 'file' }
import _a388 from '../../../templates/projects/README.md' with { type: 'file' }
import _a389 from '../../../templates/projects/scalingo.json' with { type: 'file' }
import _a390 from '../../../templates/README.md' with { type: 'file' }
import _a391 from './dashboard/dashboard-app.yaml' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_icy_northstar.sql": _a1,
      "0001_glossy_squadron_supreme.sql": _a2,
      "0002_bitter_calypso.sql": _a3,
      "0003_magenta_the_anarchist.sql": _a4,
      "0004_absurd_zaran.sql": _a5,
      "0005_greedy_smasher.sql": _a6,
      "0006_material_lizard.sql": _a7,
    },
  },
  sqlite: {
    journal: _a8,
    migrations: {
      "0000_mute_cassandra_nova.sql": _a9,
      "0001_famous_leper_queen.sql": _a10,
      "0002_quick_texas_twister.sql": _a11,
      "0003_absent_dakota_north.sql": _a12,
      "0004_shocking_lyja.sql": _a13,
      "0005_stormy_sersi.sql": _a14,
      "0006_fantastic_mojo.sql": _a15,
    },
  },
}

export const TEMPLATE_FILES = {
  "api-only/.buildpacks": _a16,
  "api-only/.claude/agents/app-editor.md": _a17,
  "api-only/.env.example": _a18,
  "api-only/app.yaml": _a19,
  "api-only/CLAUDE.md": _a20,
  "api-only/config/auth.yaml": _a21,
  "api-only/config/tables/projects.yaml": _a22,
  "api-only/config/tables/tasks.yaml": _a23,
  "api-only/LICENSE": _a24,
  "api-only/Procfile": _a25,
  "api-only/README.md": _a26,
  "api-only/scalingo.json": _a27,
  "assets/.buildpacks": _a28,
  "assets/.claude/agents/app-editor.md": _a29,
  "assets/.env.example": _a30,
  "assets/app.yaml": _a31,
  "assets/CLAUDE.md": _a32,
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
  "automation-recipes/.claude/agents/app-editor.md": _a50,
  "automation-recipes/.env.example": _a51,
  "automation-recipes/app.yaml": _a52,
  "automation-recipes/CLAUDE.md": _a53,
  "automation-recipes/config/auth.yaml": _a54,
  "automation-recipes/config/automations/alert-on-failure.yaml": _a55,
  "automation-recipes/config/automations/capture-lead-from-webhook.yaml": _a56,
  "automation-recipes/config/automations/daily-digest.yaml": _a57,
  "automation-recipes/config/automations/log-new-lead.yaml": _a58,
  "automation-recipes/config/pages/_nav.yaml": _a59,
  "automation-recipes/config/pages/activity.yaml": _a60,
  "automation-recipes/config/pages/home.yaml": _a61,
  "automation-recipes/config/pages/sign-in.yaml": _a62,
  "automation-recipes/config/tables/activity_log.yaml": _a63,
  "automation-recipes/config/tables/leads.yaml": _a64,
  "automation-recipes/config/theme.yaml": _a65,
  "automation-recipes/LICENSE": _a66,
  "automation-recipes/Procfile": _a67,
  "automation-recipes/public/.gitkeep": _a68,
  "automation-recipes/public/README.md": _a69,
  "automation-recipes/README.md": _a70,
  "automation-recipes/scalingo.json": _a71,
  "blog/.buildpacks": _a72,
  "blog/.claude/agents/app-editor.md": _a73,
  "blog/.env.example": _a74,
  "blog/app.yaml": _a75,
  "blog/CLAUDE.md": _a76,
  "blog/config/agents/blog-editor.yaml": _a77,
  "blog/config/auth.yaml": _a78,
  "blog/config/pages/admin-ai-editor.yaml": _a79,
  "blog/config/pages/admin-authors.yaml": _a80,
  "blog/config/pages/admin-dashboard.yaml": _a81,
  "blog/config/pages/admin-login.yaml": _a82,
  "blog/config/pages/admin-post-edit.yaml": _a83,
  "blog/config/pages/admin-post-new.yaml": _a84,
  "blog/config/pages/admin-register.yaml": _a85,
  "blog/config/pages/admin-tags.yaml": _a86,
  "blog/config/pages/index.yaml": _a87,
  "blog/config/pages/post-detail.yaml": _a88,
  "blog/config/tables/authors.yaml": _a89,
  "blog/config/tables/posts.yaml": _a90,
  "blog/config/tables/tags.yaml": _a91,
  "blog/LICENSE": _a92,
  "blog/Procfile": _a93,
  "blog/public/.gitkeep": _a94,
  "blog/public/README.md": _a95,
  "blog/README.md": _a96,
  "blog/scalingo.json": _a97,
  "catalog.json": _a98,
  "company-os/.buildpacks": _a99,
  "company-os/.claude/agents/app-editor.md": _a100,
  "company-os/.env.example": _a101,
  "company-os/app.yaml": _a102,
  "company-os/CLAUDE.md": _a103,
  "company-os/config/agents/ops-assistant.yaml": _a104,
  "company-os/config/auth.yaml": _a105,
  "company-os/config/automations/approve-time-off.yaml": _a106,
  "company-os/config/automations/create-project-on-won-deal.yaml": _a107,
  "company-os/config/automations/notify-contact-on-resolved-ticket.yaml": _a108,
  "company-os/config/pages/_nav.yaml": _a109,
  "company-os/config/pages/assistant.yaml": _a110,
  "company-os/config/pages/dashboard.yaml": _a111,
  "company-os/config/pages/delivery.yaml": _a112,
  "company-os/config/pages/people.yaml": _a113,
  "company-os/config/pages/sales.yaml": _a114,
  "company-os/config/pages/sign-in.yaml": _a115,
  "company-os/config/pages/support.yaml": _a116,
  "company-os/config/tables/companies.yaml": _a117,
  "company-os/config/tables/contacts.yaml": _a118,
  "company-os/config/tables/deals.yaml": _a119,
  "company-os/config/tables/employees.yaml": _a120,
  "company-os/config/tables/project_tasks.yaml": _a121,
  "company-os/config/tables/projects.yaml": _a122,
  "company-os/config/tables/tickets.yaml": _a123,
  "company-os/config/tables/time_off_requests.yaml": _a124,
  "company-os/config/theme.yaml": _a125,
  "company-os/LICENSE": _a126,
  "company-os/Procfile": _a127,
  "company-os/public/.gitkeep": _a128,
  "company-os/public/README.md": _a129,
  "company-os/README.md": _a130,
  "company-os/scalingo.json": _a131,
  "content-calendar/.buildpacks": _a132,
  "content-calendar/.claude/agents/app-editor.md": _a133,
  "content-calendar/.env.example": _a134,
  "content-calendar/app.yaml": _a135,
  "content-calendar/CLAUDE.md": _a136,
  "content-calendar/config/auth.yaml": _a137,
  "content-calendar/config/automations/weekly-digest.yaml": _a138,
  "content-calendar/config/pages/_nav.yaml": _a139,
  "content-calendar/config/pages/calendar.yaml": _a140,
  "content-calendar/config/pages/grid.yaml": _a141,
  "content-calendar/config/pages/pipeline.yaml": _a142,
  "content-calendar/config/pages/sign-in.yaml": _a143,
  "content-calendar/config/tables/campaigns.yaml": _a144,
  "content-calendar/config/tables/content.yaml": _a145,
  "content-calendar/config/theme.yaml": _a146,
  "content-calendar/LICENSE": _a147,
  "content-calendar/Procfile": _a148,
  "content-calendar/public/.gitkeep": _a149,
  "content-calendar/public/README.md": _a150,
  "content-calendar/README.md": _a151,
  "content-calendar/scalingo.json": _a152,
  "crm/.buildpacks": _a153,
  "crm/.claude/agents/app-editor.md": _a154,
  "crm/.env.example": _a155,
  "crm/app.yaml": _a156,
  "crm/CLAUDE.md": _a157,
  "crm/config/agents/records-assistant.yaml": _a158,
  "crm/config/auth.yaml": _a159,
  "crm/config/automations/deal-won-notification.yaml": _a160,
  "crm/config/pages/_nav.yaml": _a161,
  "crm/config/pages/assistant.yaml": _a162,
  "crm/config/pages/companies.yaml": _a163,
  "crm/config/pages/contacts.yaml": _a164,
  "crm/config/pages/deals.yaml": _a165,
  "crm/config/pages/sign-in.yaml": _a166,
  "crm/config/pages/tasks.yaml": _a167,
  "crm/config/tables/companies.yaml": _a168,
  "crm/config/tables/contacts.yaml": _a169,
  "crm/config/tables/deals.yaml": _a170,
  "crm/config/tables/tasks.yaml": _a171,
  "crm/config/theme.yaml": _a172,
  "crm/LICENSE": _a173,
  "crm/Procfile": _a174,
  "crm/public/.gitkeep": _a175,
  "crm/public/README.md": _a176,
  "crm/README.md": _a177,
  "crm/scalingo.json": _a178,
  "docs-site/.buildpacks": _a179,
  "docs-site/.claude/agents/app-editor.md": _a180,
  "docs-site/.env.example": _a181,
  "docs-site/app.yaml": _a182,
  "docs-site/CLAUDE.md": _a183,
  "docs-site/config/pages/docs.yaml": _a184,
  "docs-site/config/pages/home.yaml": _a185,
  "docs-site/config/theme.yaml": _a186,
  "docs-site/content/docs/guides/configuration.md": _a187,
  "docs-site/content/docs/guides/deployment.md": _a188,
  "docs-site/content/docs/installation.md": _a189,
  "docs-site/content/docs/introduction.md": _a190,
  "docs-site/content/docs/quick-start.md": _a191,
  "docs-site/LICENSE": _a192,
  "docs-site/Procfile": _a193,
  "docs-site/public/.gitkeep": _a194,
  "docs-site/public/README.md": _a195,
  "docs-site/README.md": _a196,
  "docs-site/scalingo.json": _a197,
  "events/.buildpacks": _a198,
  "events/.claude/agents/app-editor.md": _a199,
  "events/.env.example": _a200,
  "events/app.yaml": _a201,
  "events/CLAUDE.md": _a202,
  "events/config/auth.yaml": _a203,
  "events/config/automations/confirm-registration.yaml": _a204,
  "events/config/forms/register.yaml": _a205,
  "events/config/pages/_nav.yaml": _a206,
  "events/config/pages/calendar.yaml": _a207,
  "events/config/pages/home.yaml": _a208,
  "events/config/pages/registrations.yaml": _a209,
  "events/config/pages/sign-in.yaml": _a210,
  "events/config/pages/thanks.yaml": _a211,
  "events/config/tables/events.yaml": _a212,
  "events/config/tables/registrations.yaml": _a213,
  "events/config/theme.yaml": _a214,
  "events/LICENSE": _a215,
  "events/Procfile": _a216,
  "events/public/.gitkeep": _a217,
  "events/public/README.md": _a218,
  "events/README.md": _a219,
  "events/scalingo.json": _a220,
  "expenses/.buildpacks": _a221,
  "expenses/.claude/agents/app-editor.md": _a222,
  "expenses/.env.example": _a223,
  "expenses/app.yaml": _a224,
  "expenses/CLAUDE.md": _a225,
  "expenses/config/auth.yaml": _a226,
  "expenses/config/automations/approve-expense.yaml": _a227,
  "expenses/config/buckets/receipts.yaml": _a228,
  "expenses/config/pages/_nav.yaml": _a229,
  "expenses/config/pages/my-expenses.yaml": _a230,
  "expenses/config/pages/review.yaml": _a231,
  "expenses/config/pages/sign-in.yaml": _a232,
  "expenses/config/tables/expenses.yaml": _a233,
  "expenses/config/theme.yaml": _a234,
  "expenses/LICENSE": _a235,
  "expenses/Procfile": _a236,
  "expenses/public/.gitkeep": _a237,
  "expenses/public/README.md": _a238,
  "expenses/README.md": _a239,
  "expenses/scalingo.json": _a240,
  "hello-world/.buildpacks": _a241,
  "hello-world/.claude/agents/app-editor.md": _a242,
  "hello-world/.env.example": _a243,
  "hello-world/app.yaml": _a244,
  "hello-world/CLAUDE.md": _a245,
  "hello-world/LICENSE": _a246,
  "hello-world/Procfile": _a247,
  "hello-world/public/.gitkeep": _a248,
  "hello-world/public/README.md": _a249,
  "hello-world/README.md": _a250,
  "hello-world/scalingo.json": _a251,
  "helpdesk/.buildpacks": _a252,
  "helpdesk/.claude/agents/app-editor.md": _a253,
  "helpdesk/.env.example": _a254,
  "helpdesk/app.yaml": _a255,
  "helpdesk/CLAUDE.md": _a256,
  "helpdesk/config/auth.yaml": _a257,
  "helpdesk/config/automations/confirm-new-ticket.yaml": _a258,
  "helpdesk/config/automations/notify-requester-on-resolved.yaml": _a259,
  "helpdesk/config/forms/submit-ticket.yaml": _a260,
  "helpdesk/config/pages/_nav.yaml": _a261,
  "helpdesk/config/pages/home.yaml": _a262,
  "helpdesk/config/pages/sign-in.yaml": _a263,
  "helpdesk/config/pages/thanks.yaml": _a264,
  "helpdesk/config/pages/tickets.yaml": _a265,
  "helpdesk/config/pages/triage.yaml": _a266,
  "helpdesk/config/tables/tickets.yaml": _a267,
  "helpdesk/config/theme.yaml": _a268,
  "helpdesk/LICENSE": _a269,
  "helpdesk/Procfile": _a270,
  "helpdesk/public/.gitkeep": _a271,
  "helpdesk/public/README.md": _a272,
  "helpdesk/README.md": _a273,
  "helpdesk/scalingo.json": _a274,
  "intranet/.buildpacks": _a275,
  "intranet/.claude/agents/app-editor.md": _a276,
  "intranet/.env.example": _a277,
  "intranet/app.yaml": _a278,
  "intranet/CLAUDE.md": _a279,
  "intranet/config/auth.yaml": _a280,
  "intranet/config/pages/home.yaml": _a281,
  "intranet/config/pages/portal.yaml": _a282,
  "intranet/config/pages/sign-in.yaml": _a283,
  "intranet/config/tables/members.yaml": _a284,
  "intranet/config/tables/posts.yaml": _a285,
  "intranet/config/tables/resources.yaml": _a286,
  "intranet/config/theme.yaml": _a287,
  "intranet/LICENSE": _a288,
  "intranet/Procfile": _a289,
  "intranet/public/.gitkeep": _a290,
  "intranet/public/README.md": _a291,
  "intranet/README.md": _a292,
  "intranet/scalingo.json": _a293,
  "knowledge-base/.buildpacks": _a294,
  "knowledge-base/.claude/agents/app-editor.md": _a295,
  "knowledge-base/.env.example": _a296,
  "knowledge-base/app.yaml": _a297,
  "knowledge-base/CLAUDE.md": _a298,
  "knowledge-base/config/auth.yaml": _a299,
  "knowledge-base/config/pages/home.yaml": _a300,
  "knowledge-base/config/pages/kb.yaml": _a301,
  "knowledge-base/config/pages/sign-in.yaml": _a302,
  "knowledge-base/config/theme.yaml": _a303,
  "knowledge-base/content/kb/expense-policy.md": _a304,
  "knowledge-base/content/kb/it-setup.md": _a305,
  "knowledge-base/content/kb/onboarding.md": _a306,
  "knowledge-base/content/kb/security-policy.md": _a307,
  "knowledge-base/content/kb/welcome.md": _a308,
  "knowledge-base/LICENSE": _a309,
  "knowledge-base/Procfile": _a310,
  "knowledge-base/public/.gitkeep": _a311,
  "knowledge-base/public/README.md": _a312,
  "knowledge-base/README.md": _a313,
  "knowledge-base/scalingo.json": _a314,
  "landing-page/.buildpacks": _a315,
  "landing-page/.claude/agents/app-editor.md": _a316,
  "landing-page/.env.example": _a317,
  "landing-page/app.yaml": _a318,
  "landing-page/CLAUDE.md": _a319,
  "landing-page/config/components/cta-button.yaml": _a320,
  "landing-page/config/components/feature-card.yaml": _a321,
  "landing-page/config/components/hero-section.yaml": _a322,
  "landing-page/config/components/language-switcher.yaml": _a323,
  "landing-page/config/components/step-card.yaml": _a324,
  "landing-page/config/languages.yaml": _a325,
  "landing-page/config/pages/home.yaml": _a326,
  "landing-page/config/theme.yaml": _a327,
  "landing-page/LICENSE": _a328,
  "landing-page/Procfile": _a329,
  "landing-page/public/.gitkeep": _a330,
  "landing-page/public/README.md": _a331,
  "landing-page/README.md": _a332,
  "landing-page/scalingo.json": _a333,
  "mcp-server/.buildpacks": _a334,
  "mcp-server/.claude/agents/app-editor.md": _a335,
  "mcp-server/.env.example": _a336,
  "mcp-server/app.yaml": _a337,
  "mcp-server/CLAUDE.md": _a338,
  "mcp-server/config/auth.yaml": _a339,
  "mcp-server/config/mcp.yaml": _a340,
  "mcp-server/config/tables/documents.yaml": _a341,
  "mcp-server/config/tables/tags.yaml": _a342,
  "mcp-server/LICENSE": _a343,
  "mcp-server/Procfile": _a344,
  "mcp-server/README.md": _a345,
  "mcp-server/scalingo.json": _a346,
  "people/.buildpacks": _a347,
  "people/.claude/agents/app-editor.md": _a348,
  "people/.env.example": _a349,
  "people/app.yaml": _a350,
  "people/CLAUDE.md": _a351,
  "people/config/auth.yaml": _a352,
  "people/config/automations/approve-time-off.yaml": _a353,
  "people/config/pages/_nav.yaml": _a354,
  "people/config/pages/directory.yaml": _a355,
  "people/config/pages/requests.yaml": _a356,
  "people/config/pages/sign-in.yaml": _a357,
  "people/config/pages/time-off.yaml": _a358,
  "people/config/tables/employees.yaml": _a359,
  "people/config/tables/time_off_requests.yaml": _a360,
  "people/config/theme.yaml": _a361,
  "people/LICENSE": _a362,
  "people/Procfile": _a363,
  "people/public/.gitkeep": _a364,
  "people/public/README.md": _a365,
  "people/README.md": _a366,
  "people/scalingo.json": _a367,
  "projects/.buildpacks": _a368,
  "projects/.claude/agents/app-editor.md": _a369,
  "projects/.env.example": _a370,
  "projects/app.yaml": _a371,
  "projects/CLAUDE.md": _a372,
  "projects/config/auth.yaml": _a373,
  "projects/config/automations/notify-assignee-on-blocked.yaml": _a374,
  "projects/config/pages/_nav.yaml": _a375,
  "projects/config/pages/board.yaml": _a376,
  "projects/config/pages/calendar.yaml": _a377,
  "projects/config/pages/dashboard.yaml": _a378,
  "projects/config/pages/sign-in.yaml": _a379,
  "projects/config/pages/timeline.yaml": _a380,
  "projects/config/tables/projects.yaml": _a381,
  "projects/config/tables/tasks.yaml": _a382,
  "projects/config/theme.yaml": _a383,
  "projects/LICENSE": _a384,
  "projects/Procfile": _a385,
  "projects/public/.gitkeep": _a386,
  "projects/public/README.md": _a387,
  "projects/README.md": _a388,
  "projects/scalingo.json": _a389,
  "README.md": _a390,
}

export const DASHBOARD_FILES = {
  "dashboard-app.yaml": _a391,
}
