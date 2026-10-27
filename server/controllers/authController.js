const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Property = require("../models/Property");
const crypto = require("crypto");
const { validateInvitation, invitationFailureMessage } = require("../services/invitationValidation");


const registerUser = async (req, res) => {
    try {
        const { name, email, password, role, invitationToken } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: "Please fill all fields"
            });
        }

        if (!["landlord", "tenant"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        let invitation = null;
        let property = null;

        // Tenants must register through a valid invitation.
        if (role === "tenant") {
            const normalizedInvitationToken = typeof invitationToken === "string" ? invitationToken.trim() : "";
            if (!normalizedInvitationToken) {
                return res.status(400).json({
                    message: "A valid invitation is required"
                });
            }

            invitation = await Invitation.findOne({ token: normalizedInvitationToken });
            const validation = validateInvitation(invitation, {
                token: normalizedInvitationToken,
                email: normalizedEmail,
            });

            if (!validation.valid) {
                if (validation.reason === "expired" && invitation.status === "Pending") {
                    invitation.status = "Expired";
                    await invitation.save();
                }
                return res.status(400).json({
                    message: invitationFailureMessage(validation.reason)
                });
            }

            property = await Property.findOne({
                _id: invitation.property,
                landlord: invitation.landlord,
                tenant: null
            });

            if (!property) {
                return res.status(400).json({
                    message: "The invited property is no longer available"
                });
            }
        }

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                message: "Please provide a valid name and email"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role
        });

        // Link the newly registered tenant to the invited property.
        if (role === "tenant") {
            property.tenant = user._id;
            property.status = "Occupied";
            await property.save();

            invitation.status = "Accepted";
            await invitation.save();
        }

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Registration failed.");
        res.status(500).json({
            message: "Registration failed"
        });
    }
};



const loginUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Please fill all fields"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (user.role !== role) {
            return res.status(401).json({
                message: "Invalid role"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login failed.");
        res.status(500).json({
            message: "Login failed"
        });
    }
};


const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("name email role createdAt");
        if (!user) return res.status(404).json({ message: "Account not found" });
        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ message: "Could not load profile." });
    }
};

const updateProfile = async (req, res) => {
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid name and email address." });
        const conflict = await User.findOne({ email, _id: { $ne: req.user.id } }).select("_id");
        if (conflict) return res.status(409).json({ message: "That email address is already in use." });
        const user = await User.findByIdAndUpdate(req.user.id, { $set: { name, email } }, { new: true, runValidators: true }).select("name email role createdAt");
        if (!user) return res.status(404).json({ message: "Account not found" });
        return res.json({ message: "Profile updated.", user });
    } catch (error) {
        if (error.name === "ValidationError") return res.status(400).json({ message: "Please check the profile details." });
        console.error("Profile update failed:", error.message);
        return res.status(500).json({ message: "Could not update profile." });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ message: "New password must be between 8 and 128 characters." });
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "Account not found" });
        if (typeof currentPassword !== "string" || !await bcrypt.compare(currentPassword, user.password)) return res.status(401).json({ message: "Current password is incorrect." });
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetTokenHash = null;
        user.passwordResetExpiresAt = null;
        await user.save();
        return res.json({ message: "Password changed successfully." });
    } catch (error) {
        console.error("Password change failed:", error.message);
        return res.status(500).json({ message: "Could not change password." });
    }
};

const forgotPassword = async (req, res) => {
    const genericMessage = "If an account uses that email, a password reset link will be sent.";
    try {
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(200).json({ message: genericMessage });
        if (!process.env.RESEND_API_KEY || !process.env.PASSWORD_RESET_FROM || !process.env.CLIENT_URL) {
            return res.status(503).json({ message: "Password reset email is not configured. Set RESEND_API_KEY, PASSWORD_RESET_FROM, and CLIENT_URL on the server." });
        }
        const user = await User.findOne({ email });
        if (!user) return res.status(200).json({ message: genericMessage });
        const rawToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();
        const resetUrl = new URL("/", process.env.CLIENT_URL);
        resetUrl.searchParams.set("page", "resetPassword");
        resetUrl.searchParams.set("token", rawToken);
        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ from: process.env.PASSWORD_RESET_FROM, to: [user.email], subject: "Reset your PropTrace password", text: "Use this secure link to set a new PropTrace password. It expires in 30 minutes: " + resetUrl.toString(), html: "<p>Use the secure link below to set a new PropTrace password. It expires in 30 minutes.</p><p><a href=\"" + resetUrl.toString() + "\">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>" }),
        });
        if (!emailResponse.ok) {
            user.passwordResetTokenHash = null;
            user.passwordResetExpiresAt = null;
            await user.save();
            console.error("Password reset email delivery failed with HTTP " + emailResponse.status);
            return res.status(502).json({ message: "Could not deliver the reset email. Check the server email configuration and try again." });
        }
        return res.json({ message: genericMessage });
    } catch (error) {
        console.error("Password reset request failed:", error.message);
        return res.status(500).json({ message: "Could not process the password reset request." });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (typeof token !== "string" || token.length < 32 || token.length > 200) return res.status(400).json({ message: "This reset link is invalid or expired. Request a new one." });
        if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } });
        if (!user) return res.status(400).json({ message: "This reset link is invalid or expired. Request a new one." });
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetTokenHash = null;
        user.passwordResetExpiresAt = null;
        await user.save();
        return res.json({ message: "Password reset successfully. You can now sign in." });
    } catch (error) {
        console.error("Password reset failed:", error.message);
        return res.status(500).json({ message: "Could not reset password." });
    }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile, changePassword, forgotPassword, resetPassword };
