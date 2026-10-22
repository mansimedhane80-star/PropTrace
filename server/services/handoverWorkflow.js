const transitions = {
  Draft: { "Inspection in Progress": "landlord" },
  "Inspection in Progress": { "Awaiting Tenant Review": "landlord", "Submitted for Review": "landlord" },
  "Submitted for Review": { "Awaiting Tenant Review": "landlord" },
  "Awaiting Tenant Review": { "Awaiting Landlord Review": "tenant", "Awaiting Other Party": "tenant" },
  "Awaiting Other Party": { "Awaiting Landlord Review": "landlord" },
  "Awaiting Landlord Review": { "Agreed / Approved": "landlord" },
  "Agreed / Approved": {},
  Submitted: { "Awaiting Tenant Review": "tenant", Reviewed: "tenant" },
  Reviewed: { "Awaiting Landlord Review": "landlord", Completed: "landlord" },
};

function validateWorkflowTransition(previousStatus, nextStatus, role, responsibleRole) {
  const expectedRole = transitions[previousStatus]?.[nextStatus];
  if (!expectedRole) return { allowed: false, reason: "invalid-transition" };
  if (role !== expectedRole || role !== responsibleRole) return { allowed: false, reason: "not-responsible" };
  return { allowed: true };
}

module.exports = { transitions, validateWorkflowTransition };
