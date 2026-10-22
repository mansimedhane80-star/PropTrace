import { useState } from "react";
import API_URL from "../../services/api";
import ProtectedEvidenceImage from "./ProtectedEvidenceImage";
import useProtectedEvidenceImage from "./useProtectedEvidenceImage";

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("This file is not a readable image."));
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function postEvidence(inspectionId, token, payload, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", API_URL + "/inspections/" + inspectionId + "/evidence");
    request.setRequestHeader("Authorization", "Bearer " + token);
    request.setRequestHeader("Content-Type", "application/json");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let data = {};
      try { data = JSON.parse(request.responseText); } catch { /* The API may return an empty error body. */ }
      if (request.status >= 200 && request.status < 300) resolve(data);
      else reject(new Error(data.message || "Photo upload failed."));
    };
    request.onerror = () => reject(new Error("Network error while uploading the photo."));
    request.send(JSON.stringify(payload));
  });
}

function EvidenceCard({ inspectionId, evidence, canDelete, onDelete }) {
  const [large, setLarge] = useState(false);
  const { url } = useProtectedEvidenceImage(inspectionId, evidence._id);
  const uploader = evidence.uploadedBy?.name || "Project participant";
  return (
    <article className="handover-evidence-card">
      <button className="handover-evidence-preview" type="button" onClick={() => setLarge(true)} aria-label={"View full-size " + (evidence.caption || evidence.location) + " photo"}>
        <ProtectedEvidenceImage inspectionId={inspectionId} evidence={evidence} alt={evidence.caption || evidence.location} />
      </button>
      <div className="handover-evidence-meta">
        <span className={"handover-photo-kind kind-" + String(evidence.classification || "General").toLowerCase()}>{evidence.classification || "General"}</span>
        <strong>{evidence.itemName || evidence.location}</strong>
        <span>{evidence.location}{evidence.itemName ? " · " + evidence.itemName : ""}</span>
        <p>{evidence.caption || "No caption provided."}</p>
        <small>Uploaded by {uploader} · {evidence.uploadedAt ? new Date(evidence.uploadedAt).toLocaleString() : "Date unavailable"}</small>
        {canDelete && <button type="button" className="handover-button handover-button-warning" onClick={() => onDelete(evidence)}>Remove photo</button>}
      </div>
      {large && url && <div className="handover-lightbox" role="dialog" aria-modal="true" aria-label="Full-size evidence photo" onClick={() => setLarge(false)}><button type="button" onClick={() => setLarge(false)} aria-label="Close full-size photo">×</button><img src={url} alt={evidence.caption || evidence.location} /></div>}
    </article>
  );
}

function EvidenceGallery({ inspection, onUpdated, readOnly = false }) {
  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState("");
  const [itemName, setItemName] = useState("");
  const [classification, setClassification] = useState("General");
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const evidence = inspection.evidence || [];
  const grouped = evidence.reduce((groups, photo) => {
    const key = photo.location || "Location not provided";
    (groups[key] ||= []).push(photo);
    return groups;
  }, {});

  const removeEvidence = async (photo) => {
    if (!window.confirm("Remove this photo from the working report?")) return;
    setError(""); setMessage(""); setDeletingId(photo._id);
    try {
      const response = await fetch(API_URL + "/inspections/" + inspection._id + "/evidence/" + photo._id, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ expectedRevision: inspection.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not remove the photo.");
      setMessage(data.message || "Photo removed.");
      onUpdated?.();
    } catch (removeError) { setError(removeError.message || "Could not remove the photo."); }
    finally { setDeletingId(""); }
  };

  const upload = async () => {
    if (!files.length) { setError("Choose one or more images first."); return; }
    if (!location.trim()) { setError("Enter a room or location for these photos."); return; }
    const token = localStorage.getItem("token");
    if (!token) { setError("Please sign in again."); return; }
    setError(""); setMessage(""); setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
        const data = await compressPhoto(file);
        await postEvidence(inspection._id, token, { data, contentType: "image/jpeg", originalName: file.name, location: location.trim(), itemName: itemName.trim(), classification, caption: caption.trim() }, setProgress);
      }
      setMessage(files.length + (files.length === 1 ? " photo saved." : " photos saved."));
      setFiles([]);
      setCaption("");
      setProgress(100);
      onUpdated?.();
    } catch (uploadError) {
      setError(uploadError.message || "Photo upload failed. Select the remaining photos and retry.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="handover-evidence-section">
      <div className="handover-section-heading"><div><h3>Photo evidence</h3><p>{evidence.length} saved photo{evidence.length === 1 ? "" : "s"} · uploaded files are private to this property</p></div></div>
      {!readOnly && inspection.status !== "Finalized" && (
        <div className="handover-upload-panel">
          <label className="handover-field">Photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
          <label className="handover-field">Room or location<input value={location} maxLength={150} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Kitchen" /></label>
          <label className="handover-field">Item or defect<input value={itemName} maxLength={150} onChange={(event) => setItemName(event.target.value)} placeholder="Optional, e.g. sink" /></label>
          <label className="handover-field">Evidence type<select value={classification} onChange={(event) => setClassification(event.target.value)}><option>General</option><option>Before</option><option>After</option></select></label>
          <label className="handover-field handover-field-wide">Caption<input value={caption} maxLength={300} onChange={(event) => setCaption(event.target.value)} placeholder="Describe what this photo shows" /></label>
          {error && <p className="handover-error" role="alert">{error}</p>}
          {message && <p className="handover-success" role="status">{message}</p>}
          {uploading && <div className="handover-progress" role="status">Uploading… {progress}%<progress value={progress} max="100" /></div>}
          <button type="button" className="handover-button handover-button-primary" disabled={uploading || !files.length} onClick={upload}>{uploading ? "Uploading…" : "Upload evidence"}</button>
          {error && files.length > 0 && <button type="button" className="handover-button" disabled={uploading} onClick={upload}>Retry upload</button>}
        </div>
      )}
      {!evidence.length ? <div className="handover-empty">No photo evidence has been added to this inspection.</div> : Object.entries(grouped).map(([group, photos]) => (
        <div className="handover-evidence-group" key={group}><h4>{group}</h4><div className="handover-evidence-grid">{photos.map((photo) => <EvidenceCard key={photo._id} inspectionId={inspection._id} evidence={photo} canDelete={inspection.status !== "Finalized" && (user?.role === "landlord" || String(photo.uploadedBy?._id || photo.uploadedBy) === String(user?._id || user?.id)) && deletingId !== photo._id} onDelete={removeEvidence} />)}</div></div>
      ))}
    </section>
  );
}

export default EvidenceGallery;
