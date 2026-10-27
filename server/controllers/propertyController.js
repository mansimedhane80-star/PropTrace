
const Property = require("../models/Property");
const User = require("../models/User");

// =====================================================
// CREATE PROPERTY
// POST /api/properties
// =====================================================
const createProperty = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can create properties",
      });
    }

    const {
      propertyName,
      propertyType,
      address,
      city,
      pincode,
      description,
      rooms,
      furnishingStatus,
      furniture,
      monthlyRent,
      securityDeposit,
      leaseStartDate,
      leaseEndDate,
    } = req.body;

    // Validate required fields
    if (
      typeof propertyName !== "string" ||
      !propertyName.trim() ||
      !propertyType ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof pincode !== "string" ||
      !pincode.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required property details",
      });
    }

    // Validate room counts
    if (rooms !== undefined) {
      if (!rooms || typeof rooms !== "object" || Array.isArray(rooms)) {
        return res.status(400).json({
          message: "Room details must be an object",
        });
      }

      const roomCounts = [
        rooms.bedrooms,
        rooms.bathrooms,
        rooms.kitchens,
        rooms.livingRooms,
        rooms.otherRooms,
      ].filter((value) => value !== undefined);

      const invalidRoomCount = roomCounts.some(
        (value) =>
          value === "" ||
          !Number.isInteger(Number(value)) ||
          Number(value) < 0
      );

      if (invalidRoomCount) {
        return res.status(400).json({
          message: "Room counts must be non-negative whole numbers",
        });
      }
    }

    // Validate rent and deposit
    for (const [fieldName, value] of [
      ["Monthly rent", monthlyRent],
      ["Security deposit", securityDeposit],
    ]) {
      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      ) {
        return res.status(400).json({
          message: `${fieldName} must be a non-negative number`,
        });
      }
    }

    // Validate lease dates
    const validDate = (value) =>
      value === undefined ||
      value === null ||
      value === "" ||
      !Number.isNaN(new Date(value).getTime());

    if (!validDate(leaseStartDate) || !validDate(leaseEndDate)) {
      return res.status(400).json({
        message: "Please provide valid lease dates",
      });
    }

    if (
      leaseStartDate &&
      leaseEndDate &&
      new Date(leaseEndDate) < new Date(leaseStartDate)
    ) {
      return res.status(400).json({
        message: "Lease end date cannot be before lease start date",
      });
    }

    // Prepare property data
    const propertyData = {
      landlord: req.user.id,
      propertyName: propertyName.trim(),
      propertyType,
      address: address.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      status: "Available",
    };

    if (description !== undefined) {
      propertyData.description = description;
    }

    if (rooms !== undefined) {
      propertyData.rooms = rooms;
    }

    if (furnishingStatus !== undefined) {
      propertyData.furnishingStatus = furnishingStatus;
    }

    if (furniture !== undefined) {
      if (!Array.isArray(furniture)) {
        return res.status(400).json({
          message: "Furniture must be provided as a list",
        });
      }

      propertyData.furniture = furnishingStatus === "Unfurnished" ? [] : furniture;
    } else if (furnishingStatus === "Unfurnished") {
      propertyData.furniture = [];
    }

    if (monthlyRent !== undefined) {
      propertyData.monthlyRent =
        monthlyRent === "" || monthlyRent === null
          ? null
          : Number(monthlyRent);
    }

    if (securityDeposit !== undefined) {
      propertyData.securityDeposit =
        securityDeposit === "" || securityDeposit === null
          ? null
          : Number(securityDeposit);
    }

    if (leaseStartDate !== undefined) {
      propertyData.leaseStartDate = leaseStartDate || null;
    }

    if (leaseEndDate !== undefined) {
      propertyData.leaseEndDate = leaseEndDate || null;
    }

    const property = await Property.create(propertyData);

    return res.status(201).json({
      message: "Property created successfully",
      property,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid property details",
        errors: error.message,
      });
    }

    console.error("Create property error:", error.message);

    return res.status(500).json({
      message: "Failed to create property",
    });
  }
};


// =====================================================
// GET MY PROPERTIES
// GET /api/properties
// =====================================================
const getMyProperties = async (req, res) => {
  try {
    let filter;

    if (req.user.role === "tenant") {
      // Tenants see properties assigned to them
      filter = {
        tenant: req.user.id,
      };
    } else if (req.user.role === "landlord") {
      // Landlords see properties they own
      filter = {
        landlord: req.user.id,
      };
    } else {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const properties = await Property.find(filter)
      .populate("tenant", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      properties,
    });
  } catch (error) {
    console.error("Get properties error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch properties",
    });
  }
};


