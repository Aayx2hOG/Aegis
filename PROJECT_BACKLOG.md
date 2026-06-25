# Aegis Improvement Backlog

Previously completed:

- Lock down production access to test endpoints.
- Replace simulated telemetry panels with real product state.
- Make the research -> watchlist -> alert -> notification -> simulation workflow visible on Dashboard and Research.
- Extract alert telemetry UI and War Room multichain configuration out of oversized page files.
- Add focused tests for alert evaluation, notification delivery idempotency, research fallback, and war-room risk math.

Completed in this pass:

- Split alert types, local alert storage utilities, market data fetching, guest alert identity, and alert dialogs out of the Alerts page.
- Split the reusable War Room metric card out of the main War Room client component.
- Made npm the documented primary package manager while keeping Bun documented for workers/Docker.
- Documented the Anchor watchlist as optional Solana-native infrastructure instead of required app setup.

Remaining high-impact improvements:

1. Continue splitting the large Alerts and War Room client files into focused components and hooks.
