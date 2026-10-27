
const crypto = require("crypto");
const Invitation = require("../models/Invitation");
const Property = require("../models/Property");
const { validateInvitation, invitationFailureMessage } = require("../services/invitationValidation");

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
      invitationLink: `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/accept-invitation/${token}`,
    });
  } catch (error) {
    console.error("Invitation creation failed.");
    res.status(500).json({
      message: "Failed to create invitation",
    });
  }
};


const acceptInvitation = async (req, res) => {
  try {
    const token = typeof req.params.token === "string" ? req.params.token.trim() : "";

    const invitation = await Invitation.findOne({ token });
    const validation = validateInvitation(invitation, { token, email: invitation?.tenantEmail });
    if (!validation.valid) {
      if (validation.reason === "expired" && invitation.status === "Pending") {
        invitation.status = "Expired";
        await invitation.save();
      }
      return res.status(validation.reason === "invalid-token" ? 404 : 400).json({
        message: invitationFailureMessage(validation.reason),
      });
    }

    res.status(200).json({
      message: "Invitation is valid",
      tenantEmail: invitation.tenantEmail,
      propertyId: invitation.property,
    });
  } catch (error) {
    console.error("Invitation verification failed.");
    res.status(500).json({
      message: "Failed to verify invitation",
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
