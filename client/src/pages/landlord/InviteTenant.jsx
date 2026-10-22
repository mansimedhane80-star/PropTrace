import { useCallback, useEffect, useState } from "react";
import API_URL from "../../services/api";
import BrandHeader from "../../components/BrandHeader";

function getNameInitials(name, email) {
  const source = String(name || email || "").trim();
  const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function InviteTenant({ initialPropertyId = "" }) {
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [invitations, setInvitations] = useState([]);

  // Open the invitation form immediately.
  const [showInviteForm, setShowInviteForm] = useState(true);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [tenantEmail, setTenantEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [editingTenantId, setEditingTenantId] = useState("");
  const [editingTenantName, setEditingTenantName] = useState("");
  const [savingTenantName, setSavingTenantName] = useState(false);

  const token = localStorage.getItem("token");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        throw new Error("Please log in again.");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [propertiesResponse, tenantsResponse, invitationsResponse] =
        await Promise.all([
          fetch(`${API_URL}/properties`, { headers }),
          fetch(`${API_URL}/properties/tenants`, { headers }),
          fetch(`${API_URL}/invitations/landlord`, { headers }),
        ]);

      const [propertiesData, tenantsData, invitationsData] =
        await Promise.all([
          propertiesResponse.json(),
          tenantsResponse.json(),
          invitationsResponse.json(),
        ]);

      if (!propertiesResponse.ok) {
        throw new Error(
          propertiesData.message || "Could not load properties."
        );
      }

      if (!tenantsResponse.ok) {
        throw new Error(
          tenantsData.message || "Could not load tenants."
        );
      }

      if (!invitationsResponse.ok) {
        throw new Error(
          invitationsData.message || "Could not load invitations."
        );
      }

      const propertyList = propertiesData.properties || [];
      const tenantList = tenantsData.tenants || [];
      const invitationList = invitationsData.invitations || [];

      setProperties(propertyList);
      setTenants(tenantList);
      setInvitations(invitationList);

      const availableProperties = propertyList.filter(
        (property) => property.status === "Available"
      );

      setPropertyId((currentId) => {
        if (
          availableProperties.some(
            (property) => property._id === currentId
          )
        ) {
          return currentId;
        }

        if (
          initialPropertyId &&
          availableProperties.some(
            (property) => property._id === initialPropertyId
          )
        ) {
          return initialPropertyId;
        }

        return availableProperties[0]?._id || "";
      });
    } catch (err) {
      setError(err.message || "Could not load tenant information.");
    } finally {
      setLoading(false);
    }
  }, [token, initialPropertyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const getInvitationStatus = (invitation) => {
    if (
      invitation.status === "Pending" &&
      invitation.expiresAt &&
      new Date(invitation.expiresAt) < new Date()
    ) {
      return "Expired";
    }

    return invitation.status || "Unknown";
  };

  const pendingInvitations = invitations.filter(
    (invitation) => getInvitationStatus(invitation) === "Pending"
  );

  const availableProperties = properties.filter(
    (property) => property.status === "Available"
  );

  const handleInvite = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setInvitationLink("");
    setCopyMessage("");

    if (!propertyId) {
      setError("Please select an available property.");
      return;
    }

    if (!tenantEmail.trim()) {
      setError("Please enter the tenant's email address.");
      return;
    }

    if (!token) {
      setError("Please log in again.");
      return;
    }

    try {
      setSending(true);

      const response = await fetch(
        `${API_URL}/invitations/${propertyId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenantEmail: tenantEmail.trim().toLowerCase(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not create the invitation."
        );
      }

      const inviteToken =
        data.invitation?.token ||
        data.token ||
        data.invitationToken;

      const link =
        data.invitationLink ||
        data.inviteLink ||
        data.link ||
        data.invitation?.link ||
        (inviteToken
          ? `${window.location.origin}/accept-invitation/${inviteToken}`
          : "");

      if (!link) {
        await loadData();

        throw new Error(
          "The invitation may have been created, but no invitation link was returned. Check the backend response before creating another invitation."
        );
      }

      setInvitationLink(link);
      setSuccess(
        data.message || "Invitation created successfully."
      );
      setTenantEmail("");

      await loadData();
    } catch (err) {
      setError(err.message || "Could not create the invitation.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopyMessage("Link copied! You can now send it to the tenant.");
    } catch {
      setCopyMessage(
        "Select the invitation link above and copy it manually."
      );
    }
  };

  const saveTenantName = async (event, tenantId) => {
    event.preventDefault(); setError(""); setSuccess("");
    if (!editingTenantName.trim()) { setError("Enter the tenant's real name."); return; }
    setSavingTenantName(true);
    try {
      const response = await fetch(`${API_URL}/properties/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editingTenantName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update tenant name.");
      setSuccess(data.message || "Tenant name updated.");
      setEditingTenantId("");
      await loadData();
    } catch (saveError) { setError(saveError.message || "Could not update tenant name."); }
    finally { setSavingTenantName(false); }
  };

  const formatDate = (date) => {
    if (!date) return "Not recorded";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not recorded";
    }

    return parsedDate.toLocaleString();
  };

  const getStatusClass = (status) => {
    const normalized = String(status || "").trim().toLowerCase();

    if (normalized === "accepted") return "status-accepted";
    if (normalized === "pending") return "status-pending";
    if (normalized === "expired") return "status-expired";
    if (normalized === "rejected") return "status-rejected";

    return "status-unknown";
  };

  return (
    <div className="invite-page">
      <BrandHeader />

      <main className="invite-main">
        <section className="invite-intro">
          <p className="invite-eyebrow">PROPERTY MANAGEMENT</p>
          <h2>Tenant Management</h2>
          <p>
            Invite tenants to your properties, view active tenants,
            and track invitation history in one place.
          </p>
        </section>

        {error && (
          <div className="invite-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="invite-success" role="status">
            {success}
          </div>
        )}

        <section className="tenant-management-stats">
          <article className="tenant-management-stat">
            <span>Active Tenants</span>
            <h3>{tenants.length}</h3>
          </article>

          <article className="tenant-management-stat">
            <span>Pending Invitations</span>
            <h3>{pendingInvitations.length}</h3>
          </article>

          <article className="tenant-management-stat">
            <span>Available Properties</span>
            <h3>{availableProperties.length}</h3>
          </article>
        </section>

        <section className="tenant-management-toolbar">
          <div>
            <h3>Your Tenants</h3>
            <p>View assigned tenants and their property details.</p>
          </div>

          <button
            type="button"
            className="invite-submit-button"
            onClick={() => {
              setShowInviteForm((current) => !current);
              setError("");
              setSuccess("");
            }}
          >
            {showInviteForm ? "Close Form" : "+ Invite Tenant"}
          </button>
        </section>

        {showInviteForm && (
          <section className="invite-card tenant-invite-form-card">
            <div className="invite-icon" aria-hidden="true">
              ✉️
            </div>

            <h3>Invite a Tenant</h3>

            <p className="invite-description">
              Select an available property and enter the tenant's email
              address to generate an invitation link.
            </p>

            {availableProperties.length === 0 ? (
              <div className="invite-empty">
                <h4>No available properties</h4>
                <p>
                  Add a property or change its status to Available
                  before sending an invitation.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <label htmlFor="invite-property">
                  Select Property
                </label>

                <select
                  id="invite-property"
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  required
                  disabled={sending}
                >
                  {availableProperties.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.propertyName} — {property.city}
                    </option>
                  ))}
                </select>

                <label htmlFor="invite-email">
                  Tenant Email
                </label>

                <input
                  id="invite-email"
                  type="email"
                  value={tenantEmail}
                  onChange={(event) => setTenantEmail(event.target.value)}
                  placeholder="tenant@example.com"
                  autoComplete="email"
                  required
                  disabled={sending}
                />

                <p className="invite-help">
                  The invitation link will appear here after it is
                  successfully created. Invitations currently have a
                  48-hour validity period according to your existing
                  implementation.
                </p>

                <button
                  type="submit"
                  className="invite-submit-button"
                  disabled={sending || loading || availableProperties.length === 0}
                >
                  {sending
                    ? "Creating Invitation..."
                    : "Generate Invitation Link"}
                </button>
              </form>
            )}

            {invitationLink && (
              <div className="invite-link-section">
                <h4>Invitation Link</h4>

                <p>
                  Share this link with the tenant so they can register
                  for the selected property.
                </p>

                <input
                  type="text"
                  value={invitationLink}
                  readOnly
                  aria-label="Generated invitation link"
                  onFocus={(event) => event.target.select()}
                />

                <button
                  type="button"
                  className="invite-copy-button"
                  onClick={copyLink}
                >
                  Copy Invitation Link
                </button>

                {copyMessage && (
                  <p role="status">{copyMessage}</p>
                )}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <p className="tenant-management-loading">
            Loading tenant information...
          </p>
        ) : (
          <>
            <section className="tenant-management-section">
              <h3>Active Tenants</h3>

              {tenants.length === 0 ? (
                <div className="tenant-management-empty">
                  <h4>No active tenants yet</h4>
                  <p>
                    When a tenant accepts an invitation and registers,
                    their information will appear here.
                  </p>
                </div>
              ) : (
                <div className="tenant-management-list">
                  {tenants.map((tenant, index) => (
                    <article
                      className="tenant-management-card"
                      key={`${tenant._id || tenant.email}-${tenant.propertyId || index}`}
                    >
                      <div className="tenant-management-avatar">
                        {getNameInitials(tenant.name, tenant.email)}
                      </div>

                      <div className="tenant-management-details">
                        <div className="tenant-management-card-heading">
                          <h4>{tenant.name || "Name not provided"}</h4>
                          <span className="tenant-management-badge status-active">
                            Active
                          </span>
                        </div>

                        <p>{tenant.email || "No email recorded"}</p>

                        <div className="tenant-management-property">
                          <strong>Property:</strong>{" "}
                          {tenant.propertyName || "Not recorded"}
                        </div>

                        <p>
                          {[tenant.address, tenant.city]
                            .filter(Boolean)
                            .join(", ") || "Address not recorded"}
                          {tenant.pincode ? ` — ${tenant.pincode}` : ""}
                        </p>

                        <p>
                          <strong>Property type:</strong>{" "}
                          {tenant.propertyType || "Not recorded"}
                        </p>

                        <p>
                          <strong>Property status:</strong>{" "}
                          {tenant.propertyStatus || "Not recorded"}
                        </p>
                        {editingTenantId === String(tenant._id) ? (
                          <form className="tenant-name-edit-form" onSubmit={(event) => saveTenantName(event, tenant._id)}>
                            <label>Tenant's real name<input autoFocus value={editingTenantName} maxLength={100} onChange={(event) => setEditingTenantName(event.target.value)} required /></label>
                            <div><button type="submit" disabled={savingTenantName}>{savingTenantName ? "Saving…" : "Save name"}</button><button type="button" onClick={() => setEditingTenantId("")} disabled={savingTenantName}>Cancel</button></div>
                          </form>
                        ) : (
                          <button type="button" className="tenant-name-edit-button" onClick={() => { setEditingTenantId(String(tenant._id)); setEditingTenantName(tenant.name || ""); }}>Edit tenant name</button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="tenant-management-section">
              <h3>Invitation History</h3>

              {invitations.length === 0 ? (
                <div className="tenant-management-empty">
                  <p>No invitations have been created yet.</p>
                </div>
              ) : (
                <div className="tenant-management-list">
                  {invitations.map((invitation) => {
                    const status = getInvitationStatus(invitation);

                    return (
                      <article
                        className="tenant-management-card"
                        key={invitation._id}
                      >
                        <div className="tenant-management-avatar">
                          ✉
                        </div>

                        <div className="tenant-management-details">
                          <div className="tenant-management-card-heading">
                            <h4>
                              {invitation.tenantEmail || "Unknown email"}
                            </h4>

                            <span
                              className={`tenant-management-badge ${getStatusClass(status)}`}
                            >
                              {status}
                            </span>
                          </div>

                          <p>
                            <strong>Property:</strong>{" "}
                            {invitation.property?.propertyName ||
                              "Property unavailable"}
                          </p>

                          <p>
                            <strong>Address:</strong>{" "}
                            {[invitation.property?.address, invitation.property?.city]
                              .filter(Boolean)
                              .join(", ") || "Not recorded"}
                          </p>

                          <p>
                            <strong>Created:</strong>{" "}
                            {formatDate(invitation.createdAt)}
                          </p>

                          <p>
                            <strong>Expires:</strong>{" "}
                            {formatDate(invitation.expiresAt)}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <button
          type="button"
          className="tenant-management-refresh"
          onClick={loadData}
          disabled={loading || sending}
        >
          {loading ? "Refreshing..." : "Refresh Tenant Information"}
        </button>
      </main>
    </div>
  );
}

export default InviteTenant;
