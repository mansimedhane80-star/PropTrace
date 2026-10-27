const transitions = {
  Pending: ["Acknowledged"],
  Acknowledged: ["In Progress"],
  "In Progress": ["Resolved"],
  Resolved: [],
};

function isAllowedMaintenanceTransition(previousStatus, nextStatus) {
  return transitions[previousStatus]?.includes(nextStatus) || false;
}

module.exports = { transitions, isAllowedMaintenanceTransition };
