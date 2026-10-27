
import { useCallback, useEffect, useState } from "react";
import API_URL from "../../services/api";
import BrandHeader from "../../components/BrandHeader";
import { selectAvailableProperty } from "../../utils/inspectionForm";

const today = new Date().toISOString().slice(0, 10);

const CONDITIONS = [
  "Not Inspected",
  "Excellent",
  "Good",
  "Fair",
  "Damaged",
];

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  const knownStatuses = ["draft", "inspection-in-progress", "submitted-for-review", "changes-requested", "awaiting-other-party", "agreed-approved", "awaiting-tenant-review", "awaiting-landlord-review", "finalized", "disputed", "submitted", "reviewed", "completed", "pending", "in-progress", "resolved", "acknowledged"];
  return knownStatuses.includes(normalized) ? `status-${normalized}` : "status-default";
}

function Inspections() {
  const [properties, setProperties] = useState([]);
  const [inspections, setInspections] = useState([]);

  const [propertyId, setPropertyId] = useState("");
  const [comparisonPropertyId, setComparisonPropertyId] = useState("");

  const [inspectionType, setInspectionType] = useState("Move-in");
  const [inspectionDate, setInspectionDate] = useState(today);

  const [items, setItems] = useState([
    {
      itemName: "Bedroom walls",
      condition: "Not Inspected",
      description: "",
    },
  ]);

  const [generalNotes, setGeneralNotes] = useState("");
  const [electricity, setElectricity] = useState("");
  const [water, setWater] = useState("");
  const [gas, setGas] = useState("");

  const [loading, setLoading] = useState(true);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingInspectionId, setUpdatingInspectionId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingInspectionId, setEditingInspectionId] = useState("");
  const [editingRevision, setEditingRevision] = useState(0);
  const [reviewingInspectionId, setReviewingInspectionId] = useState("");
  const [reviewComments, setReviewComments] = useState({});

  const token = localStorage.getItem("token");

  // Load properties and inspection records
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

      const [propertyResponse, inspectionResponse] = await Promise.all([
        fetch(`${API_URL}/properties`, { headers }),
        fetch(`${API_URL}/inspections`, { headers }),
      ]);
      const [propertyData, inspectionData] = await Promise.all([propertyResponse.json(), inspectionResponse.json()]);
      const failures = [];
      if (propertyResponse.ok) {
        const propertyList = Array.isArray(propertyData.properties) ? propertyData.properties : [];
        setProperties(propertyList);
        setPropertiesError("");
        setPropertyId((current) => selectAvailableProperty(propertyList, current));
        setComparisonPropertyId((current) => selectAvailableProperty(propertyList, current));
      } else {
        setProperties([]);
        setPropertiesError(propertyData.message || "Failed to load properties.");
        setPropertyId("");
        setComparisonPropertyId("");
      }
      setPropertiesLoading(false);
      if (inspectionResponse.ok) {
        setInspections(Array.isArray(inspectionData.inspections) ? inspectionData.inspections : []);
      } else {
        failures.push(inspectionData.message || "Failed to load inspections.");
      }
      if (failures.length) throw new Error(failures.join(" "));
    } catch (err) {
      setError(err.message || "Failed to load inspection information.");
    } finally {
      setLoading(false);
      setPropertiesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Update one inspection item in the form
  const updateItem = (index, field, value) => {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((previous) => [
      ...previous,
      {
        itemName: "",
        condition: "Not Inspected",
        description: "",
      },
    ]);
  };

  const removeItem = (index) => {
    setItems((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const resetForm = () => {
    setInspectionType("Move-in");
    setInspectionDate(today);
    setItems([
      {
        itemName: "Bedroom walls",
        condition: "Not Inspected",
        description: "",
      },
    ]);
    setGeneralNotes("");
    setElectricity("");
    setWater("");
    setGas("");
  };

  // Create a move-in or move-out inspection
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!propertyId) {
      setError("Please add a property before creating an inspection.");
      return;
    }

    const cleanedItems = items
      .filter((item) => item.itemName.trim())
      .map((item) => ({
        itemName: item.itemName.trim(),
        condition: item.condition,
        description: item.description.trim(),
        photos: item.photos || [],
      }));

    if (cleanedItems.length === 0) {
      setError("Please add at least one inspection item.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(editingInspectionId ? `${API_URL}/inspections/${editingInspectionId}` : `${API_URL}/inspections`, {
        method: editingInspectionId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          inspectionType,
          inspectionDate,
          items: cleanedItems,
          generalNotes,
          meterReadings: {
            electricity,
            water,
            gas,
          },
          ...(editingInspectionId ? { expectedRevision: editingRevision } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create inspection."
        );
      }

      setSuccess(editingInspectionId ? "Inspection updated successfully." : "Inspection created successfully.");
      setEditingInspectionId("");
      setEditingRevision(0);
      resetForm();
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  const addEvidence = async (index, files) => {
    const selected = Array.from(files || []);
    const photos = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setItems((current) => current.map((item, i) => i === index ? { ...item, photos: [...(item.photos || []), ...photos] } : item));
  };

  const editInspection = (inspection) => {
    setEditingInspectionId(inspection._id);
    setEditingRevision(inspection.revision || 0);
    setPropertyId(inspection.property?._id || inspection.property);
    setInspectionType(inspection.inspectionType);
    setInspectionDate(new Date(inspection.inspectionDate).toISOString().slice(0, 10));
    setItems((inspection.items || []).map((item) => ({ ...item, photos: item.photos || [] })));
    setGeneralNotes(inspection.generalNotes || "");
    setElectricity(inspection.meterReadings?.electricity || "");
    setWater(inspection.meterReadings?.water || "");
    setGas(inspection.meterReadings?.gas || "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Change the inspection status through the backend
  const handleStatusUpdate = async (inspectionId, nextStatus, comment = "") => {
    setError("");
    setSuccess("");
    setUpdatingInspectionId(inspectionId);

    try {
      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API_URL}/inspections/${inspectionId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus, comment, expectedRevision: inspections.find((inspection) => inspection._id === inspectionId)?.revision ?? 0 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update inspection status."
        );
      }

      await loadData();

      setSuccess(
        data.message || `Inspection status updated to ${nextStatus}.`
      );
    } catch (err) {
      setError(err.message || "Failed to update inspection status.");
    } finally {
      setUpdatingInspectionId("");
    }
  };

  const formatDate = (value) => {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleDateString("en-IN");
  };

  // Get inspection records for the selected comparison property
  const comparisonInspections = inspections.filter((inspection) => {
    const id = inspection.property?._id || inspection.property;

    return String(id) === String(comparisonPropertyId);
  });

  // Earliest move-in inspection becomes the baseline
  const moveInInspection = comparisonInspections
    .filter((inspection) => inspection.inspectionType === "Move-in")
    .sort(
      (a, b) =>
        new Date(a.inspectionDate) - new Date(b.inspectionDate)
    )[0];

  // Latest move-out inspection is used for comparison
  const moveOutInspection = comparisonInspections
    .filter((inspection) => inspection.inspectionType === "Move-out")
    .sort(
      (a, b) =>
        new Date(b.inspectionDate) - new Date(a.inspectionDate)
    )[0];

  // Match items by name, ignoring capitalisation and outer spaces
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

  const comparisonNames = Array.from(
    new Set([...moveInItems.keys(), ...moveOutItems.keys()])
  ).sort();

  const comparisonRows = comparisonNames.map((name) => {
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

  const comparisonProperty = properties.find(
    (property) => property._id === comparisonPropertyId
  );

  return (
    <div className="inspections-page">
      <BrandHeader />
      <main className="inspections-main">
        <section className="inspections-intro">
          <p className="inspections-eyebrow">
            PROPERTY MANAGEMENT
          </p>

          <h2>Inspections</h2>

          <p>
            Record property conditions, manage review statuses, and
            compare move-in and move-out inspection records.
          </p>
        </section>

        {error && (
          <div
            className="inspections-message inspections-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="inspections-message inspections-success"
            role="status"
          >
            {success}
          </div>
        )}

        {/* Inspection records heading */}
        <section className="inspections-toolbar">
          <div>
            <h3>Inspection Records</h3>
            <p>
              {inspections.length}{" "}
              {inspections.length === 1
                ? "inspection"
                : "inspections"}{" "}
              saved
            </p>
          </div>

          <div className="inspections-toolbar-actions"><button
            type="button"
            className="inspections-primary-button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setSuccess("");
            }}
          >
            {showForm ? "Close Form" : "+ New Inspection"}
          </button></div>
        </section>

        {/* Create Inspection Form */}
        {showForm && (
          <section className="inspections-form-card">
            <h3>{editingInspectionId ? "Edit Inspection" : "Create an Inspection"}</h3>

            <form onSubmit={handleSubmit}>
              <div className="inspections-form-grid">
                <div className="inspections-field">
                  <label htmlFor="inspection-property">
                    Property *
                  </label>

                  <select
                    id="inspection-property"
                    value={propertyId}
                    onChange={(event) =>
                      setPropertyId(event.target.value)
                    }
                    required
                    disabled={propertiesLoading || Boolean(propertiesError) || properties.length === 0}
                  >
                    <option value="">{propertiesLoading ? "Loading properties…" : propertiesError ? "Properties unavailable" : properties.length ? "Select a property" : "No properties available"}</option>

                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.propertyName} — {property.city}
                      </option>
                    ))}
                  </select>
                  {propertiesError && <p className="inspections-message inspections-error" role="alert">{propertiesError}</p>}
                  {!propertiesLoading && !propertiesError && properties.length === 0 && <p className="inspections-empty">Add a property before creating an inspection.</p>}
                </div>

                <div className="inspections-field">
                  <label htmlFor="inspection-type">
                    Inspection Type *
                  </label>

                  <select
                    id="inspection-type"
                    value={inspectionType}
                    onChange={(event) =>
                      setInspectionType(event.target.value)
                    }
                    required
                  >
                    <option value="Move-in">Move-in</option>
                    <option value="Move-out">Move-out</option>
                  </select>
                </div>

                <div className="inspections-field">
                  <label htmlFor="inspection-date">
                    Inspection Date *
                  </label>

                  <input
                    id="inspection-date"
                    type="date"
                    value={inspectionDate}
                    onChange={(event) =>
                      setInspectionDate(event.target.value)
                    }
                    required
                  />
                </div>
              </div>

              <h4 className="inspections-subheading">
                Room and Item Conditions
              </h4>

              {items.map((item, index) => (
                <div className="inspection-item-form" key={index}>
                  <div className="inspections-field">
                    <label htmlFor={`item-name-${index}`}>
                      Room or Item Name *
                    </label>

                    <input
                      id={`item-name-${index}`}
                      value={item.itemName}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "itemName",
                          event.target.value
                        )
                      }
                      placeholder="e.g. Bedroom walls, refrigerator"
                    />
                  </div>

                  <div className="inspections-field inspection-evidence-field">
                    <label htmlFor={`item-photos-${index}`}>Photo evidence</label>
                    <input id={`item-photos-${index}`} type="file" accept="image/*" multiple onChange={(event) => addEvidence(index, event.target.files)} />
                    {!!item.photos?.length && <div className="inspection-photo-grid">{item.photos.map((photo, photoIndex) => <img key={photoIndex} src={photo} alt={`${item.itemName || "Inspection item"} evidence ${photoIndex + 1}`} />)}</div>}
                  </div>

                  <div className="inspections-field">
                    <label htmlFor={`item-condition-${index}`}>
                      Condition
                    </label>

                    <select
                      id={`item-condition-${index}`}
                      value={item.condition}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "condition",
                          event.target.value
                        )
                      }
                    >
                      {CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inspections-field">
                    <label htmlFor={`item-description-${index}`}>
                      Observations
                    </label>

                    <textarea
                      id={`item-description-${index}`}
                      value={item.description}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                      rows={2}
                      placeholder="Describe visible condition or damage"
                    />
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      className="inspection-remove-button"
                      onClick={() => removeItem(index)}
                    >
                      Remove Item
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="inspections-add-item-button"
                onClick={addItem}
              >
                + Add Room or Item
              </button>

              <h4 className="inspections-subheading">
                Meter Readings
              </h4>

              <div className="inspections-form-grid">
                <div className="inspections-field">
                  <label htmlFor="electricity">
                    Electricity Reading
                  </label>

                  <input
                    id="electricity"
                    value={electricity}
                    onChange={(event) =>
                      setElectricity(event.target.value)
                    }
                    placeholder="Enter actual reading"
                  />
                </div>

                <div className="inspections-field">
                  <label htmlFor="water">
                    Water Reading
                  </label>

                  <input
                    id="water"
                    value={water}
                    onChange={(event) =>
                      setWater(event.target.value)
                    }
                    placeholder="Enter actual reading"
                  />
                </div>

                <div className="inspections-field">
                  <label htmlFor="gas">
                    Gas Reading
                  </label>

                  <input
                    id="gas"
                    value={gas}
                    onChange={(event) =>
                      setGas(event.target.value)
                    }
                    placeholder="Enter actual reading"
                  />
                </div>
              </div>

              <div className="inspections-field inspections-notes-field">
                <label htmlFor="general-notes">
                  General Notes
                </label>

                <textarea
                  id="general-notes"
                  value={generalNotes}
                  onChange={(event) =>
                    setGeneralNotes(event.target.value)
                  }
                  rows={4}
                  placeholder="Additional observations about the property..."
                />
              </div>

              <button
                type="submit"
                className="inspections-primary-button"
                disabled={
                  submitting || loading || properties.length === 0
                }
              >
                {submitting ? "Saving..." : editingInspectionId ? "Save Changes" : "Save Inspection"}
              </button>
            </form>
          </section>
        )}

        {/* Move-in / Move-out Comparison */}
        <section className="inspections-comparison-section">
          <div className="inspections-comparison-heading">
            <div>
              <h3>Move-in vs. Move-out Comparison</h3>
              <p>
                Compare recorded item conditions for the same property.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading inspection records...</p>
          ) : properties.length === 0 ? (
            <div className="inspections-empty">
              <h3>No properties available</h3>
              <p>
                Add a property before creating inspections or comparing
                property conditions.
              </p>
            </div>
          ) : (
            <>
              <div className="inspections-field inspections-comparison-property">
                <label htmlFor="comparison-property">
                  Choose Property
                </label>

                <select
                  id="comparison-property"
                  value={comparisonPropertyId}
                  onChange={(event) =>
                    setComparisonPropertyId(event.target.value)
                  }
                >
                  {properties.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.propertyName} — {property.city}
                    </option>
                  ))}
                </select>
              </div>

              {comparisonProperty && (
                <p className="inspections-comparison-address">
                  {comparisonProperty.address}
                  {comparisonProperty.city
                    ? `, ${comparisonProperty.city}`
                    : ""}
                </p>
              )}

              <div className="inspections-comparison-summaries">
                <article className="inspections-comparison-summary">
                  <span>Move-in baseline</span>
                  <strong>
                    {moveInInspection
                      ? formatDate(moveInInspection.inspectionDate)
                      : "Not recorded"}
                  </strong>
                  <p>
                    {moveInInspection
                      ? `${moveInInspection.items?.length || 0} items recorded`
                      : "Create a move-in inspection first."}
                  </p>
                </article>

                <article className="inspections-comparison-summary">
                  <span>Latest move-out</span>
                  <strong>
                    {moveOutInspection
                      ? formatDate(moveOutInspection.inspectionDate)
                      : "Not recorded"}
                  </strong>
                  <p>
                    {moveOutInspection
                      ? `${moveOutInspection.items?.length || 0} items recorded`
                      : "A move-out inspection is still needed."}
                  </p>
                </article>
              </div>

              {!moveInInspection || !moveOutInspection ? (
                <div className="inspections-comparison-empty">
                  <h4>Comparison not ready</h4>
                  <p>
                    You need both a move-in inspection and a move-out
                    inspection for this property. Once both records
                    exist, their recorded item conditions will appear
                    here.
                  </p>
                </div>
              ) : comparisonRows.length === 0 ? (
                <div className="inspections-comparison-empty">
                  <h4>No comparable items</h4>
                  <p>
                    Add room or item names to both inspection records
                    to compare their conditions.
                  </p>
                </div>
              ) : (
                <div className="inspections-comparison-table-wrapper">
                  <table className="inspections-comparison-table">
                    <thead>
                      <tr>
                        <th>Room or Item</th>
                        <th>Move-in</th>
                        <th>Move-out</th>
                        <th>Recorded Result</th>
                      </tr>
                    </thead>

                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.name.toLowerCase()}>
                          <td>
                            <strong>{row.name}</strong>
                          </td>

                          <td>
                            <span className="comparison-condition">
                              {row.before}
                            </span>
                            {row.beforeDescription && (
                              <p>{row.beforeDescription}</p>
                            )}
                          </td>

                          <td>
                            <span className="comparison-condition">
                              {row.after}
                            </span>
                            {row.afterDescription && (
                              <p>{row.afterDescription}</p>
                            )}
                          </td>

                          <td>
                            <span
                              className={`comparison-result ${
                                row.result === "Same recorded condition"
                                  ? "comparison-result-same"
                                  : row.result === "Condition differs"
                                  ? "comparison-result-different"
                                  : "comparison-result-missing"
                              }`}
                            >
                              {row.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="inspections-comparison-disclaimer">
                This comparison identifies differences in saved records
                only. It does not establish who caused damage or
                determine responsibility. Matching is based on item
                names and recorded condition labels.
              </p>
            </>
          )}
        </section>

        {/* All saved inspections */}
        <section className="inspections-list-section">
          <div className="inspections-list-heading">
            <h3>All Inspection Records</h3>
            <p>
              View inspection details and manage available status actions.
            </p>
          </div>

          {loading ? (
            <p>Loading inspection records...</p>
          ) : inspections.length === 0 ? (
            <div className="inspections-empty">
              <h3>No inspections yet</h3>
              <p>
                Create your first inspection to start recording
                property condition information.
              </p>
            </div>
          ) : (
            <div className="inspections-list">
              {inspections.map((inspection) => {
                const isUpdating =
                  updatingInspectionId === inspection._id;

                return (
                  <article
                    className="inspection-card"
                    key={inspection._id}
                  >
                    <div className="inspection-card-heading">
                      <div>
                        <h3>
                          {inspection.inspectionType} Inspection
                        </h3>

                        <p>
                          {inspection.property?.propertyName || "Property"}
                          {inspection.property?.city
                            ? ` — ${inspection.property.city}`
                            : ""}
                        </p>
                      </div>

                      <div className="inspection-status-actions">
                        <span className={`status-badge ${getStatusClass(inspection.status)}`}>
                          {inspection.status}
                        </span>

                        {inspection.status === "Draft" && (
                          <>
                          <button type="button" className="inspections-secondary-button" onClick={() => editInspection(inspection)}>Edit</button>
                          <button
                            type="button"
                            className="inspections-primary-button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleStatusUpdate(
                                inspection._id,
                                "Inspection in Progress"
                              )
                            }
                          >
                            {isUpdating
                              ? "Updating..."
                              : "Start Inspection"}
                          </button>
                          </>
                        )}

                        {inspection.status === "Inspection in Progress" && <><button type="button" className="inspections-secondary-button" onClick={() => editInspection(inspection)}>Edit</button><button type="button" className="inspections-primary-button" disabled={isUpdating} onClick={() => handleStatusUpdate(inspection._id, "Awaiting Tenant Review")}>Submit for tenant review</button></>}

                        {inspection.status === "Changes Requested" && <><button type="button" className="inspections-secondary-button" onClick={() => editInspection(inspection)}>Edit Requested Changes</button><button type="button" className="inspections-primary-button" disabled={isUpdating} onClick={() => handleStatusUpdate(inspection._id, "Inspection in Progress", "Requested changes have been addressed.")}>Resume Inspection</button></>}

                        {inspection.status === "Submitted for Review" && (
                          <button type="button" className="inspections-primary-button" disabled={isUpdating} onClick={() => handleStatusUpdate(inspection._id, "Awaiting Tenant Review")}>
                            Send to tenant review
                          </button>
                        )}

                        {inspection.status === "Awaiting Other Party" && (
                          <button
                            type="button"
                            className="inspections-primary-button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleStatusUpdate(
                                inspection._id,
                                "Agreed / Approved"
                              )
                            }
                          >
                            {isUpdating
                              ? "Updating..."
                              : "Approve & Finalize"}
                          </button>
                        )}

                        {inspection.status === "Awaiting Landlord Review" && (
                          <button type="button" className="inspections-primary-button" disabled={isUpdating} onClick={() => setReviewingInspectionId((current) => current === inspection._id ? "" : inspection._id)}>
                            {reviewingInspectionId === inspection._id ? "Close review" : "Review tenant response"}
                          </button>
                        )}
                      </div>
                    </div>

                    {inspection.status === "Awaiting Landlord Review" && reviewingInspectionId === inspection._id && (
                      <section className="inspection-review-panel" aria-label="Tenant review response">
                        <h4>Tenant review response</h4>
                        {(inspection.statusHistory || []).filter((entry) => entry.role === "tenant" && entry.comment).slice().reverse().map((entry, index) => (
                          <p key={`${entry._id || entry.createdAt}-${index}`}><strong>{entry.newStatus || "Tenant comment"}:</strong> {entry.comment}</p>
                        ))}
                        {(inspection.statusHistory || []).every((entry) => entry.role !== "tenant" || !entry.comment) && <p>The tenant confirmed the inspection. No additional note was provided.</p>}
                        <label htmlFor={`landlord-review-comment-${inspection._id}`}>Your response note</label>
                        <textarea id={`landlord-review-comment-${inspection._id}`} rows={3} value={reviewComments[inspection._id] || ""} onChange={(event) => setReviewComments((current) => ({ ...current, [inspection._id]: event.target.value }))} placeholder="Add an acknowledgment or explain the changes needed" />
                        <div className="inspection-review-actions">
                          <button type="button" className="inspections-primary-button" disabled={isUpdating || !reviewComments[inspection._id]?.trim()} onClick={() => handleStatusUpdate(inspection._id, "Agreed / Approved", reviewComments[inspection._id])}>Approve tenant review</button>
                        </div>
                      </section>
                    )}

                    <div className="inspection-card-details">
                      <p>
                        <strong>Date:</strong>{" "}
                        {formatDate(inspection.inspectionDate)}
                      </p>

                      <p>
                        <strong>Rooms and items recorded:</strong>{" "}
                        {inspection.items?.length || 0}
                      </p>

                      {inspection.tenant?.name && (
                        <p>
                          <strong>Tenant:</strong>{" "}
                          {inspection.tenant.name}
                        </p>
                      )}
                    </div>

                    {inspection.items?.length > 0 && (
                      <div className="inspection-recorded-items">
                        {inspection.items.map((item, index) => (
                          <div
                            className="inspection-recorded-item"
                            key={
                              item._id ||
                              `${item.itemName}-${index}`
                            }
                          >
                            <strong>{item.itemName}</strong>
                            <span>{item.condition}</span>

                            {item.description && (
                              <p>{item.description}</p>
                            )}
                            {!!item.photos?.length && <div className="inspection-photo-grid">{item.photos.map((photo, photoIndex) => <img key={photoIndex} src={photo} alt={`${item.itemName} evidence ${photoIndex + 1}`} />)}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {!!inspection.activity?.length && <details className="inspection-activity"><summary>Activity history ({inspection.activity.length})</summary>{inspection.activity.slice().reverse().map((entry, index) => <p key={`${entry._id || entry.createdAt}-${index}`}><strong>{entry.action}</strong> · {entry.role} · {formatDate(entry.createdAt)}{entry.note ? ` — ${entry.note}` : ""}</p>)}</details>}

                    {inspection.generalNotes && (
                      <p className="inspection-general-notes">
                        <strong>Notes:</strong>{" "}
                        {inspection.generalNotes}
                      </p>
                    )}

                    {inspection.meterReadings && (
                      <div className="inspection-card-details">
                        {inspection.meterReadings.electricity && (
                          <p>
                            <strong>Electricity:</strong>{" "}
                            {inspection.meterReadings.electricity}
                          </p>
                        )}

                        {inspection.meterReadings.water && (
                          <p>
                            <strong>Water:</strong>{" "}
                            {inspection.meterReadings.water}
                          </p>
                        )}

                        {inspection.meterReadings.gas && (
                          <p>
                            <strong>Gas:</strong>{" "}
                            {inspection.meterReadings.gas}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Inspections;
