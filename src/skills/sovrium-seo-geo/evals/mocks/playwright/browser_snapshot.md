---
expect: 'called after browser_navigate to http://localhost:3000/fr/ or http://localhost:3000/en/'
---

- banner:
  - link "Boulangerie Martin" [ref=e2]
  - navigation "Menu principal":
    - link "Nos pains" [ref=e4]
    - link "Commander" [ref=e5]
    - link "English" [ref=e6]
- main:
  - heading "Du pain au levain, cuit chaque matin à Lyon" [level=1] [ref=e8]
  - paragraph: "Farines bio de la Drôme, fermentation de 24 heures, cuisson au feu de bois."
  - img "Miches de pain au levain sur une étagère en bois" [ref=e10]
- contentinfo:
  - text: "12 rue des Tanneurs, 69001 Lyon"
