# FulfillSmart – E-Commerce Fulfillment & Logistics Control Tower

**FulfillSmart** is a full-stack e-commerce fulfillment and logistics control tower designed to provide centralized visibility, operational intelligence, and decision support across the entire order fulfillment lifecycle.

The platform brings together order management, inventory allocation, fulfillment network monitoring, carrier intelligence, shipment tracking, anomaly detection, scenario simulation, and business analytics into a unified dashboard.

It helps operations teams understand what is happening across their fulfillment network, identify potential operational bottlenecks, evaluate alternative fulfillment strategies, and make data-driven decisions using historical operational data and configurable simulations.

---

## Project Overview

Modern e-commerce fulfillment involves multiple interconnected processes, including order processing, inventory availability, warehouse allocation, carrier selection, shipment dispatch, delivery tracking, and service-level monitoring.

Managing these activities across disconnected systems makes it difficult to identify delays, understand fulfillment performance, monitor capacity constraints, and evaluate the impact of operational changes.

FulfillSmart addresses this challenge through a centralized control tower that integrates operational data and presents it through interactive dashboards, analytical views, and simulation capabilities.

The platform is designed to provide visibility at three levels:

- **Operational Visibility:** Monitor orders, shipments, inventory allocation, fulfillment nodes, and carrier performance.
- **Analytical Intelligence:** Evaluate fulfillment KPIs, delivery trends, service-level performance, and operational exceptions.
- **Decision Support:** Simulate network disruptions and operational changes to understand their potential impact on fulfillment outcomes.

## Key Features

### 1. Executive Overview
A centralized dashboard providing a high-level view of fulfillment operations.

- Total order volume and fulfillment KPIs.
- Order and shipment performance indicators.
- Monthly operational trends.
- Fulfillment status distribution.
- Service-level and delivery performance metrics.
- Quick access to important operational areas.

### 2. Fulfillment Network Map
An interactive geographical view of the fulfillment network.

- Visualization of fulfillment nodes across major Indian logistics hubs.
- Node-level capacity and operational status.
- Geographical node coordinates.
- Service-zone relationships.
- Interactive node markers and detail views.
- Network-level visibility for identifying potential capacity constraints.

### 3. Order Management
A centralized interface for exploring and monitoring customer orders.

- Searchable and paginated order records.
- Order status and priority filtering.
- Individual order detail views.
- Order line-item information.
- Destination and fulfillment information.
- Support for analyzing order-level fulfillment performance.

### 4. Intelligent Allocation Engine
A fulfillment allocation module for evaluating how orders can be assigned to available fulfillment nodes.

- Inventory and node-capacity-aware allocation.
- Single-node and split-shipment allocation analysis.
- Allocation policy configuration.
- Node utilization monitoring.
- Allocation decision history and audit information.
- Split-shipment penalty accounting.

### 5. Carrier Intelligence
A centralized view of logistics carrier performance and service coverage.

- Carrier performance scorecards.
- Carrier-level operational metrics.
- Transit-time and delivery adherence analysis.
- Carrier service-zone coverage.
- Carrier distribution and comparison.
- Service-zone and carrier availability information.

### 6. Shipment Tracking
A shipment monitoring interface providing visibility into recorded shipment progress.

- Shipment search and identification.
- Shipment status monitoring.
- Tracking event timelines.
- Delivery milestone visibility.
- SLA delay indicators.
- Historical tracking event analysis.

*Tracking insights are based on recorded tracking events, not live GPS telemetry.*

### 7. Anomaly Control Tower
An operational exception monitoring module designed to highlight potential fulfillment issues.

It supports analysis across six anomaly categories:

- Cutoff missed.
- SLA breach risk.
- Capacity bottleneck.
- Routing exception.
- Split-shipment penalty.
- Inventory starvation.

Additional capabilities include anomaly severity classification, distribution analysis, root-cause inspection, and resolution workflow interfaces.

### 8. Simulation Lab
A scenario-based simulation environment for evaluating operational changes and network disruptions.

- Preconfigured operational scenarios.
- Configurable capacity and transit-time multipliers.
- Fulfillment node and carrier disabling options.
- Order-limit configuration.
- Simulation execution and result retrieval.
- Baseline-versus-simulation KPI comparison.
- Simulation history and run details.
- Analysis of potential financial and SLA trade-offs.

Simulation results are isolated from historical operational records.

### 9. Analytics & Business Intelligence
A dedicated analytical workspace for understanding fulfillment performance.

