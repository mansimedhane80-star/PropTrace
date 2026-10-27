export function shouldShowFurniture(furnishingStatus) {
  return furnishingStatus === "Partially Furnished" || furnishingStatus === "Fully Furnished";
}

export function buildFurniturePayload(furnishingStatus, furniture) {
  if (!shouldShowFurniture(furnishingStatus)) return [];
  return furniture.filter((item) => item.name.trim()).map((item) => ({
    ...item,
    name: item.name.trim(),
    quantity: Number(item.quantity),
  }));
}
