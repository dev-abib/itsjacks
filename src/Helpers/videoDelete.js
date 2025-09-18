const fs = require("fs");
const path = require("path");

const videoUploadPath = path.join(__dirname, "uploads/videos");

/**
 * Delete a video file by filename
 * @param {string} filename - The name of the file to delete
 * @returns {boolean} - true if deleted successfully, false otherwise
 */
const deleteVideo = (filename) => {
  const filePath = path.join(videoUploadPath, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // delete the file
      console.log(`Video deleted: ${filename}`);
      return true;
    } else {
      console.warn(`File not found: ${filename}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to delete video: ${error.message}`);
    return false;
  }
};

module.exports = {
  deleteVideo,
};
