import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import waitlistRoutes from "./routes/waitlist.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// ===================== CONFIGURATION ===================== //
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ===================== MIDDLEWARE ===================== //

// Security Headers
app.use(helmet());

// Rate Limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// CORS (Restrict to your domain + localhost for development)
const corsOptions = {
  origin: [
    "https://ahapnng.org",
    "http://localhost:3000", // Remove in production
  ],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Request Logging
app.use(morgan("dev"));

// Body Parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Static Files (with cache control)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.set("Cache-Control", "public, max-age=31536000");
    },
  })
);

// ===================== ROUTES ===================== //
app.use("/api", waitlistRoutes);

// ===================== ERROR HANDLING ===================== //

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;
