export function canSubmitInspectionChangeRequest(note) {
  return Boolean(String(note || "").trim());
}

export function getTenantReviewComments(inspection) {
  const history = Array.isArray(inspection?.statusHistory) ? inspection.statusHistory : [];
  const activity = Array.isArray(inspection?.activity) ? inspection.activity : [];
  const entries = [
    ...history.filter((entry) => entry.role === "tenant" && entry.comment).map((entry) => ({
      role: entry.role, comment: entry.comment, createdAt: entry.createdAt,
    })),
    ...activity.filter((entry) => entry.role === "tenant" && entry.note).map((entry) => ({
      role: entry.role, comment: entry.note, createdAt: entry.createdAt,
    })),
  ];
  return entries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
