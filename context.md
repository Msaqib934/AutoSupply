# AutoSupply Hub — Application Development Context

## 1. Role and working approach

You are the lead full-stack developer building **AutoSupply Hub**, an AI-powered automotive supplier and production-planning web application. Treat this file as the main product and engineering specification.

Work incrementally: inspect the repository, explain its structure, propose a short plan, implement one working feature slice at a time, run relevant tests, fix failures, and update the README. Do not generate the entire application in one unverified pass. Never claim a feature or test works unless you verified it. Ask a focused question if a business requirement is unclear.

**Scope boundary:** Build application code and local development setup only. Do not implement AWS, cloud infrastructure, Kubernetes, Terraform, deployment pipelines, or other cloud/DevOps infrastructure. I will handle those myself later.

## 2. Product vision

AutoSupply Hub helps a fictional motorcycle/automotive manufacturer coordinate component suppliers, purchasing, inventory, incoming deliveries, production requirements, quality checks, invoices, and AI-assisted business queries.

Use fictional companies and demo data. Build a realistic, maintainable application, not a collection of static mockup pages.

## 3. Default technology stack

Use these defaults unless the repository already has a sensible working equivalent:
- Frontend: Next.js, TypeScript, App Router
- Backend: Python, FastAPI, Pydantic
- Database: PostgreSQL
- ORM and migrations: SQLAlchemy and Alembic
- Local development: Docker Compose
- Backend tests: Pytest
- Frontend tests: an appropriate framework for the selected setup
- AI: provider abstraction configurable through environment variables

Keep frontend and backend clearly separated. Never expose database credentials or AI keys in browser-side code. Provide `.env.example` with placeholders only.

## 4. Users and permissions

Implement authentication and backend-enforced role-based access control (RBAC).

Roles:
- **Admin:** manages users, roles, suppliers, components, and application settings.
- **Procurement Manager:** manages suppliers and purchase orders.
- **Supplier:** sees only their own profile, POs, shipments, and relevant invoices; can confirm orders and update permitted shipment information.
- **Warehouse Operator:** records goods receipts and accepted/rejected quantities.
- **Production Planner:** manages BOMs and production plans, and reviews stock and shortages.
- **Quality Inspector:** records inspections and non-conformities.
- **Finance Officer:** reviews invoices and discrepancies.
- **Viewer/Auditor:** read-only access to permitted records.

Security rules:
- Enforce permissions in backend logic, not only by hiding UI controls.
- A supplier must never access another supplier's data.
- Validate record ownership on every supplier-scoped request.
- Audit important actions.
- If a temporary demo authentication approach is used, document its limitations and do not describe it as production-ready.

## 5. Main modules and workflows

### 5.1 Dashboard
Show database-backed summary cards/lists for open POs, orders awaiting supplier confirmation, expected deliveries, low-stock components, production shortages, pending inspections, invoices requiring review, and recent activity. Include loading, empty, error, and success states. Do not hardcode totals.

### 5.2 Supplier management
Fields: supplier code, company name, contact name, email, phone, address/country, components supplied, typical lead time, status (`ACTIVE`, `INACTIVE`, `UNDER_REVIEW`), timestamps.

Features: list/search/filter/view/create/edit; prevent duplicate supplier codes; restrict edits by role; supplier users can access only their own profile and approved fields.

### 5.3 Component catalogue
Fields: component code/SKU, name, description, category, unit of measure, reorder threshold, optional preferred supplier, active/inactive status.

Fictional sample components:
- `ENG-001` — Motorcycle engine assembly
- `FRM-001` — Motorcycle frame
- `WHL-001` — Front wheel assembly
- `TYR-001` — Tyre
- `BRK-001` — Brake assembly
- `BAT-001` — Battery
- `WIR-001` — Wiring harness
- `SEA-001` — Seat assembly

Support search/filter, prevent duplicate codes, and show stock on hand separately from incoming quantities.

### 5.4 Purchase orders
A purchase order (PO) contains a unique PO number, supplier, creation date, requested delivery date, one or more component lines, quantity, unit price, currency, total, status, and status history.

Suggested statuses: `DRAFT`, `SUBMITTED`, `SUPPLIER_CONFIRMED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`, `REJECTED`.

Features:
- Create and view POs with one or more component lines.
- Validate positive quantities and active components.
- Calculate line totals and PO totals on the backend using decimal-safe money types.
- Allow the correct supplier to confirm or reject a submitted PO.
- Show line items, status history, linked shipments, receipts, and relevant audit events.
- Validate status transitions on the backend; do not accept arbitrary status changes from the browser.
- Use database transactions for multi-record operations.
- Prevent uncontrolled editing after a PO leaves draft status.

### 5.5 Inventory and goods receipts
Features:
- Show stock on hand by component and incoming quantities separately.
- Record goods receipts against valid POs, including partial deliveries.
- Record received, accepted, rejected, and damaged quantities.
- Update PO status correctly after partial or complete receipt.
- Maintain an inventory movement ledger; never change stock without recording the movement.
- Make receipt posting transactional and idempotent so retrying a request cannot add stock twice.
- Record who posted the receipt and when.
- Rejected or quarantined goods must not count as available production stock.

