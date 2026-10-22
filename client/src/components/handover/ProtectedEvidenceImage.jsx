import useProtectedEvidenceImage from "./useProtectedEvidenceImage";

function ProtectedEvidenceImage({ inspectionId, evidence, alt, className = "" }) {
  const { url, error } = useProtectedEvidenceImage(inspectionId, evidence?._id);
  if (error) return <div className={"evidence-image-placeholder " + className} role="status">{error}</div>;
  if (!url) return <div className={"evidence-image-placeholder " + className} aria-label="Loading evidence photo">Loading photo…</div>;
  return <img className={className} src={url} alt={alt || evidence?.caption || "Property evidence"} loading="lazy" />;
}

export default ProtectedEvidenceImage;
