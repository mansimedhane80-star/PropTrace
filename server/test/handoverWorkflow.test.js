const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWorkflowTransition } = require("../services/handoverWorkflow");

test("landlord can start a draft inspection when responsible", () => {
  assert.deepEqual(validateWorkflowTransition("Draft", "Inspection in Progress", "landlord", "landlord"), { allowed: true });
});

test("tenant cannot submit landlord-owned inspection work", () => {
  assert.deepEqual(validateWorkflowTransition("Inspection in Progress", "Awaiting Tenant Review", "tenant", "landlord"), { allowed: false, reason: "not-responsible" });
});

test("tenant can acknowledge a review assigned to them", () => {
  assert.deepEqual(validateWorkflowTransition("Awaiting Tenant Review", "Awaiting Landlord Review", "tenant", "tenant"), { allowed: true });
});

test("approval cannot skip the tenant review state", () => {
  assert.deepEqual(validateWorkflowTransition("Inspection in Progress", "Agreed / Approved", "landlord", "landlord"), { allowed: false, reason: "invalid-transition" });
});
