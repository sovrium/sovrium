# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A company and its staff: every employee, who reads the hub and the directory, the managers who publish announcements, and IT, who administers it.

## Product Purpose

A company intranet: the must-read first, the news, a searchable directory, the resources, and a Publish page for managers.

Halden — a company intranet. A public welcome page, sign-in by a link emailed to a work
address (a password on its own page as the fallback), and behind it the hub everyone opens
in the morning: the must-read on top with how many colleagues have acknowledged it, the
latest news with who wrote it, what is coming up, who joined in the last 30 days, a
searchable directory and the company's resources. Managers publish from their own page;
nobody else is offered it.

## Capabilities and Constraints

- **Tables** (6): company (one row; its `headcount` counts the directory), members (the
  directory, with a `manager` link to the same table), posts (announcements; `must_read_by`
  makes one a must-read, `ack_line` reads "31 of 46"), acknowledgements, events, resources
- **Forms** (1): publish-announcement (rendered on `/publish`)
- **Pages** (8): portal (`/portal`, Home), news, people, resources, publish (managers only),
  home (`/`), sign-in (the link), sign-in-password (the fallback)
- **Automations** (2): sign-new-announcement (signs, dates and addresses a new announcement),
  and record-to-teams-channel — a library recipe (`library/recipe/`, with its
  `library/connection/microsoft-365.yaml`) posting each new announcement to a Teams channel
  once the Microsoft variables are set
- **Singletons**: auth, design, env
- **Seed data**: `seed/` — eight sign-in accounts, forty-six colleagues (thirty-eight of them
  invented), six announcements, thirty-one acknowledgements, three dates and ten resources,
  dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of halden-intranet is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named halden-intranet. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
