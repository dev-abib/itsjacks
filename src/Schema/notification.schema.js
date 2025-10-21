const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["unread", "read"], default: "unread" },
    type: {
      type: String,
      enum: ["like", "event-reminder", "rating"],
      required: true,
    },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "post", required: true },
    createdAt: { type: Date, default: Date.now },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification = mongoose.model("notification", notificationSchema);

module.exports = { Notification };
