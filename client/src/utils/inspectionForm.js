export function selectAvailableProperty(properties, currentId = "") {
  if (!Array.isArray(properties)) return "";
  return properties.some((property) => String(property._id) === String(currentId))
    ? String(currentId)
    : String(properties[0]?._id || "");
}
