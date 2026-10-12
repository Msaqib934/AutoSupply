"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { ComponentItem, PageResponse, SupplierSummary, UnitOfMeasure } from "@/lib/types";
import { Modal } from "@/components/Modal";
import {
  Cpu,
  Search,
  Plus,
  Edit2,
  Filter,
  CheckCircle2,
  XCircle,
  Truck,
  Building2,
  AlertTriangle,
} from "lucide-react";

export default function ComponentsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PageResponse<ComponentItem> | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  // Create/Edit Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<ComponentItem | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "Powertrain",
    unit_of_measure: "EA" as UnitOfMeasure,
    reorder_threshold: "20.000",
    preferred_supplier_id: null as number | null,
    is_active: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canWriteComponents = hasPermission("components:write");

  const fetchComponents = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (search.trim()) query.set("q", search.trim());
      if (categoryFilter) query.set("category", categoryFilter);

      const res = await apiFetch<PageResponse<ComponentItem>>(`/api/v1/components?${query.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load components.");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliersList = async () => {
    try {
      const res = await apiFetch<PageResponse<SupplierSummary>>("/api/v1/suppliers?page_size=100");
      setSuppliers(res.items);
    } catch (err) {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchComponents();
    loadSuppliersList();
  }, [page, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchComponents();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/components", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setIsCreateOpen(false);
      fetchComponents();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create component.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComp) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await apiFetch(`/api/v1/components/${selectedComp.id}`, {
        method: "PATCH",
        body: JSON.stringify(formData),
      });
      setIsEditOpen(false);
      fetchComponents();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update component.");
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
            Component Catalogue
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Raw materials, sub-assemblies, reorder thresholds, and incoming PO quantities.
          </p>
        </div>

        {canWriteComponents && (
          <button
            onClick={() => {
              setFormData({
                code: "",
                name: "",
                description: "",
                category: "Powertrain",
                unit_of_measure: "EA",
                reorder_threshold: "20.000",
                preferred_supplier_id: null,
                is_active: true,
              });
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>New Component</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
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
              placeholder="Search by SKU, component name, or description..."
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
            style={{ width: "180px" }}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            <option value="Powertrain">Powertrain</option>
            <option value="Chassis & Frame">Chassis & Frame</option>
            <option value="Wheels & Suspension">Wheels & Suspension</option>
            <option value="Brakes">Brakes</option>
            <option value="Electrical">Electrical</option>
            <option value="Body & Ergonomics">Body & Ergonomics</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="glass-card" style={{ borderLeft: "4px solid #EF4444" }}>
          <p style={{ color: "#EF4444", fontSize: "0.875rem" }}>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU / Code</th>
              <th>Component Name</th>
              <th>Category</th>
              <th>UOM</th>
              <th>Reorder Min</th>
              <th>Incoming Confirmed</th>
              <th>Incoming Pending</th>
              <th>Preferred Supplier</th>
              <th>Status</th>
              {canWriteComponents && <th style={{ textAlign: "right" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  Loading component catalogue...
                </td>
              </tr>
            ) : data?.items?.length ? (
              data.items.map((comp) => (
                <tr key={comp.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#60A5FA" }}>
                    {comp.code}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600, color: "#FFFFFF" }}>{comp.name}</span>
                      {comp.description && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {comp.description}
                        </span>
                      )}
                    </div>
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
                      {comp.category}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{comp.unit_of_measure}</td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    {comp.reorder_threshold}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: Number(comp.incoming_confirmed) > 0 ? "var(--success-bg)" : "rgba(255,255,255,0.03)",
                        color: Number(comp.incoming_confirmed) > 0 ? "#10B981" : "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      <Truck size={12} />
                      {comp.incoming_confirmed}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: Number(comp.incoming_unconfirmed) > 0 ? "var(--warning-bg)" : "rgba(255,255,255,0.03)",
                        color: Number(comp.incoming_unconfirmed) > 0 ? "#F59E0B" : "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {comp.incoming_unconfirmed}
                    </span>
                  </td>
                  <td>
                    {comp.preferred_supplier ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem" }}>
                        <Building2 size={13} color="var(--text-dim)" />
                        {comp.preferred_supplier.company_name}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>
                  <td>
                    {comp.is_active ? (
                      <span className="badge badge-active">Active</span>
                    ) : (
                      <span className="badge badge-cancelled">Inactive</span>
                    )}
                  </td>
                  {canWriteComponents && (
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => {
                          setSelectedComp(comp);
                          setFormData({
                            code: comp.code,
                            name: comp.name,
                            description: comp.description || "",
                            category: comp.category,
                            unit_of_measure: comp.unit_of_measure,
                            reorder_threshold: comp.reorder_threshold,
                            preferred_supplier_id: comp.preferred_supplier?.id || null,
                            is_active: comp.is_active,
                          });
                          setFormError(null);
                          setIsEditOpen(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No components found matching your query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register New Component">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Component SKU / Code</label>
              <input
                type="text"
                required
                placeholder="e.g. SUS-001"
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Component Name</label>
              <input
                type="text"
                required
                placeholder="Descriptive part name"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                required
                placeholder="e.g. Chassis, Powertrain"
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure (UOM)</label>
              <select
                className="form-select"
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value as UnitOfMeasure })}
              >
                <option value="EA">EA (Each)</option>
                <option value="SET">SET</option>
                <option value="PAIR">PAIR</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="M">M (Metres)</option>
                <option value="L">L (Litres)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Reorder Threshold (Min Quantity)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                className="form-input"
                value={formData.reorder_threshold}
                onChange={(e) => setFormData({ ...formData, reorder_threshold: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Supplier</label>
              <select
                className="form-select"
                value={formData.preferred_supplier_id ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_supplier_id: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Technical Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Specification details, dimensions, material..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
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
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? "Saving..." : "Create Component"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Component: ${formData.code}`}>
        <form onSubmit={handleEditSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Component SKU / Code</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Component Name</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure (UOM)</label>
              <select
                className="form-select"
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value as UnitOfMeasure })}
              >
                <option value="EA">EA (Each)</option>
                <option value="SET">SET</option>
                <option value="PAIR">PAIR</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="M">M (Metres)</option>
                <option value="L">L (Litres)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Reorder Threshold</label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                className="form-input"
                value={formData.reorder_threshold}
                onChange={(e) => setFormData({ ...formData, reorder_threshold: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Supplier</label>
              <select
                className="form-select"
                value={formData.preferred_supplier_id ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_supplier_id: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Active Status</label>
            <select
              className="form-select"
              value={formData.is_active ? "true" : "false"}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
            >
              <option value="true">Active (Eligible for POs)</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {formError && (
            <div style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", background: "var(--danger-bg)", color: "#EF4444", fontSize: "0.8125rem", marginBottom: "1rem" }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? "Saving..." : "Update Component"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
