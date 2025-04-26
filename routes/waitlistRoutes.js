import express from "express";
import multer from "multer";
import {
  addToWaitlist,
  getWaitlistCount,
  getUserByEmail,
  downloadEventIdPdf,
} from "../controllers/waitlistController.js";

const router = express.Router();

// Multer upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Routes

// Register a new user on waitlist (with optional image upload)
router.post("/waitlist", upload.single("image"), addToWaitlist);

// Get total count of registered users
router.get("/waitlist/count", getWaitlistCount);

// Get a user's eventId by their email
router.get("/waitlist/:email", getUserByEmail);

// Add download route!
router.get("/event-id-pdf/:eventId", downloadEventIdPdf);

export default router;
