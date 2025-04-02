import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import PDFKit from "pdfkit";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import bwipjs from "bwip-js";
import multer from "multer";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://ahapnng.org' }));
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/edo2025")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Waitlist Schema
const waitlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  state: { type: String, required: true },
  regId: { type: String, required: true },
  imageUrl: { type: String }, // Store the path to the uploaded image
  regNumber: { type: Number, required: true }, // Ascending registration number
  eventId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
});
const Waitlist = mongoose.model("Waitlist", waitlistSchema);

// Hardcoded list of valid regIds
const validRegIds = ["REG001", "REG002", "REG003", "REG004", "REG005"]; // Add more as needed

// Track registration number (incremented for each new entry)
let regNumberCounter = 0;

// Generate a unique 6-digit event ID (e.g., edoahapn-001, edoahapn-002, ...)
async function generateEventId() {
  const prefix = "edoahapn-";
  let id;
  let isUnique = false;
  while (!isUnique) {
    const randomNum = Math.floor(100 + Math.random() * 900).toString();
    id = prefix + randomNum.padStart(3, "0"); // e.g., edoahapn-123
    const existing = await Waitlist.findOne({ eventId: id });
    if (!existing) isUnique = true;
  }
  return id;
}

// Function to generate PDF as a buffer
function generatePDFBuffer(user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A6", margin: 10 }); // A6 page with smaller margin
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Add AHAPN logo at top-left inside the card
    doc.image("./ahapn-logo.png", 27, 330, { width: 25, opacity: 0.1 }); // Scaled down for A6

    // Add Benin mask logo at bottom-right inside the card
    doc.image("./benin-mask.png", 260, 330, { width: 25, opacity: 0.1 }); // Scaled down for A6

    // Add attendee image in top-right corner inside the card
    if (user.imageUrl) {
      try {
        doc.image(user.imageUrl.replace(/^\//, ""), 215, 50, {
          width: 70,
          height: 80,
        }); // Scaled down for A6
      } catch (error) {
        console.error("Error loading attendee image:", error);
      }
    }

    // Header
    doc
      .fontSize(12)
      .text("Edo 2025 Conference ID", { align: "center", color: "#006400" });

    // ID Card Layout (bordered box with user details)
    doc.rect(25, 50, 260, 310).stroke("#006400"); // Adjusted for A6 size
    doc
      .fontSize(10)
      .text(`ID: ${user.regNumber}`, 30, 120, { color: "#006400" });
    doc.text(`Name: ${user.name.toUpperCase()}`, 30, 140, { color: "#006400" });
    doc.text(`State/Country: ${user.state.toUpperCase()}`, 30, 160, {
      color: "#006400",
    });
    doc.text(`Reg Number: ${user.regNumber}`, 30, 180, { color: "#006400" });
    doc.text(`Valid for: Edo 2025 (August 4–9, 2025)`, 30, 200, {
      color: "#006400",
    });

    // Add barcode
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: user.eventId,
        scale: 2,
        height: 8,
        includetext: true,
      },
      (err, barcodeBuffer) => {
        if (err) reject(err);
        else {
          doc.image(barcodeBuffer, 30, 250, { width: 120 }); // Adjusted for A6 size
          doc
            .moveDown(11)
            .fontSize(6)
            .text(
              "Association of Hospital and Administrative Pharmacists of Nigeria (AHAPN)",
              { align: "center", color: "#006400" }
            )
            .text("Contact: info@ahapn.org | Edo 2025 Conference", {
              align: "center",
              color: "#006400",
            });
          doc.end();
        }
      }
    );
  });
}

