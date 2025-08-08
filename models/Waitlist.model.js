import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  state: { type: String, required: true },
  regId: { type: String, required: true },
  imageUrl: { type: String },
  eventId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  certificateSent: { type: Boolean, default: false },
}, { timestamps: true });

const Waitlist = mongoose.model("Waitlist", waitlistSchema);

export default Waitlist;
