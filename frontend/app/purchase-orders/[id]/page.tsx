"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { PODetailItem, PurchaseOrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  FileSpreadsheet,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Ban,
  User,
  Shield,
  Layers,
  AlertCircle,
} from "lucide-react";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poId = params.id as string;

  const [po, setPo] = useState<PODetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action Modals
  const [activeAction, setActiveAction] = useState<"submit" | "confirm" | "reject" | "cancel" | null>(null);

  const fetchPO = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PODetailItem>(`/api/v1/purchase-orders/${poId}`);
      setPo(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load purchase order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (poId) fetchPO();
  }, [poId]);

  const handleAction = async (note?: string) => {
    if (!activeAction) return;
    await apiFetch(`/api/v1/purchase-orders/${poId}/actions/${activeAction}`, {
      method: "POST",
      body: JSON.stringify({ note: note || null }),
    });
    await fetchPO();
  };

  if (loading) {
    return (
      <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--text-muted)" }}>
        <p>Loading purchase order #{poId}...</p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="glass-card" style={{ borderLeft: "4px solid #EF4444" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.5rem" }}>
          Order Not Accessible
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error || "Purchase order not found or access restricted to your organization."}
        </p>
        <Link href="/purchase-orders" className="btn btn-secondary">
          <ArrowLeft size={14} />
          <span>Back to Purchase Orders</span>
        </Link>
      </div>
    );
  }

  const isSupplierUser = user?.role === "SUPPLIER";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Top Breadcrumb & Action Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/purchase-orders"
            className="btn btn-secondary"
            style={{ padding: "0.4rem 0.65rem" }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  color: "#FFFFFF",
                }}
              >
                {po.po_number}
              </h2>
              <StatusBadge status={po.status} />
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Created on {po.order_date} by {po.created_by_name || "Procurement System"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.625rem" }}>
          {po.available_actions.includes("submit") && (
            <button
              onClick={() => setActiveAction("submit")}
              className="btn btn-primary"
            >
              <Send size={15} />
              <span>Submit to Supplier</span>
            </button>
          )}

          {po.available_actions.includes("confirm") && (
            <button
              onClick={() => setActiveAction("confirm")}
              className="btn btn-success"
            >
              <CheckCircle2 size={15} />
              <span>Confirm Order</span>
            </button>
          )}

          {po.available_actions.includes("reject") && (
            <button
              onClick={() => setActiveAction("reject")}
              className="btn btn-danger"
            >
              <XCircle size={15} />
              <span>Reject Order</span>
            </button>
          )}

          {po.available_actions.includes("cancel") && (
            <button
              onClick={() => setActiveAction("cancel")}
              className="btn btn-secondary"
              style={{ color: "#EF4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
            >
              <Ban size={15} />
              <span>Cancel Requisition</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Order Details Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Left Column: Line Items and Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Supplier Response Banner if Present */}
          {po.supplier_response_note && (
            <div
              className="glass-card"
              style={{
                background:
                  po.status === "REJECTED"
                    ? "rgba(239, 68, 68, 0.08)"
                    : "rgba(16, 185, 129, 0.08)",
                border:
                  po.status === "REJECTED"
                    ? "1px solid var(--danger-border)"
                    : "1px solid var(--success-border)",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: po.status === "REJECTED" ? "#EF4444" : "#10B981" }}>
                Supplier Response Note
              </span>
              <p style={{ fontSize: "0.875rem", color: "#FFFFFF", marginTop: "0.25rem" }}>
                "{po.supplier_response_note}"
              </p>
              {po.responded_at && (
                <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: "0.25rem", display: "block" }}>
                  Recorded at {new Date(po.responded_at).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Line items table */}
          <div className="glass-card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "1rem" }}>
              Component Lines ({po.lines.length})
            </h3>
            <div className="table-container" style={{ border: "none" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Component SKU</th>
                    <th>Part Name</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th style={{ textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {line.line_number}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#60A5FA" }}>
                        {line.component.code}
                      </td>
                      <td style={{ fontWeight: 600, color: "#FFFFFF" }}>{line.component.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {line.quantity} {line.component.unit_of_measure}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {po.currency} {Number(line.unit_price).toFixed(4)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "#FFFFFF" }}>
                        {po.currency} {Number(line.line_total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "1.5rem",
                paddingTop: "1.25rem",
                marginTop: "1.25rem",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Grand Order Total:
              </span>
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  color: "#60A5FA",
                }}
              >
                {po.currency} {Number(po.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Notes */}
          {po.notes && (
            <div className="glass-card">
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                Requisition Notes
              </span>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                {po.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Order Meta & Status Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Supplier Info Card */}
          <div className="glass-card">
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Supplier Fulfillment Partner
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div
                style={{
                  padding: "0.6rem",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#3B82F6",
                }}
              >
                <Building2 size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                  {po.supplier.company_name}
                </h4>
                <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  Code: {po.supplier.code}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "1rem", paddingTop: "0.875rem", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Order Date:</span>
                <span style={{ fontWeight: 600 }}>{po.order_date}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Delivery Required:</span>
                <span style={{ fontWeight: 600, color: "#60A5FA" }}>{po.requested_delivery_date}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Line Items:</span>
                <span style={{ fontWeight: 600 }}>{po.lines.length} components</span>
              </div>
            </div>
          </div>

          {/* Status History Timeline */}
          <div className="glass-card">
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "1rem" }}>
              Status Lifecycle & Audit History
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
              {po.status_history.map((hist, idx) => (
                <div
                  key={hist.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: idx === po.status_history.length - 1 ? "#3B82F6" : "var(--border-subtle)",
                      marginTop: "4px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <StatusBadge status={hist.to_status} />
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)" }}>
                        {new Date(hist.changed_at).toLocaleString()}
                      </span>
                    </div>
                    {hist.note && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {hist.note}
                      </p>
                    )}
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)" }}>
                      By: {hist.changed_by_name || "System"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <ConfirmModal
        isOpen={activeAction === "submit"}
        onClose={() => setActiveAction(null)}
        onConfirm={handleAction}
        title="Submit Purchase Order to Supplier"
        description="Submitting will lock the purchase order draft and notify the supplier partner for confirmation."
        confirmLabel="Submit to Supplier"
        confirmVariant="primary"
      />

      <ConfirmModal
        isOpen={activeAction === "confirm"}
        onClose={() => setActiveAction(null)}
        onConfirm={handleAction}
        title="Confirm Purchase Order"
        description="Confirming commits your supplier organization to deliver the requested quantities by the requested date."
        confirmLabel="Confirm Order"
        confirmVariant="success"
        notePlaceholder="Optional fulfillment note (e.g., dispatch schedule)..."
      />

      <ConfirmModal
        isOpen={activeAction === "reject"}
        onClose={() => setActiveAction(null)}
        onConfirm={handleAction}
        title="Reject Purchase Order"
        description="Rejecting will notify the buyer. A clear reason must be provided for audit tracking."
        confirmLabel="Reject Order"
        confirmVariant="danger"
        requireNote={true}
        notePlaceholder="Please state the exact reason for rejection (e.g. capacity shortage, price change)..."
      />

      <ConfirmModal
        isOpen={activeAction === "cancel"}
        onClose={() => setActiveAction(null)}
        onConfirm={handleAction}
        title="Cancel Purchase Order Requisition"
        description="Cancelling terminates this purchase order. A reason must be recorded in the audit trail."
        confirmLabel="Cancel Requisition"
        confirmVariant="danger"
        requireNote={true}
        notePlaceholder="Enter cancellation reason for the audit ledger..."
      />
    </div>
  );
}
