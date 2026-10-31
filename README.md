# FulfillSmart — E-Commerce Fulfillment & Logistics Control Tower

FulfillSmart is an enterprise-grade fulfillment optimization and logistics control tower application. It provides deterministic allocation node selection, carrier selection with transit-day promise guarantees, end-to-end shipment milestone tracking, rule-based anomaly detection, operational KPI analytics, and what-if scenario simulations.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────────────────────────────┐
                                      │                     Vercel Hosting                      │
                                      │                                                         │
  ┌───────────────────────┐           │   ┌─────────────────────┐     ┌─────────────────────┐   │
  │     Web Browser       │ ──────────┼──►│  React 18 / Vite    │     │  Vercel Serverless  │   │
  │  (Desktop Dashboard)  │   Static  │   │  (Static SPA Dist)  │     │  API Proxy Handler  │   │
  │                       │   Routes  │   └─────────────────────┘     │  frontend/api/*     │   │
  │                       │           │                               └──────────┬──────────┘   │
  │                       │ ──────────┼──► /api/v1/... (Same Origin) ────────────┘              │
  └───────────────────────┘           │                                          │              │
                                      └──────────────────────────────────────────┼──────────────┘
                                                                                 │ Injects Server-Side
                                                                                 │ X-API-Key: $SECRET
                                                                                 ▼
                                      ┌─────────────────────────────────────────────────────────┐
                                      │                  Render Web Service                     │
                                      │                                                         │
                                      │   ┌─────────────────────────────────────────────────┐   │
                                      │   │        FastAPI REST API (Uvicorn / Python 3)    │   │
                                      │   │        - Allocation & Carrier Engines           │   │
                                      │   │        - Anomaly Detection & Scenario Simulator │   │
                                      │   │        - Operational & Delivery Analytics       │   │
                                      │   └────────────────────────┬────────────────────────┘   │
                                      │                            │ WAL Mode Access            │
                                      │                            ▼                            │
                                      │   ┌─────────────────────────────────────────────────┐   │
                                      │   │           Render Persistent Disk                │   │
                                      │   │           Mounted at /var/data                  │   │
                                      │   │           (fulfillsmart.db SQLite DB)           │   │
                                      │   └─────────────────────────────────────────────────┘   │
                                      └─────────────────────────────────────────────────────────┘
```

---

## Dashboard Modules

1. **Executive Overview** (`/overview`): Real-time KPI scorecard, SLA attainment, spend, and volume trends.
2. **Network Map** (`/network`): Interactive D3-geo canvas of 20 fulfillment nodes across India with regional delivery zones.
3. **Orders Management** (`/orders`): Paginated explorer across 50,000 historical order records with priority and status filters.
4. **Allocation Engine** (`/allocation`): Deterministic chronological order allocation with capacity utilization and split-shipment metrics.
5. **Carrier Intelligence** (`/carriers`): Scorecard across 10 registered carriers, SLA compliance rates, and service zone coverage.
6. **Shipment Tracking** (`/tracking`): End-to-end tracking for 49,436 shipments across 5 lifecycle stages.
7. **Anomaly Detection** (`/anomalies`): Detection across 6 anomaly categories with root-cause drawers.
8. **Simulation Lab** (`/simulation`): What-if scenario modeling (e.g., Chennai Outage, Peak Surge) in an isolated sandbox.
9. **Analytics & BI** (`/analytics`): Deep-dive charts for trends, fulfillment, delivery, carriers, and CSV export.

---

## Local Development Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Launch FastAPI server
export FULFILLSMART_API_KEY="test-secret-key-2026"
uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Start Vite dev server (proxies /api to localhost:8000 with auto-injected API key)
export FULFILLSMART_API_KEY="test-secret-key-2026"
npm run dev
```
Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## Production Deployment Guide

### Part 1: Render Backend Deployment
1. Connect your GitHub repository `https://github.com/Larapraneeth/Fulfillsmart` to Render.
2. Select **New Web Service** and configure:
   - **Name**: `fulfillsmart-backend`
   - **Runtime**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python scripts/init_production_db.py && uvicorn src.main:app --host 0.0.0.0 --port $PORT --workers 1`
   - **Plan**: `Starter` (required for persistent disk support)
3. Attach Persistent Disk under **Advanced** -> **Disks**:
   - **Name**: `data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB`
4. Add Environment Variables:
   - `PYTHON_VERSION`: `3.11.9`
   - `ENVIRONMENT`: `production`
   - `FULFILLSMART_DATABASE_PATH`: `/var/data/fulfillsmart.db`
   - `FULFILLSMART_API_KEY`: *(Generate a secure 32+ character random secret)*
   - `CORS_ALLOWED_ORIGINS`: `https://<your-project>.vercel.app`
5. Set Health Check Path: `/health`.
6. Deploy the service and note your Render backend URL (e.g. `https://fulfillsmart-backend.onrender.com`).

### Part 2: Vercel Frontend Deployment
1. Connect your repository to Vercel and import the project.
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables on Vercel:
   - `BACKEND_API_URL`: `https://fulfillsmart-backend.onrender.com`
   - `FULFILLSMART_API_KEY`: *(Exact same secret configured on Render)*
   > **Note**: Do NOT prefix `FULFILLSMART_API_KEY` with `VITE_`. It is used exclusively server-side by the Vercel serverless proxy at `frontend/api/[...path].ts`.
4. Deploy the project.
5. In your Render Dashboard, update `CORS_ALLOWED_ORIGINS` to match your production Vercel domain.

---

## Security Architecture & Best Practices

- **API Secret Isolation**: The master API key is injected strictly server-side by Vercel serverless proxy functions. It is never exposed in browser JavaScript, Vite environment bundles, or client logs.
- **Persistent Database Safety**: `scripts/init_production_db.py` runs before application start. It detects existing databases and refuses to overwrite valid tables. If data is corrupted, it halts container startup with a fatal error rather than silently overwriting.
- **Zero Localhost in Production**: When `CORS_ALLOWED_ORIGINS` is configured, all default localhost origins are excluded from CORS headers.
- **Important Security Notice**: The Vercel serverless proxy shields the backend master secret from client bundle inspection. However, to restrict dashboard visibility to authorized internal users, enable **Vercel Deployment Protection** (Password / SSO Authentication) in your Vercel project settings.

---

## Test & Verification Suite

Run full system tests locally at any time:
```bash
# Run 98 backend unit and integration tests
pytest -q

# Run Python static compilation check
python -m compileall src -q

# Run frontend TypeScript type checking and production build
cd frontend && npm run build
```
