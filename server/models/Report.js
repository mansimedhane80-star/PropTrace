
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // The property where the problem occurred
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    // The tenant who submitted the report
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The landlord responsible for the property
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    category: {
      type: String,
      enum: [
        "Plumbing",
        "Electrical",
        "Structural Damage",
        "Cleaning",
        "Safety",
        "Other",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Acknowledged",
        "In Progress",
        "Resolved",
      ],
      default: "Pending",
    },

    // Image URLs can be added when evidence uploads are implemented
    attachments: {
      type: [String],
      default: [],
    },

    resolutionNote: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
