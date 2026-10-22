
import { useEffect, useState } from "react";
import API_URL from "../../services/api";
import Logo from "../../Logo";

function getInitials(name, email) {
  const source = String(name || email || "").trim();
  const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function Dashboard({
  user,
  onLogout,
  onProfile,
  onSettings,
  onReports,
  onInviteTenant,
  onProperties,
  onAddProperty,
  onInspections,
  onFinalHandover,
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
            inspections: inspections.filter((inspection) => !["Agreed / Approved", "Completed"].includes(inspection.status)).length,
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

  const summaryItems = [
    {
      title: "Total Properties",
      value: summary.properties,
      icon: "🏠",
      color: "blue",
    },
    {
      title: "Active Tenants",
      value: summary.tenants,
      icon: "👥",
      color: "green",
    },
    {
      title: "Pending Inspections",
      value: summary.inspections,
      icon: "📋",
      color: "purple",
    },
    {
      title: "Open Reports",
      value: summary.reports,
      icon: "📄",
      color: "amber",
    },
  ];

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo />
          <small className="sidebar-tagline">Record. Compare. Trust.</small>
          <span>Landlord</span>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <div className="nav-item active" aria-current="page">
            <span aria-hidden="true">▦</span>
            Dashboard
          </div>

          <div
            className="nav-item"
            role="button"
            tabIndex={0}
            onClick={() => onProperties?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onProperties)
            }
          >
            <span aria-hidden="true">🏠</span>
            Properties
          </div>

          <div
            className="nav-item"
            role="button"
            tabIndex={0}
            onClick={() => onInviteTenant?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onInviteTenant)
            }
          >
            <span aria-hidden="true">👥</span>
            Tenants
          </div>

          <div
            className="nav-item"
            role="button"
            tabIndex={0}
            onClick={() => onInspections?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onInspections)
            }
          >
            <span aria-hidden="true">📋</span>
            Inspections
          </div>

          
          <div
            className="nav-item"
            role="button"
            tabIndex={0}
            onClick={() => onReports?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onReports)
            }
          >
            <span aria-hidden="true">📄</span>
            Reports
          </div>
          <div
            className="nav-item nav-item-handover"
            role="button"
            tabIndex={0}
            onClick={() => onFinalHandover?.()}
            onKeyDown={(event) => handleKeyboardClick(event, onFinalHandover)}
          >
            <span aria-hidden="true">✦</span>
            Final Handover
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div
            className="nav-item"
            role="button"
            tabIndex={0}
            onClick={() => onSettings?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onSettings)
            }
          >
            <span aria-hidden="true">⚙️</span>
            Settings
          </div>

          <div
            className="nav-item logout-item"
            role="button"
            tabIndex={0}
            onClick={() => onLogout?.()}
            onKeyDown={(event) =>
              handleKeyboardClick(event, onLogout)
            }
          >
            <span aria-hidden="true">↪</span>
            Logout
          </div>
        </div>
      </aside>

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
            <div
              className={`dashboard-summary-item summary-${item.color}`}
              key={item.title}
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
            </div>
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
