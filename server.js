// server.js
import mongoose from "mongoose";
import app from "./app.js";
import RegId from "./models/RegId.model.js";
import LateRegId from "./models/LateRegIds.model.js";
import initialRegIds from "./data/initialRegIds.js";
import initialLateRegIds from "./data/initialLateRegIds.js";
import dotenv from "dotenv";

dotenv.config();

// Function to initialize RegIds
async function initializeRegIds() {
  const count = await RegId.countDocuments();
  if (count === 0) {
    console.log("Initializing registration IDs...");
    const regIdDocs = initialRegIds.map((regId) => ({ regId }));
    await RegId.insertMany(regIdDocs);
    console.log(`Initialized ${initialRegIds.length} registration IDs.`);
  }
}

// Function to initialize LateRegIds
async function initializeLateRegIds() {
  const count = await LateRegId.countDocuments();
  if (count === 0) {
    console.log("Initializing late registration IDs...");
    const lateRegDocs = initialLateRegIds.map((regId) => ({ regId }));
    await LateRegId.insertMany(lateRegDocs);
    console.log(
      `Initialized ${initialLateRegIds.length} late registration IDs.`
    );
  }
}

// Main Start Server Function
async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/ahapnDatabase"
    );
    console.log("MongoDB connected");

    await initializeRegIds();
    await initializeLateRegIds();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Run the server
startServer();