// =====================================================
// GET LANDLORD'S TENANTS
// GET /api/properties/tenants
// =====================================================
const getLandlordTenants = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can view their tenants",
      });
    }

    const properties = await Property.find({
      landlord: req.user.id,
      tenant: { $ne: null },
    })
      .populate("tenant", "name email")
      .sort({ updatedAt: -1 });

    const tenants = properties
      .filter((property) => property.tenant)
      .map((property) => ({
        _id: property.tenant._id,
        name: property.tenant.name,
        email: property.tenant.email,

        propertyId: property._id,
        propertyName: property.propertyName,
        propertyType: property.propertyType,
        address: property.address,
        city: property.city,
        pincode: property.pincode,
        propertyStatus: property.status,

        // This is the property update time, not a move-in date.
        propertyUpdatedAt: property.updatedAt,
      }));

    return res.status(200).json({
      count: tenants.length,
      tenants,
    });
  } catch (error) {
    console.error("Get landlord tenants error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch tenants",
    });
  }
};

const updateLandlordTenantName = async (req, res) => {
  try {
    if (req.user.role !== "landlord") return res.status(403).json({ message: "Only landlords can update an assigned tenant name." });
    const name = typeof req.body.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 100) return res.status(400).json({ message: "Enter the tenant's real name (up to 100 characters)." });
    const assignedProperty = await Property.exists({ landlord: req.user.id, tenant: req.params.tenantId });
    if (!assignedProperty) return res.status(404).json({ message: "This tenant is not assigned to one of your properties." });
    const tenant = await User.findByIdAndUpdate(req.params.tenantId, { $set: { name } }, { new: true, runValidators: true }).select("_id name email");
    if (!tenant) return res.status(404).json({ message: "Tenant account not found." });
    return res.json({ message: "Tenant name updated.", tenant });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "Tenant account not found." });
    console.error("Tenant name update failed:", error.message);
    return res.status(500).json({ message: "Could not update tenant name." });
  }
};


// =====================================================
// ASSIGN AN EXISTING TENANT
// PUT /api/properties/:id/assign-tenant
// =====================================================
const assignTenant = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can assign tenants",
      });
    }

    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        message: "Tenant ID is required",
      });
    }

    const tenant = await User.findOne({
      _id: tenantId,
      role: "tenant",
    });

    if (!tenant) {
      return res.status(404).json({
        message: "Tenant account not found",
      });
    }

    const property = await Property.findOne({
      _id: req.params.id,
      landlord: req.user.id,
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    if (
      property.tenant &&
      property.tenant.toString() !== tenant._id.toString()
    ) {
      return res.status(409).json({
        message: "This property already has an assigned tenant",
      });
    }

    property.tenant = tenant._id;
    property.status = "Occupied";

    await property.save();

    return res.status(200).json({
      message: "Tenant assigned successfully",
      property,
    });
  } catch (error) {
    if (
      error.name === "CastError" ||
      error.name === "ValidationError"
    ) {
      return res.status(400).json({
        message: "Invalid property or tenant details",
      });
    }

    console.error("Assign tenant error:", error.message);

    return res.status(500).json({
      message: "Failed to assign tenant",
    });
  }
};


// =====================================================
// UPDATE EXISTING PROPERTY
// PUT /api/properties/:id
// =====================================================
const updateProperty = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({
        message: "Only landlords can update properties",
      });
    }

    // Only allow the owner to update the property
    const property = await Property.findOne({
      _id: req.params.id,
      landlord: req.user.id,
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    const allowedFields = [
      "propertyName",
      "propertyType",
      "address",
      "city",
      "pincode",
      "description",
      "rooms",
      "furnishingStatus",
      "furniture",
      "monthlyRent",
      "securityDeposit",
      "leaseStartDate",
      "leaseEndDate",
    ];

    // Update only the permitted fields
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        property.set(field, req.body[field]);
      }
    }

    if (property.furnishingStatus === "Unfurnished") {
      property.furniture = [];
    }

    // Validate lease dates
    if (
      property.leaseStartDate &&
      property.leaseEndDate &&
      property.leaseEndDate < property.leaseStartDate
    ) {
      return res.status(400).json({
        message: "Lease end date cannot be before lease start date",
      });
    }

    await property.save();

    return res.status(200).json({
      message: "Property updated successfully",
      property,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid property details",
        errors: error.message,
      });
    }

    console.error("Update property error:", error.message);

    return res.status(500).json({
      message: "Failed to update property",
    });
  }
};


// =====================================================
// EXPORT CONTROLLER FUNCTIONS
// =====================================================
module.exports = {
  createProperty,
  getMyProperties,
  getLandlordTenants,
  updateLandlordTenantName,
  assignTenant,
  updateProperty,
};
