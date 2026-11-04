---
name: design-agent-mock-becomes-config
max_turns: 25
---

A design agent read the DESIGN.md of my Sovrium app and proposed this pricing page. Make it the real /pricing page of the app. Here is my app.yaml:

```yaml
name: harbour-studio
design:
  colors:
    primary: '#1f4e79'
    signature: '#6b7f5e'
pages:
  - name: home
    path: /
    components:
      - type: text
        element: h1
        content: Design that ships
```

And here is what the agent proposed:

```html
<style>
  .pricing {
    background: linear-gradient(135deg, #7c3aed, #1f4e79);
    padding: 72px 24px;
  }
  .plan {
    border-radius: 18px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
</style>
<section class="pricing">
  <h1>Simple pricing</h1>
  <div class="plan">
    <h2>Studio</h2>
    <p>€490 per project</p>
    <a href="/contact">Book a call</a>
  </div>
  <div class="plan">
    <h2>Retainer</h2>
    <p>€2,400 per month</p>
    <a href="/contact">Book a call</a>
  </div>
</section>
```
