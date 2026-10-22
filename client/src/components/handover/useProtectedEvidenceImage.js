import { useEffect, useState } from "react";
import API_URL from "../../services/api";

export default function useProtectedEvidenceImage(inspectionId, evidenceId) {
  const [result, setResult] = useState({ id: "", url: "", error: "" });
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const token = localStorage.getItem("token");
    if (!inspectionId || !evidenceId || !token) return undefined;
    fetch(API_URL + "/inspections/" + inspectionId + "/evidence/" + evidenceId, {
      headers: { Authorization: "Bearer " + token },
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not load photo");
      }
      return response.blob();
    }).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setResult({ id: evidenceId, url: objectUrl, error: "" });
    }).catch((loadError) => {
      if (active) setResult({ id: evidenceId, url: "", error: loadError.message || "Could not load photo" });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, evidenceId]);
  if (!localStorage.getItem("token")) return { url: "", error: "Please sign in to view this photo." };
  return result.id === evidenceId ? { url: result.url, error: result.error } : { url: "", error: "" };
}
