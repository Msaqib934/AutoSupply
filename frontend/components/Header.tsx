"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { LogOut, User as UserIcon, Shield, Building2 } from "lucide-react";

export function Header() {
  const { user, logout } = useAuth();

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrator",
    PROCUREMENT_MANAGER: "Procurement Manager",
    SUPPLIER: "Supplier Partner",
    PRODUCTION_PLANNER: "Production Planner",
    WAREHOUSE_OPERATOR: "Warehouse Operator",
    QUALITY_INSPECTOR: "Quality Inspector",
    FINANCE_OFFICER: "Finance Officer",
    VIEWER: "Auditor / Viewer",
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.875rem 2rem",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(11, 15, 23, 0.75)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            background: "rgba(59, 130, 246, 0.15)",
            color: "#60A5FA",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            letterSpacing: "0.05em",
          }}
        >
          PHASE 0 & 1 VERIFIED
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {user ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-full)",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                {user.full_name.charAt(0)}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{user.full_name}</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <Shield size={10} color="#3B82F6" />
                  {roleLabels[user.role] || user.role}
                  {user.supplier && (
                    <span style={{ color: "#34D399", marginLeft: "0.25rem" }}>
                      • {user.supplier.company_name}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="btn btn-secondary"
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Exit</span>
            </button>
          </>
        ) : (
          <Link href="/login" className="btn btn-primary" style={{ padding: "0.4rem 0.85rem" }}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
