# Distant Star Systems access model

Distant Star Systems owns identity and access administration centrally. Domain Applications remain independently deployed, but they do not own separate user stores or approval systems.

## Ownership

- `distantstarsystems.ai`: central access-request, invitation, approval, entitlement, expiration, and revocation administration.
- `hearts.distantstarsystems.ai`: Cancellation Hearts application; Cloudflare Access enforces admission at the application edge.
- `ochem.distantstarsystems.ai`: Organic Chemistry application; separately enforced at its application edge.
- ULS: canonical DSS account identity and entitlement authority across applications.

Cloudflare Access answers whether a verified identity may reach an application. ULS answers which DSS products that canonical account is entitled to use. OTP verifies identity only; successful OTP authentication is not, by itself, authorization.

## Cancellation Hearts admission

`hearts.distantstarsystems.ai` must use a Cloudflare Access policy limited to an explicitly approved identity population. A reusable group/list such as `DSS Cancellation Hearts Approved Users` may hold approved email addresses. The policy must not allow every identity merely because One-time PIN succeeded.

After Cloudflare admits a verified email, the ULS Learning Gateway resolves the canonical account from the Cloudflare identity and requires the `app:cancellation-hearts` entitlement. Browser-supplied account or learner identifiers are never authoritative.

## Provisioning

Both entry paths converge on the same provisioning service:

1. Request Access -> operator approval -> approved Cloudflare identity + pending ULS access -> invitation.
2. Direct Invite -> approved Cloudflare identity + pending ULS access -> invitation.

Pending ULS access is keyed to the normalized verified email. On first authenticated gateway use, the existing Cloudflare-email claim path attaches that pending access to the canonical ULS account.

Access-source semantics remain `trial`, `subscription`, and `grant`. Product rights remain entitlement-based and support single-app, bundle, and all-app plans.

## Revocation

Complete revocation has two layers:

1. Remove the identity from the applicable Cloudflare approved population so future application admission fails.
2. Revoke the ULS access source so the canonical account no longer has product rights.

Existing Cloudflare sessions may remain valid until their configured session expiration; ULS entitlement enforcement remains an independent fail-closed boundary.

## Application rule

Domain Applications must not add app-local shared passwords, duplicate ULS entitlements, or maintain application-specific user databases. Cancellation Hearts therefore relies on Cloudflare Access plus ULS and has no secondary password gate.
