export function getHandoverReportDocument(inspection) {
  const snapshot = inspection.finalReportVersions?.[inspection.finalReportVersions.length - 1];
  return inspection.status === "Finalized" && snapshot
    ? { ...inspection, ...snapshot, _id: inspection._id, updatedAt: snapshot.finalizedAt, lastUpdatedBy: snapshot.finalizedBy }
    : inspection;
}
