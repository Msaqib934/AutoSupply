export type Role =
  | "ADMIN"
  | "PROCUREMENT_MANAGER"
  | "SUPPLIER"
  | "WAREHOUSE_OPERATOR"
  | "PRODUCTION_PLANNER"
  | "QUALITY_INSPECTOR"
  | "FINANCE_OFFICER"
  | "VIEWER";

export type SupplierStatus = "ACTIVE" | "INACTIVE" | "UNDER_REVIEW";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SUPPLIER_CONFIRMED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"
  | "REJECTED";

export type UnitOfMeasure = "EA" | "SET" | "PAIR" | "KG" | "M" | "L";

export type Currency = "EUR" | "USD" | "GBP" | "JPY" | "INR" | "PKR";

export interface SupplierRef {
  id: number;
  code: string;
  company_name: string;
}

export interface ComponentRef {
  id: number;
  code: string;
  name: string;
  unit_of_measure: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  supplier: SupplierRef | null;
  is_active: boolean;
  created_at: string;
}

export interface CurrentUser extends User {
  permissions: string[];
}

export interface SupplierSummary {
  id: number;
  code: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  country: string;
  lead_time_days: number;
  status: SupplierStatus;
  component_count: number;
}

export interface SupplierDetail {
  id: number;
  code: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  lead_time_days: number;
  status: SupplierStatus;
  notes: string | null;
  components: ComponentRef[];
  created_at: string;
  updated_at: string;
}

export interface ComponentItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  unit_of_measure: UnitOfMeasure;
  reorder_threshold: string;
  preferred_supplier: SupplierRef | null;
  is_active: boolean;
  incoming_confirmed: string;
  incoming_unconfirmed: string;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: number;
  line_number: number;
  component: ComponentRef;
  quantity: string;
  unit_price: string;
  line_total: string;
}

export interface POStatusHistoryItem {
  id: number;
  from_status: PurchaseOrderStatus | null;
  to_status: PurchaseOrderStatus;
  changed_at: string;
  changed_by_name: string | null;
  note: string | null;
}

export interface POSummaryItem {
  id: number;
  po_number: string;
  supplier: SupplierRef;
  status: PurchaseOrderStatus;
  currency: Currency;
  order_date: string;
  requested_delivery_date: string;
  total_amount: string;
  line_count: number;
}

export interface PODetailItem {
  id: number;
  po_number: string;
  supplier: SupplierRef;
  status: PurchaseOrderStatus;
  currency: Currency;
  order_date: string;
  requested_delivery_date: string;
  notes: string | null;
  total_amount: string;
  supplier_response_note: string | null;
  submitted_at: string | null;
  responded_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  lines: POLineItem[];
  status_history: POStatusHistoryItem[];
  available_actions: string[];
  can_edit: boolean;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  open_pos: number;
  orders_awaiting_confirmation: number;
  total_suppliers: number;
  active_suppliers: number;
  total_components: number;
  total_spend_open: string;
  recent_activity: {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
    actor_name: string;
  }[];
}
