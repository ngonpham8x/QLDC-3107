import React from "react";
import { Resident, DemographicsChange, DemographicsChangeType, ResidentStatus } from "../types";

interface Props {
  resident: Resident;
  changes?: DemographicsChange[];
  className?: string;
}

export function getResidentChangeInfo(resident: Resident, changes: DemographicsChange[] = []) {
  if (!resident) return null;

  // 1. Check if there's a recorded change in changes array (most recent match first)
  const resId = String(resident.id || "").trim();
  const resName = (resident.fullName || "").toLowerCase().trim();

  const recentChange = [...changes]
    .reverse()
    .find(c => (c.residentId && String(c.residentId).trim() === resId) || (c.residentName && c.residentName.toLowerCase().trim() === resName));

  if (recentChange) {
    switch (recentChange.type) {
      case DemographicsChangeType.DEATH:
        return { label: "Đã mất", type: "death", icon: "🪦", bg: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" };
      case DemographicsChangeType.MOVE_OUT:
        return { label: "Chuyển đi", type: "move_out", icon: "🚚", bg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" };
      case DemographicsChangeType.TEMP_ABSENT:
        return { label: "Tạm vắng", type: "temp_absent", icon: "✈️", bg: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800" };
      case DemographicsChangeType.MOVE_IN:
        return { label: "Chuyển đến", type: "move_in", icon: "🏠", bg: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" };
      case DemographicsChangeType.NEWBORN:
        return { label: "Sinh mới", type: "newborn", icon: "👶", bg: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800" };
      case DemographicsChangeType.TEMP_STAY:
        return { label: "Tạm trú", type: "temp_stay", icon: "📝", bg: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800" };
    }
  }

  // 2. Fallback check resident object attributes
  const occ = (resident.occupation || "").toLowerCase();
  const notes = (resident.notes || "").toLowerCase();

  if (occ.includes("qua đời") || occ.includes("đã mất") || notes.includes("qua đời") || notes.includes("đã mất")) {
    return { label: "Đã mất", type: "death", icon: "🪦", bg: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" };
  }

  if (notes.includes("chuyển đi") || occ.includes("chuyển đi")) {
    return { label: "Chuyển đi", type: "move_out", icon: "🚚", bg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" };
  }

  if (resident.status === ResidentStatus.TEMPORARY_ABSENT || (resident.status as any) === "Tạm vắng") {
    return { label: "Tạm vắng", type: "temp_absent", icon: "✈️", bg: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800" };
  }

  if (resident.status === ResidentStatus.TEMPORARY_STAY || (resident.status as any) === "Tạm trú") {
    return { label: "Tạm trú", type: "temp_stay", icon: "📝", bg: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800" };
  }

  return null;
}

export default function ResidentStatusBadge({ resident, changes = [], className = "" }: Props) {
  const info = getResidentChangeInfo(resident, changes);
  if (!info) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs shrink-0 select-none ${info.bg} ${className}`}>
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
}
