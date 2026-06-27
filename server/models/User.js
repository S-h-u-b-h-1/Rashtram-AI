const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  googleId: { type: String, unique: true },
  avatar: { type: String },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
});


const User = mongoose.model("User", userSchema);
User.createIndexes();
module.exports = User;
