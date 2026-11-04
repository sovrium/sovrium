# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small team that delivers projects: the people who work their tasks, and the project lead who also deletes projects and tasks.

## Product Purpose

A project workspace for a small team: dashboard, task board, timeline, calendar.

Fernhill Projects — a project workspace for a small team. The dashboard is the home page, with
what needs attention this week before how the portfolio is doing; the board holds open tasks by
status and opens a task in a drawer; the timeline lays every task out by project with what it
waits on; and the calendar shows the month's deadlines beside your own tasks.

## Capabilities and Constraints

- **Tables** (2): projects, tasks
- **Pages** (5): dashboard (`/`), board, timeline, calendar, sign-in
- **Automations** (3): notify-assignee-on-blocked; chase-blocked-tasks (a manual trigger,
  pressed from the dashboard, with a one-day delay); and record-to-teams-channel — a library
  recipe (`library/recipe/`, with its `library/connection/microsoft-365.yaml`) posting each
  new project to a Teams channel once the Microsoft variables are set
- **Singletons**: auth, design, env
- **Seed data**: `seed/` — five sign-in accounts, six projects and eighteen tasks, dated
  relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of fernhill-projects is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named fernhill-projects. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
