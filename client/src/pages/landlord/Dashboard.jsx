
import { useEffect, useState } from "react";
import API_URL from "../../services/api";
import { dashboardSummaryActions } from "../../utils/dashboardSummary";

function getInitials(name, email) {
  const source = String(name || email || "").trim();
  const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function Dashboard({
  user,
  onProfile,
  onReports,
  onInviteTenant,
  onProperties,
  onAddProperty,
  onInspections,
}) {
  const [summary, setSummary] = useState({
    properties: null,
    tenants: null,
    inspections: 0,
    reports: null,
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [summaryError, setSummaryError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        if (!token) {
          throw new Error("Please log in again.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          propertyResponse,
          tenantResponse,
          reportResponse,
          inspectionResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/properties`, { headers }),
          fetch(`${API_URL}/properties/tenants`, { headers }),
          fetch(`${API_URL}/reports/landlord`, { headers }),
          fetch(`${API_URL}/inspections`, { headers }),
        ]);

        const [
          propertyData,
          tenantData,
          reportData,
          inspectionData,
        ] = await Promise.all([
          propertyResponse.json(),
          tenantResponse.json(),
          reportResponse.json(),
          inspectionResponse.json(),
        ]);

        if (!propertyResponse.ok) {
          throw new Error(
            propertyData.message || "Failed to load properties."
          );
        }

        if (!tenantResponse.ok) {
          throw new Error(
            tenantData.message || "Failed to load tenants."
          );
        }

        if (!reportResponse.ok) {
          throw new Error(
            reportData.message || "Failed to load reports."
          );
        }
        if (!inspectionResponse.ok) throw new Error(inspectionData.message || "Failed to load inspections.");

        const properties = propertyData.properties || [];
        const tenants = tenantData.tenants || [];
        const reports = reportData.reports || [];
        const inspections = inspectionData.inspections || [];

        const openReports = reports.filter(
          (report) =>
            String(report.status || "").toLowerCase() !== "resolved"
        ).length;

        const activities = [
          ...properties.map((property) => ({
            id: `property-${property._id}`,
            title: "Property registered",
            description: property.propertyName || "New property",
            date: property.createdAt,
            icon: "🏠",
          })),

          ...reports.map((report) => ({
            id: `report-${report._id}`,
            title: "Tenant report submitted",
            description: report.title || "New tenant report",
            date: report.createdAt,
            icon: "📄",
          })),
          ...inspections.map((inspection) => ({
            id: `inspection-${inspection._id}`,
            title: `Inspection ${inspection.status || "updated"}`,
            description: inspection.property?.propertyName || inspection.inspectionType || "Inspection",
            date: inspection.updatedAt || inspection.createdAt,
            icon: "📋",
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.date || 0).getTime() -
              new Date(a.date || 0).getTime()
          )
          .slice(0, 5);

        if (!cancelled) {
          setSummary({
            properties: properties.length,
            tenants:
              typeof tenantData.count === "number"
                ? tenantData.count
                : tenants.length,
            inspections: Math.max(0, (inspectionData.count ?? inspections.length) - (inspectionData.summary?.finalized || 0)),
            reports: openReports,
          });

          setRecentActivities(activities);
          setSummaryError("");
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryError(error.message || "Unable to load dashboard.");
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleKeyboardClick = (event, callback) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback?.();
    }
  };

  const summaryActionHandlers = { properties: onProperties, inviteTenant: onInviteTenant, inspections: onInspections, reports: onReports };
  const summaryItems = [
    {
      title: "Total Properties",
      value: summary.properties,
      icon: "🏠",
      color: "blue",
      onClick: summaryActionHandlers[dashboardSummaryActions["Total Properties"]],
    },
    {
      title: "Active Tenants",
      value: summary.tenants,
      icon: "👥",
      color: "green",
      onClick: summaryActionHandlers[dashboardSummaryActions["Active Tenants"]],
    },
    {
      title: "Pending Inspections",
      value: summary.inspections,
      icon: "📋",
      color: "purple",
      onClick: summaryActionHandlers[dashboardSummaryActions["Pending Inspections"]],
    },
    {
      title: "Open Reports",
      value: summary.reports,
      icon: "📄",
      color: "amber",
      onClick: summaryActionHandlers[dashboardSummaryActions["Open Reports"]],
    },
  ];

  return (
    <div className="dashboard-page">


      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-label">LANDLORD DASHBOARD</p>

            <h1>
              Welcome back, {user?.name || "there"} 👋
            </h1>

            <p>
              Here's your rental management overview.
            </p>
          </div>

          <div
            className="profile-circle"
            role="button"
            tabIndex={0}
            title="View Profile"
            aria-label="View profile"
            onClick={() => onProfile?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onProfile)
            }
          >
            {getInitials(user?.name, user?.email)}
          </div>
        </header>

        {summaryError && (
          <div className="dashboard-summary-error" role="alert">
            {summaryError}
          </div>
        )}

        <section className="dashboard-summary">
          {summaryItems.map((item) => (
            <button
              type="button"
              className={`dashboard-summary-item summary-${item.color}`}
              key={item.title}
              onClick={item.onClick}
              aria-label={`${item.title}: ${item.value === null ? "loading" : item.value}`}
            >
              <div className="summary-item-top">
                <span>{item.title}</span>
                <span className="summary-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              </div>

              <strong>
                {item.value === null ? "…" : item.value}
              </strong>
            </button>
          ))}
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <h2>Add Property</h2>
              <p>
                Start recording a property and its rental details.
              </p>
            </div>
          </div>

          <div className="empty-property-card">
            <div className="empty-house-icon" aria-hidden="true">
              🏠
            </div>

            <h3>Bring your property into PropTrace</h3>

            <p>
              Record property details, rooms, furniture, and other
              information for a clear rental handover.
            </p>

            <button
              type="button"
              className="empty-add-button"
              onClick={() => onAddProperty?.()}
            >
              <span aria-hidden="true">＋</span> Add Property
            </button>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>
                Your latest property registrations and tenant reports.
              </p>
            </div>
          </div>

          <div className="dashboard-recent-activity">
            {recentActivities.length === 0 ? (
              <div className="activity-card">
                <div className="activity-icon" aria-hidden="true">
                  ✓
                </div>

                <div>
                  <h3>You're all set!</h3>
                  <p>
                    Add a property or receive a tenant report to see
                    recent activity here.
                  </p>
                </div>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div className="activity-card" key={activity.id}>
                  <div className="activity-icon" aria-hidden="true">
                    {activity.icon}
                  </div>

                  <div className="activity-content">
                    <h3>{activity.title}</h3>
                    <p>{activity.description}</p>

                    <span className="dashboard-activity-date">
                      {activity.date
                        ? new Date(activity.date).toLocaleString()
                        : "Date unavailable"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
