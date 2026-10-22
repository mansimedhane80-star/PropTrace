const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        passwordResetTokenHash: { type: String, default: null },
        passwordResetExpiresAt: { type: Date, default: null },

        role: {
            type: String,
            enum: ["landlord", "tenant"],
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
