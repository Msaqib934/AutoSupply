"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  ComponentItem,
  Currency,
  PageResponse,
  POSummaryItem,
  PurchaseOrderStatus,
  SupplierSummary,
} from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import {
  FileSpreadsheet,
  Search,
  Plus,
  Filter,
  Eye,
  Trash2,
  Calendar,
  Building2,
  Euro,
  Layers,
} from "lucide-react";

interface LineDraft {
  component_id: number;
  quantity: string;
  unit_price: string;
}

export default function PurchaseOrdersPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<PageResponse<POSummaryItem> | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitImmediately, setSubmitImmediately] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canWritePO = hasPermission("purchase_orders:write");
  const isSupplierUser = user?.role === "SUPPLIER";

  const fetchPOs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (search.trim()) query.set("q", search.trim());
      if (statusFilter) query.set("status", statusFilter);

      const res = await apiFetch<PageResponse<POSummaryItem>>(
        `/api/v1/purchase-orders?${query.toString()}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      if (!isSupplierUser) {
        const supRes = await apiFetch<PageResponse<SupplierSummary>>(
          "/api/v1/suppliers?page_size=100&status=ACTIVE"
        );
        setSuppliers(supRes.items);
      }
      const compRes = await apiFetch<PageResponse<ComponentItem>>(
        "/api/v1/components?page_size=100&is_active=true"
      );
      setComponents(compRes.items);
    } catch (err) {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [page, statusFilter]);

  useEffect(() => {
    loadDependencies();
    // Default requested delivery date = 14 days from today
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setRequestedDeliveryDate(d.toISOString().split("T")[0]);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPOs();
  };

  const handleAddLine = () => {
    if (!components.length) return;
    const available = components.find((c) => !lines.some((l) => l.component_id === c.id));
    if (!available) {
      alert("All active components have already been added to this purchase order.");
      return;
    }
    setLines([
      ...lines,
      {
        component_id: available.id,
        quantity: "10.000",
        unit_price: "100.0000",
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof LineDraft, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  // Preview total calculation in UI
  const calculatePreviewTotal = (): string => {
    let tot = 0;
    for (const l of lines) {
      const q = parseFloat(l.quantity) || 0;
      const p = parseFloat(l.unit_price) || 0;
      tot += q * p;
    }
    return tot.toFixed(2);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setFormError("Please select a supplier.");
      return;
    }
    if (!lines.length) {
      setFormError("Purchase order must have at least one component line.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        supplier_id: supplierId,
        currency,
        requested_delivery_date: requestedDeliveryDate,
        notes: notes.trim() || null,
        submit: submitImmediately,
        lines: lines.map((l) => ({
          component_id: l.component_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      };

      const res = await apiFetch<{ id: number }>("/api/v1/purchase-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setIsCreateOpen(false);
      setLines([]);
      fetchPOs();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create purchase order.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#FFFFFF" }}>
            Purchase Orders
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {isSupplierUser
              ? "View and confirm purchase orders addressed to your organization."
              : "Requisitions, supplier confirmations, decimal-safe totals, and delivery tracking."}
          </p>
        </div>

        {canWritePO && (
          <button
            onClick={() => {
              if (suppliers.length) setSupplierId(suppliers[0].id);
              if (components.length) {
                setLines([
                  {
                    component_id: components[0].id,
                    quantity: "20.000",
                    unit_price: "150.0000",
                  },
                ]);
              }
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Create Purchase Order</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div
        className="glass-card"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", flex: 1, maxWidth: "500px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={16}
              color="var(--text-dim)"
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Search by PO number or supplier name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Filter size={16} color="var(--text-dim)" />
          <select
            className="form-select"
            style={{ width: "200px" }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {!isSupplierUser && <option value="DRAFT">Draft</option>}
            <option value="SUBMITTED">Submitted (Pending Action)</option>
            <option value="SUPPLIER_CONFIRMED">Supplier Confirmed</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card" style={{ borderLeft: "4px solid #EF4444" }}>
          <p style={{ color: "#EF4444", fontSize: "0.875rem" }}>{error}</p>
        </div>
      )}

      {/* PO Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Order Date</th>
              <th>Delivery Required</th>
              <th>Currency & Total</th>
              <th>Lines</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  Loading purchase orders...
                </td>
              </tr>
            ) : data?.items?.length ? (
              data.items.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#60A5FA" }}>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      style={{ color: "#60A5FA", textDecoration: "underline" }}
                    >
                      {po.po_number}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600, color: "#FFFFFF" }}>{po.supplier.company_name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {po.supplier.code}
                      </span>
                    </div>
                  </td>
                  <td>{po.order_date}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Calendar size={13} color="var(--text-dim)" />
                      {po.requested_delivery_date}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        fontSize: "0.9375rem",
                      }}
                    >
                      {po.currency} {Number(po.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.05)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {po.line_count} lines
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={po.status} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="btn btn-secondary"
                      style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                    >
                      <Eye size={13} />
                      <span>View Order</span>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No purchase orders found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Showing {data.items.length} of {data.total} orders
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * data.page_size >= data.total}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Purchase Order"
        maxWidth="750px"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Target Supplier</label>
              <select
                className="form-select"
                required
                value={supplierId ?? ""}
                onChange={(e) => setSupplierId(parseInt(e.target.value) || null)}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Requested Delivery</label>
              <input
                type="date"
                required
                className="form-input"
                value={requestedDeliveryDate}
                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Internal Requisition Notes</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Batch run requirements or specific shipping instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Line items section */}
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#FFFFFF" }}>
                Order Component Lines ({lines.length})
              </h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="btn btn-secondary"
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
              >
                <Plus size={14} />
                <span>Add Component Line</span>
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {lines.map((l, idx) => {
                const comp = components.find((c) => c.id === l.component_id);
                const lineTotal = (
                  (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0)
                ).toFixed(2);

                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                      gap: "0.65rem",
                      alignItems: "center",
                      background: "rgba(255, 255, 255, 0.03)",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <select
                        className="form-select"
                        style={{ fontSize: "0.8125rem", padding: "0.4rem" }}
                        value={l.component_id}
                        onChange={(e) =>
                          handleLineChange(idx, "component_id", parseInt(e.target.value))
                        }
                      >
                        {components.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name} ({c.unit_of_measure})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        className="form-input"
                        style={{ fontSize: "0.8125rem", padding: "0.4rem" }}
                        placeholder="Quantity"
                        value={l.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="form-input"
                        style={{ fontSize: "0.8125rem", padding: "0.4rem" }}
                        placeholder="Unit Price"
                        value={l.unit_price}
                        onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                      />
                    </div>

                    <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      <span style={{ fontSize: "0.8125rem", color: "#60A5FA" }}>
                        {currency} {lineTotal}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#EF4444",
                          cursor: "pointer",
                          padding: "0.25rem",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.875rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid var(--border-accent)",
                marginTop: "0.875rem",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Estimated Order Total:</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "#FFFFFF" }}>
                {currency} {calculatePreviewTotal()}
              </span>
            </div>
          </div>

          {/* Submission action mode */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
              background: "rgba(255, 255, 255, 0.02)",
              marginBottom: "1rem",
            }}
          >
            <input
              type="checkbox"
              id="submitImmediately"
              checked={submitImmediately}
              onChange={(e) => setSubmitImmediately(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <label htmlFor="submitImmediately" style={{ fontSize: "0.8125rem", cursor: "pointer", color: "var(--text-muted)" }}>
              Submit directly to supplier (status will become <span style={{ color: "#F59E0B", fontWeight: 700 }}>SUBMITTED</span> instead of DRAFT)
            </label>
          </div>

          {formError && (
            <div style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", background: "var(--danger-bg)", color: "#EF4444", fontSize: "0.8125rem", marginBottom: "1rem" }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading || !lines.length}>
              {formLoading ? "Saving..." : submitImmediately ? "Submit Purchase Order" : "Save as Draft"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
