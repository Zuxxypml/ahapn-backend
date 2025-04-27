// /models/LateRegId.js
import mongoose from "mongoose";

const lateRegIdSchema = new mongoose.Schema({
  regId: {
    type: String,
    required: true,
    unique: true,
  },
});

const LateRegId = mongoose.model("LateRegId", lateRegIdSchema);

export default LateRegId;