### 5.6 Products, BOMs, and production planning
A bill of materials (BOM) defines the components needed for one finished product. Use a fictional motorcycle model such as `MOTO-70`, with a plausible demo BOM including an engine, frame, wheels, tyres, brake assemblies, battery, wiring harness, and seat. Mark seed data as fictional.

Features:
- Create and view finished products.
- Define component quantities per finished unit.
- Create production plans with product, planned quantity, target date, and status.
- Calculate gross demand as production quantity × BOM quantity.
- Calculate shortages using available stock and clearly defined eligible incoming supply.
- Show required, available, incoming, and shortage quantities for each component.
- Show which open POs may cover shortages without treating unconfirmed delivery as guaranteed.
- Recalculate requirements when BOMs, stock, or production plans change.
- Perform authoritative calculations in deterministic application code, not an LLM.

### 5.7 Shipments and delivery tracking
Track linked PO, supplier, carrier, tracking/reference number, dispatch date, estimated arrival, actual arrival, and status. Suggested statuses: `PLANNED`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `DELAYED`, `CANCELLED`.

Suppliers may update only their own shipments. Show overdue deliveries and maintain status history.

### 5.8 Quality inspections
Record inspections against goods receipts or component batches. Store inspected, accepted, and rejected quantities, result, notes, inspector, and timestamp. Support `PENDING`, `PASSED`, `FAILED`, and `PARTIAL`. Keep rejected/quarantined items unavailable to production until appropriately released. Link non-conformities to the relevant component, receipt, and supplier.

### 5.9 Invoices and matching
Store supplier, invoice number/date, currency, subtotal, tax, total, linked PO, document reference, and review status.

Features:
- Upload invoice documents to private local application storage with file-type and size validation.
- Compare invoice details with PO lines and goods receipts.
- Flag duplicate invoices and supplier, quantity, price, tax, or total discrepancies.
- Support statuses such as `PENDING_REVIEW`, `MATCHED`, `DISCREPANCY`, `APPROVED`, and `REJECTED`.
- Require human review before invoice approval.
- Never approve or pay an invoice based only on AI output.
- Enforce document access permissions and never expose private files publicly.

### 5.10 Notifications and audit history
Provide in-app notifications for new POs, orders awaiting supplier confirmation, delayed shipments, goods receipts, failed inspections, material shortages, and invoice discrepancies. Audit important actions with actor and timestamp. Start with database-backed notifications.

## 6. AI features

AI assists users; it is not the source of truth for business calculations or permissions.

### 6.1 Document extraction
Allow authorized users to upload an invoice or supported business document and extract supplier and invoice/PO numbers, dates, component codes/descriptions, quantities, unit prices, tax, and total.

Requirements:
- Validate model output against a defined schema.
- Display extracted values for human review before saving them as authoritative data.
- Compare extracted values with existing records and show discrepancies.
- Treat all document content as untrusted input.
- Handle unsupported files, malformed output, provider errors, and timeouts gracefully.
- Do not automatically approve invoices, change orders, or post inventory based on extracted values.
- Avoid logging sensitive document content unnecessarily.

### 6.2 AI procurement assistant
Provide a chat-style assistant that can answer questions such as:
- “Which components are below their reorder threshold?”
- “Which purchase orders await supplier confirmation?”
- “Why does this production plan have a tyre shortage?”
- “Which invoices have discrepancies?”
- “Which shipments are overdue?”

Requirements:
- Retrieve information through authorized backend functions/services.
- Enforce the current user's permissions before retrieving data.
- Never give the LLM unrestricted database access or arbitrary SQL execution.
- Ground answers in actual records and include relevant record references/links.
- Say when information is missing rather than inventing values.
- Distinguish confirmed facts from estimates and recommendations.
- Require explicit human confirmation before business-changing actions.
- Configure the AI provider through environment variables; never hardcode API keys.
- The app must still work when AI is unconfigured or unavailable and show a helpful message.

### 6.3 Later AI enhancements
After core workflows work, consider supplier delivery-risk summaries, reorder suggestions, shortage explanations, and invoice discrepancy summaries. Clearly label recommendations and do not automatically execute consequential actions.

## 7. Database and engineering standards

Expected entities include users/roles, suppliers, components, supplier-component associations, purchase orders and lines, products, BOMs and lines, production plans, inventory movements, goods receipts and lines, shipments, quality inspections, invoices and lines, documents, notifications, and audit events.

Standards:
- Use primary/foreign keys, unique constraints, and useful indexes.
- Use decimal-safe types for currency; never use binary floating point for money.
- Use transactions for multi-record operations.
- Store timestamps in UTC.
- Use migrations instead of manually changing database schemas.
- Validate all inputs on the server.
- Paginate large lists and return consistent API errors/status codes.
- Avoid redundant derived data unless its consistency strategy is documented.
- Protect retryable operations with idempotency mechanisms.
- Keep business rules in backend domain/service code rather than duplicating them in the frontend.

