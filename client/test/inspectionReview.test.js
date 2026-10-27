import test from "node:test";
import assert from "node:assert/strict";
import { canSubmitInspectionChangeRequest, getTenantReviewComments } from "../src/utils/inspectionReview.js";
import { getLandlordActivePage, landlordFooterNavigation, landlordNavigation } from "../src/utils/landlordNavigation.js";

test("change requests require a nonblank tenant comment", () => {
  assert.equal(canSubmitInspectionChangeRequest("  "), false);
  assert.equal(canSubmitInspectionChangeRequest("Kitchen tap still leaks"), true);
});

test("tenant feedback is recovered from persisted status history", () => {
  const notes = getTenantReviewComments({ statusHistory: [
    { role: "tenant", comment: "Earlier", createdAt: "2026-01-01T00:00:00Z" },
    { role: "landlord", comment: "Not tenant feedback", createdAt: "2026-01-02T00:00:00Z" },
    { role: "tenant", comment: "Latest", createdAt: "2026-01-03T00:00:00Z" },
  ] });
  assert.deepEqual(notes.map(({ comment }) => comment), ["Latest", "Earlier"]);
});

test("landlord navigation covers app sections and highlights property subroutes", () => {
  assert.deepEqual(landlordNavigation.map(([page]) => page), ["dashboard", "properties", "inviteTenant", "inspections", "reports", "finalHandover"]);
  assert.deepEqual(landlordFooterNavigation.map(([action]) => action), ["settings", "logout"]);
  assert.equal(getLandlordActivePage("addProperty"), "properties");
  assert.equal(getLandlordActivePage("propertyDetails"), "properties");
  assert.equal(getLandlordActivePage("inspections"), "inspections");
});
