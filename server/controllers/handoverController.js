const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const Inspection = require("../models/Inspection");
const Property = require("../models/Property");
const User = require("../models/User");
const { transitions, validateWorkflowTransition } = require("../services/handoverWorkflow");

const evidenceDirectory = path.join(__dirname, "..", "uploads", "evidence");
const imageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const otherParty = (role) => role === "tenant" ? "landlord" : "tenant";

function imageBytesMatch(contentType, buffer) {
  if (contentType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/gif") return buffer.subarray(0, 6).toString("ascii").startsWith("GIF8");
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function userCanView(inspection, user) {
  return user.role === "landlord"
    ? String(inspection.landlord) === String(user.id)
    : user.role === "tenant" && inspection.tenant && String(inspection.tenant) === String(user.id);
}

async function findAccessibleInspection(id, user) {
  const inspection = await Inspection.findById(id);
  if (!inspection) return { error: { status: 404, message: "Inspection report not found" } };
  if (!userCanView(inspection, user)) return { error: { status: 403, message: "You do not have access to this report" } };
  return { inspection };
}

const transitionStatus = async (req, res) => {
  try {
    let { status, comment = "", expectedRevision } = req.body;
    if (!Number.isInteger(expectedRevision)) return res.status(428).json({ message: "Report revision is required. Refresh the report and try again." });
    if (typeof comment !== "string" || comment.length > 1500) return res.status(400).json({ message: "Comments must be 1,500 characters or fewer" });
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    if (inspection.revision !== expectedRevision) return res.status(409).json({ message: "This report changed since you opened it. Refresh to review the latest version.", currentRevision: inspection.revision });
    if (inspection.status === "Finalized") return res.status(409).json({ message: "Finalized reports are locked. Start an authorized revision to make changes." });

    const previousStatus = inspection.status;
    let responsibleRole = inspection.responsibleRole || "landlord";
    let tenantConfirmed = inspection.tenantConfirmation && inspection.tenantConfirmation.confirmed;
    let landlordConfirmed = inspection.landlordConfirmation && inspection.landlordConfirmation.confirmed;
    let dispute = inspection.dispute && inspection.dispute.toObject ? inspection.dispute.toObject() : inspection.dispute;
    const isResponsible = req.user.role === responsibleRole;
    let action = "Status changed to " + status;

    if (status === "Disputed") {
      if (["Draft", "Finalized"].includes(previousStatus)) return res.status(409).json({ message: "A dispute can only be raised on an active handover report." });
      if (!comment.trim()) return res.status(400).json({ message: "Add a comment explaining the dispute." });
      dispute = { raisedBy: req.user.id, raisedByRole: req.user.role, comment: comment.trim(), resolvedAt: null };
      responsibleRole = otherParty(req.user.role);
      action = "Dispute raised";
    } else if (previousStatus === "Disputed" && status === "Changes Requested") {
      if (!isResponsible) return res.status(403).json({ message: "The " + responsibleRole + " must respond to this dispute." });
      if (!comment.trim()) return res.status(400).json({ message: "Add a comment explaining how the dispute is resolved." });
      responsibleRole = dispute && dispute.raisedByRole ? dispute.raisedByRole : otherParty(req.user.role);
      dispute.resolvedAt = new Date();
      tenantConfirmed = false;
      landlordConfirmed = false;
      action = "Dispute response recorded";
    } else if (status === "Changes Requested") {
      if (["Draft", "Finalized", "Disputed"].includes(previousStatus)) return res.status(400).json({ message: "Changes cannot be requested from this report state." });
      if (!comment.trim()) return res.status(400).json({ message: "Add a comment describing the changes needed." });
      responsibleRole = otherParty(req.user.role);
      tenantConfirmed = false;
      landlordConfirmed = false;
      action = "Changes requested";
    } else if (previousStatus === "Changes Requested" && status === "Inspection in Progress") {
      if (!isResponsible) return res.status(403).json({ message: "The " + responsibleRole + " is responsible for responding to this change request." });
      if (!comment.trim()) return res.status(400).json({ message: "Add a short response to the requested changes." });
      if (req.user.role === "tenant") {
        status = "Awaiting Landlord Review";
        responsibleRole = "landlord";
        tenantConfirmed = true;
        action = "Tenant changes submitted for landlord review";
      } else {
        action = "Changes addressed";
      }
    } else {
      const decision = validateWorkflowTransition(previousStatus, status, req.user.role, responsibleRole);
      if (!decision.allowed && decision.reason === "invalid-transition") return res.status(400).json({ message: "Invalid transition from " + previousStatus + " to " + status + ".", allowedStatuses: Object.keys(transitions[previousStatus] || {}) });
      if (!decision.allowed || !isResponsible) return res.status(403).json({ message: "The " + responsibleRole + " is responsible for the next action." });
      if (["Awaiting Landlord Review", "Agreed / Approved"].includes(status) && !comment.trim()) return res.status(400).json({ message: "Add an acknowledgment comment before approving this report." });
      if (status === "Awaiting Landlord Review" || status === "Awaiting Other Party") {
        tenantConfirmed = true;
        responsibleRole = "landlord";
      } else if (status === "Awaiting Tenant Review") {
        responsibleRole = "tenant";
      } else if (status === "Agreed / Approved") {
        landlordConfirmed = true;
        responsibleRole = "landlord";
      } else if (status === "Inspection in Progress") {
        responsibleRole = req.user.role;
      }
    }

    if (status === "Finalized") return res.status(400).json({ message: "Use the finalization action after both parties have approved." });
    const createdAt = new Date();
    const history = { previousStatus, newStatus: status, user: req.user.id, role: req.user.role, comment: comment.trim(), createdAt };
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: expectedRevision },
      {
        $set: {
          status,
          responsibleRole,
          tenantConfirmation: { confirmed: Boolean(tenantConfirmed), confirmedAt: tenantConfirmed ? ((inspection.tenantConfirmation && inspection.tenantConfirmation.confirmedAt) || createdAt) : null },
          landlordConfirmation: { confirmed: Boolean(landlordConfirmed), confirmedAt: landlordConfirmed ? ((inspection.landlordConfirmation && inspection.landlordConfirmation.confirmedAt) || createdAt) : null },
          dispute,
          lastUpdatedBy: req.user.id,
        },
        $inc: { revision: 1 },
        $push: {
          statusHistory: history,
          activity: { actor: req.user.id, role: req.user.role, action, note: comment.trim(), createdAt },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "This report changed while you were updating it. Refresh and try again." });
    return res.json({ message: "Report updated to " + status + ".", inspection: updated });
  } catch (error) {
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid report update" });
    console.error("Handover status update failed:", error.message);
    return res.status(500).json({ message: "Could not update the report" });
  }
};

const uploadEvidence = async (req, res) => {
  let storagePath;
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    if (inspection.status === "Finalized") return res.status(409).json({ message: "Evidence is locked on finalized reports. Create a revision to add new evidence." });
    const { data, contentType, originalName, location, itemName = "", classification = "General", caption = "" } = req.body;
    if (!imageTypes[contentType]) return res.status(415).json({ message: "Upload a JPEG, PNG, WebP, or GIF image." });
    if (typeof location !== "string" || !location.trim() || location.trim().length > 150) return res.status(400).json({ message: "A room or location (up to 150 characters) is required." });
    if (!["Before", "After", "General"].includes(classification)) return res.status(400).json({ message: "Choose Before, After, or General evidence." });
    if (typeof caption !== "string" || caption.length > 300 || typeof itemName !== "string" || itemName.length > 150) return res.status(400).json({ message: "Caption or item name is too long." });
    const base64 = String(data || "").replace(/^data:[^;]+;base64,/, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return res.status(400).json({ message: "Invalid image data." });
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return res.status(413).json({ message: "Each image must be smaller than 8 MB." });
    if (!imageBytesMatch(contentType, buffer)) return res.status(415).json({ message: "The uploaded file does not match its declared image type." });
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const duplicate = inspection.evidence.find((photo) => photo.checksum === checksum);
    if (duplicate) return res.status(200).json({ message: "This photo is already attached to the report.", duplicate: true, evidence: duplicate });

    await fs.mkdir(evidenceDirectory, { recursive: true });
    const storageKey = crypto.randomUUID() + imageTypes[contentType];
    storagePath = path.join(evidenceDirectory, storageKey);
    await fs.writeFile(storagePath, buffer, { flag: "wx" });
    const evidenceId = new mongoose.Types.ObjectId();
    const evidence = {
      _id: evidenceId,
      storageKey,
      originalName: path.basename(String(originalName || "photo")).slice(0, 120),
      contentType,
      size: buffer.length,
      checksum,
      location: location.trim(),
      itemName: itemName.trim(),
      classification,
      caption: caption.trim(),
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      revision: inspection.revision + 1,
    };
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: inspection.revision },
      { $push: { evidence }, $inc: { revision: 1 }, $set: { lastUpdatedBy: req.user.id } },
      { new: true, runValidators: true },
    );
    if (!updated) {
      await fs.rm(storagePath, { force: true });
      return res.status(409).json({ message: "The report changed during upload. Refresh and try again." });
    }
    return res.status(201).json({ message: "Photo evidence uploaded.", evidence: updated.evidence.id(evidenceId), revision: updated.revision });
  } catch (error) {
    if (storagePath) await fs.rm(storagePath, { force: true }).catch(() => {});
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid photo evidence details." });
    console.error("Evidence upload failed:", error.message);
    return res.status(500).json({ message: "Could not save photo evidence." });
  }
};

