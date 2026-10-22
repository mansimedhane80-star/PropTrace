
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createProperty,
  getMyProperties,
  getLandlordTenants,
  updateLandlordTenantName,
  assignTenant,
  updateProperty,
} = require("../controllers/propertyController");

// Get tenant list
router.get("/tenants", protect, getLandlordTenants);
router.patch("/tenants/:tenantId", protect, updateLandlordTenantName);

// Get properties
router.get("/", protect, getMyProperties);

// Create a property
router.post("/", protect, createProperty);

// Update an existing property
router.put("/:id", protect, updateProperty);

// Assign an existing tenant
router.put("/:id/assign-tenant", protect, assignTenant);

module.exports = router;
