import express from "express";
import multer from "multer";
import {
  addToWaitlist,
  getWaitlistCount,
  getUserByEmail,
} from "../controllers/waitlistController.js";

const router = express.Router();

// Upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Routes
router.post("/waitlist", upload.single("image"), addToWaitlist);
router.get("/waitlist/count", getWaitlistCount);
router.get("/waitlist/:email", getUserByEmail);

export default router;
