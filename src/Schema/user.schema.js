const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full Name is requried "],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
    },
    role: {
      type: String,
      required: [true, "user role is required"],
      enum: ["student", "creator"],
      message: "Role must be one of the following:  user, or moderator",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isVerifiedAccount: {
      type: Boolean,
      default: false,
    },
    isBanned: { type: Boolean, default: false },
    isOtpVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    refreshToken: {
      type: String,
    },
    resetToken: {
      type: String,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    creator_rating: {
      type: String,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const user = models.user || model("user", userSchema);

module.exports = {
  user,
};
