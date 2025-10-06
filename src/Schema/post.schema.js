const mongoose = require("mongoose");
const { model, models } = mongoose;

const postSchema = new mongoose.Schema(
  {
    images: [
      {
        type: String,
        required: [true, "Provide at least one photo"],
      },
    ],
    description: {
      type: String,
      required: [true, "Post description is required"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user", 
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);


const Post = models.post || model("post", postSchema);

module.exports = { Post };
