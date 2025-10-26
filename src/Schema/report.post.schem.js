const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const reportSchma = new Schema(
  {
    postId: {
      type: mongoose.Schema.ObjectId,
      ref: "post",
    },
    senderId: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
    },
    reasons: {
      type: String,
      required: [true, "Reason filed is required"],
    },
  },
  {
    timestamps: true,
  }
);

const report = models.report || model("report", reportSchma);

module.exports = {
  report,
};
