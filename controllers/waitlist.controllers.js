import Waitlist from "../models/Waitlist.model.js";
import RegId from "../models/RegId.model.js";
import LateRegId from "../models/LateRegIds.model.js";
import nodemailer from "nodemailer";
import PDFKit from "pdfkit";
import bwipjs from "bwip-js";

// Constants (for easy maintenance)
const LATE_REGISTRATION_START = "2025-07-01";
const CERTIFICATE_RELEASE_DATE = "2025-08-09";
const EVENT_DATE_RANGE = "Aug 4–9, 2025";

// Reusable email transporter
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===================== CONTROLLERS ===================== //

// 1. Download Event ID PDF
export const downloadEventIdPdf = async (req, res) => {
  try {
    const user = await Waitlist.findOne({ eventId: req.params.eventId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const pdfBuffer = await generatePDFBuffer(user);

    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=event_id_${user.email}.pdf`,
      })
      .send(pdfBuffer);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res
      .status(500)
      .json({ message: "Failed to generate PDF", error: error.message });
  }
};

// 2. Get Waitlist Count
export const getWaitlistCount = async (req, res) => {
  try {
    const count = await Waitlist.countDocuments();
    res.json({ count });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch count", error: error.message });
  }
};

// 3. Get User by Email
export const getUserByEmail = async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ eventId: user.eventId });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Failed to fetch user", error: error.message });
  }
};

// 4. Add to Waitlist (MAIN LOGIC)
export const addToWaitlist = async (req, res) => {
  try {
    const { name, email, phoneNumber, state, regId, lateRegId } = req.body;
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });
    const imageUrl = `/uploads/${req.file.filename}`;

    // Validate Registration Code
    const validRegCode = await RegId.findOne({ regId });
    if (!validRegCode) {
      return res.status(400).json({ message: "Invalid Registration Code" });
    }

    // Late Registration Check
    const isLatePeriod = new Date() >= new Date(LATE_REGISTRATION_START);
    if (isLatePeriod && !lateRegId) {
      return res
        .status(400)
        .json({ message: "Late Registration Code required" });
    }

    // Validate Late Code (if applicable)
    if (isLatePeriod) {
      const validLateCode = await LateRegId.findOne({ regId: lateRegId });
      if (!validLateCode) {
        return res
          .status(400)
          .json({ message: "Invalid Late Registration Code" });
      }
    }

    // Generate Event ID (format: edo-ahapn-0001)
    const lastUser = await Waitlist.findOne().sort({ createdAt: -1 });
    const nextId = lastUser ? parseInt(lastUser.eventId.split("-")[2]) + 1 : 1;
    const eventId = `edo-ahapn-${String(nextId).padStart(4, "0")}`;

    // Save User
    const newUser = await Waitlist.create({
      name,
      email,
      phoneNumber,
      state,
      regId,
      imageUrl,
      eventId,
    });

    // Cleanup: Delete used codes
    await RegId.deleteOne({ regId });
    if (isLatePeriod) await LateRegId.deleteOne({ regId: lateRegId });

    // Send Email with PDF
    const pdfBuffer = await generatePDFBuffer(newUser);
    await sendEmail(
      email,
      "Welcome to AHAPN Edo 2025 Waitlist",
      `Dear ${name},\n\nYour Event ID: ${eventId}\n\nBest regards,\nAHAPN Team`,
      pdfBuffer,
      `event_id_${email}.pdf`
    );

    res.status(201).json({
      message: "Waitlist entry created!",
      eventId,
    });
  } catch (error) {
    console.error("Waitlist Error:", error);
    res
      .status(500)
      .json({ message: "Failed to add to waitlist", error: error.message });
  }
};

// 5. Send Certificates to All Users (Bulk)
export const sendCertificatesToAllUsers = async () => {
  try {
    const users = await Waitlist.find({});
    for (const user of users) {
      try {
        const certBuffer = await generateCertificateBuffer(
          user.name.toUpperCase()
        );
        await sendEmail(
          user.email,
          "Your AHAPN Edo 2025 Certificate",
          `Dear ${user.name},\n\nAttached is your certificate.\n\nBest regards,\nAHAPN Team`,
          certBuffer,
          `certificate_${user.name}.pdf`
        );
        console.log(`✅ Sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.email}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Bulk Cert Error:", error);
  }
};

// 6. Download Certificate by Email
export const downloadCertificateByEmail = async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Certificate Release Check
    const isCertAvailable = new Date() >= new Date(CERTIFICATE_RELEASE_DATE);
    if (!isCertAvailable) {
      return res.status(403).json({
        message: `Certificates available after ${CERTIFICATE_RELEASE_DATE}`,
      });
    }

    const buffer = await generateCertificateBuffer(user.name.toUpperCase());
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=certificate_${user.name}.pdf`,
      })
      .send(buffer);
  } catch (err) {
    console.error("Certificate Error:", err);
    res.status(500).json({ message: "Failed to generate certificate" });
  }
};

// ===================== HELPER FUNCTIONS ===================== //

// Reusable Email Sender
async function sendEmail(to, subject, text, attachmentBuffer, attachmentName) {
  await emailTransporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    attachments: [
      {
        filename: attachmentName,
        content: attachmentBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

// Generate Certificate PDF
async function generateCertificateBuffer(name) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A4", layout: "landscape" });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Background Template
    doc.image("./assets/certificate-template.jpeg", 0, 0, {
      width: 842,
      height: 595,
    });

    // Participant Name
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(name.toUpperCase(), 275, 260, { align: "center" });

    doc.end();
  });
}

// Generate Event ID PDF
async function generatePDFBuffer(user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A6" });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Background Gradient
    const gradient = doc.linearGradient(0, 0, 0, 420);
    gradient.stop(0, "#e6ffe6").stop(1, "#b3ffb3");
    doc.rect(0, 0, 297, 420).fill(gradient);

    // Header
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

    // Border
    doc.roundedRect(15, 50, 267, 350, 5).stroke("#006400").lineWidth(2);

    // Logos
    doc.image("./ahapn-logo.png", 20, 60, { width: 70 });
    if (user.imageUrl) {
      try {
        doc.image(user.imageUrl.replace(/^\//, ""), 108, 60, {
          width: 80,
          height: 100,
        });
        doc.rect(108, 60, 80, 100).stroke("#006400");
      } catch (err) {
        console.error("Error loading attendee image:", err);
      }
    }
    doc.image("./benin-mask.png", 207, 60, { width: 80, opacity: 0.2 });

    // User Details
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
      .text(`Valid: ${EVENT_DATE_RANGE}`, 20, 260, {
        width: 257,
        align: "center",
      });

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
