import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import initialRegIds from "./data/initialRegIds.js";
import RegId from "./models/RegId.model.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "https://ahapnng.org" }));
app.use("/uploads", express.static("uploads"));
app.use("/api", waitlistRoutes);

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/ahapnDatabase")
  .then(async () => {
    console.log("MongoDB connected");
    await initializeRegIds(); // 👈 initialize regIds once database connected
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize RegIds if database empty
async function initializeRegIds() {
  const count = await RegId.countDocuments();
  if (count === 0) {
    console.log("Initializing registration IDs...");
    const regIdDocs = initialRegIds.map((regId) => ({ regId }));
    await RegId.insertMany(regIdDocs);
    console.log(`Initialized ${initialRegIds.length} registration IDs.`);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
