---
name: does-not-trigger-on-automation-retry
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

In ~/apps/helpdesk/app.yaml, the automation that posts new tickets to our Slack webhook sometimes posts the same ticket twice when Slack is slow. How do I stop the duplicates?
