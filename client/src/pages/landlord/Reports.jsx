import { useCallback, useEffect, useState } from "react";
import API_URL from "../../services/api";
import BrandHeader from "../../components/BrandHeader";

function getStatusClass(status) {
  const normalizedStatus = String(status || "pending")
    .toLowerCase()
    .replace(/\s+/g, "-");

  switch (normalizedStatus) {
    case "pending":
      return "status-pending";
    case "acknowledged":
      return "status-acknowledged";
    case "in-progress":
      return "status-in-progress";
    case "resolved":
      return "status-resolved";
    default:
      return "status-default";
  }
}

function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(`${API_URL}/reports/landlord`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load reports.");
      }

      setReports(data.reports || []);
    } catch (err) {
      setError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const updateStatus = async (reportId, status) => {
    setUpdatingId(reportId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/reports/${reportId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update report.");
      }

      setMessage("Report status updated successfully.");
      await loadReports();
    } catch (err) {
      setError(err.message || "Failed to update report.");
    } finally {
      setUpdatingId("");
    }
  };

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    return Number.isNaN(parsedDate.getTime())
      ? "Date unavailable"
      : parsedDate.toLocaleString();
  };

  return (
    <div className="landlord-reports-page">
      <BrandHeader />
      <main className="landlord-reports-main">
        <section className="landlord-reports-welcome">
          <p className="tenant-label">PROPERTY MANAGEMENT</p>
          <h2>Maintenance Issue Reports</h2>
          <p>Review tenant-reported issues and track their progress.</p>
        </section>

        {message && (
          <p className="landlord-report-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="landlord-report-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading tenant reports...</p>
        ) : reports.length === 0 ? (
          <section className="landlord-report-empty">
            <h3>No reports yet</h3>
            <p>
              Reports submitted by tenants for your properties will appear here.
            </p>
          </section>
        ) : (
          <>
            <h3>All Reports ({reports.length})</h3>

            <div className="landlord-report-list">
              {reports.map((report) => (
                <article className="landlord-report-card" key={report._id}>
                  <div className="landlord-report-card-header">
                    <div>
                      <h3>{report.title}</h3>
                      <p className="landlord-report-date">
                        Submitted: {formatDate(report.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`landlord-report-status status-badge ${getStatusClass(
                        report.status
                      )}`}
                    >
                      {report.status}
                    </span>
                  </div>

                  <div className="landlord-report-details">
                    <p>
                      <strong>Tenant:</strong> {report.tenant?.name || "Tenant"}
                    </p>

                    <p>
                      <strong>Tenant email:</strong>{" "}
                      {report.tenant?.email || "Unavailable"}
                    </p>

                    <p>
                      <strong>Property:</strong>{" "}
                      {report.property?.propertyName ||
                        "Property details unavailable"}
                    </p>

                    {report.property?.address && (
                      <p>
                        <strong>Address:</strong> {report.property.address}
                        {report.property.city ? `, ${report.property.city}` : ""}
                      </p>
                    )}

                    <p>
                      <strong>Category:</strong> {report.category}
                    </p>

                    <p>
                      <strong>Priority:</strong> {report.priority}
                    </p>

                    {report.location && (
                      <p>
                        <strong>Problem location:</strong> {report.location}
                      </p>
                    )}

                    <p>
                      <strong>Description:</strong> {report.description}
                    </p>

                    {report.resolutionNote && (
                      <p>
                        <strong>Resolution note:</strong> {report.resolutionNote}
                      </p>
                    )}
                  </div>

                  <div className="landlord-report-actions">
                    <label htmlFor={`status-${report._id}`}>Update status</label>

                    <select
                      id={`status-${report._id}`}
                      value={report.status}
                      disabled={updatingId === report._id}
                      onChange={(event) =>
                        updateStatus(report._id, event.target.value)
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="Acknowledged">Acknowledged</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>

                    {updatingId === report._id && <span>Updating...</span>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Reports;
