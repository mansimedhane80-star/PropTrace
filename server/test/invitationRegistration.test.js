const test = require("node:test");
const assert = require("node:assert/strict");
const Invitation = require("../models/Invitation");
const Property = require("../models/Property");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { registerUser, loginUser } = require("../controllers/authController");
const { validateInvitation } = require("../services/invitationValidation");

const fixedNow = new Date("2026-10-24T10:00:00.000Z");
const token = "a".repeat(64);
const pendingInvitation = (overrides = {}) => ({
  token,
  property: "property-test-id",
  landlord: "landlord-test-id",
  tenantEmail: "tenant@example.test",
  status: "Pending",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  ...overrides,
});

test("valid invitation is accepted for its normalized invited email", () => {
  assert.deepEqual(validateInvitation(pendingInvitation(), { token, email: " TENANT@example.test ", now: fixedNow }), { valid: true, reason: "valid" });
});

test("unknown invitation token is rejected", () => {
  assert.deepEqual(validateInvitation(null, { token: "b".repeat(64), email: "tenant@example.test", now: fixedNow }), { valid: false, reason: "invalid-token" });
});

test("expired invitation is rejected at the expiry boundary", () => {
  assert.deepEqual(validateInvitation(pendingInvitation({ expiresAt: fixedNow }), { token, email: "tenant@example.test", now: fixedNow }), { valid: false, reason: "expired" });
});

test("accepted invitation cannot be reused", () => {
  assert.deepEqual(validateInvitation(pendingInvitation({ status: "Accepted" }), { token, email: "tenant@example.test", now: fixedNow }), { valid: false, reason: "used" });
});

test("invitation already marked expired remains distinguishable from an accepted invitation", () => {
  assert.deepEqual(validateInvitation(pendingInvitation({ status: "Expired" }), { token, email: "tenant@example.test", now: fixedNow }), { valid: false, reason: "expired" });
});

test("invitation issued to another email is rejected", () => {
  assert.deepEqual(validateInvitation(pendingInvitation(), { token, email: "other@example.test", now: fixedNow }), { valid: false, reason: "email-mismatch" });
});

test("valid invitation registration creates tenant and associates property before accepting invite", async () => {
  const originals = {
    invitationFindOne: Invitation.findOne,
    propertyFindOne: Property.findOne,
    userFindOne: User.findOne,
    userCreate: User.create,
  };
  const invitation = pendingInvitation({ save: async function save() {} });
  const property = {
    _id: "property-test-id",
    tenant: null,
    status: "Available",
    save: async function save() {},
  };
  const createdUser = { _id: "tenant-test-id", name: "Test Tenant", email: "tenant@example.test", role: "tenant" };

  Invitation.findOne = async (query) => query.token === token ? invitation : null;
  Property.findOne = async (query) => query._id === property._id && query.landlord === invitation.landlord && query.tenant === null ? property : null;
  User.findOne = async () => null;
  User.create = async (data) => ({ ...createdUser, ...data, _id: createdUser._id });

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await registerUser({
      body: { name: "Test Tenant", email: " TENANT@example.test ", password: "safe-test-password", role: "tenant", invitationToken: ` ${token} ` },
      user: null,
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.user.role, "tenant");
    assert.equal(property._id, invitation.property);
    assert.equal(property.tenant, createdUser._id);
    assert.equal(property.status, "Occupied");
    assert.equal(invitation.status, "Accepted");
  } finally {
    Invitation.findOne = originals.invitationFindOne;
    Property.findOne = originals.propertyFindOne;
    User.findOne = originals.userFindOne;
    User.create = originals.userCreate;
  }
});

test("landlord login still returns the authenticated landlord account", async () => {
  const originalFindOne = User.findOne;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-signing-secret-only";
  const landlord = {
    _id: "landlord-test-id",
    name: "Test Landlord",
    email: "landlord@example.test",
    role: "landlord",
    password: await bcrypt.hash("safe-test-password", 4),
  };
  User.findOne = async ({ email }) => email === landlord.email ? landlord : null;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await loginUser({ body: { email: landlord.email, password: "safe-test-password", role: "landlord" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.role, "landlord");
    assert.equal(typeof response.body.token, "string");
  } finally {
    User.findOne = originalFindOne;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
