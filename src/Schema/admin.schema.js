const mongoose = require("mongoose");
const { Schema, model, models } = mongoose;

const AdminSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    profilePicture: {
      type: String,
    },
    telephoneNumber: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Admin = models.admin || model("admin", AdminSchema);

module.exports = { Admin};
