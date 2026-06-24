# Aegis Improvement Backlog

Completed in this pass:

- Lock down production access to test endpoints.
- Replace simulated telemetry panels with real product state.
- Make the research -> watchlist -> alert -> notification -> simulation workflow visible on Dashboard and Research.
- Extract alert telemetry UI and War Room multichain configuration out of oversized page files.
- Add focused tests for alert evaluation, notification delivery idempotency, research fallback, and war-room risk math.

Remaining high-impact improvements:

1. Continue splitting the large Alerts and War Room client files into focused components and hooks.
2. Clean up package-manager and README consistency.
3. Decide whether the Anchor watchlist is a core feature or optional infrastructure, then adjust the UI/docs accordingly.
