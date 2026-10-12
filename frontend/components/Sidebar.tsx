"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Cpu,
  FileSpreadsheet,
  Boxes,
  CalendarDays,
  Truck,
  ClipboardCheck,
  Receipt,
  Bot,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isSupplier = user?.role === "SUPPLIER";

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, active: pathname === "/" },
    {
      label: isSupplier ? "My Supplier Profile" : "Suppliers",
      href: "/suppliers",
      icon: Building2,
      active: pathname.startsWith("/suppliers"),
    },
    // Supplier users see components via POs only per spec §4
    ...(!isSupplier
      ? [
          {
            label: "Components",
            href: "/components",
            icon: Cpu,
            active: pathname.startsWith("/components"),
          },
        ]
      : []),
    {
      label: "Purchase Orders",
      href: "/purchase-orders",
      icon: FileSpreadsheet,
      active: pathname.startsWith("/purchase-orders"),
    },
  ];

  const upcomingPhases = [
    { label: "Inventory / Receipts", phase: "P2", icon: Boxes },
    { label: "Production & BOM", phase: "P3", icon: CalendarDays },
    { label: "Shipments Tracking", phase: "P4", icon: Truck },
    { label: "Quality Inspections", phase: "P4", icon: ClipboardCheck },
    { label: "Invoices & Match", phase: "P4", icon: Receipt },
    { label: "AI Procurement Assistant", phase: "P5", icon: Bot },
  ];

  return (
    <aside
      style={{
        width: "260px",
        background: "rgba(11, 15, 23, 0.95)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
        gap: "1.5rem",
      }}
    >
      {/* Brand */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0 0.5rem" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFF",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
          }}
        >
          <Layers size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.01em", color: "#FFFFFF" }}>
            AutoSupply<span style={{ color: "#3B82F6" }}>Hub</span>
          </h1>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Automotive Operations
          </p>
        </div>
      </Link>

      {/* Main Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "0.5rem 0.75rem",
          }}
        >
          Active Modules
        </span>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 0.875rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: item.active ? "#FFFFFF" : "var(--text-muted)",
                background: item.active
                  ? "linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)"
                  : "transparent",
                borderLeft: item.active ? "3px solid #3B82F6" : "3px solid transparent",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={18} color={item.active ? "#60A5FA" : "var(--text-dim)"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Roadmap Items */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "0.5rem 0.75rem",
          }}
        >
          Roadmap Modules
        </span>
        {upcomingPhases.map((phase) => {
          const Icon = phase.icon;
          return (
            <div
              key={phase.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.875rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.8125rem",
                color: "var(--text-dim)",
                opacity: 0.75,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Icon size={16} />
                <span>{phase.label}</span>
              </div>
              <span
                style={{
                  fontSize: "0.625rem",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "4px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-dim)",
                  fontWeight: 700,
                }}
              >
                {phase.phase}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
