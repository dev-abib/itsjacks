/**
 * @fileoverview Handles uploading and deleting video files to/from Cloudinary.
 * @date 2025-08-20
 */

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_SERVER_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_PASS,
});

/**
 * Uploads a local video file to Cloudinary and deletes local file after upload.
 *
 * @param {string} filePath - Local file path of the video.
 * @param {string} folder - Cloudinary folder to store video.
 * @param {string} oldVideoUrl - Optional old Cloudinary URL to delete.
 * @returns {Promise<string>} Returns secure_url of uploaded video.
 */
const uploadVideoToCloudinary = async (
  filePath,
  folder,
  oldVideoUrl = null
) => {
  if (!filePath) throw new Error("filePath is required");

  const mimetype = `video/${path.extname(filePath).slice(1)}`;
  const originalname = path.basename(filePath);

  // Delete old video if provided
  if (oldVideoUrl) {
    const publicId = oldVideoUrl.split("/").pop().split(".")[0];
    const fullPublicId = `${folder}/${publicId}`;
    try {
      await cloudinary.uploader.destroy(fullPublicId, {
        resource_type: "video",
      });
      console.log("Old video deleted:", fullPublicId);
    } catch (err) {
      console.error("Failed to delete old video:", err);
    }
  }

  // Upload new video
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder,
        use_filename: true,
        unique_filename: true,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    fs.createReadStream(filePath).pipe(stream);
  });

  // Delete local file after upload
  fs.unlink(filePath, (err) => {
    if (err) console.error("Failed to delete local video file:", err);
  });

  return result.secure_url;
};

/**
 * Deletes a video from Cloudinary.
 *
 * @param {string} fullUrl - Full Cloudinary URL.
 * @param {string} folder - Cloudinary folder where video is stored.
 */
const deleteVideoFromCloudinary = async (fullUrl, folder) => {
  if (!fullUrl) return;
  const publicId = fullUrl.split("/").pop().split(".")[0];
  const fullPublicId = `${folder}/${publicId}`;

  try {
    const result = await cloudinary.uploader.destroy(fullPublicId, {
      resource_type: "video",
    });
    console.log("Video deleted:", result);
    return result;
  } catch (err) {
    console.error("Failed to delete video:", err);
  }
};

module.exports = {
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
};
