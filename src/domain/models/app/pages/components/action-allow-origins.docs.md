# Sending a member to another site after an action

> `onSuccess.allowOrigins` — the sites one action may send the reader to, when the address is one its run returned.

An answered action moves the reader within your app: a `navigate` written as another site's address is refused when the config is read. A payment checkout is the case that rule cannot serve — the provider answers with the address of its own page, and the member must go there. So one action may list the exact sites it trusts, and send the member to the address its run returned when that address is on one of them.

```yaml
- type: button
  content: Join
  action:
    type: automation
    name: create-checkout-session
    await: true
    onSuccess:
      navigate: $response.output.url
      allowOrigins: ['https://checkout.stripe.com']
    onError:
      toast:
        message: The payment page could not be opened. Please try again.
        variant: error
```

`allowOrigins` is read only when `navigate` is a lone `$response.<path>`, the address the run answered. Each entry is an exact origin — `https://` and a host, with an optional port, no path and no wildcard — and the returned address must match one of them exactly, so `https://checkout.stripe.com.example.net` never passes for `https://checkout.stripe.com`. Anything else — another site, a `javascript:` address, a value that is not an address — is refused: the member stays on the page and `onError` is shown. Without the list, a returned address is followed only when it is on your own site.

`http://localhost`, on any port, is accepted for testing a checkout on your own machine, and refused in production like any other `http://` origin. A `navigate` written out as another site's address stays refused whatever the list says, and the list beside any `navigate` other than a lone `$response.<path>` is refused at startup. An endpoint form's `onSuccess` follows the same rule.