const getEvidenceFile = async (req, res) => {
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const evidence = result.inspection.evidence.id(req.params.photoId)
      || result.inspection.finalReportVersions.flatMap((version) => version.evidence || []).find((photo) => String(photo._id) === String(req.params.photoId));
    if (!evidence) return res.status(404).json({ message: "Photo evidence not found" });
    if (!/^[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(evidence.storageKey)) return res.status(404).json({ message: "Photo evidence not found" });
    const filePath = path.join(evidenceDirectory, path.basename(evidence.storageKey));
    res.set("Cache-Control", "private, no-store");
    res.type(evidence.contentType);
    return res.sendFile(filePath, (sendError) => {
      if (sendError && !res.headersSent) res.status(sendError.statusCode || 404).json({ message: "Photo file is unavailable" });
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "Photo evidence not found" });
    console.error("Evidence read failed:", error.message);
    return res.status(500).json({ message: "Could not load photo evidence" });
  }
};

const deleteEvidence = async (req, res) => {
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    const evidence = inspection.evidence.id(req.params.photoId);
    if (!evidence) return res.status(404).json({ message: "Photo evidence not found" });
    if (inspection.status === "Finalized") return res.status(409).json({ message: "Evidence in a finalized report is preserved. Create a revision to make changes." });
    if (inspection.finalReportVersions.some((version) => (version.evidence || []).some((photo) => String(photo._id) === String(evidence._id)))) return res.status(409).json({ message: "This photo is part of a preserved finalized version and cannot be deleted." });
    if (req.user.role !== "landlord" && String(evidence.uploadedBy) !== String(req.user.id)) return res.status(403).json({ message: "Only the uploader or landlord can remove this photo." });
    if (inspection.comparisons.some((pair) => String(pair.beforeEvidence) === String(evidence._id) || String(pair.afterEvidence) === String(evidence._id))) return res.status(409).json({ message: "This photo belongs to a saved comparison. Correct or remove the comparison first." });
    if (Number(req.body.expectedRevision) !== inspection.revision) return res.status(409).json({ message: "The report changed. Refresh before removing evidence." });
    const storageKey = evidence.storageKey;
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: inspection.revision },
      { $pull: { evidence: { _id: evidence._id } }, $inc: { revision: 1 }, $set: { lastUpdatedBy: req.user.id } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ message: "The report changed. Refresh before removing evidence." });
    await fs.rm(path.join(evidenceDirectory, path.basename(storageKey)), { force: true }).catch(() => {});
    return res.json({ message: "Photo evidence removed.", revision: updated.revision });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "Photo evidence not found" });
    console.error("Evidence delete failed:", error.message);
    return res.status(500).json({ message: "Could not remove photo evidence." });
  }
};

