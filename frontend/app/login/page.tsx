"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Layers, ShieldCheck, ArrowRight, UserCheck, Lock } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@autosupply.local",
    password: "AdminPass123!",
    badge: "Full Access",
    desc: "Manage users, suppliers, components, and settings.",
  },
  {
    role: "Procurement Manager",
    email: "procurement@autosupply.local",
    password: "ProcurePass123!",
    badge: "Buyer",
    desc: "Create and manage suppliers and purchase orders.",
  },
  {
    role: "Supplier (Apex Dynamics)",
    email: "apex.supplier@autosupply.local",
    password: "SupplierPass123!",
    badge: "Isolated",
    desc: "View own profile and POs; confirm or reject orders.",
  },
  {
    role: "Supplier (MotoPowertrain)",
    email: "moto.supplier@autosupply.local",
    password: "SupplierPass123!",
    badge: "Isolated",
    desc: "View own profile and POs; confirm or reject orders.",
  },
  {
    role: "Production Planner",
    email: "planner@autosupply.local",
    password: "PlannerPass123!",
    badge: "Planning",
    desc: "Review stock, incoming orders, and shortage plans.",
  },
  {
    role: "Warehouse Operator",
    email: "warehouse@autosupply.local",
    password: "WarehousePass123!",
    badge: "Inventory",
    desc: "Review deliveries and goods receipts.",
  },
  {
    role: "Viewer / Auditor",
    email: "auditor@autosupply.local",
    password: "AuditorPass123!",
    badge: "Read-Only",
    desc: "Audit trail inspection and read-only record review.",
  },
];

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("procurement@autosupply.local");
  const [password, setPassword] = useState("ProcurePass123!");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || "Invalid credentials.");
    }
  };

  const handleQuickSelect = async (account: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    try {
      await login(account.email, account.password);
    } catch (err: any) {
      setError(err?.message || "Quick sign-in failed.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background:
          "radial-gradient(at 50% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 60%), #0B0F17",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: "2.5rem",
          background: "rgba(18, 24, 38, 0.9)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "2.5rem",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Left: Sign In Form */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFF",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF" }}>
                AutoSupply<span style={{ color: "#3B82F6" }}>Hub</span>
              </h1>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                Automotive Supplier & Production Platform
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#FFFFFF" }}>
            Sign In
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            Enter your credentials or click any demo persona on the right.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@autosupply.local"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger-bg)",
                  color: "#EF4444",
                  fontSize: "0.8125rem",
                  border: "1px solid var(--danger-border)",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", padding: "0.75rem" }}
            >
              {loading ? "Authenticating..." : "Sign In to Workspace"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Right: 1-Click Demo Accounts */}
        <div
          style={{
            borderLeft: "1px solid var(--border-subtle)",
            paddingLeft: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                1-Click Demo Personas
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                Click any role to test role-based permissions immediately
              </p>
            </div>
            <UserCheck size={18} color="#3B82F6" />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              maxHeight: "440px",
              overflowY: "auto",
              paddingRight: "0.25rem",
            }}
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickSelect(acc)}
                disabled={loading}
                style={{
                  textAlign: "left",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#FFFFFF" }}>
                    {acc.role}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#60A5FA",
                      fontWeight: 600,
                    }}
                  >
                    {acc.badge}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{acc.desc}</span>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {acc.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
