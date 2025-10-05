/**
 * @fileoverview Cloudinary helper for uploading/deleting images/videos/files under a common folder.
 * @date 2025-10-05
 */

const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// ✅ Configure Cloudinary from .env
cloudinary.config({
  cloud_name: process.env.CLOUD_SERVER_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_PASS,
});

// ✅ Common root folder (customize as needed)
const COMMON_FOLDER = "Frapp";

/**
 * Uploads a file buffer to Cloudinary under the common folder.
 */
const uploadCloudinary = (buffer, subFolder) => {
  return new Promise((resolve, reject) => {
    const targetFolder = `${COMMON_FOLDER}/${subFolder || "general"}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: "auto", // auto detects image/video/raw
        use_filename: true,
        unique_filename: true,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Extracts the Cloudinary public_id from a full secure URL.
 * Works even with nested folders and version numbers.
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;

  // ✅ Robust regex: handles versioned URLs, nested folders, and all file types
  const regex = /upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/;
  const match = url.match(regex);
  return match ? match[1] : null; // e.g. "Frapp/profilePic/abcd1234"
};

/**
 * Deletes a file (image/video/raw) from Cloudinary using only its URL.
 */
const deleteCloudinaryAsset = async (url) => {
  try {
    const publicId = extractPublicId(url);
    if (!publicId) return { result: "not found" };

    // detect resource type from URL
    let resourceType = "image"; // default fallback
    if (url.includes("/video/")) resourceType = "video";
    else if (url.includes("/raw/")) resourceType = "raw";

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return result; 
  } catch (error) {
    console.error("Error deleting Cloudinary asset:", error);
    return { result: "error", error };
  }
};

module.exports = {
  uploadCloudinary,
  deleteCloudinaryAsset,
};
