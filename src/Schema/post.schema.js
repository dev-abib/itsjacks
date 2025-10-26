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
    eventTime: {
      type: Date,
    },
    postType: {
      type: String,
      required: [true, "post type is required"],
      enum: ["community-post", "event"],
      message: "Post type must be one of the following:  user, or moderator",
    },
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user", 
      },
    ],
    ratingInfo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        rating: {
          type: String,
          required: true,
        },
      },
    ],
    approxRating: {
      type: Number,
      default:null
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
