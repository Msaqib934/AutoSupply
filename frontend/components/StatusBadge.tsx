"use client";

import React from "react";
import { PurchaseOrderStatus, SupplierStatus } from "@/lib/types";

interface Props {
  status: PurchaseOrderStatus | SupplierStatus | string;
}

export function StatusBadge({ status }: Props) {
  let badgeClass = "badge-draft";
  let label = status;

  switch (status) {
    case "DRAFT":
      badgeClass = "badge-draft";
      label = "Draft";
      break;
    case "SUBMITTED":
      badgeClass = "badge-submitted";
      label = "Submitted";
      break;
    case "SUPPLIER_CONFIRMED":
      badgeClass = "badge-confirmed";
      label = "Confirmed";
      break;
    case "PARTIALLY_RECEIVED":
      badgeClass = "badge-received";
      label = "Partial Recv";
      break;
    case "RECEIVED":
      badgeClass = "badge-received";
      label = "Received";
      break;
    case "CANCELLED":
      badgeClass = "badge-cancelled";
      label = "Cancelled";
      break;
    case "REJECTED":
      badgeClass = "badge-rejected";
      label = "Rejected";
      break;
    case "ACTIVE":
      badgeClass = "badge-active";
      label = "Active";
      break;
    case "UNDER_REVIEW":
      badgeClass = "badge-under-review";
      label = "Under Review";
      break;
    case "INACTIVE":
      badgeClass = "badge-cancelled";
      label = "Inactive";
      break;
    default:
      badgeClass = "badge-draft";
  }

  return <span className={`badge ${badgeClass}`}>{label}</span>;
}