## 8. API and frontend requirements

Use a versioned REST API such as `/api/v1`. Possible endpoint groups:
- `/auth`
- `/suppliers`
- `/components`
- `/purchase-orders`
- `/inventory`
- `/receipts`
- `/products`
- `/boms`
- `/production-plans`
- `/shortages`
- `/shipments`
- `/quality-inspections`
- `/invoices`
- `/notifications`
- `/audit-events`
- `/ai/chat`
- `/ai/documents/extract`

Implement endpoints as features are built; do not create nonfunctional placeholders. Keep OpenAPI documentation current.

Navigation:
- Dashboard
- Suppliers
- Components
- Purchase Orders
- Inventory / Receipts
- Production Planning
- Shipments
- Quality
- Invoices
- AI Assistant
- Administration (authorized users only)

UI standards:
- Professional operations-dashboard design.
- Responsive desktop, tablet, and mobile layouts.
- Reusable components and consistent typography, spacing, and status labels.
- Search, filtering, sorting, and pagination where useful.
- Accessible forms, tables, controls, and dialogs.
- Clear loading, empty, validation, success, and error states.
- Confirm sensitive actions such as cancelling a PO or approving an invoice.
- Do not rely on color alone to communicate status.
- Visually distinguish AI suggestions from verified system records.

## 9. Testing requirements

Add tests as features are implemented. At minimum, test:
- PO totals and invalid quantities
- Allowed/disallowed PO status transitions
- Supplier data isolation and role permissions
- Partial goods receipts
- Duplicate receipt requests and inventory consistency
- BOM demand and shortage calculations
- Duplicate invoices and discrepancy rules
- Invalid AI output and provider failures
- API validation and database constraints
- Critical frontend forms/workflows where practical

Use Pytest for backend tests. Add frontend linting, formatting, and tests appropriate to the selected setup. Report which tests actually ran and their results. Do not claim success for tests that were not executed.

## 10. Suggested repository structure

```text
autosupply-hub/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── modules/
│   ├── alembic/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── docs/
│   ├── architecture.md
│   └── demo-script.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Adapt the structure when justified by the repository. Do not create empty folders or dummy services for features that have not been implemented.

## 11. Implementation roadmap

Complete and verify each phase before moving to the next.

### Phase 0 — Local foundation
- Inspect repository and summarize its structure.
- Set up frontend, backend, PostgreSQL, local configuration, and migrations.
- Add health and database-connectivity endpoints.
- Add README setup instructions and automated checks.

**Acceptance:** The app starts locally, frontend loads, backend responds, and backend connects to PostgreSQL.

### Phase 1 — Suppliers and purchase orders
- Add users/roles, suppliers, components, POs, and PO lines.
- Add fictional seed data.
- Implement authentication and role-aware UI.
- Build supplier and PO list/create/detail screens.
- Implement backend validation, totals, and status transitions.
- Add tests.

**Acceptance:** An authorized user can create a supplier and component, create a PO with at least one line, and see the saved PO and calculated total in the UI. Data persists after refresh. Supplier users can access only their own records.

### Phase 2 — Inventory and receipts
- Implement inventory movements and partial receipts.
- Update PO status correctly.
- Protect receipt posting against duplicate requests.

**Acceptance:** A receipt updates stock exactly once and records an inventory movement.

### Phase 3 — BOM and production planning
- Implement products, BOMs, production plans, and shortage calculations.

**Acceptance:** A user can create a production plan and see correct required, available, incoming, and shortage quantities.

### Phase 4 — Shipments, quality, invoices, notifications
- Add delivery tracking, inspections, invoice matching, notifications, and audit history.

**Acceptance:** Users can trace a component from PO through receipt, quality result, stock, and invoice review.

### Phase 5 — AI capabilities
- Add provider configuration, document extraction preview, and authorized procurement-assistant tools.

**Acceptance:** AI answers use authorized application data. Extracted documents require human review. The app remains usable if AI is unconfigured or unavailable.

### Phase 6 — Polish and verification
- Improve mobile usability, accessibility, error handling, tests, demo data, and documentation.
- Add a demo script for the end-to-end workflow.

**Acceptance:** A reviewer can start the app locally, use the documented demo account, complete the main workflow, and run the tests.

## 12. First task for the coding agent

Start with **Phase 0 and Phase 1 only**.

1. Inspect the current repository and summarize its structure.
2. Give a short implementation plan.
3. Build or adapt the local Next.js + FastAPI + PostgreSQL application.
4. Add migrations, seed data, `.env.example`, and local startup instructions.
5. Implement the first working flow: log in with a fictional demo account; create a supplier; create a component; create a PO with one or more component lines; calculate totals on the backend; display the saved PO number, supplier, line items, total, status, and requested delivery date.
6. Add tests for core business rules and permissions.
7. Run available checks, fix failures, and report actual results.
8. Update README with exact startup and test commands.
9. Summarize files changed, features completed, tests run, limitations, and the next recommended step.

Do not implement all modules at once. Do not implement any AWS or cloud infrastructure. Focus on a reliable, working local application first.
