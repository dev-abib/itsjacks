const mongoose = require("mongoose");

const { model, models, Schema } = mongoose;

const companyAddressSchema = new Schema(
  {
    accountTitle: {
      type: String,
      required: [true, "account title is required"],
    },
    addressLine: {
      type: String,
      required: [true, "Address line is required"],
    },
    city: {
      type: String,
      required: [true, "City address is required"],
    },
    state: {
      type: String,
      required: [true, "state address is required"],
    },
    zipCode: {
      type: String,
      required: [true, "zip code is required"],
    },
    phoneNumber: {
      type: String,
      required: [true, "phone numbe is requiered"],
    },
    descreptionTxt: {
      type: String,
      required: [true, "descreption requiered"],
    },
    addresstTitle: {
      type: String,
      required: [true, "Address titel is required"],
    },
  },
  {
    timestamps: true,
  }
);

const companyAddressModel =
  models.companyAddress || model("companyAddress", companyAddressSchema);

module.exports = {
  companyAddressModel,
};
