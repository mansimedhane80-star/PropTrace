const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWorkflowTransition, canRequestChanges } = require("../services/handoverWorkflow");
const { isAllowedMaintenanceTransition } = require("../services/maintenanceWorkflow");

test("landlord can start a draft inspection when responsible", () => {
  assert.deepEqual(validateWorkflowTransition("Draft", "Inspection in Progress", "landlord", "landlord"), { allowed: true });
});

test("tenant cannot submit landlord-owned inspection work", () => {
  assert.deepEqual(validateWorkflowTransition("Inspection in Progress", "Awaiting Tenant Review", "tenant", "landlord"), { allowed: false, reason: "not-responsible" });
});

test("tenant can acknowledge a review assigned to them", () => {
  assert.deepEqual(validateWorkflowTransition("Awaiting Tenant Review", "Awaiting Landlord Review", "tenant", "tenant"), { allowed: true });
});

test("landlord can act on a tenant-confirmed review after refresh", () => {
  assert.deepEqual(validateWorkflowTransition("Awaiting Landlord Review", "Agreed / Approved", "landlord", "landlord"), { allowed: true });
  assert.deepEqual(validateWorkflowTransition("Awaiting Landlord Review", "Agreed / Approved", "tenant", "landlord"), { allowed: false, reason: "not-responsible" });
});

test("handover approvals proceed tenant review then landlord approval before finalization", () => {
  assert.equal(validateWorkflowTransition("Inspection in Progress", "Awaiting Tenant Review", "landlord", "landlord").allowed, true);
  assert.equal(validateWorkflowTransition("Awaiting Tenant Review", "Awaiting Landlord Review", "tenant", "tenant").allowed, true);
  assert.equal(validateWorkflowTransition("Awaiting Landlord Review", "Agreed / Approved", "landlord", "landlord").allowed, true);
  assert.equal(validateWorkflowTransition("Agreed / Approved", "Finalized", "landlord", "landlord").allowed, false);
});

test("landlord can submit inspection directly to tenant review", () => {
  assert.deepEqual(validateWorkflowTransition("Inspection in Progress", "Awaiting Tenant Review", "landlord", "landlord"), { allowed: true });
});

test("legacy submitted reports can be routed into tenant review", () => {
  assert.deepEqual(validateWorkflowTransition("Submitted for Review", "Awaiting Tenant Review", "landlord", "landlord"), { allowed: true });
});

test("approval cannot skip the tenant review state", () => {
  assert.deepEqual(validateWorkflowTransition("Inspection in Progress", "Agreed / Approved", "landlord", "landlord"), { allowed: false, reason: "invalid-transition" });
});

test("the responsible tenant reviewer can request changes during tenant review", () => {
  assert.equal(canRequestChanges("Awaiting Tenant Review", "tenant", "tenant"), true);
});

test("a landlord preparing an inspection cannot request changes from themselves", () => {
  assert.equal(canRequestChanges("Inspection in Progress", "landlord", "landlord"), false);
});

test("a participant who is not the responsible reviewer cannot request changes", () => {
  assert.equal(canRequestChanges("Awaiting Tenant Review", "landlord", "tenant"), false);
});

test("changes cannot be requested from a draft or disputed report", () => {
  assert.equal(canRequestChanges("Draft", "landlord", "landlord"), false);
  assert.equal(canRequestChanges("Disputed", "landlord", "landlord"), false);
});

test("maintenance reports advance one step at a time without crossing into handover states", () => {
  assert.equal(isAllowedMaintenanceTransition("Pending", "Acknowledged"), true);
  assert.equal(isAllowedMaintenanceTransition("Acknowledged", "In Progress"), true);
  assert.equal(isAllowedMaintenanceTransition("In Progress", "Resolved"), true);
  assert.equal(isAllowedMaintenanceTransition("Pending", "Resolved"), false);
  assert.equal(isAllowedMaintenanceTransition("Resolved", "In Progress"), false);
  assert.equal(isAllowedMaintenanceTransition("Pending", "Agreed / Approved"), false);
});
