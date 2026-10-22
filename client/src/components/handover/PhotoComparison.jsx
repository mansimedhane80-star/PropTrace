import { useMemo, useState } from "react";
import API_URL from "../../services/api";
import useProtectedEvidenceImage from "./useProtectedEvidenceImage";

function ComparisonSlider({ inspectionId, before, after }) {
  const [position, setPosition] = useState(50);
  const beforeImage = useProtectedEvidenceImage(inspectionId, before?._id);
  const afterImage = useProtectedEvidenceImage(inspectionId, after?._id);
  if (!before || !after) return <div className="handover-empty">A matching Before or After photo has not been provided.</div>;
  return (
    <div className="handover-slider-wrap">
      <div className="handover-photo-slider" aria-label="Before and after photo comparison">
        {beforeImage.url && <img className="handover-slider-before" src={beforeImage.url} alt={"Before: " + (before.caption || before.location)} />}
        {afterImage.url && <img className="handover-slider-after" src={afterImage.url} alt={"After: " + (after.caption || after.location)} style={{ clipPath: "inset(0 " + (100 - position) + "% 0 0)" }} />}
        <span className="handover-slider-label handover-slider-label-before">Before</span>
        <span className="handover-slider-label handover-slider-label-after">After</span>
      </div>
      <label className="handover-field handover-slider-control">Reveal after photo<input aria-label="Adjust before and after photo reveal" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label>
    </div>
  );
}

