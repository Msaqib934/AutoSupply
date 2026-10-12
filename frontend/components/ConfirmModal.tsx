"use client";

import React, { useState } from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger" | "success";
  requireNote?: boolean;
  notePlaceholder?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  requireNote = false,
  notePlaceholder = "Enter an optional reason or note...",
}: Props) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (requireNote && !note.trim()) {
      setError("A note or reason is required for this action.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(note.trim() ? note.trim() : undefined);
      setNote("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to execute action.");
    } finally {
      setLoading(false);
    }
  };

  const btnClass =
    confirmVariant === "danger"
      ? "btn-danger"
      : confirmVariant === "success"
      ? "btn-success"
      : "btn-primary";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="480px">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "8px",
              background:
                confirmVariant === "danger" ? "var(--danger-bg)" : "var(--info-bg)",
              color: confirmVariant === "danger" ? "#EF4444" : "#3B82F6",
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {description}
          </p>
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: "0.35rem", display: "block" }}>
            {requireNote ? "Reason (Required):" : "Add Note (Optional):"}
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notePlaceholder}
          />
        </div>

        {error && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius-md)",
              background: "var(--danger-bg)",
              color: "#EF4444",
              fontSize: "0.8125rem",
              border: "1px solid var(--danger-border)",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${btnClass}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
