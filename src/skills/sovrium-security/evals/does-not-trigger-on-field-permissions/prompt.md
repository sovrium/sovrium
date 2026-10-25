---
name: does-not-trigger-on-field-permissions
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

In ~/apps/portal/app.yaml, add a `discount` decimal field to the contracts table that only admins can see and edit. Everyone signed in should still read the rest of the contract.