// API: Add to waitlist with image upload, email notification, and PDF attachment
app.post("/api/waitlist", upload.single("image"), async (req, res) => {
  const { name, email, phoneNumber, state, regId } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    // Validate regId
    if (!validRegIds.includes(regId)) {
      return res.status(400).json({ message: "Invalid registration ID" });
    }

    const eventId = await generateEventId();
    regNumberCounter += 1; // Increment registration number
    const regNumber = regNumberCounter;

    const newEntry = new Waitlist({
      name,
      email,
      phoneNumber,
      state,
      regId,
      imageUrl,
      regNumber,
      eventId,
    });

    // Generate PDF buffer
    const pdfBuffer = await generatePDFBuffer(newEntry);

    // Send email notification with PDF attachment
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: `${process.env.EMAIL_USER}`, // Set in .env
        pass: `${process.env.EMAIL_PASS}`, // App-specific password
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Edo 2025 Waitlist",
      text: `Dear ${name},\n\nYou have been added to the Edo 2025 waitlist!\nEvent ID: ${eventId}\nReg Number: ${regNumber}\nPlease keep this ID for access to the conference.\n\nBest regards,\nAHAPN Team`,
      attachments: [
        {
          filename: `event_id_${email}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    res
      .status(201)
      .json({ message: "Added to waitlist with ID sent via email!", eventId });
    await newEntry.save();
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error adding to waitlist", error });
  }
});

// API: Fetch user by email for ID retrieval
app.get("/api/waitlist/:email", async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ eventId: user.eventId, regNumber: user.regNumber });
  } catch (error) {
    res.status(400).json({ message: "Error fetching ID", error });
  }
});

// API: Generate and serve event ID as a styled PDF (A6 size with adjusted image positions)
app.get("/api/event-id-pdf/:eventId", async (req, res) => {
  try {
    console.log("Fetching event ID PDF for eventId:", req.params.eventId);
    const user = await Waitlist.findOne({ eventId: req.params.eventId });
    if (!user) {
      console.log(
        "User not found in database for eventId:",
        req.params.eventId
      );
      return res.status(404).json({ message: "User not found" });
    }

    const doc = new PDFKit({ size: "A6", margin: 10 }); // A6 page with smaller margin
    doc.rect(25, 50, 260, 310).stroke("#006400"); // Adjusted for A6 size

    // Add AHAPN logo at top-left inside the card
    doc.image("./ahapn-logo.png", 27, 330, { width: 25, opacity: 0.1 }); // Scaled down for A6 (x: 30, y: 340)

    // Add Benin mask logo at bottom-right inside the card
    doc.image("./benin-mask.png", 260, 330, { width: 25, opacity: 0.1 }); // Scaled down for A6 (x: 265, y: 340)

    // Add attendee image in top-right corner inside the card
    if (user.imageUrl) {
      try {
        doc.image(user.imageUrl.replace(/^\//, ""), 215, 50, {
          width: 70,
          height: 80,
        }); // Scaled down for A6 (x: 228, y: 70)
      } catch (error) {
        console.error("Error loading attendee image:", error);
      }
    }

    // Header
    doc
      .fontSize(12)
      .text("Edo 2025 Conference ID", { align: "center", color: "#006400" });

    // ID Card Layout (bordered box with user details)
    doc
      .fontSize(10)
      .text(`ID: ${user.regNumber}`, 30, 120, { color: "#006400" });
    doc.text(`Name: ${user.name.toUpperCase()}`, 30, 140, { color: "#006400" });
    doc.text(`State/Country: ${user.state.toUpperCase()}`, 30, 160, {
      color: "#006400",
    });
    doc.text(`Reg Number: ${user.regNumber}`, 30, 180, { color: "#006400" });
    doc.text(`Valid for: Edo 2025 (August 4–9, 2025)`, 30, 200, {
      color: "#006400",
    });

    // Add barcode
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: user.eventId,
      scale: 2,
      height: 8,
      includetext: true,
    });
    doc.image(barcodeBuffer, 30, 250, { width: 120 }); // Adjusted for A6 size

    // Footer
    doc
      .moveDown(11)
      .fontSize(6)
      .text(
        "Association of Hospital and Administrative Pharmacists of Nigeria (AHAPN)",
        { align: "center", color: "#006400" }
      );
    doc.text("Contact: info@ahapn.org | Edo 2025 Conference", {
      align: "center",
      color: "#006400",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=event_id_${user.email}.pdf`
    );
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res
      .status(400)
      .json({ message: "Error generating PDF", error: error.message });
  }
});
// Future: Certificate endpoint (placeholder)
app.get("/api/certificate/:eventId", async (req, res) => {
  res.json({ message: "Certificate generation coming soon!" });
});

app.listen(process.env.PORT || 5000, () => console.log("Server on port 5000"));

// {
//   "scripts": {
//     "start": "pm2 start index.js --name 'edo-api'"
//   }
//}