function PhotoComparison({ inspection, onUpdated }) {
  const evidence = useMemo(() => inspection.evidence || [], [inspection.evidence]);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [conditionBefore, setConditionBefore] = useState("");
  const [conditionAfter, setConditionAfter] = useState("");
  const [observedDifferences, setObservedDifferences] = useState("");
  const [comments, setComments] = useState("");
  const [outstandingConcerns, setOutstandingConcerns] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const beforeOptions = useMemo(() => evidence.filter((photo) => photo.classification === "Before"), [evidence]);
  const selectedBefore = beforeOptions.find((photo) => photo._id === beforeId);
  const afterOptions = useMemo(() => evidence.filter((photo) =>
    photo.classification === "After" &&
    (!selectedBefore || (photo.location.trim().toLowerCase() === selectedBefore.location.trim().toLowerCase() &&
      (photo.itemName || "").trim().toLowerCase() === (selectedBefore.itemName || "").trim().toLowerCase()))
  ), [evidence, selectedBefore]);
  const after = afterOptions.find((photo) => photo._id === afterId);

  const save = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!selectedBefore || !after) { setError("Select a matching Before and After photo."); return; }
    setSaving(true);
    try {
      const response = await fetch(API_URL + "/inspections/" + inspection._id + "/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({
          beforeEvidence: selectedBefore._id,
          afterEvidence: after._id,
          location: selectedBefore.location,
          itemName: selectedBefore.itemName || "",
          conditionBefore,
          conditionAfter,
          observedDifferences,
          comments,
          outstandingConcerns,
          expectedRevision: inspection.revision,
          ...(comparisonId ? { comparisonId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save this comparison.");
      setMessage(data.message || "Comparison saved.");
      setBeforeId(""); setAfterId(""); setConditionBefore(""); setConditionAfter(""); setObservedDifferences(""); setComments(""); setOutstandingConcerns(""); setComparisonId("");
      onUpdated?.();
    } catch (saveError) {
      setError(saveError.message || "Could not save this comparison.");
    } finally {
      setSaving(false);
    }
  };

  const findPhoto = (id) => evidence.find((photo) => String(photo._id) === String(id));
  const editComparison = (comparison) => {
    setComparisonId(comparison._id);
    setBeforeId(String(comparison.beforeEvidence));
    setAfterId(String(comparison.afterEvidence));
    setConditionBefore(comparison.conditionBefore || "");
    setConditionAfter(comparison.conditionAfter || "");
    setObservedDifferences(comparison.observedDifferences || "");
    setComments(comparison.comments || "");
    setOutstandingConcerns(comparison.outstandingConcerns || "");
    setError(""); setMessage("");
    document.querySelector(".handover-comparison-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="handover-comparison-section">
      <div className="handover-section-heading"><div><h3>Before and after comparison</h3><p>Photos are paired only when a user explicitly selects the same room and item.</p></div></div>
      {!inspection.comparisons?.length && <div className="handover-empty">{beforeOptions.length && !evidence.some((photo) => photo.classification === "After") ? "An After photo is missing; upload one to create a comparison." : "No comparisons have been saved for this inspection."}</div>}
      {(inspection.comparisons || []).map((comparison) => {
        const before = findPhoto(comparison.beforeEvidence);
        const afterPhoto = findPhoto(comparison.afterEvidence);
        return (
          <article className="handover-comparison-card" key={comparison._id}>
            <h4>{comparison.location}{comparison.itemName ? " · " + comparison.itemName : ""}</h4>
            <ComparisonSlider inspectionId={inspection._id} before={before} after={afterPhoto} />
            <div className="handover-comparison-pair">
              {[["Before", before], ["After", afterPhoto]].map(([label, photo]) => <div key={label}><strong>{label}</strong>{photo ? <><p>{photo.caption || "No caption provided."}</p><small>{photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleString() : "Date unavailable"}</small></> : <p>Matching photo not provided.</p>}</div>)}
            </div>
            <div className="handover-comparison-summary">
              <p><strong>Recorded condition:</strong> {comparison.conditionBefore || "Before condition not provided"} → {comparison.conditionAfter || "After condition not provided"}</p>
              <p><strong>Observed differences:</strong> {comparison.observedDifferences || "Not provided"}</p>
              <p><strong>Comments:</strong> {comparison.comments || "Not provided"}</p>
              <p><strong>Outstanding concerns:</strong> {comparison.outstandingConcerns || "None recorded"}</p>
              <p><strong>Evidence status:</strong> {before && afterPhoto ? "Before and after photos linked" : "A matching photo is missing"}</p>
              <small>A comparison records observations and does not establish cause or prove that a repair is complete.</small>
              {inspection.status !== "Finalized" && <button type="button" className="handover-button" onClick={() => editComparison(comparison)}>Correct this pairing or its notes</button>}
            </div>
          </article>
        );
      })}
      {inspection.status !== "Finalized" && (
        <form className="handover-comparison-form" onSubmit={save}>
          <h4>{comparisonId ? "Correct saved photo pair" : "Add a photo pair"}</h4>
          <div className="handover-form-grid">
            <label className="handover-field">Before photo<select required value={beforeId} onChange={(event) => { setBeforeId(event.target.value); setAfterId(""); }}><option value="">Choose a saved Before photo</option>{beforeOptions.map((photo) => <option key={photo._id} value={photo._id}>{photo.location}{photo.itemName ? " · " + photo.itemName : ""} — {photo.caption || "No caption"}</option>)}</select></label>
            <label className="handover-field">Matching After photo<select required value={afterId} onChange={(event) => setAfterId(event.target.value)}><option value="">Choose a matching After photo</option>{afterOptions.map((photo) => <option key={photo._id} value={photo._id}>{photo.location}{photo.itemName ? " · " + photo.itemName : ""} — {photo.caption || "No caption"}</option>)}</select>{selectedBefore && !afterOptions.length && <small>No After photo for this room and item. Upload a matching photo first.</small>}</label>
            <label className="handover-field">Condition before<input value={conditionBefore} onChange={(event) => setConditionBefore(event.target.value)} placeholder="Use the recorded condition, or leave blank" /></label>
            <label className="handover-field">Condition after<input value={conditionAfter} onChange={(event) => setConditionAfter(event.target.value)} placeholder="Use the recorded condition, or leave blank" /></label>
            <label className="handover-field handover-field-wide">Observed differences<textarea rows="3" maxLength={1500} value={observedDifferences} onChange={(event) => setObservedDifferences(event.target.value)} /></label>
            <label className="handover-field">Supporting comments<textarea rows="3" maxLength={1500} value={comments} onChange={(event) => setComments(event.target.value)} /></label>
            <label className="handover-field">Outstanding concerns<textarea rows="3" maxLength={1500} value={outstandingConcerns} onChange={(event) => setOutstandingConcerns(event.target.value)} /></label>
          </div>
          {error && <p className="handover-error" role="alert">{error}</p>}
          {message && <p className="handover-success" role="status">{message}</p>}
          <button className="handover-button handover-button-primary" disabled={saving || !beforeId || !afterId}>{saving ? "Saving…" : comparisonId ? "Save corrections" : "Save comparison"}</button>
          {comparisonId && <button type="button" className="handover-button" onClick={() => { setComparisonId(""); setBeforeId(""); setAfterId(""); }}>Cancel editing</button>}
        </form>
      )}
    </section>
  );
}

export default PhotoComparison;
