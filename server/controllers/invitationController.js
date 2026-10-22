
const crypto = require("crypto");
const Invitation = require("../models/Invitation");
const Property = require("../models/Property");

const createInvitation = async (req, res) => {
  try {
    const { tenantEmail } = req.body;
    const propertyId = req.params.propertyId;

    if (!tenantEmail || !tenantEmail.trim()) {
      return res.status(400).json({
        message: "Please provide the tenant's email",
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      landlord: req.user.id,
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found or you are not its landlord",
      });
    }

    if (property.tenant) {
      return res.status(400).json({
        message: "This property already has a tenant",
      });
    }

    const normalizedEmail = tenantEmail.trim().toLowerCase();

    const existingInvitation = await Invitation.findOne({
      property: property._id,
      tenantEmail: normalizedEmail,
      status: "Pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvitation) {
      return res.status(409).json({
        message: "A pending invitation already exists for this email",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const invitation = await Invitation.create({
      property: property._id,
      landlord: req.user.id,
      tenantEmail: normalizedEmail,
      token,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    res.status(201).json({
      message: "Invitation created successfully",
      invitation: {
        id: invitation._id,
        tenantEmail: invitation.tenantEmail,
        property: invitation.property,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      // Temporary development link; we will build acceptance next.
      invitationLink: `http://localhost:5173/accept-invitation/${token}`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create invitation",
      error: error.message,
    });
  }
};


const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findOne({ token });

    if (!invitation) {
      return res.status(404).json({
        message: "Invalid invitation link",
      });
    }

    if (invitation.status !== "Pending") {
      return res.status(400).json({
        message: "This invitation has already been used or is no longer valid",
      });
    }

    if (invitation.expiresAt <= new Date()) {
      invitation.status = "Expired";
      await invitation.save();

      return res.status(400).json({
        message: "This invitation has expired",
      });
    }

    res.status(200).json({
      message: "Invitation is valid",
      tenantEmail: invitation.tenantEmail,
      propertyId: invitation.property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to verify invitation",
      error: error.message,
    });
  }
};


const getLandlordInvitations = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can view their invitations",
      });
    }

    const invitations = await Invitation.find({
      landlord: req.user.id,
    })
      .select("-token")
      .populate("property", "propertyName address city")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: invitations.length,
      invitations,
    });
  } catch (error) {
    console.error(
      "Get landlord invitations error:",
      error.message
    );

    return res.status(500).json({
      message: "Failed to fetch invitations",
    });
  }
};



module.exports = {
  createInvitation,
  acceptInvitation,
  getLandlordInvitations,
};