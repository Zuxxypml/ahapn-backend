// app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import path from "path";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({ origin: "https://ahapnng.org" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api", waitlistRoutes);

export default app;
