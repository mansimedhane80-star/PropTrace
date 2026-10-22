
const Report = require("../models/Report");
const Property = require("../models/Property");

// @desc   Submit a report for an assigned property
// @route  POST /api/reports/:propertyId
// @access Private - Tenant only
const createReport = async (req, res) => {
  try {
    // Only tenants can submit reports
    if (req.user.role !== "tenant") {
      return res.status(403).json({
        message: "Only tenants can submit property reports",
      });
    }

    const { title, category, description, location, priority } =
      req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !category ||
      !description?.trim()
    ) {
      return res.status(400).json({
        message: "Title, category, and description are required",
      });
    }

    // Find a property assigned to this logged-in tenant
    const property = await Property.findOne({
      _id: req.params.propertyId,
      tenant: req.user.id,
    });

    if (!property) {
      return res.status(404).json({
        message: "Assigned property not found",
      });
    }

    // Create the report using trusted IDs from the database
    const report = await Report.create({
      property: property._id,
      tenant: req.user.id,
      landlord: property.landlord,
      title,
      category,
      description,
      location,
      priority,
    });

    return res.status(201).json({
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    // Invalid MongoDB IDs and validation errors
    if (
      error.name === "CastError" ||
      error.name === "ValidationError"
    ) {
      return res.status(400).json({
        message: "Invalid report details",
      });
    }

    console.error("Create report error:", error.message);

    return res.status(500).json({
      message: "Failed to submit report",
    });
  }
};


const getMyReports = async (req, res) => {
  try {
    if (req.user.role !== "tenant") {
      return res.status(403).json({
        message: "Only tenants can view their reports",
      });
    }

    const reports = await Report.find({
      tenant: req.user.id,
    })
      .populate("property", "propertyName address city")
      .sort({ createdAt: -1 });

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Get reports error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch reports",
    });
  }
};


const getLandlordReports = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can view landlord reports",
      });
    }

    // Only retrieve reports belonging to this landlord
    const reports = await Report.find({
      landlord: req.user.id,
    })
      .populate("tenant", "name email")
      .populate("property", "propertyName address city")
      .sort({ createdAt: -1 });

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Get landlord reports error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch landlord reports",
    });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can update report status",
      });
    }

    const { status, resolutionNote } = req.body;

    const allowedStatuses = [
      "Acknowledged",
      "In Progress",
      "Resolved",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid report status",
      });
    }

    // Find only a report belonging to this landlord
    const report = await Report.findOne({
      _id: req.params.reportId,
      landlord: req.user.id,
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    report.status = status;

    if (resolutionNote !== undefined) {
      report.resolutionNote = resolutionNote;
    }

    await report.save();

    return res.status(200).json({
      message: "Report status updated successfully",
      report,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid report ID",
      });
    }

    console.error("Update report status error:", error.message);

    return res.status(500).json({
      message: "Failed to update report status",
    });
  }
};



module.exports = {
  createReport,
  getMyReports,
  getLandlordReports,
  updateReportStatus,
};