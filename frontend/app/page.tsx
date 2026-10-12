"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { DashboardSummary } from "@/lib/types";
import {
  FileSpreadsheet,
  Clock,
  Building2,
  Cpu,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardSummary>("/api/v1/dashboard/summary");
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  if (loading) {
    return (
      <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ display: "inline-block", width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>Loading operations metrics...</p>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="glass-card"
        style={{
          borderLeft: "4px solid #EF4444",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <AlertCircle size={24} color="#EF4444" />
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>Dashboard Error</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{error}</p>
        </div>
        <button onClick={fetchDashboard} className="btn btn-secondary" style={{ marginLeft: "auto" }}>
          Retry
        </button>
      </div>
    );
  }

  const isSupplier = user?.role === "SUPPLIER";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Welcome Banner */}
      <div
        className="glass-card"
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
          border: "1px solid var(--border-accent)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#60A5FA",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Operations Dashboard
            </span>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem", color: "#FFFFFF" }}>
              Welcome, {user?.full_name || "Guest"}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {isSupplier
                ? `Supplier portal for ${user?.supplier?.company_name || "partner"}. Manage incoming purchase orders and confirmations.`
                : "Live overview of automotive component procurement, supplier fulfillment, and inventory demand."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link href="/purchase-orders" className="btn btn-primary">
              <FileSpreadsheet size={16} />
              <span>Purchase Orders</span>
            </Link>
            {!isSupplier && (
              <Link href="/suppliers" className="btn btn-secondary">
                <Building2 size={16} />
                <span>Suppliers</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
        }}
      >
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Active / Open POs</span>
            <FileSpreadsheet size={18} color="#3B82F6" />
          </div>
          <span className="stat-value">{data?.open_pos ?? 0}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Submitted, Confirmed, Partial
          </span>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Awaiting Supplier Response</span>
            <Clock size={18} color="#F59E0B" />
          </div>
          <span className="stat-value" style={{ color: "#F59E0B" }}>
            {data?.orders_awaiting_confirmation ?? 0}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Action required by supplier
          </span>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Open Requisition Spend</span>
            <TrendingUp size={18} color="#10B981" />
          </div>
          <span className="stat-value" style={{ color: "#10B981" }}>
            €{Number(data?.total_spend_open || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Exact calculated EUR total
          </span>
        </div>

        {!isSupplier && (
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">Active Suppliers</span>
              <Building2 size={18} color="#06B6D4" />
            </div>
            <span className="stat-value">
              {data?.active_suppliers ?? 0}{" "}
              <span style={{ fontSize: "1rem", color: "var(--text-dim)", fontWeight: 500 }}>
                / {data?.total_suppliers ?? 0}
              </span>
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              {data?.total_components ?? 0} components in catalogue
            </span>
          </div>
        )}
      </div>

      {/* Main Content Split: Quick Actions & Audit Trail */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
        {/* Quick Nav Workflows */}
        <div className="glass-card">
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem", color: "#FFFFFF" }}>
            Core Operations Workflows
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <Link
              href="/purchase-orders"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-subtle)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)";
                e.currentTarget.style.borderColor = "var(--border-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3B82F6" }}>
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#FFFFFF" }}>
                    Purchase Order Tracking
                  </h4>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Create multi-line POs, calculate decimal totals, submit, and confirm
                  </p>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-dim)" />
            </Link>

            {!isSupplier && (
              <>
                <Link
                  href="/suppliers"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)";
                    e.currentTarget.style.borderColor = "var(--border-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(6, 182, 212, 0.15)", color: "#06B6D4" }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#FFFFFF" }}>
                        Supplier Management
                      </h4>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Manage approved vendors, lead times, and components supplied
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} color="var(--text-dim)" />
                </Link>

                <Link
                  href="/components"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)";
                    e.currentTarget.style.borderColor = "var(--border-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>
                      <Cpu size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#FFFFFF" }}>
                        Component Catalogue
                      </h4>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Inspect SKUs, UOMs, reorder thresholds, and incoming quantities
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} color="var(--text-dim)" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Audit / Recent Activity Log */}
        <div className="glass-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF" }}>
              Audit & Activity Trail
            </h3>
            <Activity size={18} color="var(--text-dim)" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
            {data?.recent_activity?.length ? (
              data.recent_activity.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#60A5FA" }}>
                      {ev.action}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)" }}>
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span>By: {ev.actor_name}</span>
                    <span>•</span>
                    <span>Target: {ev.entity_type} {ev.entity_id ? `#${ev.entity_id}` : ""}</span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", padding: "1rem 0" }}>
                No recent activity recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
