
const mongoose = require("mongoose");

const furnitureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    condition: {
      type: String,
      enum: [
        "Excellent",
        "Good",
        "Fair",
        "Damaged",
        "Not Inspected",
      ],
      default: "Not Inspected",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const propertySchema = new mongoose.Schema(
  {
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    propertyName: {
      type: String,
      required: true,
      trim: true,
    },

    propertyType: {
      type: String,
      enum: ["Apartment", "House", "Room", "Office", "Other"],
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Room counts
    rooms: {
      bedrooms: {
        type: Number,
        default: 0,
        min: 0,
      },

      bathrooms: {
        type: Number,
        default: 0,
        min: 0,
      },

      kitchens: {
        type: Number,
        default: 0,
        min: 0,
      },

      livingRooms: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherRooms: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Furnishing status
    furnishingStatus: {
      type: String,
      enum: [
        "Unfurnished",
        "Partially Furnished",
        "Fully Furnished",
      ],
      default: "Unfurnished",
    },

    // Furniture and appliances inventory
    furniture: {
      type: [furnitureSchema],
      default: [],
    },

    // Rental information (amounts in INR)
    monthlyRent: {
      type: Number,
      min: 0,
      default: null,
    },

    securityDeposit: {
      type: Number,
      min: 0,
      default: null,
    },

    leaseStartDate: {
      type: Date,
      default: null,
    },

    leaseEndDate: {
      type: Date,
      default: null,
    },

    // Existing property status
    status: {
      type: String,
      enum: ["Available", "Occupied"],
      default: "Available",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);