const saveComparison = async (req, res) => {
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    if (inspection.status === "Finalized") return res.status(409).json({ message: "Comparisons are locked on finalized reports. Create a revision to edit them." });
    if (req.body.expectedRevision !== inspection.revision) return res.status(409).json({ message: "The report has changed. Refresh before editing the comparison." });
    const body = req.body;
    const before = inspection.evidence.id(body.beforeEvidence);
    const after = inspection.evidence.id(body.afterEvidence);
    if (!before || !after || before._id.equals(after._id) || before.classification !== "Before" || after.classification !== "After") return res.status(400).json({ message: "Choose one saved Before photo and one saved After photo." });
    if (!body.location || before.location.trim().toLowerCase() !== after.location.trim().toLowerCase() || before.itemName.trim().toLowerCase() !== after.itemName.trim().toLowerCase()) return res.status(400).json({ message: "Photos must be manually paired to the same room or item." });
    const entry = {
      beforeEvidence: before._id,
      afterEvidence: after._id,
      location: String(body.location).trim(),
      itemName: String(body.itemName || "").trim(),
      conditionBefore: String(body.conditionBefore || ""),
      conditionAfter: String(body.conditionAfter || ""),
      observedDifferences: String(body.observedDifferences || ""),
      comments: String(body.comments || ""),
      outstandingConcerns: String(body.outstandingConcerns || ""),
      createdBy: req.user.id,
      updatedAt: new Date(),
    };
    if ([entry.observedDifferences, entry.comments, entry.outstandingConcerns].some((value) => value.length > 1500)) return res.status(400).json({ message: "Comparison notes must be 1,500 characters or fewer." });
    const comparisons = inspection.comparisons.map((value) => value.toObject());
    if (body.comparisonId) {
      const index = comparisons.findIndex((value) => String(value._id) === String(body.comparisonId));
      if (index < 0) return res.status(404).json({ message: "Comparison not found" });
      comparisons[index] = { ...comparisons[index], ...entry, createdBy: comparisons[index].createdBy };
    } else {
      comparisons.push(entry);
    }
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: inspection.revision },
      { $set: { comparisons, lastUpdatedBy: req.user.id }, $inc: { revision: 1 } },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "The report changed during the comparison update. Refresh and try again." });
    return res.status(200).json({ message: "Photo comparison saved.", inspection: updated });
  } catch (error) {
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid comparison details." });
    console.error("Comparison save failed:", error.message);
    return res.status(500).json({ message: "Could not save the photo comparison." });
  }
};

