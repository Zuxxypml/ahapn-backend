import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import waitlistRoutes from "./routes/waitlistRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "https://ahapnng.org" }));
app.use("/uploads", express.static("uploads"));

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/ahapnDatabase")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Use routes
app.use("/api", waitlistRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
