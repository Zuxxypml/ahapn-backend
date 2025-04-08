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
  eventId: { type: String, required: true, unique: true }, // e.g., "edo-ahapn-0001"
  timestamp: { type: Date, default: Date.now },
});
const Waitlist = mongoose.model("Waitlist", waitlistSchema);

// Registration ID Schema
const regIdSchema = new mongoose.Schema({
  regId: { type: String, required: true, unique: true },
});
const RegId = mongoose.model("RegId", regIdSchema);

// Initial 70 hardcoded registration IDs (20 original + 50 new)
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
  "REG371294",
  "REG482105",
  "REG593216",
  "REG604327",
  "REG715438",
  "REG826549",
  "REG937650",
  "REG048761",
  "REG159872",
  "REG260983",
  "REG371094",
  "REG482105",
  "REG593216",
  "REG704327",
  "REG815438",
  "REG926549",
  "REG037650",
  "REG148761",
  "REG259872",
  "REG360983",
  "REG471094",
  "REG582105",
  "REG693216",
  "REG804327",
  "REG915438",
  "REG026549",
  "REG137650",
  "REG248761",
  "REG359872",
  "REG460983",
  "REG571094",
  "REG682105",
  "REG793216",
  "REG904327",
  "REG015438",
  "REG126549",
  "REG237650",
  "REG348761",
  "REG459872",
  "REG560983",
  "REG671094",
  "REG782105",
  "REG893216",
  "REG904327",
  "REG015438",
  "REG126549",
  "REG237650",
  "REG348761",
  "REG459872",
  "REG560983",
];

// Initialize regIds in MongoDB
async function initializeRegIds() {
  const count = await RegId.countDocuments();
  if (count === 0) {
    console.log("Initializing registration IDs...");
    const regIdDocs = initialRegIds.map((regId) => ({ regId }));
    await RegId.insertMany(regIdDocs);
    console.log("Initialized 70 registration IDs.");
  }
}

// Load validRegIds from MongoDB
async function loadValidRegIds() {
  const regIds = await RegId.find().select("regId -_id");
  return regIds.map((doc) => doc.regId);
}

// Generate sequential eventId (e.g., "edo-ahapn-0001" with 4 digits)
async function generateEventId() {
  const prefix = "edo-ahapn-";
  const lastEntry = await Waitlist.findOne().sort({ timestamp: -1 });
  const lastNumber =
    lastEntry && lastEntry.eventId.startsWith(prefix)
      ? parseInt(lastEntry.eventId.split("-")[2], 10)
      : 0;
  const nextNumber = lastNumber + 1;
  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}

// Generate PDF with centered info
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

    // AHAPN mask (left)
    doc.image("./ahapn-logo.png", 207, 60, { width: 70 });

    // Photo (centered)
    if (user.imageUrl) {
      try {
        doc.image(user.imageUrl.replace(/^\//, ""), 108, 60, {
          width: 80,
          height: 100,
        });
        doc.rect(108, 60, 80, 100).stroke("#006400");
      } catch (error) {
        console.error("Error loading attendee image:", error);
      }
    }

    // Benin logo (right)
    doc.image("./benin-mask.png", 20, 60, { width: 80, opacity: 0.2 });

    // Details below photo (centered, wrapped for long names)
    doc
      .fontSize(10)
      .fillColor("#333")
      .text(`Name: ${user.name.toUpperCase()}`, 20, 200, {
        width: 257,
        align: "center",
      });
    doc
      .fontSize(10)
      .fillColor("#333")
      .text(`State: ${user.state.toUpperCase()}`, 20, 220, {
        width: 257,
        align: "center",
      });
    doc
      .fontSize(12)
      .fillColor("#006400")
      .text(`ID: ${user.eventId}`, 20, 240, { width: 257, align: "center" });
    doc
      .fontSize(8)
      .fillColor("#666")
      .font("Times-Italic")
      .text(`Valid: Aug 4–9, 2025`, 20, 260, { width: 257, align: "center" });

    // Barcode
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: user.eventId,
        scale: 2,
        height: 12,
        includetext: true,
      },
      (err, barcodeBuffer) => {
        if (err) reject(err);
        else {
          doc.image(barcodeBuffer, 60, 330, { width: 180 });
          // Footer
          doc
            .font("Times-Roman")
            .fontSize(9)
            .fillColor("#006400")
            .text("AHAPN | ahapn2021@gmail.com", 0, 390, { align: "center" });
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