const finalizeReport = async (req, res) => {
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    if (req.user.role !== "landlord" || String(inspection.landlord) !== String(req.user.id)) return res.status(403).json({ message: "Only the property's landlord can finalize the handover report." });
    if (req.body.expectedRevision !== inspection.revision) return res.status(409).json({ message: "The report has changed. Refresh before finalizing." });
    if (inspection.status !== "Agreed / Approved" || !inspection.tenantConfirmation?.confirmed || !inspection.landlordConfirmation?.confirmed) return res.status(409).json({ message: "Finalization requires an agreed status and confirmation from both the tenant and landlord." });
    const comment = String(req.body.comment || "").trim();
    const finalNotes = String(req.body.finalNotes ?? inspection.finalNotes ?? "").trim();
    if (finalNotes.length > 3000) return res.status(400).json({ message: "Final notes must be 3,000 characters or fewer." });
    const finalizedAt = new Date();
    const property = await Property.findById(inspection.property).select("propertyName address city pincode propertyType furniture rooms");
    const [tenant, landlord] = await Promise.all([
      inspection.tenant ? User.findById(inspection.tenant).select("name email") : null,
      User.findById(inspection.landlord).select("name email"),
    ]);
    const version = (inspection.finalReportVersions?.length || 0) + 1;
    const snapshot = {
      version,
      finalizedAt,
      finalizedBy: req.user.id,
      reportId: String(inspection._id),
      status: "Finalized",
      property: property?.toObject() || { _id: inspection.property },
      tenant: tenant?.toObject() || null,
      landlord: landlord?.toObject() || null,
      inspectionType: inspection.inspectionType,
      inspectionDate: inspection.inspectionDate,
      items: inspection.items.map((item) => item.toObject()),
      meterReadings: inspection.meterReadings?.toObject?.() || inspection.meterReadings,
      generalNotes: inspection.generalNotes,
      evidence: inspection.evidence.map((photo) => photo.toObject()),
      comparisons: inspection.comparisons.map((item) => item.toObject()),
      statusHistory: inspection.statusHistory.map((entry) => entry.toObject()),
      tenantConfirmation: inspection.tenantConfirmation?.toObject?.() || inspection.tenantConfirmation,
      landlordConfirmation: inspection.landlordConfirmation?.toObject?.() || inspection.landlordConfirmation,
      dispute: inspection.dispute?.toObject?.() || inspection.dispute,
      activity: inspection.activity.map((entry) => entry.toObject()),
      finalNotes,
    };
    const history = { previousStatus: inspection.status, newStatus: "Finalized", user: req.user.id, role: req.user.role, comment, createdAt: finalizedAt };
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: inspection.revision, status: "Agreed / Approved" },
      {
        $set: { status: "Finalized", finalizedAt, finalNotes, lastUpdatedBy: req.user.id },
        $inc: { revision: 1 },
        $push: {
          statusHistory: history,
          finalReportVersions: snapshot,
          activity: { actor: req.user.id, role: req.user.role, action: "Handover report finalized (version " + version + ")", note: comment, createdAt: finalizedAt },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "The report changed during finalization. Refresh and try again." });
    return res.status(200).json({ message: "Handover report finalized as version " + version + ".", inspection: updated, finalReport: snapshot });
  } catch (error) {
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid final report details." });
    console.error("Report finalization failed:", error.message);
    return res.status(500).json({ message: "Could not finalize the handover report." });
  }
};

