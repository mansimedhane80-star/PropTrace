
const Inspection = require("../models/Inspection");
const Property = require("../models/Property");
const { transitionStatus } = require("./handoverController");

// =====================================================
// CREATE INSPECTION
// POST /api/inspections
// =====================================================
const createInspection = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can create inspections",
      });
    }

    const {
      propertyId,
      inspectionType,
      inspectionDate,
      items,
      generalNotes,
      meterReadings,
    } = req.body;

    if (!propertyId || !inspectionType) {
      return res.status(400).json({
        message: "Property and inspection type are required",
      });
    }

    if (!["Move-in", "Move-out"].includes(inspectionType)) {
      return res.status(400).json({
        message: "Inspection type must be Move-in or Move-out",
      });
    }

    if (items !== undefined && !Array.isArray(items)) {
      return res.status(400).json({
        message: "Inspection items must be provided as a list",
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      landlord: req.user.id,
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found or not owned by this landlord",
      });
    }

    if (inspectionType === "Move-out" && !property.tenant) {
      return res.status(400).json({
        message: "A tenant must be assigned before a move-out inspection",
      });
    }

    if (
      inspectionDate &&
      Number.isNaN(new Date(inspectionDate).getTime())
    ) {
      return res.status(400).json({
        message: "Invalid inspection date",
      });
    }

    const inspection = await Inspection.create({
      property: property._id,
      landlord: req.user.id,
      tenant: property.tenant || null,
      inspectionType,
      inspectionDate: inspectionDate || new Date(),
      items: items || [],
      generalNotes: generalNotes || "",
      meterReadings: meterReadings || {},
      status: "Draft",
      responsibleRole: "landlord",
      lastUpdatedBy: req.user.id,
      statusHistory: [{ previousStatus: "", newStatus: "Draft", user: req.user.id, role: req.user.role, comment: "Inspection created" }],
      activity: [{ actor: req.user.id, role: req.user.role, action: "Inspection created" }],
    });

    return res.status(201).json({
      message: "Inspection created successfully",
      inspection,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid inspection details",
        errors: error.message,
      });
    }

    console.error("Create inspection error:", error.message);

    return res.status(500).json({
      message: "Failed to create inspection",
    });
  }
};

// Update a saved inspection while it is still being prepared.
const updateInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ message: "Inspection not found" });
    const owns = req.user.role === "landlord" && String(inspection.landlord) === String(req.user.id);
    const assigned = req.user.role === "tenant" && inspection.tenant && String(inspection.tenant) === String(req.user.id);
    if (!owns && !assigned) return res.status(403).json({ message: "You do not have permission to edit this inspection" });
    if (req.body.expectedRevision !== inspection.revision) return res.status(409).json({ message: "This inspection has changed. Refresh and try again.", currentRevision: inspection.revision });
    if (!["Draft", "Inspection in Progress", "Changes Requested"].includes(inspection.status) || (inspection.status === "Changes Requested" && inspection.responsibleRole !== req.user.role)) {
      return res.status(409).json({ message: "This inspection is locked for review" });
    }
    if (inspection.status === "Draft" && !owns) return res.status(403).json({ message: "Only the landlord can edit a draft inspection" });
    if (inspection.status === "Inspection in Progress" && inspection.responsibleRole !== req.user.role) return res.status(403).json({ message: "The other party is responsible for the next inspection update." });
    const fields = ["inspectionType", "inspectionDate", "items", "generalNotes", "meterReadings"];
    for (const field of fields) if (req.body[field] !== undefined) inspection.set(field, req.body[field]);
    inspection.activity.push({ actor: req.user.id, role: req.user.role, action: "Inspection updated" });
    inspection.lastUpdatedBy = req.user.id;
    inspection.revision += 1;
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: req.body.expectedRevision },
      { $set: { inspectionType: inspection.inspectionType, inspectionDate: inspection.inspectionDate, items: inspection.items, generalNotes: inspection.generalNotes, meterReadings: inspection.meterReadings, lastUpdatedBy: inspection.lastUpdatedBy }, $inc: { revision: 1 }, $push: { activity: { actor: req.user.id, role: req.user.role, action: "Inspection updated" } } },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "This inspection changed while you were saving it. Refresh and try again." });
    return res.json({ message: "Inspection updated successfully", inspection: updated });
  } catch (error) {
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid inspection details" });
    console.error("Update inspection error:", error.message);
    return res.status(500).json({ message: "Failed to update inspection" });
  }
};


