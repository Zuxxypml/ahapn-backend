import Waitlist from "../models/Waitlist.model.js";
import RegId from "../models/RegId.model.js";
import nodemailer from "nodemailer";
import PDFKit from "pdfkit";
import bwipjs from "bwip-js";
import fs from "fs";
import LateRegId from "../models/LateRegIds.model.js";

export const downloadEventIdPdf = async (req, res) => {
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
};

export const getWaitlistCount = async (req, res) => {
  try {
    const count = await Waitlist.countDocuments();
    res.json({ count });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error counting waitlist", error: error.message });
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ eventId: user.eventId });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error fetching ID", error: error.message });
  }
};

export const addToWaitlist = async (req, res) => {
  try {
    const { name, email, phoneNumber, state, regId, lateRegId } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // First check Registration Number
    const normalCode = await RegId.findOne({ regId });
    if (!normalCode) {
      return res
        .status(400)
        .json({ message: "Invalid or expired Registration Number" });
    }

    // Late Registration logic
    const today = new Date();
    const lateRegistrationStart = new Date("2025-07-01"); // 👈 same date as frontend
    const isLatePeriod = today >= lateRegistrationStart;

    if (isLatePeriod) {
      // During Late Period, LateRegId must be provided and valid
      if (!lateRegId) {
        return res.status(400).json({
          message:
            "Late Registration Code required during late registration period.",
        });
      }

      const lateCode = await LateRegId.findOne({ regId: lateRegId });
      if (!lateCode) {
        return res
          .status(400)
          .json({ message: "Invalid or expired Late Registration Code." });
      }
    }

    // Generate Event ID
    const prefix = "edo-ahapn-";
    const lastEntry = await Waitlist.findOne().sort({ timestamp: -1 });
    const lastNumber = lastEntry
      ? parseInt(lastEntry.eventId.split("-")[2], 10)
      : 0;
    const nextNumber = lastNumber + 1;
    const eventId = `${prefix}${nextNumber.toString().padStart(4, "0")}`;

    // Save to Waitlist
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

    // Remove used regId (ONLY ONCE)
    await RegId.deleteOne({ regId });

    // Remove used lateRegId if needed
    if (isLatePeriod && lateRegId) {
      await LateRegId.deleteOne({ regId: lateRegId });
    }

    // Generate PDF
    const pdfBuffer = await generatePDFBuffer(newEntry);

    // Send Email with PDF attached
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
      subject: "Welcome to AHAPN Edo 2025 Waitlist",
      text: `Dear ${name},\n\nYou have been added to the Edo 2025 waitlist!\nEvent ID: ${eventId}\nPlease keep this ID for access to the conference.\n\nBest regards,\nAHAPN Team`,
      attachments: [
        {
          filename: `event_id_${email}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // Success
    res
      .status(201)
      .json({ message: "Added to waitlist and ID sent via email!", eventId });
  } catch (error) {
    console.error("Error in addToWaitlist:", error);
    res
      .status(500)
      .json({ message: "Error adding to waitlist", error: error.message });
  }
};

// send certs
export const sendCertificatesToAllUsers = async () => {
  const users = await Waitlist.find({});

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  for (const user of users) {
    try {
      const certBuffer = await generateCertificateBuffer(
        user.name.toUpperCase()
      );

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Your Certificate – AHAPN Edo 2025",
        text: `Dear ${user.name},\n\nAttached is your certificate for attending the 26th AHAPN National Conference.\n\nBest regards,\nAHAPN Team`,
        attachments: [
          {
            filename: `certificate_${user.name}.pdf`,
            content: certBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      console.log(`✅ Sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${user.email}:`, err.message);
    }
  }
};
// Generate Cert buffer
async function generateCertificateBuffer(name) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A4", layout: "landscape" });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Draw background certificate template
    doc.image("./assets/certificate-template.jpeg", 0, 0, {
      width: 842, // A4 landscape width in points
      height: 595,
    });

    // Name text
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("black")
      .text(name, 275, 260, {
        align: "center",
      });

    doc.end();
  });
}

// Download cert
export const downloadCertificateByEmail = async (req, res) => {
  try {
    const user = await Waitlist.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if 2 months have passed since event
    const eventEndDate = new Date("2025-08-10"); // or use createdAt
    const now = new Date();
    const diffMonths = (now - eventEndDate) / (1000 * 60 * 60 * 24 * 30);

    // if (diffMonths < 2) {
    //   return res.status(403).json({
    //     message: "Certificate will be available 2 months after the event.",
    //   });
    // }

    const buffer = await generateCertificateBuffer(user.name.toUpperCase());

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=certificate_${user.name}.pdf`
    );
    res.send(buffer);
  } catch (err) {
    console.error("Certificate error:", err);
    res.status(500).json({ message: "Could not generate certificate." });
  }
};

// Generate PDF function
async function generatePDFBuffer(user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A6", margin: 10 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // Background
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

    // Details
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
      .text("Valid: Aug 4–9, 2025", 20, 260, { width: 257, align: "center" });

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
