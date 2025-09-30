const bcrypt = require("bcrypt");
const { Admin } = require("../Schema/admin.schema");


const seedDefaultAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      console.log("An admin already exists. Skipping default admin creation.");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("##AdminPassword123@@", salt);

    const admin = new Admin({
      name: "Default Admin",
      email: "admin@example.com",
      password: hashedPassword,
      isDefault: true,
      role: "admin",
    });

    await admin.save();
    console.log("Default admin created successfully.");
  } catch (error) {
    console.error("Failed to create default admin:", error);
  }
};

module.exports = { seedDefaultAdmin };
