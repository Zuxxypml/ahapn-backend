import express from "express";
import multer from "multer";
import {
  addToWaitlist,
  getWaitlistCount,
  getUserByEmail,
  downloadEventIdPdf,
  downloadCertificateByEmail,
  sendCertificatesToAllUsers,
} from "../controllers/waitlist.controllers.js";

const router = express.Router();

// ===================== MULTER CONFIG ===================== //
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save to 'uploads/' directory
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp + original name
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images (optional security)
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// ===================== ROUTES ===================== //

// 1. Add to Waitlist (with image upload)
router.post("/waitlist", upload.single("image"), addToWaitlist);

// 2. Get Waitlist Count
router.get("/waitlist/count", getWaitlistCount);

// 3. Get User by Email
router.get("/waitlist/:email", getUserByEmail);

// 4. Download Event ID PDF
router.get("/event-id-pdf/:eventId", downloadEventIdPdf);

// 5. Download Certificate by Email
router.get("/download-certificate/:email", downloadCertificateByEmail);

// 6. [ADMIN] Send Certificates to All Users (secured)
router.get("/admin/send-certificates", async (req, res) => {
  // Add authentication middleware here if needed
  try {
    await sendCertificatesToAllUsers();
    res.json({ message: "Certificates sent to all users!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send certificates", error: error.message });
  }
});

export default router;
