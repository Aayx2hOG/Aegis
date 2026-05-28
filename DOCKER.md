# Running services with Docker Compose

This repository includes a `docker-compose.yml` that starts Redis, the Next dev server, and the two background workers (AI summary and notifications). This lets you run workers as long‑running services instead of executing them manually in separate terminals.

Prerequisites

- Docker and Docker Compose installed.
- Your `.env` populated (including `REDIS_URL`, `DATABASE_URL`, etc.).

Start services (detached):

```bash
docker compose up -d --build
```

Tail logs:

```bash
docker compose logs -f worker_ai
docker compose logs -f worker_notifications
docker compose logs -f web
```

Stop services:

```bash
docker compose down
```

Notes
- The compose file uses the `oven/bun:edge` image so the project runs using Bun. It mounts the repository into `/app` and runs `bun install` on startup.
- For production deployments, build a proper Dockerfile and run workers as separate services (this compose file is intended for staging / developer convenience).
