import Waitlist from "../models/Waitlist.model.js";
import RegId from "../models/RegId.model.js";

export const addToWaitlist = async (req, res) => {
  try {
    const { name, email, phoneNumber, state, regId } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const validRegIds = await RegId.find().select("regId -_id");
    const validList = validRegIds.map((doc) => doc.regId);

    if (!validList.includes(regId)) {
      return res
        .status(400)
        .json({ message: "Invalid or expired registration ID" });
    }

    const prefix = "edo-ahapn-";
    const lastEntry = await Waitlist.findOne().sort({ timestamp: -1 });
    const lastNumber = lastEntry
      ? parseInt(lastEntry.eventId.split("-")[2], 10)
      : 0;
    const nextNumber = lastNumber + 1;
    const eventId = `${prefix}${nextNumber.toString().padStart(4, "0")}`;

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

    res.status(201).json({ message: "Added to waitlist!", eventId });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding to waitlist", error: error.message });
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
