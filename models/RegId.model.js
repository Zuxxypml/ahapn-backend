import mongoose from "mongoose";

const regIdSchema = new mongoose.Schema({
  regId: { type: String, required: true, unique: true },
});

const RegId = mongoose.model("RegId", regIdSchema);

export default RegId;
