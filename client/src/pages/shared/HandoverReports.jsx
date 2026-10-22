import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../services/api";
import Logo from "../../Logo";
import EvidenceGallery from "../../components/handover/EvidenceGallery";
import PhotoComparison from "../../components/handover/PhotoComparison";
import FinalHandoverReport from "../../components/handover/FinalHandoverReport";

const STATUS_OPTIONS = [
  "Draft", "Inspection in Progress", "Awaiting Tenant Review", "Awaiting Landlord Review",
  "Changes Requested", "Disputed", "Agreed / Approved", "Finalized",
  "Submitted for Review", "Awaiting Other Party", "Submitted", "Reviewed", "Completed",
];

function nextAction(report) {
  const actions = {
    Draft: "Start the inspection",
    "Inspection in Progress": "Complete inspection and submit for tenant review",
    "Submitted for Review": "Tenant review",
    "Awaiting Tenant Review": "Review and acknowledge or request changes",
    "Awaiting Landlord Review": "Landlord review and approval",
    "Changes Requested": "Respond to requested changes",
    Disputed: "Respond to the dispute",
    "Agreed / Approved": "Finalize the handover",
    Finalized: "Handover complete",
    "Awaiting Other Party": "Other party review",
    Submitted: "Tenant review",
    Reviewed: "Landlord review",
    Completed: "Handover complete",
  };
  return actions[report.status] || "Review report";
}

function shortId(id) {
  return "PT-" + String(id || "").slice(-8).toUpperCase();
}

