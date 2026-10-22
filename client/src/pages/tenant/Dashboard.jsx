import { useEffect, useState } from "react";
import API_URL from "../../services/api";
import Logo from "../../Logo";
import HandoverReports from "../shared/HandoverReports";

const NAV_ITEMS = [
  { id: "Overview", label: "Overview", icon: "⌂" },
  { id: "My Property", label: "My Property", icon: "▦" },
  { id: "Evidence", label: "Inspections", icon: "✓" },
  { id: "Reports", label: "Reports", icon: "▤" },
  { id: "Final Handover", label: "Final Handover", icon: "✦" },
];

function getInitials(name, email) {
  const source = String(name || email || "").trim();
  const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function TenantDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [showProfile, setShowProfile] = useState(false);
  const [tenantCurrentPassword, setTenantCurrentPassword] = useState("");
  const [tenantNewPassword, setTenantNewPassword] = useState("");
  const [tenantConfirmPassword, setTenantConfirmPassword] = useState("");
  const [tenantProfileMessage, setTenantProfileMessage] = useState("");
  const [tenantProfileError, setTenantProfileError] = useState("");
  const [tenantPasswordSaving, setTenantPasswordSaving] = useState(false);
  const [tenantPasswordFormOpen, setTenantPasswordFormOpen] = useState(false);

  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(true);

  const [inspections, setInspections] = useState([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [inspectionError, setInspectionError] = useState("");
  const [inspectionMessage, setInspectionMessage] = useState("");
  const [reviewingInspectionId, setReviewingInspectionId] = useState("");
  const [inspectionReviewNote, setInspectionReviewNote] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Plumbing");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState("Medium");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submittedReport, setSubmittedReport] = useState(null);

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportHistoryError, setReportHistoryError] = useState("");
  const [reportsRefresh, setReportsRefresh] = useState(0);

  const tenantName = user?.name || "Tenant";
  const token = localStorage.getItem("token");

  const updateTenantPassword = async (event) => {
    event.preventDefault(); setTenantProfileError(""); setTenantProfileMessage("");
    if (tenantNewPassword !== tenantConfirmPassword) { setTenantProfileError("The new password and confirmation do not match."); return; }
    setTenantPasswordSaving(true);
    try {
      const response = await fetch(API_URL + "/auth/change-password", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ currentPassword: tenantCurrentPassword, newPassword: tenantNewPassword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not change password.");
      setTenantCurrentPassword(""); setTenantNewPassword(""); setTenantConfirmPassword(""); setTenantProfileMessage(data.message || "Password changed.");
    } catch (passwordError) { setTenantProfileError(passwordError.message || "Could not change password."); }
    finally { setTenantPasswordSaving(false); }
  };

  const selectedProperty = properties.find(
    (property) => property._id === selectedPropertyId
  );

  const selectedPropertyInspections = inspections.filter((inspection) => {
    const propertyId = inspection.property?._id || inspection.property;
    return String(propertyId) === String(selectedPropertyId);
  });

  const moveInInspection = selectedPropertyInspections
    .filter((inspection) => inspection.inspectionType === "Move-in")
    .sort(
      (a, b) =>
        new Date(a.inspectionDate) - new Date(b.inspectionDate)
    )[0];

  const moveOutInspection = selectedPropertyInspections
    .filter((inspection) => inspection.inspectionType === "Move-out")
    .sort(
      (a, b) =>
        new Date(b.inspectionDate) - new Date(a.inspectionDate)
    )[0];

  const moveInItems = new Map(
    (moveInInspection?.items || [])
      .filter((item) => item.itemName?.trim())
      .map((item) => [item.itemName.trim().toLowerCase(), item])
  );

  const moveOutItems = new Map(
    (moveOutInspection?.items || [])
      .filter((item) => item.itemName?.trim())
      .map((item) => [item.itemName.trim().toLowerCase(), item])
  );

  const comparisonNames = new Set([
    ...moveInItems.keys(),
    ...moveOutItems.keys(),
  ]);

  const comparisonRows = Array.from(comparisonNames).map((name) => {
    const before = moveInItems.get(name);
    const after = moveOutItems.get(name);

    let result;

    if (!before) {
      result = "Only in move-out record";
    } else if (!after) {
      result = "Only in move-in record";
    } else if (before.condition === after.condition) {
      result = "Same recorded condition";
    } else {
      result = "Condition differs";
    }

    return {
      name: after?.itemName || before?.itemName || name,
      before: before?.condition || "Not recorded",
      after: after?.condition || "Not recorded",
      beforeDescription: before?.description || "",
      afterDescription: after?.description || "",
      result,
    };
  });

  useEffect(() => {
    let isActive = true;

    const loadProperties = async () => {
      try {
        if (!token) {
          throw new Error("Please log in again to continue.");
        }

        const response = await fetch(`${API_URL}/properties`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load your properties."
          );
        }

        if (!isActive) return;

        const propertyList = data.properties || [];
        setProperties(propertyList);

        setSelectedPropertyId((currentId) =>
          propertyList.some((property) => property._id === currentId)
            ? currentId
            : propertyList[0]?._id || ""
        );
      } catch (err) {
        if (isActive) setError(err.message);
      } finally {
        if (isActive) setLoadingProperties(false);
      }
    };

    loadProperties();

    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    if (activeTab !== "Evidence") return undefined;

    let isActive = true;

    const loadInspections = async () => {
      setLoadingInspections(true);
      setInspectionError("");
      setInspectionMessage("");

      try {
        if (!token) {
          throw new Error("Please log in again to view inspections.");
        }

        const response = await fetch(`${API_URL}/inspections`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load inspection records."
          );
        }

        if (isActive) setInspections(data.inspections || []);
      } catch (err) {
        if (isActive) setInspectionError(err.message);
      } finally {
        if (isActive) setLoadingInspections(false);
      }
    };

    loadInspections();

    return () => {
      isActive = false;
    };
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== "Reports") return undefined;

    let isActive = true;

    const loadReports = async () => {
      setLoadingReports(true);
      setReportHistoryError("");

      try {
        if (!token) {
          throw new Error("Please log in again to view your reports.");
        }

        const response = await fetch(`${API_URL}/reports/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load report history."
          );
        }

        if (isActive) setReports(data.reports || []);
      } catch (err) {
        if (isActive) setReportHistoryError(err.message);
      } finally {
        if (isActive) setLoadingReports(false);
      }
    };

    loadReports();

    return () => {
      isActive = false;
    };
  }, [activeTab, token, reportsRefresh]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError("");
    setSuccess("");
    setInspectionError("");
    setInspectionMessage("");
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmittedReport(null);

    if (!token) {
      setError("Please log in again to submit a report.");
      return;
    }

    if (!selectedPropertyId) {
      setError("No assigned property is available for reporting.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_URL}/reports/${selectedPropertyId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            category,
            description: description.trim(),
            location: location.trim(),
            priority,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to submit your report."
        );
      }

      setSuccess(data.message || "Report submitted successfully.");
      setSubmittedReport(data.report);

      setTitle("");
      setCategory("Plumbing");
      setDescription("");
      setLocation("");
      setPriority("Medium");

      setReportsRefresh((current) => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewInspection = async (inspectionId, status, note = "") => {
    setInspectionError("");
    setInspectionMessage("");

    if (!token) {
      setInspectionError(
        "Please log in again to review this inspection."
      );
      return;
    }

    try {
      setReviewingInspectionId(inspectionId);

      const response = await fetch(
        `${API_URL}/inspections/${inspectionId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status, comment: note, expectedRevision: inspections.find((inspection) => inspection._id === inspectionId)?.revision ?? 0 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not mark this inspection as reviewed."
        );
      }

      setInspections((previous) =>
        previous.map((inspection) =>
          inspection._id === inspectionId
            ? { ...inspection, status, revision: inspection.revision + 1, responsibleRole: "landlord" }
            : inspection
        )
      );

      setInspectionMessage(
        status === "Changes Requested" ? "Changes requested. The landlord can now update this inspection." : "Review recorded. The landlord has been asked to confirm the inspection."
      );
    } catch (err) {
      setInspectionError(
        err.message || "Inspection review failed."
      );
    } finally {
      setReviewingInspectionId("");
    }
  };

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleString("en-IN");
  };

  const getReportStatusClass = (status) => {
    const normalized = String(status || "").trim().toLowerCase();

    if (["resolved", "closed", "completed"].includes(normalized)) {
      return "tenant-status-resolved";
    }

    if (["acknowledged", "accepted"].includes(normalized)) {
      return "tenant-status-acknowledged";
    }

    if (
      ["in progress", "in-progress", "in_progress", "processing"].includes(
        normalized
      )
    ) {
      return "tenant-status-in-progress";
    }

    if (["rejected", "declined"].includes(normalized)) {
      return "tenant-status-rejected";
    }

    if (
      ["pending", "submitted", "open"].includes(normalized)
    ) {
      return "tenant-status-pending";
    }

    return "tenant-status-unknown";
  };

  const renderInspectionRecord = (inspection, label) => {
    if (!inspection) {
      return (
        <p className="tenant-muted">
          No {label.toLowerCase()} inspection is available for this property.
        </p>
      );
    }

    const isReviewing = reviewingInspectionId === inspection._id;

    return (
      <>
        <div className="tenant-record-meta">
          <p>
            <strong>Date:</strong> {formatDate(inspection.inspectionDate)}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <span className={`tenant-status handover-state-${String(inspection.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>
              {inspection.status || "Draft"}
            </span>
          </p>
        </div>

        {["Submitted for Review", "Awaiting Tenant Review"].includes(inspection.status) && (
          <div className="tenant-review-box">
            <p>
              Review the room conditions and photo evidence. Confirm review or request changes. Add a note if you request a change.
            </p>

            <button
              type="button"
              className="tenant-button tenant-button-secondary"
              disabled={Boolean(reviewingInspectionId)}
              onClick={() => handleReviewInspection(inspection._id, "Awaiting Landlord Review", "Tenant reviewed the inspection.")}
            >
              {isReviewing ? "Updating..." : "Confirm Review"}
            </button>
            <textarea value={inspectionReviewNote} onChange={(event) => setInspectionReviewNote(event.target.value)} aria-label="Review note" placeholder="Describe the change needed" rows={3} />
            <button type="button" className="tenant-button tenant-button-primary" disabled={Boolean(reviewingInspectionId)} onClick={() => handleReviewInspection(inspection._id, "Changes Requested", inspectionReviewNote)}>Request Changes</button>
          </div>
        )}

        {inspection.status === "Awaiting Other Party" && (
          <p className="tenant-success-text">
            Your review is recorded. Waiting for the landlord to approve and finalize.
          </p>
        )}

        {(inspection.items || []).length > 0 ? (
          <div className="tenant-inspection-items">
            {inspection.items.map((item, index) => (
              <article
                className="tenant-item-card"
                key={item._id || `${item.itemName}-${index}`}
              >
                <strong>{item.itemName}</strong>
                <p>
                  <strong>Condition:</strong>{" "}
                  {item.condition || "Not recorded"}
                </p>
                {item.description && <p>{item.description}</p>}
                {!!item.photos?.length && <div className="inspection-photo-grid">{item.photos.map((photo, photoIndex) => <img key={photoIndex} src={photo} alt={`${item.itemName} evidence ${photoIndex + 1}`} />)}</div>}
              </article>
            ))}
          </div>
        ) : (
          <p className="tenant-muted">
            No items were recorded for this inspection.
          </p>
        )}

        {inspection.generalNotes && (
          <p>
            <strong>General notes:</strong> {inspection.generalNotes}
          </p>
        )}

        {inspection.meterReadings && (
          <div className="tenant-meter-grid">
            {inspection.meterReadings.electricity && (
              <div>
                <span>Electricity</span>
                <strong>{inspection.meterReadings.electricity}</strong>
              </div>
            )}
            {inspection.meterReadings.water && (
              <div>
                <span>Water</span>
                <strong>{inspection.meterReadings.water}</strong>
              </div>
            )}
            {inspection.meterReadings.gas && (
              <div>
                <span>Gas</span>
                <strong>{inspection.meterReadings.gas}</strong>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="tenant-dashboard">
      <aside className="tenant-sidebar">
        <div className="tenant-brand">
          <Logo variant="compact" />
          <small className="tenant-brand-tagline">Record. Compare. Trust.</small>
        </div>

        <p className="tenant-nav-heading">TENANT WORKSPACE</p>

        <nav className="tenant-navigation" aria-label="Tenant navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tenant-nav-item ${
                activeTab === item.id ? "active" : ""
              }`}
              aria-current={activeTab === item.id ? "page" : undefined}
              onClick={() => handleTabChange(item.id)}
            >
              <span className="tenant-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="tenant-sidebar-footer">
          <span className="tenant-footer-dot" />
          <span>Record. Compare. Trust.</span>
        </div>
      </aside>

      <div className="tenant-workspace">
        <header className="tenant-header">
          <div className="tenant-header-title">
            <p className="tenant-eyebrow">PROPERTY MANAGEMENT</p>
            <h1>
              {activeTab === "Evidence"
                ? "Inspections"
                : activeTab}
            </h1>
          </div>

          <div className="tenant-user">
            <button
              type="button"
              className="tenant-profile-trigger"
              onClick={() => setShowProfile(true)}
              aria-label="View tenant profile"
            >
              <span className="tenant-avatar tenant-profile-initial" aria-hidden="true">
                {getInitials(user?.name, user?.email)}
              </span>
            </button>
            <button
              type="button"
              className="tenant-logout-button"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="tenant-profile-backdrop" onClick={() => setShowProfile(false)}>
            <section
              className="tenant-profile-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tenant-profile-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="tenant-section-heading">
                <div>
                  <p className="tenant-eyebrow">ACCOUNT DETAILS</p>
                  <h2 id="tenant-profile-title">Tenant Profile</h2>
                </div>
                <button type="button" className="tenant-profile-close" onClick={() => setShowProfile(false)} aria-label="Close profile">×</button>
              </div>
              <div className="tenant-profile-avatar">{getInitials(user?.name, user?.email)}</div>
              <div className="tenant-profile-detail"><span>Full name</span><strong>{tenantName}</strong></div>
              <div className="tenant-profile-detail"><span>Email</span><strong>{user?.email || "Not provided"}</strong></div>
              {user?.phone && <div className="tenant-profile-detail"><span>Phone</span><strong>{user.phone}</strong></div>}
              <div className="tenant-profile-detail"><span>Role</span><strong>Tenant</strong></div>
              {tenantProfileError && <p className="tenant-error-text" role="alert">{tenantProfileError}</p>}
              {tenantProfileMessage && <p className="tenant-success-text" role="status">{tenantProfileMessage}</p>}
              {!tenantPasswordFormOpen ? <button type="button" className="tenant-profile-password-toggle" onClick={() => { setTenantPasswordFormOpen(true); setTenantProfileError(""); setTenantProfileMessage(""); }}>Change password</button> : <form className="tenant-password-form" onSubmit={updateTenantPassword}>
                <div className="tenant-password-heading"><div><h3>Change password</h3><p>Choose at least 8 characters.</p></div><button type="button" onClick={() => setTenantPasswordFormOpen(false)}>Cancel</button></div>
                <label>Current password<input type="password" autoComplete="current-password" value={tenantCurrentPassword} onChange={(event) => setTenantCurrentPassword(event.target.value)} required /></label>
                <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={tenantNewPassword} onChange={(event) => setTenantNewPassword(event.target.value)} required /></label>
                <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={tenantConfirmPassword} onChange={(event) => setTenantConfirmPassword(event.target.value)} required /></label>
                <button type="submit" className="tenant-button tenant-button-primary" disabled={tenantPasswordSaving}>{tenantPasswordSaving ? "Saving…" : "Update password"}</button>
              </form>}
              <button type="button" className="tenant-button tenant-button-primary" onClick={() => setShowProfile(false)}>Close</button>
            </section>
          </div>
        )}

        <main className="tenant-main">
          {error && (
            <div className="tenant-message tenant-error" role="alert">
              {error}
            </div>
          )}

          {/* OVERVIEW: summaries only, no duplicate navigation buttons */}
          {activeTab === "Overview" && (
            <section className="tenant-page">
              <div className="tenant-page-heading">
                <div>
                  <p className="tenant-eyebrow">YOUR ACCOUNT</p>
                  <h2>Welcome back, {tenantName}!</h2>
                  <p>
                    Here is a quick summary of your rental property.
                  </p>
                </div>
              </div>

              <div className="tenant-summary-grid">
                <article className="tenant-summary-card">
                  <div className="tenant-summary-top">
                    <span className="tenant-summary-icon">⌂</span>
                    <span className="tenant-summary-label">
                      My Property
                    </span>
                  </div>
                  <strong className="tenant-summary-value">
                    {loadingProperties ? "…" : properties.length}
                  </strong>
                  <p>
                    {properties.length === 1
                      ? "Property assigned to you"
                      : "Properties assigned to you"}
                  </p>
                </article>

                <article className="tenant-summary-card">
                  <div className="tenant-summary-top">
                    <span className="tenant-summary-icon">✓</span>
                    <span className="tenant-summary-label">
                      Inspections
                    </span>
                  </div>
                  <strong className="tenant-summary-value">
                    {inspections.length}
                  </strong>
                  <p>Inspection records loaded</p>
                </article>

                <article className="tenant-summary-card">
                  <div className="tenant-summary-top">
                    <span className="tenant-summary-icon">▤</span>
                    <span className="tenant-summary-label">
                      My Reports
                    </span>
                  </div>
                  <strong className="tenant-summary-value">
                    {reports.length}
                  </strong>
                  <p>Reports in your loaded history</p>
                </article>
              </div>

              <section className="tenant-info-panel">
                <div>
                  <p className="tenant-eyebrow">QUICK INFORMATION</p>
                  <h3>Your rental workspace</h3>
                  <p>
                    View your assigned property, inspect move-in and
                    move-out records, or submit a maintenance report
                    using the sidebar.
                  </p>
                </div>
              </section>

              {!loadingProperties && properties.length > 0 && (
                <section className="tenant-info-panel tenant-overview-property">
                  <div className="tenant-section-heading">
                    <div>
                      <p className="tenant-eyebrow">ASSIGNED PROPERTY</p>
                      <h3>{selectedProperty?.propertyName || properties[0]?.propertyName}</h3>
                    </div>
                    <span className="tenant-property-status">
                      {selectedProperty?.status || properties[0]?.status || "Assigned"}
                    </span>
                  </div>

                  <p className="tenant-muted">
                    {selectedProperty?.address || properties[0]?.address}
                    {", "}
                    {selectedProperty?.city || properties[0]?.city}
                  </p>
                </section>
              )}
            </section>
          )}

          {/* MY PROPERTY */}
          {activeTab === "My Property" && (
            <section className="tenant-page">
              <div className="tenant-page-heading">
                <div>
                  <p className="tenant-eyebrow">RENTAL INFORMATION</p>
                  <p>
                    Your assigned property's details, rooms, lease,
                    and inventory.
                  </p>
                </div>
              </div>

              {loadingProperties ? (
                <div className="tenant-empty-state">
                  Loading your property...
                </div>
              ) : properties.length === 0 ? (
                <div className="tenant-empty-state">
                  <span className="tenant-empty-icon">⌂</span>
                  <h3>No property assigned yet</h3>
                  <p>
                    Your property details will appear here once your
                    landlord assigns a property to your account.
                  </p>
                </div>
              ) : (
                <div className="tenant-property-list">
                  {properties.map((property) => (
                    <article
                      className="tenant-property-card"
                      key={property._id}
                    >
                      <div className="tenant-section-heading">
                        <div>
                          <p className="tenant-eyebrow">YOUR PROPERTY</p>
                          <h3>{property.propertyName}</h3>
                          <p className="tenant-muted">
                            {property.address}, {property.city}
                            {property.pincode
                              ? ` — ${property.pincode}`
                              : ""}
                          </p>
                        </div>

                        <span className="tenant-property-status">
                          {property.status || "Not specified"}
                        </span>
                      </div>

                      <div className="tenant-detail-grid">
                        <div className="tenant-detail-item">
                          <span>Property type</span>
                          <strong>
                            {property.propertyType || "Not provided"}
                          </strong>
                        </div>

                        <div className="tenant-detail-item">
                          <span>Furnishing</span>
                          <strong>
                            {property.furnishingStatus || "Not specified"}
                          </strong>
                        </div>

                        <div className="tenant-detail-item">
                          <span>Monthly rent</span>
                          <strong>
                            {property.monthlyRent != null
                              ? `₹${Number(property.monthlyRent).toLocaleString("en-IN")}`
                              : "Not provided"}
                          </strong>
                        </div>

                        <div className="tenant-detail-item">
                          <span>Security deposit</span>
                          <strong>
                            {property.securityDeposit != null
                              ? `₹${Number(property.securityDeposit).toLocaleString("en-IN")}`
                              : "Not provided"}
                          </strong>
                        </div>
                      </div>

                      <div className="tenant-detail-section">
                        <h4>Rooms</h4>
                        <div className="tenant-detail-grid">
                          {[
                            ["Bedrooms", property.rooms?.bedrooms],
                            ["Bathrooms", property.rooms?.bathrooms],
                            ["Kitchens", property.rooms?.kitchens],
                            ["Living rooms", property.rooms?.livingRooms],
                            ["Other rooms", property.rooms?.otherRooms],
                          ].map(([label, value]) => (
                            <div className="tenant-detail-item" key={label}>
                              <span>{label}</span>
                              <strong>{value ?? "Not recorded"}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="tenant-detail-section">
                        <h4>Lease Information</h4>
                        <div className="tenant-detail-grid">
                          <div className="tenant-detail-item">
                            <span>Lease start</span>
                            <strong>
                              {property.leaseStartDate
                                ? new Date(
                                    property.leaseStartDate
                                  ).toLocaleDateString("en-IN")
                                : "Not provided"}
                            </strong>
                          </div>

                          <div className="tenant-detail-item">
                            <span>Lease end</span>
                            <strong>
                              {property.leaseEndDate
                                ? new Date(
                                    property.leaseEndDate
                                  ).toLocaleDateString("en-IN")
                                : "Not provided"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {property.description && (
                        <div className="tenant-detail-section">
                          <h4>Property Description</h4>
                          <p>{property.description}</p>
                        </div>
                      )}

                      <div className="tenant-detail-section">
                        <h4>Furniture and Inventory</h4>

                        {property.furniture?.length > 0 ? (
                          <div className="tenant-inventory-list">
                            {property.furniture.map((item, index) => (
                              <div
                                className="tenant-inventory-item"
                                key={item._id || `${item.name}-${index}`}
                              >
                                <div>
                                  <strong>{item.name}</strong>
                                  <p>
                                    Condition:{" "}
                                    {item.condition || "Not inspected"}
                                  </p>
                                  {item.notes && <p>Notes: {item.notes}</p>}
                                </div>
                                <span>Qty: {item.quantity ?? 1}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="tenant-muted">
                            No furniture or inventory items recorded.
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* INSPECTIONS / EVIDENCE */}
          {activeTab === "Evidence" && (
            <section className="tenant-page">
              <div className="tenant-page-heading">
                <div>
                  <p className="tenant-eyebrow">PROPERTY CONDITION</p>
                  <p>
                    Review recorded property conditions and compare
                    move-in and move-out records.
                  </p>
                </div>
              </div>

              {properties.length > 1 && (
                <div className="tenant-filter">
                  <label htmlFor="evidence-property">
                    Select property
                  </label>
                  <select
                    id="evidence-property"
                    value={selectedPropertyId}
                    onChange={(event) =>
                      setSelectedPropertyId(event.target.value)
                    }
                  >
                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.propertyName} — {property.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {inspectionError && (
                <div className="tenant-message tenant-error" role="alert">
                  {inspectionError}
                </div>
              )}

              {inspectionMessage && (
                <div
                  className="tenant-message tenant-success"
                  role="status"
                >
                  {inspectionMessage}
                </div>
              )}

              {loadingInspections ? (
                <div className="tenant-empty-state">
                  Loading inspection records...
                </div>
              ) : properties.length === 0 ? (
                <div className="tenant-empty-state">
                  No assigned property is available to show evidence.
                </div>
              ) : (
                <>
                  <article className="tenant-panel">
                    <div className="tenant-section-heading">
                      <div>
                        <p className="tenant-eyebrow">BASELINE RECORD</p>
                        <h3>Move-in Inspection</h3>
                      </div>
                    </div>
                    {renderInspectionRecord(
                      moveInInspection,
                      "Move-in"
                    )}
                  </article>

                  <article className="tenant-panel">
                    <div className="tenant-section-heading">
                      <div>
                        <p className="tenant-eyebrow">FINAL RECORD</p>
                        <h3>Move-out Inspection</h3>
                      </div>
                    </div>
                    {renderInspectionRecord(
                      moveOutInspection,
                      "Move-out"
                    )}
                  </article>

                  <article className="tenant-panel">
                    <div className="tenant-section-heading">
                      <div>
                        <p className="tenant-eyebrow">RECORD COMPARISON</p>
                        <h3>Condition Comparison</h3>
                      </div>
                    </div>

                    {!moveInInspection || !moveOutInspection ? (
                      <div className="tenant-empty-state compact">
                        A comparison will be available after both move-in
                        and move-out inspections have been recorded.
                      </div>
                    ) : comparisonRows.length === 0 ? (
                      <div className="tenant-empty-state compact">
                        No items were recorded for comparison.
                      </div>
                    ) : (
                      <div className="tenant-comparison-list">
                        {comparisonRows.map((row) => (
                          <article
                            className="tenant-item-card"
                            key={row.name.toLowerCase()}
                          >
                            <div className="tenant-section-heading">
                              <h4>{row.name}</h4>
                              <span
                                className={`tenant-status ${
                                  row.result === "Same recorded condition"
                                    ? "tenant-status-resolved"
                                    : row.result === "Condition differs"
                                      ? "tenant-status-pending"
                                      : "tenant-status-unknown"
                                }`}
                              >
                                {row.result}
                              </span>
                            </div>

                            <div className="tenant-comparison-columns">
                              <div>
                                <span>Move-in condition</span>
                                <strong>{row.before}</strong>
                                {row.beforeDescription && (
                                  <p>{row.beforeDescription}</p>
                                )}
                              </div>

                              <div>
                                <span>Move-out condition</span>
                                <strong>{row.after}</strong>
                                {row.afterDescription && (
                                  <p>{row.afterDescription}</p>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    <p className="tenant-help-text">
                      Comparisons show differences in recorded conditions.
                      They do not determine who caused damage or who is
                      responsible.
                    </p>
                  </article>
                </>
              )}
            </section>
          )}

          {/* REPORTS */}
          {activeTab === "Reports" && (
            <section className="tenant-page">
              <div className="tenant-page-heading">
                <div>
                  <p className="tenant-eyebrow">MAINTENANCE AND SUPPORT</p>
                  <p>
                    Submit property issues and track their progress.
                  </p>
                </div>
              </div>

              <article className="tenant-panel">
                <h3>Submit a Property Issue</h3>
                <p className="tenant-muted">
                  Describe the problem so your landlord can review it.
                </p>

                {loadingProperties ? (
                  <p>Loading your assigned property...</p>
                ) : properties.length === 0 ? (
                  <div className="tenant-empty-state compact">
                    You need an assigned property before submitting a report.
                  </div>
                ) : (
                  <form
                    className="tenant-report-form"
                    onSubmit={handleReportSubmit}
                  >
                    <div className="tenant-form-grid">
                      <div className="tenant-form-field full-width">
                        <label htmlFor="report-property">Property</label>
                        <select
                          id="report-property"
                          value={selectedPropertyId}
                          onChange={(event) =>
                            setSelectedPropertyId(event.target.value)
                          }
                          disabled={submitting}
                          required
                        >
                          {properties.map((property) => (
                            <option
                              key={property._id}
                              value={property._id}
                            >
                              {property.propertyName} — {property.city}
                            </option>
                          ))}
                        </select>
                        {selectedProperty && (
                          <p className="tenant-help-text">
                            {selectedProperty.address},{" "}
                            {selectedProperty.city}
                          </p>
                        )}
                      </div>

                      <div className="tenant-form-field">
                        <label htmlFor="report-title">Report title</label>
                        <input
                          id="report-title"
                          type="text"
                          value={title}
                          onChange={(event) =>
                            setTitle(event.target.value)
                          }
                          maxLength={100}
                          placeholder="e.g. Bathroom tap leaking"
                          required
                        />
                      </div>

                      <div className="tenant-form-field">
                        <label htmlFor="report-category">Category</label>
                        <select
                          id="report-category"
                          value={category}
                          onChange={(event) =>
                            setCategory(event.target.value)
                          }
                          required
                        >
                          <option value="Plumbing">Plumbing</option>
                          <option value="Electrical">Electrical</option>
                          <option value="Structural Damage">
                            Structural Damage
                          </option>
                          <option value="Cleaning">Cleaning</option>
                          <option value="Safety">Safety</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="tenant-form-field">
                        <label htmlFor="report-location">
                          Where is the problem?
                        </label>
                        <input
                          id="report-location"
                          type="text"
                          value={location}
                          onChange={(event) =>
                            setLocation(event.target.value)
                          }
                          maxLength={150}
                          placeholder="e.g. Bathroom, kitchen"
                        />
                      </div>

                      <div className="tenant-form-field">
                        <label htmlFor="report-priority">Priority</label>
                        <select
                          id="report-priority"
                          value={priority}
                          onChange={(event) =>
                            setPriority(event.target.value)
                          }
                          required
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>

                      <div className="tenant-form-field full-width">
                        <label htmlFor="report-description">
                          Describe the problem
                        </label>
                        <textarea
                          id="report-description"
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          maxLength={2000}
                          rows={5}
                          placeholder="Explain the problem and when you noticed it."
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="tenant-button tenant-button-primary"
                      disabled={submitting || loadingProperties}
                    >
                      {submitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </form>
                )}

                {success && (
                  <div
                    className="tenant-message tenant-success"
                    role="status"
                  >
                    <strong>{success}</strong>
                    {submittedReport && (
                      <p>
                        Report ID: {submittedReport._id}
                        <br />
                        Status: {submittedReport.status}
                      </p>
                    )}
                  </div>
                )}
              </article>

              <article className="tenant-panel">
                <div className="tenant-section-heading">
                  <div>
                    <p className="tenant-eyebrow">SUBMISSION HISTORY</p>
                    <h3>My Report History</h3>
                    <p className="tenant-muted">
                      Track the issues you have submitted and their current
                      status.
                    </p>
                  </div>
                </div>

                {loadingReports ? (
                  <p>Loading your reports...</p>
                ) : reportHistoryError ? (
                  <p className="tenant-error-text" role="alert">
                    {reportHistoryError}
                  </p>
                ) : reports.length === 0 ? (
                  <div className="tenant-empty-state compact">
                    <h4>No reports yet</h4>
                    <p>Your submitted property issues will appear here.</p>
                  </div>
                ) : (
                  <div className="tenant-report-list">
                    {reports.map((report) => (
                      <article
                        className="tenant-report-card"
                        key={report._id}
                      >
                        <div className="tenant-section-heading">
                          <div>
                            <h4>{report.title}</h4>
                            <p className="tenant-muted">
                              Submitted {formatDate(report.createdAt)}
                            </p>
                          </div>

                          <span
                            className={`tenant-status ${getReportStatusClass(
                              report.status
                            )}`}
                          >
                            {report.status || "Unknown"}
                          </span>
                        </div>

                        <div className="tenant-report-meta">
                          <p>
                            <strong>Category:</strong>{" "}
                            {report.category || "Not specified"}
                          </p>
                          <p>
                            <strong>Priority:</strong>{" "}
                            {report.priority || "Not specified"}
                          </p>
                          <p>
                            <strong>Property:</strong>{" "}
                            {report.property?.propertyName ||
                              "Rental property"}
                          </p>

                          {report.property?.address && (
                            <p>
                              <strong>Address:</strong>{" "}
                              {report.property.address}
                              {report.property.city
                                ? `, ${report.property.city}`
                                : ""}
                            </p>
                          )}

                          {report.location && (
                            <p>
                              <strong>Problem location:</strong>{" "}
                              {report.location}
                            </p>
                          )}
                        </div>

                        <div className="tenant-report-description">
                          <strong>Description</strong>
                          <p>{report.description}</p>
                        </div>

                        {report.resolutionNote && (
                          <div className="tenant-resolution-note">
                            <strong>Resolution note</strong>
                            <p>{report.resolutionNote}</p>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === "Final Handover" && <section className="tenant-page"><HandoverReports embedded title="Final Handover" /></section>}
        </main>

        <footer className="tenant-footer">
          <span>PropTrace</span>
          <span>Record. Compare. Trust.</span>
        </footer>
      </div>
    </div>
  );
}

export default TenantDashboard;
