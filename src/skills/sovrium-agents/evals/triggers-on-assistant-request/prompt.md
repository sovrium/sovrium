---
name: triggers-on-assistant-request
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Our helpdesk runs on Sovrium (~/apps/helpdesk, app.yaml). I want a chatbot on the /help page that answers customers from our FAQ table and our product manual PDF, and can open a ticket for them. We'd rather not send everything to a cloud model. How do I set it up?
