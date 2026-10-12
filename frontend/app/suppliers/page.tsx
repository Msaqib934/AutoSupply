"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PageResponse, SupplierDetail, SupplierStatus, SupplierSummary } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
} from "lucide-react";

export default function SuppliersPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<PageResponse<SupplierSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDetail | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    code: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Germany",
    lead_time_days: 14,
    status: "ACTIVE" as SupplierStatus,
    notes: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canWriteSuppliers = hasPermission("suppliers:write");
  const isSupplierUser = user?.role === "SUPPLIER";

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (search.trim()) query.set("q", search.trim());
      if (statusFilter) query.set("status", statusFilter);

      const res = await apiFetch<PageResponse<SupplierSummary>>(`/api/v1/suppliers?${query.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSuppliers();
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const detail = await apiFetch<SupplierDetail>(`/api/v1/suppliers/${id}`);
      setSelectedSupplier(detail);
      setIsDetailOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to load supplier details.");
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const detail = await apiFetch<SupplierDetail>(`/api/v1/suppliers/${id}`);
      setSelectedSupplier(detail);
      setFormData({
        code: detail.code,
        company_name: detail.company_name,
        contact_name: detail.contact_name || "",
        email: detail.email || "",
        phone: detail.phone || "",
        address: detail.address || "",
        city: detail.city || "",
        country: detail.country,
        lead_time_days: detail.lead_time_days,
        status: detail.status,
        notes: detail.notes || "",
      });
      setFormError(null);
      setIsEditOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to load supplier for editing.");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/suppliers", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setIsCreateOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create supplier.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setFormLoading(true);
    setFormError(null);
    try {
      // If supplier user, send only self-editable fields
      const payload = isSupplierUser
        ? {
            contact_name: formData.contact_name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            country: formData.country,
          }
        : formData;

      await apiFetch(`/api/v1/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setIsEditOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update supplier.");
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
            {isSupplierUser ? "My Supplier Organization" : "Supplier Directory"}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {isSupplierUser
              ? "Manage your company profile and view supplied components."
              : "Manage automotive OEM suppliers, lead times, and components supplied."}
          </p>
        </div>

        {canWriteSuppliers && (
          <button
            onClick={() => {
              setFormData({
                code: "",
                company_name: "",
                contact_name: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                country: "Germany",
                lead_time_days: 14,
                status: "ACTIVE",
                notes: "",
              });
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      {!isSupplierUser && (
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
                placeholder="Search by code, company, or country..."
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
              style={{ width: "160px" }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      )}

      {/* Error state */}
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
              <th>Code</th>
              <th>Company Name</th>
              <th>Contact</th>
              <th>Country</th>
              <th>Lead Time</th>
              <th>Supplied Components</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  Loading suppliers...
                </td>
              </tr>
            ) : data?.items?.length ? (
              data.items.map((sup) => (
                <tr key={sup.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#60A5FA" }}>
                    {sup.code}
                  </td>
                  <td style={{ fontWeight: 600, color: "#FFFFFF" }}>{sup.company_name}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{sup.contact_name || "—"}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {sup.email || ""}
                      </span>
                    </div>
                  </td>
                  <td>{sup.country}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={12} color="var(--text-dim)" />
                      {sup.lead_time_days} days
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
                      {sup.component_count} linked
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={sup.status} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleOpenDetail(sup.id)}
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        title="View Profile"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                      {(canWriteSuppliers || isSupplierUser) && (
                        <button
                          onClick={() => handleOpenEdit(sup.id)}
                          className="btn btn-secondary"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No suppliers found matching your query.
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
            Showing {data.items.length} of {data.total} suppliers
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

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Supplier">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Supplier Code (SKU)</label>
              <input
                type="text"
                required
                placeholder="e.g. SUP-BOSCH"
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                required
                placeholder="Full corporate name"
                className="form-input"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input
                type="text"
                placeholder="Key Account Representative"
                className="form-input"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                placeholder="orders@supplier.com"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                placeholder="+49 ..."
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Lead Time (Days)</label>
              <input
                type="number"
                min="0"
                max="365"
                required
                className="form-input"
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Initial Status</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as SupplierStatus })}
              >
                <option value="ACTIVE">Active</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
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
              {formLoading ? "Saving..." : "Create Supplier"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Supplier: ${formData.company_name}`}>
        <form onSubmit={handleEditSubmit}>
          {isSupplierUser && (
            <div style={{ padding: "0.75rem", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#60A5FA", fontSize: "0.8125rem", marginBottom: "1rem" }}>
              Supplier users may update contact and address information. Code, status, and lead time can only be modified by procurement.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Supplier Code</label>
              <input
                type="text"
                disabled={isSupplierUser}
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                disabled={isSupplierUser}
                className="form-input"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-input"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>

          {!isSupplierUser && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Lead Time (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  className="form-input"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SupplierStatus })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          )}

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
              {formLoading ? "Saving..." : "Update Supplier"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={`Supplier: ${selectedSupplier?.company_name}`}>
        {selectedSupplier && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF" }}>
                  {selectedSupplier.company_name}
                </span>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  Code: {selectedSupplier.code}
                </p>
              </div>
              <StatusBadge status={selectedSupplier.status} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", borderRadius: "var(--radius-md)", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
              <div>
                <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Contact Person:</span>
                <p style={{ fontWeight: 600 }}>{selectedSupplier.contact_name || "—"}</p>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Email:</span>
                <p style={{ fontWeight: 600 }}>{selectedSupplier.email || "—"}</p>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Phone:</span>
                <p style={{ fontWeight: 600 }}>{selectedSupplier.phone || "—"}</p>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Location:</span>
                <p style={{ fontWeight: 600 }}>{[selectedSupplier.city, selectedSupplier.country].filter(Boolean).join(", ")}</p>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Typical Lead Time:</span>
                <p style={{ fontWeight: 600 }}>{selectedSupplier.lead_time_days} days</p>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.5rem" }}>
                Components Supplied ({selectedSupplier.components.length})
              </h4>
              {selectedSupplier.components.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {selectedSupplier.components.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(59, 130, 246, 0.1)",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#60A5FA" }}>{c.code}</span>
                      <span style={{ color: "var(--text-muted)" }}>• {c.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)" }}>
                  No components linked to this supplier yet.
                </p>
              )}
            </div>

            {selectedSupplier.notes && (
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
                <span style={{ color: "var(--text-dim)", display: "block", fontSize: "0.6875rem" }}>Internal Notes:</span>
                {selectedSupplier.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