const createRevision = async (req, res) => {
  try {
    const result = await findAccessibleInspection(req.params.id, req.user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const inspection = result.inspection;
    if (req.user.role !== "landlord" || String(inspection.landlord) !== String(req.user.id)) return res.status(403).json({ message: "Only the landlord can open a report revision." });
    if (inspection.status !== "Finalized") return res.status(409).json({ message: "Only finalized reports can be reopened as a revision." });
    if (req.body.expectedRevision !== inspection.revision) return res.status(409).json({ message: "The report has changed. Refresh and try again." });
    const comment = String(req.body.comment || "").trim();
    if (!comment) return res.status(400).json({ message: "Explain why this report needs a revision." });
    const history = { previousStatus: "Finalized", newStatus: "Inspection in Progress", user: req.user.id, role: req.user.role, comment, createdAt: new Date() };
    const updated = await Inspection.findOneAndUpdate(
      { _id: inspection._id, revision: inspection.revision, status: "Finalized" },
      {
        $set: { status: "Inspection in Progress", responsibleRole: "landlord", finalizedAt: null, "tenantConfirmation.confirmed": false, "tenantConfirmation.confirmedAt": null, "landlordConfirmation.confirmed": false, "landlordConfirmation.confirmedAt": null, lastUpdatedBy: req.user.id },
        $inc: { revision: 1 },
        $push: { statusHistory: history, activity: { actor: req.user.id, role: req.user.role, action: "Final report revision opened", note: comment } },
      },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "The report changed during this revision request." });
    return res.status(200).json({ message: "A new working revision has been opened. The previous finalized snapshot is preserved.", inspection: updated });
  } catch (error) {
    if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid revision request." });
    console.error("Report revision failed:", error.message);
    return res.status(500).json({ message: "Could not open a report revision." });
  }
};

module.exports = { transitionStatus, uploadEvidence, getEvidenceFile, deleteEvidence, saveComparison, finalizeReport, createRevision };
