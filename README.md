# AutoSupply Hub — AI-Powered Automotive Supplier & Production Planning Platform

AutoSupply Hub is a full-stack platform designed for automotive manufacturers to coordinate component suppliers, purchasing, inventory, production bills of materials (BOM), incoming deliveries, quality inspections, and AI-assisted procurement analysis.

---

## Architecture: Microservices Structure

AutoSupply Hub is built with a **decoupled, standalone Microservices Architecture**. Each microservice is 100% self-contained with its own code, database, dependencies (`requirements.txt`), Dockerfile, utilities (`common/`), and unit tests (`tests/`).

Traffic is routed directly via **Next.js rewrites** (in local Docker Compose) or via **Kubernetes Ingress (AWS ALB Ingress Controller)** on cloud clusters:

```
                          ┌───────────────────────────┐
                          │   Next.js 16 Frontend     │
                          │        (Port 3000)        │
                          └─────────────┬─────────────┘
                                        │ Direct API Routing (or K8s Ingress)
          ┌───────────────────┬─────────┴─────────┬───────────────────┐
          │                   │                   │                   │
          ▼                   ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   Auth Service    │ │ Supplier Service  │ │ Component Service │ │   Order Service   │
│    (Port 8001)    │ │    (Port 8002)    │ │    (Port 8003)    │ │    (Port 8004)    │
└─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
          │                   │                   │                   │
          ▼                   ▼                   ▼                   ▼
 [autosupply_auth]   [autosupply_supplier] [autosupply_component]  [autosupply_order]
```

### Microservice Topology

| Service | Port | Database | Responsibilities |
|---|---|---|---|
| **Auth Service** | `8001` | `autosupply_auth` | User identity, credential verification, JWT token issuance, session cookies, and RBAC matrix permissions. |
| **Supplier Service** | `8002` | `autosupply_supplier` | Supplier directory, ISO lead times, tenant isolation, supplier self-service profile edits, and `/internal/suppliers/{id}`. |
| **Component Service** | `8003` | `autosupply_component` | Automotive parts catalogue, technical specs, UOM (EA, SET, PAIR), reorder thresholds, and `/internal/components/{id}`. |
| **Order Service** | `8004` | `autosupply_order` | Purchase orders, decimal calculations (`ROUND_HALF_UP`), status state machine, audit history, and `/api/v1/dashboard/summary` aggregation. |
| **Frontend** | `3000` | *Browser / Client* | Next.js 16 App Router operations portal with real-time analytics, responsive styling, and 1-click persona switcher. |

---

## Project Structure

```
AutoSupply Hub/
├── docker/
│   └── init-databases.sql         # Initializes 4 isolated Postgres databases
├── docker-compose.yml             # Orchestrates DB, 4 microservices, and frontend
├── frontend/                      # Next.js 16 App Router UI
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── Dockerfile
│   └── next.config.ts             # Direct service rewrites
└── backend/
    └── services/
        ├── auth_service/          # 100% self-contained Auth service
        │   ├── Dockerfile
        │   ├── main.py
        │   ├── requirements.txt
        │   ├── common/            # Isolated utilities (JWT, RBAC, DB helpers)
        │   └── tests/             # Isolated unit tests
        ├── supplier_service/      # 100% self-contained Supplier service
        │   ├── Dockerfile
        │   ├── main.py
        │   ├── requirements.txt
        │   ├── common/
        │   └── tests/
        ├── component_service/     # 100% self-contained Component catalogue
        │   ├── Dockerfile
        │   ├── main.py
        │   ├── requirements.txt
        │   ├── common/
        │   └── tests/
        ├── order_service/         # 100% self-contained Purchase Order service
        │   ├── Dockerfile
        │   ├── main.py
        │   ├── requirements.txt
        │   ├── common/
        │   └── tests/
        └── seed.py                # Database seeder for demo data
```

---

## Role-Based Access Control (RBAC) & Demo Accounts

The platform includes pre-seeded fictional demo data with accounts for every specification persona. All accounts can be accessed via the **1-Click Demo Persona Selector** on `/login`:

| Persona | Email | Demo Password | Role | Permissions Summary |
|---|---|---|---|---|
| **Admin** | `admin@autosupply.local` | `AdminPass123!` | `ADMIN` | Full system access: manage users, suppliers, components, POs, and settings. |
| **Procurement Manager** | `procurement@autosupply.local` | `ProcurePass123!` | `PROCUREMENT_MANAGER` | Create & edit suppliers, manage purchase orders, review spend. |
| **Apex Dynamics Rep** | `apex.supplier@autosupply.local` | `SupplierPass123!` | `SUPPLIER` | Scoped to Apex Dynamics GmbH. View own profile and POs; confirm/reject orders. |
| **MotoPowertrain Rep** | `moto.supplier@autosupply.local` | `SupplierPass123!` | `SUPPLIER` | Scoped to MotoPowertrain Technologies. Completely isolated from Apex data. |
| **Production Planner** | `planner@autosupply.local` | `PlannerPass123!` | `PRODUCTION_PLANNER` | Read components, review stock, and prepare for BOM requirements. |
| **Warehouse Operator** | `warehouse@autosupply.local` | `WarehousePass123!` | `WAREHOUSE_OPERATOR` | Review delivery requirements and incoming PO quantities. |
| **Quality Inspector** | `quality@autosupply.local` | `QualityPass123!` | `QUALITY_INSPECTOR` | Inspect component specifications and supplier lead times. |
| **Finance Officer** | `finance@autosupply.local` | `FinancePass123!` | `FINANCE_OFFICER` | Review purchase orders, currencies, and total committed spend. |
| **Auditor / Viewer** | `auditor@autosupply.local` | `AuditorPass123!` | `VIEWER` | Read-only access to permitted records and audit history. |

