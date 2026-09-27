---
name: normalises-and-keeps-ids
max_turns: 25
---

In ~/apps/agency/config/tables/clients.yaml the clients table has fields contact_1_name, contact_1_email, contact_2_name, contact_2_email and a long-text 'projects' holding comma-separated names. Sales reps must only see their own clients. Restructure it without losing existing data.
