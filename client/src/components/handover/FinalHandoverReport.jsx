import { useState } from "react";
import API_URL from "../../services/api";
import ProtectedEvidenceImage from "./ProtectedEvidenceImage";
import Logo from "../../Logo";
import { getHandoverReportDocument } from "../../utils/handoverReport";

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleString();
}

function FinalHandoverReport({ inspection, onUpdated }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isLandlord = user?.role === "landlord";
  const isFinalized = inspection.status === "Finalized";
  const latestSnapshot = inspection.finalReportVersions?.[inspection.finalReportVersions.length - 1];
  // A finalized report is an immutable document. Render its saved snapshot so
  // later property/user edits and narrow populate projections cannot alter it.
  const report = getHandoverReportDocument(inspection);
  const [finalNotes, setFinalNotes] = useState(inspection.finalNotes || "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submitStatus = async (status, confirmationText) => {
    if (!window.confirm(confirmationText)) return;
    if (!comment.trim() && status !== "Inspection in Progress") { setError("Add a comment for this approval or workflow action."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(API_URL + "/inspections/" + inspection._id + "/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ status, comment, expectedRevision: inspection.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update the report.");
      setMessage(data.message || "Report updated.");
      setComment("");
      onUpdated?.();
    } catch (actionError) {
      setError(actionError.message || "Could not update the report.");
    } finally { setBusy(false); }
  };

  const finalize = async () => {
    if (!window.confirm("Finalize and preserve this handover report version? This requires both parties' recorded approvals.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(API_URL + "/inspections/" + inspection._id + "/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ expectedRevision: inspection.revision, finalNotes, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "This report is not eligible for finalization.");
      setMessage(data.message || "Final handover report finalized.");
      setComment("");
      onUpdated?.();
    } catch (finalizeError) { setError(finalizeError.message || "Could not finalize the report."); }
    finally { setBusy(false); }
  };

  const revise = async () => {
    if (!comment.trim()) { setError("Explain why this finalized report needs a revision."); return; }
    if (!window.confirm("Open a new working revision? The finalized snapshot will remain preserved.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(API_URL + "/inspections/" + inspection._id + "/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ expectedRevision: inspection.revision, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not open a revision.");
      setMessage(data.message || "Revision opened.");
      setComment("");
      onUpdated?.();
    } catch (revisionError) { setError(revisionError.message || "Could not open a revision."); }
    finally { setBusy(false); }
  };

  const property = report.property || {};
  const confirmationsComplete = inspection.tenantConfirmation?.confirmed && inspection.landlordConfirmation?.confirmed;
  const canAct = user?.role === inspection.responsibleRole && !isFinalized;

  return (
    <div className="handover-report-page">
      <header className="handover-document-brand"><Logo variant="compact" /><div><span className="brand-tagline">Record. Compare. Trust.</span><span>PROPERTY HANDOVER</span><h1>Final Handover Report</h1></div><button className="handover-button" type="button" onClick={() => window.print()}>Print / Save PDF</button></header>
      <div className="handover-report-identifiers"><span>Report ID: {String(inspection._id).toUpperCase()}</span><span>Version: {latestSnapshot?.version || 1}</span><span className={"handover-status-pill handover-state-" + String(report.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}>{report.status}</span></div>
      {latestSnapshot && !isFinalized && <aside className="handover-notice">Previous finalized version {latestSnapshot.version} remains preserved. This is a new working revision.</aside>}
      <section className="handover-report-block">
        <h2>Property and participants</h2>
        <div className="handover-detail-grid">
          <p><span>Property</span><strong>{property.propertyName || "Property details not provided"}</strong></p>
          <p><span>Address</span><strong>{[property.address, property.city, property.pincode].filter(Boolean).join(", ") || "Address not provided"}</strong></p>
          <p><span>Inspection type</span><strong>{report.inspectionType || "Not provided"}</strong></p>
          <p><span>Inspection date</span><strong>{formatDate(report.inspectionDate)}</strong></p>
          <p><span>Tenant</span><strong>{report.tenant?.name || "No tenant assigned"}</strong></p>
          <p><span>Landlord</span><strong>{report.landlord?.name || "Landlord details unavailable"}</strong></p>
          <p><span>Last updated</span><strong>{formatDate(report.updatedAt)}</strong></p>
          <p><span>Last updated by</span><strong>{report.lastUpdatedBy?.name || report.finalizedBy?.name || "Not available"}</strong></p>
        </div>
      </section>
      <section className="handover-report-block">
        <h2>Room-by-room condition summary</h2>
        {!report.items?.length ? <p className="handover-empty">No room or item conditions have been recorded.</p> : <div className="handover-report-table-wrap"><table className="handover-report-table"><thead><tr><th>Room or item</th><th>Condition</th><th>Observations</th></tr></thead><tbody>{report.items.map((item, index) => <tr key={item._id || index}><td>{item.itemName || "Item name not provided"}</td><td>{item.condition || "Not recorded"}</td><td>{item.description || "No observation provided"}</td></tr>)}</tbody></table></div>}
        {report.generalNotes && <p><strong>Inspection notes:</strong> {report.generalNotes}</p>}
        {report.meterReadings && <p><strong>Meter readings:</strong> Electricity {report.meterReadings.electricity || "not provided"} · Water {report.meterReadings.water || "not provided"} · Gas {report.meterReadings.gas || "not provided"}</p>}
      </section>
      <section className="handover-report-block">
        <h2>Furniture and appliances</h2>
        {!property.furniture?.length ? <p className="handover-empty">No furniture or appliance inventory has been recorded.</p> : <div className="handover-report-table-wrap"><table className="handover-report-table"><thead><tr><th>Item</th><th>Quantity</th><th>Condition</th><th>Notes</th></tr></thead><tbody>{property.furniture.map((item, index) => <tr key={item._id || index}><td>{item.name}</td><td>{item.quantity}</td><td>{item.condition || "Not recorded"}</td><td>{item.notes || "None provided"}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="handover-report-block">
        <h2>Photo evidence and comparisons</h2>
        {!(report.evidence || []).length && <p className="handover-empty">No evidence photos were submitted.</p>}
        <div className="handover-evidence-grid">{(report.evidence || []).map((photo) => <article className="handover-evidence-card" key={photo._id}><ProtectedEvidenceImage inspectionId={inspection._id} evidence={photo} alt={photo.caption || photo.location} /><div className="handover-evidence-meta"><span>{photo.classification} · {photo.location}{photo.itemName ? " · " + photo.itemName : ""}</span><p>{photo.caption || "No caption provided."}</p><small>{formatDate(photo.uploadedAt)}</small></div></article>)}</div>
        {(report.comparisons || []).map((comparison) => <div className="handover-comparison-summary" key={comparison._id}><h3>{comparison.location}{comparison.itemName ? " · " + comparison.itemName : ""}</h3><p><strong>Condition:</strong> {comparison.conditionBefore || "Not provided"} → {comparison.conditionAfter || "Not provided"}</p><p><strong>Observed differences:</strong> {comparison.observedDifferences || "Not provided"}</p><p><strong>Comments:</strong> {comparison.comments || "Not provided"}</p><p><strong>Outstanding concerns:</strong> {comparison.outstandingConcerns || "None recorded"}</p></div>)}
      </section>
      <section className="handover-report-block">
        <h2>Reviews, disputes, and approvals</h2>
        <p><strong>Tenant acknowledgment:</strong> {report.tenantConfirmation?.confirmed ? "Recorded " + formatDate(report.tenantConfirmation.confirmedAt) : "Not completed"}</p>
        <p><strong>Landlord acknowledgment:</strong> {report.landlordConfirmation?.confirmed ? "Recorded " + formatDate(report.landlordConfirmation.confirmedAt) : "Not completed"}</p>
        {report.dispute?.comment && <div className="handover-notice"><strong>Dispute:</strong> {report.dispute.comment}{report.dispute.resolvedAt ? " · Responded " + formatDate(report.dispute.resolvedAt) : " · Response pending"}</div>}
        {!(report.statusHistory || []).length ? <p className="handover-empty">No status history has been recorded.</p> : <ol className="handover-history">{report.statusHistory.map((entry, index) => <li key={entry._id || index}><strong>{entry.previousStatus || "New"} → {entry.newStatus}</strong><span>{entry.user?.name || entry.role || "Participant"} · {formatDate(entry.createdAt)}</span>{entry.comment && <p>{entry.comment}</p>}</li>)}</ol>}
      </section>
      <section className="handover-report-block handover-finalization">
        <h2>Final handover notes</h2>
        <p className="handover-final-notes-print">{report.finalNotes || "None provided"}</p>
        <label className="handover-field handover-final-notes-editor">Final notes<textarea value={finalNotes} maxLength={3000} disabled={isFinalized} onChange={(event) => setFinalNotes(event.target.value)} rows={4} placeholder="Add final observations or unresolved items" /></label>
        <div className="handover-approval-checks"><span className={inspection.tenantConfirmation?.confirmed ? "approval-done" : ""}>Tenant acknowledgment {inspection.tenantConfirmation?.confirmed ? "complete" : "required"}</span><span className={inspection.landlordConfirmation?.confirmed ? "approval-done" : ""}>Landlord acknowledgment {inspection.landlordConfirmation?.confirmed ? "complete" : "required"}</span></div>
        {!isFinalized && !confirmationsComplete && <p className="handover-notice">This report cannot be finalized until both tenant and landlord approvals are recorded.</p>}
        {error && <p className="handover-error" role="alert">{error}</p>}
        {message && <p className="handover-success" role="status">{message}</p>}
        {!isFinalized && <label className="handover-field">Approval or revision comment<textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1500} placeholder="Required for approval, dispute response, or finalization" /></label>}
        <div className="handover-report-actions">
          {canAct && inspection.status === "Draft" && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Inspection in Progress", "Start this inspection?")}>Start inspection</button>}
          {canAct && inspection.status === "Inspection in Progress" && isLandlord && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Awaiting Tenant Review", "Submit this handover report for tenant review?")}>Submit for tenant review</button>}
          {canAct && inspection.status === "Submitted for Review" && isLandlord && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Awaiting Tenant Review", "Send this existing report to the tenant for review?")}>Send to tenant review</button>}
          {canAct && inspection.status === "Awaiting Tenant Review" && !isLandlord && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Awaiting Landlord Review", "Confirm that you have reviewed the report? This is an acknowledgment, not a legal signature.")}>Acknowledge review</button>}
          {canAct && inspection.status === "Awaiting Landlord Review" && isLandlord && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Agreed / Approved", "Record the landlord approval?")}>Approve report</button>}
          {canAct && inspection.status === "Agreed / Approved" && isLandlord && confirmationsComplete && <button className="handover-button handover-button-primary" disabled={busy} onClick={finalize}>Finalize handover</button>}
          {canAct && inspection.status === "Changes Requested" && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Inspection in Progress", "Mark the requested changes as being addressed?")}>Address requested changes</button>}
          {canAct && !["Draft", "Inspection in Progress", "Changes Requested", "Disputed", "Finalized"].includes(inspection.status) && <button className="handover-button handover-button-warning" disabled={busy} onClick={() => submitStatus("Changes Requested", "Request changes and assign the other party to respond?")}>Request changes</button>}
          {!isFinalized && inspection.status !== "Draft" && inspection.status !== "Disputed" && <button className="handover-button handover-button-danger" disabled={busy} onClick={() => submitStatus("Disputed", "Raise a dispute and notify the other party?")}>Raise dispute</button>}
          {inspection.status === "Disputed" && canAct && <button className="handover-button handover-button-primary" disabled={busy} onClick={() => submitStatus("Changes Requested", "Record your response to this dispute?")}>Respond to dispute</button>}
          {isFinalized && isLandlord && <button className="handover-button handover-button-warning" disabled={busy} onClick={revise}>Open a new revision</button>}
        </div>
        {isFinalized && <p className="handover-finalized-note">Finalized {formatDate(inspection.finalizedAt)}. This snapshot is preserved as version {latestSnapshot?.version || 1}.</p>}
        {inspection.status !== "Finalized" && !canAct && <p className="handover-muted">The {inspection.responsibleRole || "assigned party"} is responsible for the next workflow action. You can view evidence and history.</p>}
      </section>
      {!!inspection.finalReportVersions?.length && <section className="handover-report-block"><h2>Preserved report versions</h2>{inspection.finalReportVersions.map((version) => <details className="handover-version" key={version.version}><summary>Finalized version {version.version} · {formatDate(version.finalizedAt)}</summary><p>Report ID: {version.reportId} · Finalized by {version.finalizedBy?.name || "authorized landlord"}</p><p>{version.property?.propertyName || "Property details unavailable"} · {version.inspectionType || "Inspection type not recorded"} · {formatDate(version.inspectionDate)}</p><h3>Saved room and item records</h3>{version.items?.length ? <ul>{version.items.map((item, index) => <li key={item._id || index}>{item.itemName}: {item.condition || "Not recorded"}{item.description ? " — " + item.description : ""}</li>)}</ul> : <p>No room/item records in this version.</p>}<h3>Saved evidence ({version.evidence?.length || 0})</h3><div className="handover-evidence-grid">{(version.evidence || []).map((photo) => <article className="handover-evidence-card" key={photo._id}><ProtectedEvidenceImage inspectionId={inspection._id} evidence={photo} alt={photo.caption || photo.location} /><div className="handover-evidence-meta"><strong>{photo.location || "Location not provided"}</strong><p>{photo.caption || "No caption provided"}</p></div></article>)}</div><h3>Approvals at finalization</h3><p>Tenant: {version.tenantConfirmation?.confirmed ? "Acknowledged" : "Not recorded"} · Landlord: {version.landlordConfirmation?.confirmed ? "Acknowledged" : "Not recorded"}</p><p>Final notes: {version.finalNotes || "None provided"}</p></details>)}</section>}
    </div>
  );
}

export default FinalHandoverReport;
