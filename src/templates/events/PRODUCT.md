# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A community that runs workshops and meetups: attendees who register from the public page with no account, the organizers who run registrations and the door, and the lead who also removes an event.

## Product Purpose

A community's events: what is on with the seats left, registration with no account, a waitlist.

Fieldday Events — a community's workshops and meetups across France. Visitors see what is on,
when, where and how many seats are left, and register with no account; a full event offers its
waitlist. The organizers read the month and the seats taken on one Overview, find everyone
grouped by event, and check people in at the door.

## Capabilities and Constraints

- **Tables** (3): events (seats taken and waitlist are counted from the registrations by an
  automation, and seats left is computed from them), registrations, calendar_events (filled
  from the shared Google calendar by the library recipe, admin-only)
- **Forms** (3): register (rendered on `/register`), join-waitlist (rendered on `/waitlist/<event>`),
  new-event (opened in a dialog on the Overview)
- **Pages** (9): calendar (`/calendar`, the Overview), registrations, home (`/`, public),
  register, waitlist, thanks, thanks-event (`/thanks/<event>`), on-the-waitlist, sign-in
- **Automations** (5): confirm-registration, recount-seats, track-registration (an
  `analytics.track` event per registration), and announce-event — a post to a Discord channel
  as an event opens, through the library connection `library/connection/discord.yaml`, once
  `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` are set, and the library recipe
  `library/recipe/google-calendar-events-to-table.yaml`, hourly, once a Google account is connected
- **Singletons**: auth, design, env, analytics (first-party, the organizers' pages excluded)
- **Seed data**: `seed/` — two sign-in accounts, seven events and their registrations, dated
  relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of fieldday-events is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named fieldday-events. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
