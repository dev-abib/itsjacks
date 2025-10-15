const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const siteSettingSchema = new Schema(
  {
    title: {
      type: String,
    },
    name: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    syestemDetails: {
      type: String,
    },
    foooterLogo: {
      type: String,
    },
    headerLogo: {
      type: String,
    },
    address: {
      type: String,
    },
    email: {
      type: String,
    },
    openingHour: {
      type: String,
    },
    copyrightTxt: {
      type: String,
    },
    faviconIcon: {
      type: String,
    },
    infoNumber: {
      type: String,
    },
    infoMsg: {
      type: String,
    },
    infCompany: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const siteSettingModel =
  models.siteSettings || model("siteSettings", siteSettingSchema);

module.exports = {
  siteSettingModel,
};
