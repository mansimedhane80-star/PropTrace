const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MONGO_URI is missing. Add it to server/.env before starting the backend.");
    }

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
        console.log(`MongoDB connected${mongoose.connection.name ? ` (${mongoose.connection.name})` : ""}`);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }
};

module.exports = connectDB;