- Executive analytics overview.
- Historical fulfillment trends.
- Carrier performance analytics.
- Delivery performance analysis.
- Allocation analytics.
- Interactive charts and KPI cards.
- CSV export functionality.

---

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Recharts
- D3 / geographical visualization
- HTML5 and CSS

### Backend
- Python
- FastAPI
- Pydantic
- SQLite
- RESTful API architecture

### Testing & Development
- Pytest
- FastAPI TestClient
- TypeScript compiler
- Vite production build
- SHA-256 data integrity verification
- Git and GitHub

---

## System Architecture

FulfillSmart follows a modular full-stack architecture.

```text
                 USER
                   |
                   v
          REACT DASHBOARD
             (Vite + TS)
                   |
                   v
             REST API
              (FastAPI)
                   |
        +----------+----------+
        |          |          |
        v          v          v
      Orders   Allocation  Analytics
        |          |          |
        +----------+----------+
                   |
                   v
          BUSINESS LOGIC LAYER
                   |
        +----------+----------+
        |          |          |
        v          v          v
     Carriers   Tracking   Simulation
        |          |          |
        +----------+----------+
                   |
                   v
             SQLITE DATABASE
                   |
                   v
         HISTORICAL OPERATIONAL DATA
```

The backend exposes modular REST API endpoints, while the frontend consumes these APIs to render operational dashboards and analytical visualizations.

## Dataset & System Scale

The verified local dataset contains:

| Entity | Records |
|---|---:|
| Orders | 50,000 |
| Order Lines | 93,552 |
| Shipments | 49,436 |
| Allocation Decisions | 93,558 |
| Fulfillment Nodes | 20 |
| Carriers | 10 |
| Tracking Events | 100,000 |
| Delivery Outcomes | 50,000 |
| Carrier Service-Zone Rules | 335 |
| Carrier Calendar Records | 3,650 |

The project also includes 29 CSV source files with SHA-256 integrity verification against ingestion metadata.

These figures describe the current verified dataset, not live production traffic.

## Testing & Verification

The project has undergone backend, frontend, integration, and data-integrity validation.

| Verification | Result |
|---|---|
| Python static compilation | Passed |
| Pytest suite | 98 passed |
| Backend API verification | 26 endpoints passed |
| Analytics API verification | 7 endpoints passed |
| Database row-count validation | Passed |
| CSV SHA-256 verification | 29/29 matched |
| Frontend TypeScript compilation | Passed |
| Frontend production build | Passed |
| Dashboard module acceptance | 9/9 reported working |

Browser-level acceptance was also completed manually after automated browser-agent execution was blocked by an upstream Playwright CDN issue.

## Getting Started

### Prerequisites
- Python 3.10 or compatible project-supported version.
- Node.js and npm.
- Git.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd FulfillSmart
```

### 2. Backend setup

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables using the project's `.env.example` and actual application configuration.

Start the FastAPI server using the configured application entry point:

```bash
uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

### 4. Access the application

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:8000

Refer to the deployment configuration and environment variables for API authentication and frontend-to-backend connectivity.

**Database note:** The historical SQLite database is not included in the Git repository. Provision the database and required reference data separately using the documented data initialization process. Use persistent storage when deploying.

---

## Project Objectives

FulfillSmart was developed to demonstrate how a centralized fulfillment control tower can combine operational monitoring, allocation intelligence, carrier analysis, anomaly detection, scenario simulation, and business analytics.

The key objectives are:

1. Improve visibility across e-commerce fulfillment operations.
2. Monitor order and shipment performance through centralized dashboards.
3. Evaluate inventory and fulfillment-node allocation decisions.
4. Analyze carrier service coverage and delivery performance.
5. Identify operational bottlenecks and fulfillment anomalies.
6. Evaluate network disruptions through isolated scenario simulations.
7. Convert historical operational data into actionable analytical insights.

## Future Enhancements

Potential areas for future development include:

- PostgreSQL-based production database architecture.
- Live carrier API integrations.
- Real-time shipment tracking and GPS integration.
- Advanced demand forecasting.
- Predictive delivery delay models.
- Automated anomaly detection.
- Role-based access control.
- Cloud deployment and scalable infrastructure.
- Automated alerts and operational notifications.

## Author

**Lara Praneeth Kondeti**

Computer Science & Engineering

IIIT Surat

---

*FulfillSmart – Bringing visibility, intelligence, and decision support to e-commerce fulfillment operations.*
