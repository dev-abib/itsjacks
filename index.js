// main listener file
require("dotenv").config();

const app = require("./app");
const reminderCron = require("./src/Helpers/eventReminderCron");
const { connectDb } = require("./src/ConnectDb/ConnectDb");

// call the data base
connectDb();