function statusClass(status) {
  return "handover-state-" + String(status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function HandoverReports({ embedded = false, title = "Reports & Handover" }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total: 0, awaitingMine: 0, awaitingOther: 0, changesRequested: 0, disputed: 0, finalized: 0 });
  const [properties, setProperties] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("updated");
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("report");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!token) throw new Error("Please sign in again to view handover reports.");
      const query = new URLSearchParams({ page: String(page), limit: "10", sort });
      if (statusFilter) query.set("status", statusFilter);
      if (propertyFilter) query.set("propertyId", propertyFilter);
      if (dateFrom) query.set("from", dateFrom);
      if (dateTo) query.set("to", dateTo);
      const searchTerm = search.trim();
      if (searchTerm) query.set("search", searchTerm);
      const response = await fetch(API_URL + "/inspections?" + query.toString(), { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load handover reports.");
      setReports(data.inspections || []);
      setSummary(data.summary || { total: data.count || 0, awaitingMine: 0, awaitingOther: 0, changesRequested: 0, disputed: 0, finalized: 0 });
      setPages(Math.max(1, data.pages || 1));
      if (selectedId && !(data.inspections || []).some((report) => report._id === selectedId)) setSelectedId("");
    } catch (loadError) {
      setError(loadError.message || "Could not load handover reports.");
    } finally {
      setLoading(false);
    }
  }, [token, page, sort, statusFilter, propertyFilter, dateFrom, dateTo, search, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetch(API_URL + "/properties", { headers: { Authorization: "Bearer " + token } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load properties.");
        if (active) setProperties(data.properties || []);
      }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [token]);

  const visibleReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      if (!needle) return true;
      return [
        report._id, report.property?.propertyName, report.property?.address, report.property?.city,
        report.tenant?.name, report.landlord?.name, report.inspectionType, report.status,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
    return filtered;
  }, [reports, search]);

  const openReport = (id, section) => {
    setSelectedId((current) => current === id && view === section ? "" : id);
    setView(section);
    setMessage("");
    setError("");
  };

  const currentReport = reports.find((report) => report._id === selectedId);
  const cards = [
    ["Total Reports", summary.total, "total"],
    ["Awaiting My Action", summary.awaitingMine, "mine"],
    ["Awaiting Other Party", summary.awaitingOther, "other"],
    ["Changes Requested", summary.changesRequested, "changes"],
    ["Disputed Reports", summary.disputed, "disputed"],
    ["Finalized Reports", summary.finalized, "finalized"],
  ];
  const role = user?.role || "user";

  return (
    <div className={embedded ? "handover-dashboard handover-dashboard-embedded" : "handover-dashboard"}>
      {!embedded && <header className="handover-dashboard-header"><Logo variant="compact" /><div><p className="brand-tagline">Record. Compare. Trust.</p><p className="handover-eyebrow">{role === "tenant" ? "TENANT PORTAL" : "PROPERTY MANAGEMENT"}</p><h1>{title}</h1><p>Review inspection findings, photo evidence, and the next handover action.</p></div></header>}
      {embedded && <div className="handover-embedded-heading"><div><Logo variant="compact" /><div><p className="brand-tagline">Record. Compare. Trust.</p><p className="handover-eyebrow">PROPERTY HANDOVER</p><h2>{title}</h2></div></div><p>Inspection reviews, photo evidence, comparisons, and finalized reports.</p></div>}
      <section className="handover-summary-grid" aria-label="Report summary">
        {cards.map(([label, value, key]) => <article className={"handover-summary-card summary-" + key} key={label}><span>{label}</span><strong>{loading ? "…" : value}</strong></article>)}
      </section>
      {error && <div className="handover-alert handover-error" role="alert">{error}</div>}
      {message && <div className="handover-alert handover-success" role="status">{message}</div>}
      <section className="handover-dashboard-panel">
        <div className="handover-section-heading"><div><h2>Handover reports</h2><p>{summary.total} inspection report{summary.total === 1 ? "" : "s"} from saved property records</p></div></div>
        <div className="handover-filter-grid">
          <label className="handover-field handover-search">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Property, tenant, report ID…" /></label>
          <label className="handover-field">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="handover-field">Property<select value={propertyFilter} onChange={(event) => { setPropertyFilter(event.target.value); setPage(1); }}><option value="">All properties</option>{properties.map((property) => <option key={property._id} value={property._id}>{property.propertyName} · {property.city}</option>)}</select></label>
          <label className="handover-field">Inspection from<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
          <label className="handover-field">Inspection to<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
          <label className="handover-field">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Last updated</option><option value="inspection-newest">Inspection date: newest</option><option value="inspection-oldest">Inspection date: oldest</option><option value="updated-oldest">Last updated: oldest</option></select></label>
        </div>
        {loading ? <div className="handover-empty" role="status">Loading reports…</div> : !visibleReports.length ? <div className="handover-empty"><h3>{reports.length ? "No reports match these filters" : "No handover reports yet"}</h3><p>{reports.length ? "Adjust the search or filters to see other reports." : "Saved property inspections will appear here. No report data is fabricated."}</p></div> : (
          <>
            <div className="handover-table-scroll"><table className="handover-list-table"><thead><tr><th>Report</th><th>Property</th><th>Inspection</th><th>Tenant / Landlord</th><th>Status &amp; responsibility</th><th>Updated</th><th>Next action</th><th>Actions</th></tr></thead><tbody>
              {visibleReports.map((report) => {
                const responsible = report.status === "Finalized" ? "Complete" : report.responsibleRole === role ? "You" : report.responsibleRole || "Landlord";
                return <tr key={report._id}>
                  <td><strong>{shortId(report._id)}</strong><small>{report.inspectionType}</small></td>
                  <td><strong>{report.property?.propertyName || "Property details unavailable"}</strong><small>{[report.property?.address, report.property?.city].filter(Boolean).join(", ") || "Address not provided"}</small></td>
                  <td>{report.inspectionDate ? new Date(report.inspectionDate).toLocaleDateString() : "Not provided"}</td>
                  <td><span>{report.tenant?.name || "Tenant not assigned"}</span><small>{report.landlord?.name || "Landlord"}</small></td>
                  <td><span className={"handover-status-pill " + statusClass(report.status)}>{report.status}</span><small>Next: {responsible}</small></td>
                  <td>{report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "Not available"}<small>By {report.lastUpdatedBy?.name || "Not available"}</small></td>
                  <td>{nextAction(report)}</td>
                  <td><div className="handover-row-actions">
                    <button type="button" onClick={() => openReport(report._id, "report")}>View Report</button>
                    {["Awaiting Tenant Review", "Awaiting Landlord Review", "Changes Requested", "Disputed", "Agreed / Approved"].includes(report.status) && report.responsibleRole === role && <button type="button" onClick={() => openReport(report._id, "report")}>Review</button>}
                    <button type="button" onClick={() => openReport(report._id, "evidence")}>Evidence</button>
                    <button type="button" onClick={() => openReport(report._id, "compare")}>Compare</button>
                    {report.status === "Finalized" && <button type="button" onClick={() => openReport(report._id, "final")}>Final handover</button>}
                  </div></td>
                </tr>;
              })}
            </tbody></table></div>
            <div className="handover-pagination"><span>Page {page} of {pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
          </>
        )}
      </section>
      {currentReport && <section className="handover-dashboard-panel handover-report-detail-panel" aria-live="polite">
        <div className="handover-detail-toolbar"><div><p className="handover-eyebrow">{shortId(currentReport._id)}</p><h2>{currentReport.property?.propertyName || "Handover report"}</h2></div><div className="handover-detail-tabs"><button type="button" aria-pressed={view === "report"} onClick={() => setView("report")}>Report</button><button type="button" aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidence</button><button type="button" aria-pressed={view === "compare"} onClick={() => setView("compare")}>Compare</button>{currentReport.status === "Finalized" && <button type="button" aria-pressed={view === "final"} onClick={() => setView("final")}>Final handover</button>}</div><button className="handover-close-detail" type="button" onClick={() => setSelectedId("")} aria-label="Close report">×</button></div>
        {view === "evidence" && <EvidenceGallery inspection={currentReport} onUpdated={loadReports} />}
        {view === "compare" && <PhotoComparison inspection={currentReport} onUpdated={loadReports} />}
        {(view === "report" || view === "final") && <FinalHandoverReport inspection={currentReport} onUpdated={loadReports} />}
      </section>}
    </div>
  );
}

export default HandoverReports;
