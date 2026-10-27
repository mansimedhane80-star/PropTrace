function validateInvitation(invitation, { token, email, now = new Date() }) {
  if (!invitation || invitation.token !== token) return { valid: false, reason: "invalid-token" };
  if (invitation.status === "Expired") return { valid: false, reason: "expired" };
  if (invitation.status !== "Pending") return { valid: false, reason: "used" };
  const expiry = new Date(invitation.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry <= now) return { valid: false, reason: "expired" };
  const invitedEmail = String(invitation.tenantEmail || "").trim().toLowerCase();
  const submittedEmail = String(email || "").trim().toLowerCase();
  if (!submittedEmail || invitedEmail !== submittedEmail) return { valid: false, reason: "email-mismatch" };
  return { valid: true, reason: "valid" };
}

function invitationFailureMessage(reason) {
  if (reason === "expired") return "This invitation has expired. Ask the landlord for a new invitation.";
  if (reason === "used") return "This invitation has already been accepted or is no longer pending. Ask the landlord for a new invitation.";
  if (reason === "email-mismatch") return "This invitation was issued to a different email address.";
  return "Invalid invitation link";
}

module.exports = { validateInvitation, invitationFailureMessage };