---

## Quickstart: Docker Compose

To start the complete microservices stack (PostgreSQL + 4 Microservices + Next.js Frontend):

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Build and start all microservice containers
docker compose up --build
```

### Endpoints:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Auth Service**: [http://localhost:8001](http://localhost:8001) (`/healthz`, `/readyz`, `/api/v1/auth/*`)
- **Supplier Service**: [http://localhost:8002](http://localhost:8002) (`/healthz`, `/readyz`, `/api/v1/suppliers/*`)
- **Component Service**: [http://localhost:8003](http://localhost:8003) (`/healthz`, `/readyz`, `/api/v1/components/*`)
- **Order Service**: [http://localhost:8004](http://localhost:8004) (`/healthz`, `/readyz`, `/api/v1/purchase-orders/*`, `/api/v1/dashboard/summary`)

---

## Running Individual Microservices Standalone

Because each microservice is completely decoupled, you can run and develop any service independently:

```bash
# Example: Running Auth Service Standalone
cd backend/services/auth_service

# Install service-specific dependencies
pip install -r requirements.txt

# Run the service
uvicorn main:app --host 127.0.0.1 --port 8001
```

### Seeding Initial Data

To populate the isolated databases with demo users, suppliers, components, and orders:

```bash
cd backend
python -m services.seed
```

---

## Running Automated Tests

Each service contains its own isolated test suite that can be run independently:

```bash
# Test Auth Service
pytest backend/services/auth_service/tests/test_auth.py -v

# Test Supplier Service
pytest backend/services/supplier_service/tests/test_supplier.py -v

# Test Component Service
pytest backend/services/component_service/tests/test_component.py -v

# Test Order Service
pytest backend/services/order_service/tests/test_order.py -v
```

---

## Phase Implementation Status

### Phase 0: Foundation & Microservices Architecture (Completed)
- [x] **Standalone Microservice Architecture**: Fully decoupled into Auth, Supplier, Component, and Order services with zero shared top-level code.
- [x] **Database-per-Service**: Dedicated PostgreSQL databases (`autosupply_auth`, `autosupply_supplier`, `autosupply_component`, `autosupply_order`).
- [x] **Next.js 16 App Router**: Custom dark-mode UI with high performance and zero placeholder elements.
- [x] **Health & Readiness**: Native `/healthz` and `/readyz` probes in each microservice.
- [x] **Docker Compose**: Clean orchestration without a bottleneck gateway.
- [x] **Ingress Ready**: All services expose prefixed `/api/v1/*` routes ready for AWS ALB Ingress Controller on EKS.

### Phase 1: Suppliers & Purchase Orders (Completed)
- [x] **Authentication & RBAC**: JWT tokens, httpOnly cookies, CSRF protection, and permission matrix for 8 roles.
- [x] **Supplier Management**: CRUD, search, filter, lead-time bounds, duplicate code rejection (409), and supplier self-service permissions.
- [x] **Supplier Tenant Isolation**: Supplier users can only access their own supplier profile and non-draft purchase orders; foreign requests return 404.
- [x] **Component Catalogue**: SKUs, technical descriptions, UOMs, reorder thresholds, and internal inter-service lookup.
- [x] **Purchase Orders**: Multi-line item creation with backend decimal precision calculations (`ROUND_HALF_UP`), status state machine (`DRAFT`, `SUBMITTED`, `SUPPLIER_CONFIRMED`, `CANCELLED`, `REJECTED`), line validations, idempotency keys, and full audit history.
- [x] **Inter-Service Communication**: Order service enriches records via Supplier and Component microservices with resilience fallbacks.
- [x] **Fictional Demo Data**: Multi-database seeder populating OEM suppliers, components, demo accounts, and purchase orders.
- [x] **Automated Tests**: Unit and integration test suites isolated in each microservice directory.

### Remaining Roadmap
- **Phase 2**: Inventory movements ledger, goods receipts, partial deliveries, and stock updates.
- **Phase 3**: Products, Bills of Materials (BOMs), production plans, and shortage calculations.
- **Phase 4**: Shipments tracking, quality inspections, invoices, and matching.
- **Phase 5**: AI procurement assistant and document extraction preview.
- **Phase 6**: Polish, accessibility, and end-to-end verification.
