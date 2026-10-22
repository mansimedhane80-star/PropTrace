
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createInspection,
  updateInspection,
  getMyInspections,
} = require("../controllers/inspectionController");
const {
  transitionStatus,
  uploadEvidence,
  getEvidenceFile,
  deleteEvidence,
  saveComparison,
  finalizeReport,
  createRevision,
} = require("../controllers/handoverController");

router.get("/", protect, getMyInspections);

router.post("/", protect, createInspection);

router.put("/:id", protect, updateInspection);

router.patch("/:id/status", protect, transitionStatus);
router.post("/:id/evidence", protect, uploadEvidence);
router.get("/:id/evidence/:photoId", protect, getEvidenceFile);
router.delete("/:id/evidence/:photoId", protect, deleteEvidence);
router.post("/:id/comparisons", protect, saveComparison);
router.post("/:id/finalize", protect, finalizeReport);
router.post("/:id/revisions", protect, createRevision);

module.exports = router;
