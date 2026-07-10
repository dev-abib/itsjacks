// main listener file
require("dotenv").config();

const app = require("./app");
const { connectDb } = require("./src/ConnectDb/ConnectDb");

// call the data base
connectDb();
