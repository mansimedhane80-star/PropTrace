
const express = require("express");
const router = express.Router();

const {
  createInvitation,
  acceptInvitation,
  getLandlordInvitations,
} = require("../controllers/invitationController");

const protect = require("../middleware/authMiddleware");

// Landlord: view invitations for their properties
router.get("/landlord", protect, getLandlordInvitations);

// Verify an invitation link
router.get("/verify/:token", acceptInvitation);

// Landlord: create an invitation for a property
router.post("/:propertyId", protect, createInvitation);

module.exports = router;
