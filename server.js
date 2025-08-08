import mongoose from "mongoose";
import app from "./app.js";
import RegId from "./models/RegId.model.js";
import LateRegId from "./models/LateRegIds.model.js";
import initialRegIds from "./data/initialRegIds.js";
import initialLateRegIds from "./data/initialLateRegIds.js";
import dotenv from "dotenv";
import cron from "node-cron";
import { sendCertificatesToAllUsers } from "./controllers/waitlist.controllers.js";

// ===================== CONFIGURATION ===================== //
dotenv.config({ path: ".env" });

// ===================== DATABASE INITIALIZATION ===================== //

/**
 * Initialize registration IDs if database is empty
 */
async function initializeRegIds() {
  try {
    const count = await RegId.estimatedDocumentCount();
    if (count === 0) {
      console.log("📝 Initializing registration IDs...");
      await RegId.insertMany(initialRegIds.map((regId) => ({ regId })));
      console.log(`✅ Initialized ${initialRegIds.length} registration IDs`);
    }
  } catch (error) {
    console.error("❌ Failed to initialize registration IDs:", error);
    throw error;
  }
}

/**
 * Initialize late registration IDs if database is empty
 */
async function initializeLateRegIds() {
  try {
    const count = await LateRegId.estimatedDocumentCount();
    if (count === 0) {
      console.log("📝 Initializing late registration IDs...");
      await LateRegId.insertMany(initialLateRegIds.map((regId) => ({ regId })));
      console.log(
        `✅ Initialized ${initialLateRegIds.length} late registration IDs`
      );
    }
  } catch (error) {
    console.error("❌ Failed to initialize late registration IDs:", error);
    throw error;
  }
}

// ===================== SERVER STARTUP ===================== //

/**
 * Connect to MongoDB and start Express server
 */
async function startServer() {
  try {
    // MongoDB Connection
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/ahapnDatabase";
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("📦 Connected to MongoDB");

    // Initialize Data
    await Promise.all([initializeRegIds(), initializeLateRegIds()]);

    // Start Server
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🌐 http://localhost:${port}`);
    });

    // Graceful Shutdown
    process.on("SIGTERM", () => {
      console.log("🛑 SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log("🔒 MongoDB connection closed");
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

// ===================== SCHEDULED JOBS ===================== //

// Schedule to run every day at 2:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("Starting daily certificate sending job...");
  await sendCertificatesToAllUsers();
  console.log("Daily certificate sending job finished.");
});

// ===================== ENTRY POINT ===================== //
startServer();
