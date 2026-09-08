# Cancellation Hearts

Cancellation Hearts is an eight-player, two-deck strategy game where identical cards cancel.

Production architecture:

`Cancellation Hearts App -> distant-star-systems/cancellation-hearts-domain -> ULS`

The app owns game execution, rendering, UI, pacing, and its Cloudflare Access product boundary. Hearts-specific coaching and decision reasoning belong to the external Cancellation Hearts Domain Pack. Generic learner identity, entitlements, persistence, Assessment, Learner Model, Calibration, and Adaptive Training remain ULS responsibilities.

The production app integration expects a same-origin Domain Pack runtime at `/v1/domains/cancellation-hearts`. That runtime must not be implemented by restoring the retired ULS-embedded Hearts prototype.
