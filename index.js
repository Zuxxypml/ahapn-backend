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
await mongoose
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

// New initialRegIds from nationaldues-AHAPN National JAN.csv (padded numeric only)
const initialRegIds = [
  "021175",
  "032491",
  "006438",
  "011170",
  "005593",
  "014785",
  "014153",
  "009346",
  "007182",
  "007561",
  "018528",
  "009821",
  "014741",
  "017356",
  "005783",
  "010642",
  "011225",
  "010214",
  "004503",
  "019537",
  "023366",
  "010840",
  "011897",
  "012415",
  "020687",
  "015362",
  "021403",
  "008040",
  "031739",
  "016412",
  "003935",
  "017611",
  "009149",
  "005806",
  "007635",
  "012352",
  "012627",
  "030923",
  "007931",
  "012421",
  "017205",
  "011161",
  "010707",
  "015275",
  "017466",
  "007325",
  "007903",
  "013122",
  "016873",
  "023853",
  "012204",
  "006560",
  "009533",
  "012353",
  "001022",
  "006979",
  "017632",
  "022570",
  "017777",
  "014139",
  "005960",
  "005987",
  "009856",
  "015152",
  "008540",
  "009457",
  "011382",
  "010761",
  "021446",
  "005513",
  "011125",
  "011559",
  "008763",
  "035179",
  "018775",
  "013280",
  "011623",
  "031502",
  "008147",
  "025679",
  "029470",
  "009789",
  "026994",
  "026119",
  "029323",
  "024346",
  "009302",
  "007011",
  "014424",
  "013110",
  "021197",
  "029608",
  "021756",
  "026685",
  "024310",
  "026572",
  "012052",
  "016707",
  "023942",
  "029565",
  "012831",
  "020572",
  "005846",
  "030920",
  "009972",
  "030939",
  "015040",
  "009032",
  "010739",
  "017180",
  "013725",
  "007986",
  "017830",
  "006053",
  "012711",
  "015153",
  "021425",
  "027605",
  "019166",
  "022292",
  "025383",
  "021526",
  "008057",
  "021778",
  "007806",
  "016541",
  "009413",
  "015615",
  "008707",
  "015846",
  "018234",
  "010638",
  "011156",
  "017672",
  "016180",
  "007426",
  "021636",
  "007754",
  "007278",
  "013275",
  "007860",
  "020579",
  "011696",
  "018957",
  "009940",
  "015541",
  "026396",
  "015775",
  "026316",
  "034116",
  "005053",
  "008472",
  "026977",
  "023989",
  "027142",
  "031145",
  "005951",
  "011286",
  "012741",
  "007872",
  "006973",
  "025082",
  "007969",
  "025313",
  "018972",
  "010884",
  "012170",
  "012412",
  "031206",
  "007703",
  "015197",
  "015112",
  "017456",
  "014975",
  "011171",
  "008565",
  "011263",
  "011812",
  "005938",
  "007846",
  "022922",
  "008190",
  "023695",
  "013962",
  "005056",
  "006143",
  "011162",
  "009008",
  "020230",
  "007853",
  "017388",
  "013481",
  "013907",
  "008855",
  "010827",
  "013493",
  "010121",
  "005069",
  "012121",
  "021224",
  "019798",
  "008691",
  "018923",
  "011497",
  "015140",
  "006339",
  "016439",
  "011440",
  "016160",
  "010240",
  "022682",
  "020822",
  "012576",
  "019326",
  "014881",
  "010345",
  "025366",
  "029728",
  "028293",
  "011919",
  "015131",
  "014322",
  "007388",
  "015383",
  "028727",
  "013937",
  "008992",
  "014493",
  "012128",
  "025187",
  "016339",
  "015766",
  "015895",
  "019163",
  "010057",
  "011265",
  "005755",
  "010694",
  "032888",
  "010803",
  "027357",
  "024995",
  "010975",
  "014011",
  "010696",
  "017278",
  "024255",
  "014014",
  "008259",
  "010926",
  "015090",
  "008526",
  "005317",
  "013399",
  "021907",
  "007235",
  "011451",
  "025952",
  "014260",
  "013990",
  "008257",
  "004302",
  "015329",
  "032764",
  "009364",
  "016496",
  "018514",
  "008704",
  "028944",
  "007064",
  "015816",
  "008176",
  "028667",
  "005796",
  "007869",
  "013583",
  "007883",
  "013942",
  "006054",
  "008530",
  "020973",
  "031968",
  "012361",
  "008818",
  "005101",
  "015221",
  "006743",
  "005928",
];

// Initialize regIds in MongoDB
async function initializeRegIds() {
  const count = await RegId.countDocuments();
  if (count === 0) {
    console.log("Initializing registration IDs...");
    const regIdDocs = initialRegIds.map((regId) => ({ regId }));
    await RegId.insertMany(regIdDocs);
    console.log("Initialized 200 registration IDs.");
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

// Generate PDF with updated header and footer
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
      .text("EDO 2025", 0, 8, { align: "center" });
    doc
      .fontSize(9)
      .fillColor("white")
      .text("26TH ANNUAL NATIONAL SCIENTIFIC CONFERENCE", 0, 25, {
        align: "center",
      });

    // Rounded border
    doc.roundedRect(15, 50, 267, 350, 5).stroke("#006400").lineWidth(2);

    // AHAPN logo (left)
    doc.image("./ahapn-logo.png", 20, 60, { width: 70 });

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

    // Benin mask (right)
    doc.image("./benin-mask.png", 207, 60, { width: 80, opacity: 0.2 });

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
      .text(`ID: ${user.eventId.toUpperCase()}`, 20, 240, {
        width: 257,
        align: "center",
      });
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
          // Footer with phone number
          doc
            .font("Times-Roman")
            .fontSize(9)
            .fillColor("#006400")
            .text("AHAPN | ahapn2021@gmail.com | 08079238160", 0, 390, {
              align: "center",
            });
          doc.end();
        }
      }
    );
  });
}

// Initialize regIds on startup
await initializeRegIds().catch(console.error);

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
      .status(500)
      .json({ message: "Error generating PDF", error: error.message });
  }
});

app.listen(process.env.PORT || 5000, () => console.log("Server on port 5000"));
