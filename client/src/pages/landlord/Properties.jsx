import { useCallback, useEffect, useState } from "react";
import API_URL from "../../services/api";
import Logo from "../../Logo";

const emptyForm = {
  propertyName: "",
  propertyType: "Apartment",
  address: "",
  city: "",
  pincode: "",
  description: "",
  bedrooms: "0",
  bathrooms: "0",
  kitchens: "0",
  livingRooms: "0",
  otherRooms: "0",
  furnishingStatus: "Unfurnished",
  monthlyRent: "",
  securityDeposit: "",
  leaseStartDate: "",
  leaseEndDate: "",
};

const emptyFurniture = {
  name: "",
  quantity: "1",
  condition: "Not Inspected",
  notes: "",
};

function getStatusClass(status) {
  const value = String(status || "").toLowerCase().trim();

  if (["available", "vacant"].includes(value)) return "available";
  if (["occupied", "rented"].includes(value)) return "occupied";
  if (value.includes("pending")) return "status-pending";
  if (value.includes("maintenance")) return "status-maintenance";
  if (["active", "completed", "resolved"].includes(value)) {
    return "status-active";
  }
  if (["rejected", "overdue", "inactive"].includes(value)) {
    return "status-danger";
  }

  return "status-default";
}

function formatDate(date) {
  if (!date) return "Not specified";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "Not specified";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount) {
  if (amount === null || amount === undefined || amount === "") {
    return "Not specified";
  }

  const number = Number(amount);

  if (!Number.isFinite(number)) return "Not specified";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

function PropertyDetail({ label, value }) {
  return (
    <div className="property-detail">
      <span>{label}</span>
      <strong>{value ?? "Not specified"}</strong>
    </div>
  );
}

function Properties({ onBack, onPropertyDetails, propertyId, mode = "list" }) {
  const addOnlyMode = mode === "add";
  const detailMode = Boolean(propertyId);
  const token = localStorage.getItem("token");

  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [furniture, setFurniture] = useState([{ ...emptyFurniture }]);
  const [loading, setLoading] = useState(!addOnlyMode);
  const [showForm, setShowForm] = useState(addOnlyMode);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/properties`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load properties.");
      }

      setProperties(data.properties || []);
    } catch (err) {
      setError(err.message || "Unable to load properties.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (addOnlyMode) return undefined;
    const timer = window.setTimeout(() => { void loadProperties(); }, 0);
    return () => window.clearTimeout(timer);
  }, [addOnlyMode, loadProperties]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleFurnitureChange(index, event) {
    const { name, value } = event.target;

    setFurniture((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item
      )
    );
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setFurniture([{ ...emptyFurniture }]);
    setEditingPropertyId(null);
  }

  function openNewForm() {
    resetForm();
    setError("");
    setSuccess("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setError("");
    setSuccess("");

    if (addOnlyMode) {
      onBack?.();
      return;
    }

    resetForm();
    setShowForm(false);
  }

  function addFurniture() {
    setFurniture((previous) => [
      ...previous,
      { ...emptyFurniture },
    ]);
  }

  function removeFurniture(index) {
    setFurniture((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function handleEdit(property) {
    const rooms = property.rooms || {};

    setForm({
      propertyName: property.propertyName || "",
      propertyType: property.propertyType || "Apartment",
      address: property.address || "",
      city: property.city || "",
      pincode: property.pincode || "",
      description: property.description || "",
      bedrooms: String(rooms.bedrooms ?? 0),
      bathrooms: String(rooms.bathrooms ?? 0),
      kitchens: String(rooms.kitchens ?? 0),
      livingRooms: String(rooms.livingRooms ?? 0),
      otherRooms: String(rooms.otherRooms ?? 0),
      furnishingStatus: property.furnishingStatus || "Unfurnished",
      monthlyRent: property.monthlyRent ?? "",
      securityDeposit: property.securityDeposit ?? "",
      leaseStartDate: property.leaseStartDate
        ? String(property.leaseStartDate).slice(0, 10)
        : "",
      leaseEndDate: property.leaseEndDate
        ? String(property.leaseEndDate).slice(0, 10)
        : "",
    });

    setFurniture(
      property.furniture?.length
        ? property.furniture.map((item) => ({
            name: item.name || "",
            quantity: String(item.quantity ?? 1),
            condition: item.condition || "Not Inspected",
            notes: item.notes || "",
          }))
        : [{ ...emptyFurniture }]
    );

    setEditingPropertyId(property._id);
    setShowForm(true);
    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (
      form.leaseStartDate &&
      form.leaseEndDate &&
      form.leaseEndDate < form.leaseStartDate
    ) {
      setError("Lease end date cannot be before lease start date.");
      return;
    }

    const inventory = furniture
      .filter((item) => item.name.trim())
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        quantity: Number(item.quantity),
      }));

    if (
      inventory.some(
        (item) =>
          !Number.isInteger(item.quantity) || item.quantity < 1
      )
    ) {
      setError("Furniture quantity must be a whole number of at least 1.");
      return;
    }

    const payload = {
      propertyName: form.propertyName.trim(),
      propertyType: form.propertyType,
      address: form.address.trim(),
      city: form.city.trim(),
      pincode: form.pincode.trim(),
      description: form.description.trim(),
      rooms: {
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        kitchens: Number(form.kitchens) || 0,
        livingRooms: Number(form.livingRooms) || 0,
        otherRooms: Number(form.otherRooms) || 0,
      },
      furnishingStatus: form.furnishingStatus,
      furniture: inventory,
      monthlyRent:
        form.monthlyRent === "" ? null : Number(form.monthlyRent),
      securityDeposit:
        form.securityDeposit === "" ? null : Number(form.securityDeposit),
      leaseStartDate: form.leaseStartDate || null,
      leaseEndDate: form.leaseEndDate || null,
    };

    try {
      setSaving(true);

      const isEditing = Boolean(editingPropertyId);
      const url = isEditing
        ? `${API_URL}/properties/${editingPropertyId}`
        : `${API_URL}/properties`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save property.");
      }

      if (isEditing) {
        setProperties((previous) =>
          previous.map((property) =>
            property._id === editingPropertyId
              ? {
                  ...property,
                  ...data.property,
                  tenant: data.property?.tenant ?? property.tenant,
                }
              : property
          )
        );

        resetForm();
        setShowForm(false);
        setSuccess("Property updated successfully.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (addOnlyMode) {
        onBack?.();
        return;
      }

      setProperties((previous) => [
        data.property,
        ...previous,
      ]);

      resetForm();
      setShowForm(false);
      setSuccess("Property added successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Unable to save property.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="properties-page">
      <header className="properties-brand-header">
        <Logo variant="compact" />
        <span className="brand-tagline">Record. Compare. Trust.</span>
      </header>

      <main className="properties-main">
        <section className="properties-intro">
          <p className="properties-eyebrow">PROPERTY MANAGEMENT</p>
          <h1>{addOnlyMode ? "Add a New Property" : detailMode ? "Property Details" : "My Properties"}</h1>
          <p>
            {addOnlyMode
              ? "Enter the details below to add a property to your portfolio."
              : detailMode
                ? "Review and update this property's information."
                : "Choose a property to view its complete details."}
          </p>
        </section>

        {!addOnlyMode && !detailMode && (
          <section className="properties-toolbar">
            <div>
              <h2>Your Properties</h2>
              <p>
                {properties.length}{" "}
                {properties.length === 1 ? "property" : "properties"} registered
              </p>
            </div>

            <button
              type="button"
              className="properties-primary-button"
              onClick={openNewForm}
            >
              + Add Property
            </button>
          </section>
        )}

        {error && (
          <div className="properties-alert properties-alert-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div
            className="properties-alert properties-alert-success"
            role="status"
          >
            {success}
          </div>
        )}

        {showForm && (
          <section className="properties-form-card">
            <div className="properties-form-heading">
              <div>
                <h2>
                  {editingPropertyId ? "Edit Property" : "Property Information"}
                </h2>
                <p>Complete the sections below to keep your records accurate.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <fieldset disabled={saving} className="properties-fieldset">
                <div className="properties-form-section">
                  <h3>01. Basic Information</h3>

                  <div className="properties-form-grid">
                    <label className="properties-field">
                      Property Name <span>*</span>
                      <input
                        name="propertyName"
                        value={form.propertyName}
                        onChange={handleChange}
                        placeholder="e.g. SaiSiddhi Apartment"
                        required
                      />
                    </label>

                    <label className="properties-field">
                      Property Type <span>*</span>
                      <select
                        name="propertyType"
                        value={form.propertyType}
                        onChange={handleChange}
                        required
                      >
                        <option value="Apartment">Apartment</option>
                        <option value="House">House</option>
                        <option value="Room">Room</option>
                        <option value="Office">Office</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <label className="properties-field properties-field-full">
                      Full Address <span>*</span>
                      <input
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        placeholder="House number, street, area"
                        required
                      />
                    </label>

                    <label className="properties-field">
                      City <span>*</span>
                      <input
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        placeholder="City"
                        required
                      />
                    </label>

                    <label className="properties-field">
                      PIN Code <span>*</span>
                      <input
                        name="pincode"
                        value={form.pincode}
                        onChange={handleChange}
                        placeholder="6-digit PIN code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        inputMode="numeric"
                        required
                      />
                    </label>

                    <label className="properties-field properties-field-full">
                      Description
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Additional information about this property"
                        rows={3}
                      />
                    </label>
                  </div>
                </div>

                <div className="properties-form-section">
                  <h3>02. Room Details</h3>
                  <p className="properties-section-description">
                    Enter the number of each room in this property.
                  </p>

                  <div className="properties-form-grid properties-room-grid">
                    {[
                      ["bedrooms", "Bedrooms"],
                      ["bathrooms", "Bathrooms"],
                      ["kitchens", "Kitchens"],
                      ["livingRooms", "Living Rooms"],
                      ["otherRooms", "Other Rooms"],
                    ].map(([name, label]) => (
                      <label className="properties-field" key={name}>
                        {label}
                        <input
                          type="number"
                          name={name}
                          value={form[name]}
                          onChange={handleChange}
                          min="0"
                          step="1"
                        />
                      </label>
                    ))}

                    <label className="properties-field">
                      Furnishing Status
                      <select
                        name="furnishingStatus"
                        value={form.furnishingStatus}
                        onChange={handleChange}
                      >
                        <option value="Unfurnished">Unfurnished</option>
                        <option value="Partially Furnished">
                          Partially Furnished
                        </option>
                        <option value="Fully Furnished">
                          Fully Furnished
                        </option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="properties-form-section">
                  <div className="properties-section-heading">
                    <div>
                      <h3>03. Furniture and Appliances</h3>
                      <p className="properties-section-description">
                        Record items, quantities, condition, and notes.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="properties-secondary-button"
                      onClick={addFurniture}
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="properties-furniture-list">
                    {furniture.map((item, index) => (
                      <div className="properties-furniture-row" key={index}>
                        <div className="properties-furniture-heading">
                          <strong>Inventory Item {index + 1}</strong>

                          {furniture.length > 1 && (
                            <button
                              type="button"
                              className="properties-remove-button"
                              onClick={() => removeFurniture(index)}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="properties-form-grid">
                          <label className="properties-field">
                            Item Name
                            <input
                              name="name"
                              value={item.name}
                              onChange={(event) =>
                                handleFurnitureChange(index, event)
                              }
                              placeholder="e.g. Sofa"
                            />
                          </label>

                          <label className="properties-field">
                            Quantity
                            <input
                              type="number"
                              name="quantity"
                              value={item.quantity}
                              onChange={(event) =>
                                handleFurnitureChange(index, event)
                              }
                              min="1"
                              step="1"
                            />
                          </label>

                          <label className="properties-field">
                            Condition
                            <select
                              name="condition"
                              value={item.condition}
                              onChange={(event) =>
                                handleFurnitureChange(index, event)
                              }
                            >
                              <option value="Not Inspected">Not Inspected</option>
                              <option value="Excellent">Excellent</option>
                              <option value="Good">Good</option>
                              <option value="Fair">Fair</option>
                              <option value="Damaged">Damaged</option>
                            </select>
                          </label>

                          <label className="properties-field properties-field-full">
                            Notes
                            <input
                              name="notes"
                              value={item.notes}
                              onChange={(event) =>
                                handleFurnitureChange(index, event)
                              }
                              placeholder="Optional notes"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="properties-form-section">
                  <h3>04. Rental and Lease Information</h3>

                  <div className="properties-form-grid">
                    <label className="properties-field">
                      Monthly Rent (₹)
                      <input
                        type="number"
                        name="monthlyRent"
                        value={form.monthlyRent}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="Monthly rent"
                      />
                    </label>

                    <label className="properties-field">
                      Security Deposit (₹)
                      <input
                        type="number"
                        name="securityDeposit"
                        value={form.securityDeposit}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="Security deposit"
                      />
                    </label>

                    <label className="properties-field">
                      Lease Start Date
                      <input
                        type="date"
                        name="leaseStartDate"
                        value={form.leaseStartDate}
                        onChange={handleChange}
                      />
                    </label>

                    <label className="properties-field">
                      Lease End Date
                      <input
                        type="date"
                        name="leaseEndDate"
                        value={form.leaseEndDate}
                        onChange={handleChange}
                        min={form.leaseStartDate || undefined}
                      />
                    </label>
                  </div>
                </div>
              </fieldset>

              <div className="properties-form-actions">
                <button
                  type="button"
                  className="properties-cancel-button"
                  onClick={cancelForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="properties-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingPropertyId
                      ? "Save Changes"
                      : "Save Property"}
                </button>
              </div>
            </form>
          </section>
        )}

        {!addOnlyMode && !showForm && (
          <section className="properties-list">
            {loading ? (
              <div className="properties-empty-state">Loading properties...</div>
            ) : error ? null : detailMode ? (
              (() => {
                const property = properties.find((item) => String(item._id) === String(propertyId));
                if (!property) {
                  return (
                    <div className="properties-empty-state">
                      <h3>Property not found</h3>
                      <p>This property may have been removed or the link may be incorrect.</p>
                    </div>
                  );
                }
                const rooms = property.rooms || {};
                const inventory = property.furniture || [];
                return (
                  <article className="property-card property-detail-page-card" key={property._id}>
                    <div className="property-card-header">
                      <div className="property-card-heading">
                        <p className="property-card-type">{property.propertyType || "Property"}</p>
                        <h2>{property.propertyName || "Unnamed Property"}</h2>
                        <p className="property-card-address">
                          {property.address}{property.city ? `, ${property.city}` : ""}{property.pincode ? ` - ${property.pincode}` : ""}
                        </p>
                      </div>
                      <span className={`property-status ${getStatusClass(property.status)}`}>{property.status || "Unknown"}</span>
                    </div>
                    {property.description && <p className="property-card-description">{property.description}</p>}

                    <section className="property-room-details">
                      <h4>Room Details</h4>
                      <div className="property-room-grid">
                        {[["Bedrooms", rooms.bedrooms], ["Bathrooms", rooms.bathrooms], ["Kitchens", rooms.kitchens], ["Living Rooms", rooms.livingRooms], ["Other Rooms", rooms.otherRooms]].map(([label, value]) => (
                          <div className="property-room-item" key={label}><span>{label}</span><strong>{value ?? 0}</strong></div>
                        ))}
                      </div>
                      <div className="property-furnishing"><span>Furnishing Status</span><strong>{property.furnishingStatus || "Not specified"}</strong></div>
                    </section>

                    <section className="property-information-section">
                      <h4>Rental Information</h4>
                      <div className="property-card-details">
                        <PropertyDetail label="Monthly Rent" value={formatMoney(property.monthlyRent)} />
                        <PropertyDetail label="Security Deposit" value={formatMoney(property.securityDeposit)} />
                      </div>
                    </section>

                    <section className="property-information-section">
                      <h4>Lease Information</h4>
                      <div className="property-card-lease">
                        <PropertyDetail label="Lease Starts" value={formatDate(property.leaseStartDate)} />
                        <PropertyDetail label="Lease Ends" value={formatDate(property.leaseEndDate)} />
                      </div>
                    </section>

                    <section className="property-information-section">
                      <div className="property-section-title-row"><h4>Furniture and Appliances</h4><span className="property-count">{inventory.length} {inventory.length === 1 ? "item" : "items"}</span></div>
                      {inventory.length === 0 ? <p className="property-muted-text">No inventory items recorded.</p> : (
                        <div className="property-inventory-list">
                          {inventory.map((item, index) => (
                            <div className="property-inventory-row" key={`${item.name}-${index}`}>
                              <div className="property-inventory-main"><strong>{item.name || "Unnamed item"}</strong><span>Quantity: {item.quantity ?? 1}</span></div>
                              <span className={`property-condition ${getStatusClass(item.condition)}`}>{item.condition || "Not Inspected"}</span>
                              {item.notes && <p className="property-inventory-notes">{item.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <div className="property-card-actions">
                      <button type="button" className="properties-secondary-button" onClick={() => handleEdit(property)}>Edit Property</button>
                    </div>
                  </article>
                );
              })()
            ) : properties.length === 0 ? (
              <div className="properties-empty-state">
                <h3>No properties yet</h3>
                <p>Add your first property to start managing your portfolio.</p>
                <button type="button" className="properties-primary-button" onClick={openNewForm}>+ Add Your First Property</button>
              </div>
            ) : (
              <div className="properties-cards property-name-cards">
                {properties.map((property) => (
                  <button
                    type="button"
                    className="property-name-card"
                    key={property._id}
                    onClick={() => onPropertyDetails?.(property._id)}
                  >
                    <span className="property-name-card-icon" aria-hidden="true">⌂</span>
                    <span className="property-name-card-text">
                      <strong>{property.propertyName || "Unnamed Property"}</strong>
                      <small>{property.propertyType || "Property"}</small>
                    </span>
                    <span className="property-name-card-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Properties;
