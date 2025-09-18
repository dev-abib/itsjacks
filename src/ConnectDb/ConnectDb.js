const mongoose = require("mongoose");
const { seedDefaultAdmin } = require("../Helpers/seedDefaultAdmin");

// internal dependencies
const DB_Name = "itsjacks";

let isConnected = false;

const connectDb = async () => {
  try {
    if (isConnected) {
      console.log("Already connected to the Database");
      return;
    }

    await mongoose.connect(process.env.MONGO_URL, {
      dbName: DB_Name,
    });

    isConnected = true;

    await seedDefaultAdmin();
    console.log("Successfully connected to the data base");
  } catch (error) {
    console.log(`something wrong with your database connection : ${error}`);
  }
};

module.exports = {
  connectDb,
};
