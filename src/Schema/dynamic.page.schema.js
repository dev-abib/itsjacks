const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const dynamicPageSchema = new Schema(
  {
    pageTitle: {
      type: String,
    },
    pageDescreption: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const dynamicPageModel =
  models.dynamicPage || model("dynamicPage", dynamicPageSchema);

module.exports = {
  dynamicPageModel,
};
