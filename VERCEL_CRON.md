Vercel Cron and Automatic Test Cleanup

This project supports two ways to clean up E2E test artifacts created via the UI:

1. Vercel Cron (recommended as a simple setup)

- In the Vercel dashboard for your project, go to "Settings" → "Cron Jobs" → "Add Cron Job".
- Configure a job to `POST` your cleanup endpoint on a schedule (e.g., daily):
  - URL: `https://<your-deploy>/api/test/cleanup`
  - Method: `POST`
  - Schedule: `@daily` (or whatever frequency you prefer)
  - Authentication: set `Authorization: Bearer <TEST_CLEANUP_SECRET>`.

In production, `/api/test/cleanup` rejects unauthenticated requests. Set `TEST_CLEANUP_SECRET` in your deployment environment. If it is not set, the endpoint falls back to `UPSTASH_WEBHOOK_SECRET`.

2. Automatic per-artifact cleanup via Upstash (serverless, no extra Cron required)

- When Upstash is configured (`UPSTASH_REST_URL` + `UPSTASH_REST_TOKEN`), the E2E test route will enqueue a delayed message into the `test-cleanup` Upstash queue. When that message fires (after the configured TTL), Upstash will POST to the serverless webhook at `/api/queues/test-cleanup` which deletes the specific test artifact.

- Configure Upstash:
  1. Create a queue named `test-cleanup`.
  2. Add a Webhook integration for the queue that points to:
     `https://<your-deploy>/api/queues/test-cleanup`
  3. In the integration, set the `Authorization` header to: `Bearer <UPSTASH_WEBHOOK_SECRET>` and set `UPSTASH_WEBHOOK_SECRET` in your Vercel env variables to the same value.

- Note: Upstash supports per-message `delay` when pushing messages; the code includes a `delay` field when enqueueing the cleanup message (value is `TEST_ARTIFACT_TTL_MS` in milliseconds). If your Upstash plan or version does not honor `delay`, fall back to the Vercel Cron approach.

Environment variables used

- `TEST_ARTIFACT_TTL_MS` — how long before test artifacts are considered stale (default 24h)
- `UPSTASH_REST_URL` and `UPSTASH_REST_TOKEN` — for pushing messages to Upstash
- `UPSTASH_WEBHOOK_SECRET` — secret expected on incoming webhook POSTs from Upstash

Which to choose

- If you want fully serverless automation without scheduled platform features, use Upstash delayed messages.
- If you prefer a simple UI-driven approach, configure a Vercel Cron job to call `/api/test/cleanup` daily.

## 3) Vercel Cron for Automated Alert Evaluation

To trigger the alert system automatically in a serverless Vercel deployment:

1. In the Vercel dashboard, navigate to **Settings** → **Cron Jobs** → **Add Cron Job**.
2. Set the details:
   - **URL**: `https://<your-deploy>/api/alerts/cron`
   - **Method**: `POST` (or `GET`)
   - **Schedule**: `*/5 * * * *` (e.g. every 5 minutes, depending on how frequently you want to check metrics)
3. Ensure you have the `ALERT_CRON_SECRET` environment variable configured in Vercel to secure the endpoint. The cron job will automatically use it for authorization when executed from the Vercel dashboard (using `Authorization: Bearer <CRON_SECRET>`).

\*\*\* End of file
