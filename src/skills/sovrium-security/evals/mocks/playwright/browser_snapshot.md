---
# Not an argument guard: called after browser_navigate to http://localhost:3000/login.
---

- main:
  - heading "Sign in to Portal" [level=1] [ref=e2]
  - textbox "Email" [ref=e4]
  - textbox "Password" [ref=e5]
  - button "Sign in" [ref=e6]
  - link "Create an account" [ref=e7]
- complementary "Dev":
  - text: "Development mode. Data on this instance is disposable."
  - code: "admin@portal.local"
  - code: "sovrium-dev-password"
