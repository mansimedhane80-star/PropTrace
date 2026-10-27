import test from "node:test";
import assert from "node:assert/strict";
import { buildFurniturePayload, shouldShowFurniture } from "../src/utils/propertyForm.js";
import { dashboardSummaryActions } from "../src/utils/dashboardSummary.js";
import { selectAvailableProperty } from "../src/utils/inspectionForm.js";
import { getHandoverReportDocument } from "../src/utils/handoverReport.js";

test("furniture fields only apply to furnished properties and stale values are dropped", () => {
  const inventory = [{ name: " Sofa ", quantity: "2" }, { name: "", quantity: "1" }];
  assert.equal(shouldShowFurniture("Unfurnished"), false);
  assert.equal(shouldShowFurniture("Partially Furnished"), true);
  assert.deepEqual(buildFurniturePayload("Unfurnished", inventory), []);
  assert.deepEqual(buildFurniturePayload("Fully Furnished", inventory), [{ name: "Sofa", quantity: 2 }]);
});

test("dashboard summary cards target existing dashboard sections", () => {
  assert.deepEqual(dashboardSummaryActions, {
    "Total Properties": "properties",
    "Active Tenants": "inviteTenant",
    "Pending Inspections": "inspections",
    "Open Reports": "reports",
  });
});

test("inspection selector keeps a valid choice or selects the first owned property", () => {
  const properties = [{ _id: "owned-a" }, { _id: "owned-b" }];
  assert.equal(selectAvailableProperty(properties, "owned-b"), "owned-b");
  assert.equal(selectAvailableProperty(properties, "missing"), "owned-a");
  assert.equal(selectAvailableProperty([], "owned-b"), "");
});

test("finalized handover document uses immutable snapshot fields", () => {
  const inspection = {
    _id: "report-id",
    status: "Finalized",
    property: { propertyName: "Renamed live property" },
    finalReportVersions: [{ version: 1, status: "Finalized", property: { propertyName: "Snapshot property", furniture: [{ name: "Desk" }] }, items: [{ itemName: "Walls" }], finalizedAt: "2026-01-01" }],
  };
  const report = getHandoverReportDocument(inspection);
  assert.equal(report._id, "report-id");
  assert.equal(report.property.propertyName, "Snapshot property");
  assert.equal(report.property.furniture[0].name, "Desk");
  assert.equal(report.items[0].itemName, "Walls");
});
