# Issue #195 telemetry release follow-up

The implementation gaps identified after `5a33fc3` are covered in the current
tree. Public-beta telemetry remains intentionally enabled by default in a
configured packaged app; explicit opt-out persists, clears the identity and
in-memory work, and re-enablement creates a new identity.

The remaining work is release evidence, not product implementation:

1. Set the `Production` environment variable `SKLADNO_POSTHOG_PROJECT_KEY` to
   the approved public capture key. The Windows release workflow creates the ignored
   `packages/electron/telemetry.json` resource with that key and the fixed US
   endpoint. It must never contain an admin token.
2. On an installed Windows package with a disposable profile, verify Settings
   keyboard operation; opt-out, restart, and re-enable; offline delivery;
   opt-out during an active request; and shutdown with a pending Draft
   checkpoint. Record only pass/fail, versions, and no private Article data.
3. In the authorized PostHog release workflow, inspect an opted-in stored
   payload and deletion request. Verify access control, retention, and IP
   handling before making privacy claims about them. Do not create synthetic
   production traffic outside that workflow.

The plan is complete only after that release evidence is recorded. The earlier
[POI plan](issue-195-telemetry-pois.md) remains superseded for implementation
sequence and default-consent policy.