// =====================================================
// GET INSPECTIONS
// GET /api/inspections
// =====================================================
const getMyInspections = async (req, res) => {
  try {
    let filter;

    if (req.user.role === "landlord") {
      filter = {
        landlord: req.user.id,
      };
    } else if (req.user.role === "tenant") {
      filter = {
        tenant: req.user.id,
      };
    } else {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const status = String(req.query.status || "");
    const propertyId = String(req.query.propertyId || "");
    const search = String(req.query.search || "").trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const sortOrder = req.query.sort === "inspection-oldest" ? { inspectionDate: 1, _id: 1 }
      : req.query.sort === "inspection-newest" ? { inspectionDate: -1, _id: -1 }
        : req.query.sort === "updated-oldest" ? { updatedAt: 1, _id: 1 }
          : { updatedAt: -1, _id: -1 };
    if (propertyId) filter.property = propertyId;
    if (status) filter.status = status;
    if (search) {
      const escaped = search.split("").map((character) => ".*+?^$".includes(character) || "{}()|[]\\".includes(character) ? "\\" + character : character).join("");
      const User = require("../models/User");
      const [matchingProperties, matchingPeople] = await Promise.all([
        Property.find({ $or: [{ propertyName: { $regex: escaped, $options: "i" } }, { address: { $regex: escaped, $options: "i" } }, { city: { $regex: escaped, $options: "i" } }] }).distinct("_id"),
        User.find({ name: { $regex: escaped, $options: "i" } }).distinct("_id"),
      ]);
      const searchClauses = [{ property: { $in: matchingProperties } }, { tenant: { $in: matchingPeople } }, { landlord: { $in: matchingPeople } }];
      if (require("mongoose").Types.ObjectId.isValid(search)) searchClauses.push({ _id: search });
      filter.$or = searchClauses;
    }
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return res.status(400).json({ message: "Invalid inspection date filter" });
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    if (from || to) filter.inspectionDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const [inspections, total, byStatus] = await Promise.all([
      Inspection.find(filter)
      .populate("property", "propertyName address city pincode propertyType furnishingStatus furniture rooms")
      .populate("landlord", "name email")
      .populate("tenant", "name email")
      .populate("lastUpdatedBy", "name email role")
      .populate("statusHistory.user", "name email role")
      .populate("evidence.uploadedBy", "name email")
      .populate("comparisons.createdBy", "name email")
      .sort(sortOrder)
      .skip((page - 1) * limit)
      .limit(limit),
      Inspection.countDocuments(filter),
      Inspection.aggregate([
        { $match: req.user.role === "landlord" ? { landlord: new (require("mongoose").Types.ObjectId)(req.user.id) } : { tenant: new (require("mongoose").Types.ObjectId)(req.user.id) } },
        { $group: { _id: { status: "$status", responsibleRole: { $ifNull: ["$responsibleRole", "landlord"] } }, count: { $sum: 1 } } },
      ]),
    ]);
    const summary = { total: 0, awaitingMine: 0, awaitingOther: 0, changesRequested: 0, disputed: 0, finalized: 0 };
    for (const row of byStatus) {
      summary.total += row.count;
      if (row._id.responsibleRole === req.user.role && !["Finalized", "Agreed / Approved"].includes(row._id.status)) summary.awaitingMine += row.count;
      if (row._id.responsibleRole && row._id.responsibleRole !== req.user.role && !["Finalized", "Agreed / Approved"].includes(row._id.status)) summary.awaitingOther += row.count;
      if (row._id.status === "Changes Requested") summary.changesRequested += row.count;
      if (row._id.status === "Disputed") summary.disputed += row.count;
      if (["Finalized", "Completed"].includes(row._id.status)) summary.finalized += row.count;
    }

    return res.status(200).json({
      count: total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      summary,
      inspections,
    });
  } catch (error) {
    console.error("Get inspections error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch inspections",
    });
  }
};


// =====================================================
// UPDATE INSPECTION STATUS
// PATCH /api/inspections/:id/status
// =====================================================
const updateInspectionStatus = transitionStatus;

/*const updateInspectionStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const transitions = {
      Draft: { "Inspection in Progress": "landlord" },
      "Inspection in Progress": { "Submitted for Review": "landlord" },
      "Submitted for Review": {
        "Changes Requested": "tenant",
        "Awaiting Other Party": "tenant",
      },
      "Changes Requested": { "Inspection in Progress": "landlord" },
      "Awaiting Other Party": { "Agreed / Approved": "landlord" },
      // Legacy status compatibility for existing records.
      Submitted: { Reviewed: "tenant" },
      Reviewed: { Completed: "landlord" },
    };

    const inspection = await Inspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        message: "Inspection not found",
      });
    }

    const allowedRole = transitions[inspection.status]?.[status];

    if (!allowedRole) {
      return res.status(400).json({
        message: `Invalid status transition from ${inspection.status}`,
        allowedNextStatuses: Object.keys(transitions[inspection.status] || {}),
      });
    }

    if (req.user.role !== allowedRole) {
      return res.status(403).json({
        message:
          allowedRole === "tenant"
            ? "Only the assigned tenant can review this inspection"
            : "Only the landlord can perform this action",
      });
    }

    // Verify that the landlord owns this inspection.
    if (
      req.user.role === "landlord" &&
      String(inspection.landlord) !== String(req.user.id)
    ) {
      return res.status(403).json({
        message: "You do not have permission to update this inspection",
      });
    }

    // Verify that this tenant is assigned to this inspection.
    if (
      req.user.role === "tenant" &&
      (
        !inspection.tenant ||
        String(inspection.tenant) !== String(req.user.id)
      )
    ) {
      return res.status(403).json({
        message: "You are not authorized to review this inspection",
      });
    }

    inspection.status = status;
    inspection.activity.push({ actor: req.user.id, role: req.user.role, action: `Status changed to ${status}`, note: req.body.note || "" });
    await inspection.save();

    return res.status(200).json({
      message: `Inspection status updated to ${status}`,
      inspection,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid inspection or status details",
      });
    }

    console.error("Update inspection status error:", error.message);

    return res.status(500).json({
      message: "Failed to update inspection status",
    });
  }
};*/


// =====================================================
// EXPORT FUNCTIONS
// =====================================================
module.exports = {
  createInspection,
  updateInspection,
  getMyInspections,
  updateInspectionStatus,
};
