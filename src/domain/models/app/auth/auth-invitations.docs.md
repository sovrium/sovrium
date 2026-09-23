# Invitations

> Onboarding somebody without inventing their password — a single-use link, a role carried explicitly, and a delegated grant with three limits.

Creating a user directly makes an admin choose the new password and sends the person nothing: workable for a script, unusable for onboarding a customer. An invitation closes that gap. The admin supplies an address, a name and a role with **no password**, Sovrium emails a single-use link, and the invitee sets their own password and lands authenticated.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  invitationTokenExpiry: '72h'
  emailTemplates:
    invitation:
      subject: 'You are invited to join, $name'
      text: |
        Hi $name,
        $inviterName invited you to join.
        Set your password: $url
        This invitation expires in 72 hours.
```

## The two endpoints

| Endpoint                                 | Behaviour                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /api/auth/admin/invite-user`       | Takes an address, a name and a role, and no password                              |
| `POST /api/auth/admin/accept-invitation` | Backs the public accept page; the invitee sets a password and lands authenticated |

Issuing answers `401` when unauthenticated and **`404`** when the caller may not invite that role — never `403`, so the endpoint leaks nothing about which roles exist. It answers `400` for invalid input, and `422` when the address already maps to a fully onboarded user.

Accepting answers `400` for an invalid token and `410` for an expired one.

Tokens expire after `invitationTokenExpiry` — 72 hours by default — and are **single-use**, consumed on the first successful accept. A replay is refused rather than silently re-onboarding somebody.

Closing public self-registration does **not** block invitations. That is precisely when you need this flow: admin-driven user creation stays available whenever authentication is configured.

## Delegating the grant

By default only the admin-equivalent role may invite. A role declaring `canInvite: true` may invite as well, without becoming admin-equivalent in any other respect.

```yaml
auth:
  roles:
    - name: engineer
      level: 80
    - name: customer-admin
      level: 40
      canInvite: true
    - name: customer-member
      level: 20
  scopeTables:
    - clients
```

Three limits come with the grant, and none is configurable:

| Limit                    | Effect                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| The level ceiling holds  | The invited role's level must be at or below the inviter's                         |
| Admin-tier roles are out | A role reaching the operator console can never be invited, whatever the levels say |
| Tenants do not widen     | The invitee inherits the inviter's scope rows and nothing else                     |

A refused invitation answers `404` rather than `403`, for the same reason the endpoint does elsewhere.

### The grant covers issuing, not the list

`canInvite` opens the invite endpoint and nothing else. Listing, resending and revoking stay admin-equivalent and answer `404` to a delegated caller.

Those endpoints range over **every** invitation in the app, so a tenant-scoped caller reading them would see other tenants' invitees. `200` on invite and `404` on list, for the same person, is the intended shape rather than an inconsistency.

## Which role the invitee gets

An invitation carries a role explicitly. Where none is supplied, a new user receives the app's default role, which itself falls back to `member`.

The default is validated against the built-ins plus your declared roles, so a typo fails validation rather than quietly assigning nothing. The first bootstrap admin is always created with the admin role and a verified address, whatever the default says.

## Invitation or create-user

| You want                                       | Reach for                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- |
| A customer to choose their own password        | An invitation — they never see an admin-set secret         |
| A service or seed account, no mailbox involved | Create-user — you set the password and nothing is sent     |
| To onboard while SMTP is not configured        | Create-user — an invitation email would never be delivered |

## Onboarding and access assignment are separate

An admin-equivalent inviter creates the account and grants no tenant scope: wiring the user to the data they may reach is a separate step, so you can invite first and assign later, or the reverse.

A delegated inviter is the exception. The invitee inherits that inviter's own scope rows, because a tenant-scoped person onboarding a colleague into a tenant they do not themselves share would be the surprising outcome.
