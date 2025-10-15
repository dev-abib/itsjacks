const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const socialSiteSchema = new Schema(
  {
    facebook: {
      type: String,
    },
    instagram: {
      type: String,
    },
    youtube: {
      type: String,
    },
    twitter: {
      type: String,
    },
    linkdein: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const socailSiteModel =
  models.socialSite || model("socialSite", socialSiteSchema);

module.exports = {
  socailSiteModel,
};
