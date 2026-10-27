export const landlordNavigation = [
  ["dashboard", "▦", "Dashboard"],
  ["properties", "🏠", "Properties"],
  ["inviteTenant", "👥", "Tenants"],
  ["inspections", "📋", "Inspections"],
  ["reports", "📄", "Reports"],
  ["finalHandover", "✦", "Final Handover Report"],
];

export const landlordFooterNavigation = [
  ["settings", "⚙️", "Settings"],
  ["logout", "↪", "Logout"],
];

export function getLandlordActivePage(page) {
  return page === "addProperty" || page === "propertyDetails" ? "properties" : page;
}
