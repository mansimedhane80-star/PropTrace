
const mongoose = require("mongoose");

// Details about the condition of an individual room or item
const inspectionItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
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

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Legacy embedded photos are retained for existing inspections.
    photos: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const evidenceSchema = new mongoose.Schema({
  storageKey: { type: String, required: true },
  originalName: { type: String, trim: true, default: "photo" },
  contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp", "image/gif"], required: true },
  size: { type: Number, required: true, min: 1 },
  checksum: { type: String, required: true },
  location: { type: String, trim: true, maxlength: 150, required: true },
  itemName: { type: String, trim: true, maxlength: 150, default: "" },
  classification: { type: String, enum: ["Before", "After", "General"], default: "General" },
  caption: { type: String, trim: true, maxlength: 300, default: "" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  uploadedAt: { type: Date, default: Date.now },
  revision: { type: Number, default: 1 },
}, { timestamps: false });

const comparisonSchema = new mongoose.Schema({
  beforeEvidence: { type: mongoose.Schema.Types.ObjectId, required: true },
  afterEvidence: { type: mongoose.Schema.Types.ObjectId, required: true },
  location: { type: String, trim: true, required: true },
  itemName: { type: String, trim: true, default: "" },
  conditionBefore: { type: String, trim: true, default: "" },
  conditionAfter: { type: String, trim: true, default: "" },
  observedDifferences: { type: String, trim: true, maxlength: 1500, default: "" },
  comments: { type: String, trim: true, maxlength: 1500, default: "" },
  outstandingConcerns: { type: String, trim: true, maxlength: 1500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

const statusHistorySchema = new mongoose.Schema({
  previousStatus: { type: String, trim: true, default: "" },
  newStatus: { type: String, trim: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["tenant", "landlord"], required: true },
  comment: { type: String, trim: true, maxlength: 1500, default: "" },
  createdAt: { type: Date, default: Date.now },
});

// Inspection record
const inspectionSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

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
    },

    inspectionType: {
      type: String,
      enum: ["Move-in", "Move-out"],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Inspection in Progress",
        "Submitted for Review",
        "Changes Requested",
        "Awaiting Other Party",
        "Agreed / Approved",
        "Awaiting Tenant Review",
        "Awaiting Landlord Review",
        "Finalized",
        "Disputed",
        // Retain legacy records during migration.
        "Submitted",
        "Reviewed",
        "Completed",
      ],
      default: "Draft",
    },

    inspectionDate: {
      type: Date,
      default: Date.now,
    },

    items: {
      type: [inspectionItemSchema],
      default: [],
    },

    generalNotes: {
      type: String,
      trim: true,
      default: "",
    },

    meterReadings: {
      electricity: {
        type: String,
        default: "",
        trim: true,
      },

      water: {
        type: String,
        default: "",
        trim: true,
      },

      gas: {
        type: String,
        default: "",
        trim: true,
      },
    },

    landlordConfirmation: {
      confirmed: {
        type: Boolean,
        default: false,
      },

      confirmedAt: {
        type: Date,
        default: null,
      },
    },

    tenantConfirmation: {
      confirmed: {
        type: Boolean,
        default: false,
      },

      confirmedAt: {
        type: Date,
        default: null,
      },
    },

    responsibleRole: { type: String, enum: ["tenant", "landlord"], default: "landlord", index: true },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revision: { type: Number, default: 0, min: 0 },
    statusHistory: { type: [statusHistorySchema], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    comparisons: { type: [comparisonSchema], default: [] },
    dispute: {
      raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      raisedByRole: { type: String, enum: ["tenant", "landlord", null], default: null },
      comment: { type: String, trim: true, maxlength: 1500, default: "" },
      resolvedAt: { type: Date, default: null },
    },
    finalNotes: { type: String, trim: true, maxlength: 3000, default: "" },
    finalizedAt: { type: Date, default: null },
    finalReportVersions: { type: [mongoose.Schema.Types.Mixed], default: [] },

    activity: {
      type: [{
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["tenant", "landlord"] },
        action: { type: String, trim: true },
        note: { type: String, trim: true, default: "" },
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Inspection",
  inspectionSchema
);
