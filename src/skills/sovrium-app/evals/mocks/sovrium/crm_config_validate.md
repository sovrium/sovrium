---
expect: 'no arguments; the call validates the files on disk'
---

{"valid":false,"files":["/Users/demo/apps/crm/app.yaml","/Users/demo/apps/crm/config/tables/contacts.yaml"],"findings":[{"path":"tables[0].fields[1]","message":"Unknown property 'lable' on field type 'single-line-text'","accepted":["id","name","label","description","required","unique","indexed","type","default"],"severity":"error"}],"notices":[]}
