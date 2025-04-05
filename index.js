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
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "https://ahapnng.org" }));
app.use("/uploads", express.static("uploads"));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/ahapnDatabase")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Waitlist Schema
const waitlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  state: { type: String, required: true },
  regId: { type: String, required: true },
  imageUrl: { type: String },
  eventId: { type: String, required: true, unique: true }, // e.g., "edoahapn-001"
  timestamp: { type: Date, default: Date.now },
});
const Waitlist = mongoose.model("Waitlist", waitlistSchema);

// Registration ID Schema
const regIdSchema = new mongoose.Schema({
  regId: { type: String, required: true, unique: true },
});
const RegId = mongoose.model("RegId", regIdSchema);

// Initial hardcoded registration IDs
const initialRegIds = [
  "REG174920",
  "REG305187",
  "REG428693",
  "REG592104",
  "REG687251",
  "REG713409",
  "REG829346",
  "REG947102",
  "REG106583",
  "REG238491",
  "REG349872",
  "REG451926",
  "REG567389",
  "REG672194",
  "REG789305",
  "REG813506",
  "REG927483",
  "REG034197",
  "REG159382",
  "REG246801",
];

// Initialize regIds in MongoDB
async function initializeRegIds() {
  const count = await RegId.countDocuments();
  if (count === 0) {
    console.log("Initializing registration IDs...");
    const regIdDocs = initialRegIds.map((regId) => ({ regId }));
    await RegId.insertMany(regIdDocs);
    console.log("Initialized 20 registration IDs.");
  }
}

// Load validRegIds from MongoDB
async function loadValidRegIds() {
  const regIds = await RegId.find().select("regId -_id");
  return regIds.map((doc) => doc.regId);
}

// Generate sequential eventId (e.g., "edoahapn-001")
async function generateEventId() {
  const prefix = "edoahapn-";
  const lastEntry = await Waitlist.findOne().sort({ timestamp: -1 });
  const lastNumber =
    lastEntry && lastEntry.eventId.startsWith(prefix)
      ? parseInt(lastEntry.eventId.split("-")[1], 10)
      : 0;
  const nextNumber = lastNumber + 1;
  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

// Generate PDF with new ID card design
function generatePDFBuffer(user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A6", margin: 10 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Background gradient
    const gradient = doc.linearGradient(0, 0, 0, 420);
    gradient.stop(0, "#e6ffe6").stop(1, "#b3ffb3");
    doc.rect(0, 0, 297, 420).fill(gradient);

    // Header bar
    doc.rect(0, 0, 297, 40).fill("#006400");
    doc
      .fontSize(14)
      .fillColor("white")
      .text("Edo 2025 Conference", 0, 12, { align: "center" });

    // Rounded border
    doc.roundedRect(15, 50, 267, 350, 5).stroke("#006400").lineWidth(2);

    // Photo
    if (user.imageUrl) {
      try {
        doc.image(user.imageUrl.replace(/^\//, ""), 20, 60, {
          width: 80,
          height: 100,
        });
        doc.rect(20, 60, 80, 100).stroke("#006400");
      } catch (error) {
        console.error("Error loading attendee image:", error);
      }
    }

    // Details
    doc
      .fontSize(12)
      .fillColor("#006400")
      .text(`ID: ${user.eventId}`, 110, 70, { align: "left" });
    doc
      .fontSize(10)
      .fillColor("#333")
      .text(`Name: ${user.name.toUpperCase()}`, 110, 90);
    doc
      .fontSize(10)
      .fillColor("#333")
      .text(`State: ${user.state.toUpperCase()}`, 110, 105);
    doc
      .fontSize(8)
      .fillColor("#666")
      .font("Times-Italic")
      .text(`Valid: Aug 4–9, 2025`, 110, 120);

    // Barcode
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: user.eventId,
        scale: 2,
        height: 10,
        includetext: true,
      },
      (err, barcodeBuffer) => {
        if (err) reject(err);
        else {
          doc.image(barcodeBuffer, 70, 280, { width: 150 });
          // Footer
          doc.image("./ahapn-logo.png", 128, 350, { width: 40 });
          doc
            .font("Times-Roman")
            .fontSize(6)
            .fillColor("#006400")
            .text("AHAPN | info@ahapn.org", 0, 390, { align: "center" });
          // Watermark
          doc.image("./benin-mask.png", 80, 150, { width: 120, opacity: 0.2 });
          doc.end();
        }
      }
    );
  });
}

// Initialize regIds on startup
initializeRegIds().catch(console.error);

// API: Add to waitlist
app.post("/api/waitlist", upload.single("image"), async (req, res) => {
  try {
    const { name, email, phoneNumber, state, regId } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const validRegIds = await loadValidRegIds();
    if (!validRegIds.includes(regId)) {
      return res
        .status(400)
        .json({ message: "Invalid or expired registration ID" });
    }

    const eventId = await generateEventId();

    const newEntry = {
      name,
      email,
      phoneNumber,
      state,
      regId,
      imageUrl,
      eventId,
    };

    await Waitlist.create(newEntry);
    await RegId.deleteOne({ regId });
    console.log("Remaining valid regIds:", (await loadValidRegIds()).length);

    const pdfBuffer = await generatePDFBuffer(newEntry);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Edo 2025 Waitlist",
      text: `Dear ${name},\n\nYou have been added to the Edo 2025 waitlist!\nEvent ID: ${eventId}\nPlease keep this ID for access to the conference.\n\nBest regards,\nAHAPN Team`,
      attachments: [
        {
          filename: `event_id_${email}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return res
      .status(201)
      .json({ message: "Added to waitlist with ID sent via email!", eventId });
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Image file too large. Maximum size is 5 MB." });
    }
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Email already registered on the waitlist." });
    }
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error adding to waitlist", error: error.message });
  }
});

// API: Fetch user by email
app.get("/api/waitlist/:email", async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ eventId: user.eventId });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Error fetching ID", error: error.message });
  }
});

// API: Generate and serve event ID PDF
app.get("/api/event-id-pdf/:eventId", async (req, res) => {
  try {
    const user = await Waitlist.findOne({ eventId: req.params.eventId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pdfBuffer = await generatePDFBuffer(user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=event_id_${user.email}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    return res
      .status(400)
      .json({ message: "Error generating PDF", error: error.message });
  }
});

app.listen(process.env.PORT || 5000, () => console.log("Server on port 5000"));
