# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small company that keeps its people records in one place: everyone on the team, who reads the directory and asks for time off, and HR, who also reads salaries, decides on the requests and sends contracts for signature.

## Product Purpose

A small company's HR workspace: the team, who is away, who decides, and contracts signed online.

Meridian People — a small company's HR workspace. The directory lists the team and withholds each
salary from everyone but an admin, on the server; time off shows who is away by name and what waits
on a decision; a request is filed by the person it concerns and waits on an admin, who decides in the
app; the HR overview counts the team and its time off; and an employment contract goes out for
signature, to the employee then the manager, and comes back signed with its evidence file.

## Capabilities and Constraints

- **Tables** (3): employees, time_off_requests, contracts
- **Pages** (7): directory (`/`), time-off, requests (admin), overview (admin), contracts
  (admin), sign-in, and contract-signing (`/sign/:token`, opened from a signer's email)
- **Automations** (4): approve-time-off; join-new-account-to-directory (an auth trigger on
  `signUp`, with an `auth` assignRole step for the People team); send-contract-for-signature (a
  `signature/send` step); and record-to-google-doc — a library recipe (`library/recipe/`, with
  its `library/connection/google.yaml`) copying a welcome document for each new hire once the
  Google variables are set
- **Signing flows** (1): employment_contract (`config/signatures/`), the employee then the
  manager, each from a link sent to their email
- **Singletons**: auth, design, env, buckets (contracts)
- **Seed data**: `seed/` — twelve sign-in accounts, twelve people with their managers, eleven
  time-off requests dated relative to the day you seed, and one drafted contract with a sample
  PDF in `seed/assets/`
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of meridian-people is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named meridian-people. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
