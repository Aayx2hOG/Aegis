# Aegis Improvement Backlog

## Recently completed

- Replaced the War Room simulation workflow with a simpler Opportunity Finder.
- Added deterministic, risk-profile-aware scoring for two to five selected protocols.
- Made live TVL, 24-hour movement, 7-day movement, relative risk, and scoring limitations visible.
- Removed the unused War Room UI, simulation APIs, engines, configuration, and types.
- Kept `/war-room` as a compatibility redirect to `/research/compare`.
- Added focused tests for opportunity scoring.
- Added a browser-level Opportunity Finder workflow test.
- Added a complete `.env.example` and removed unused Express dependencies.
- Added independent TVL, yield, and audit-evidence freshness labels.
- Split Alerts into focused components and hooks.
- Added tests for alert evaluation, notification delivery, research fallback, wallet authentication, and API behavior.

## Remaining high-impact improvements

1. Consolidate the two watchlist storage implementations into one shared module.
2. Split the large Watchlist page into selection, market-data, anomaly, and presentation modules.
3. Extend browser coverage to the full Research → Opportunity Finder → Alerts workflow.
4. Continue extracting the Opportunity Finder table and selection controls into smaller presentation components.
