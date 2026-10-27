const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const protect = require("./middleware/authMiddleware");
const propertyRoutes = require("./routes/propertyRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const inspectionRoutes = require("./routes/inspectionRoutes");

const app = express();

// Middleware
const clientOrigin = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
app.use(cors({ origin: clientOrigin }));
// Inspection evidence is stored as data URLs; allow several compressed photos per save.
app.use(express.json({ limit: "18mb" }));

// Authentication routes
app.use("/api/auth", authRoutes);

app.use("/api/properties", propertyRoutes);

app.use("/api/invitations", invitationRoutes);

app.use("/api/reports", reportRoutes);
// Test route
app.get("/", (req, res) => {
    res.send("PropTrace Server is running");
});

app.use("/api/inspections", inspectionRoutes);

app.get("/api/health", (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? "ok" : "unavailable",
        database: databaseConnected ? "connected" : "disconnected",
    });
});

const PORT = process.env.PORT || 5000;
app.get("/api/auth/profile", protect, (req, res) => {
    res.json({
        message: "Protected route accessed successfully",
        user: req.user
    });
});
const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server ready on port ${PORT}`);
    });
};

startServer().catch(() => {
    console.error("Backend startup aborted because MongoDB is unavailable.");
    process.exitCode = 1;
});
