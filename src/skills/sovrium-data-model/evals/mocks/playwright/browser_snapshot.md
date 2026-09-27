---
expect: 'called after browser_navigate to a record page under http://localhost:3000/clients/'
---

- main:
  - heading "Northwind Trading" [level=1] [ref=e3]
  - description-list:
    - term: "Account owner"
    - definition: "Priya Raman"
  - heading "Contacts" [level=2] [ref=e8]
  - table "Contacts" [ref=e9]:
    - row: "Name Email"
    - row: "Ada Okafor ada@northwind.example"
    - row: "Luis Ortega luis@northwind.example"
  - heading "Projects" [level=2] [ref=e14]
  - list [ref=e15]:
    - listitem: "Website refresh"
    - listitem: "Quarterly reporting"
