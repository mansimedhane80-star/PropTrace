
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createReport,
  getMyReports,
  getLandlordReports,
  updateReportStatus,
} = require("../controllers/reportController");

// Tenant: view their own reports
router.get("/mine", protect, getMyReports);

// Landlord: view reports associated with their properties
router.get("/landlord", protect, getLandlordReports);

// Landlord: update a report's status
router.patch(
  "/:reportId/status",
  protect,
  updateReportStatus
);

// Tenant: submit a report for an assigned property
router.post("/:propertyId", protect, createReport);

module.exports = router;
