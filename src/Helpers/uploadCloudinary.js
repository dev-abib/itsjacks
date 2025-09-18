/**
 * @fileoverview Handles uploading and deleting media (images, videos, raw/PDF) to/from Cloudinary.
 * @date 2024-11-01
 */

const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const { Readable } = require("stream");

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_SERVER_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_PASS,
});

/**
 * Detects the Cloudinary resource type based on MIME type.
 */
const getResourceType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "raw";
};

/**
 * Uploads a file buffer to Cloudinary.
 *
 * @param {Buffer} buffer - File buffer.
 * @param {String} folder - Cloudinary folder name.
 * @param {Object} meta - File metadata (mimetype, originalname).
 * @returns {Promise<Object>} Cloudinary upload result.
 */
const uploadCloudinary = (buffer, folder, meta) => {
  const resourceType = getResourceType(meta.mimetype);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
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

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

/**
 * Extracts the actual public ID from a full Cloudinary URL.
 *
 * @param {String} url - Full Cloudinary secure URL.
 * @returns {String|null} Extracted public ID or null.
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  const parts = url.split("/");
  const fileWithExtension = parts.pop();
  const publicId = fileWithExtension.split(".")[0];
  return publicId;
};

/**
 * Deletes an asset from Cloudinary.
 *
 * @param {String} fullUrl - The full secure_url from Cloudinary.
 * @param {String} folder - The folder used during upload.
 * @returns {Promise<Object>} Cloudinary delete result.
 */
const deleteCloudinaryAsset = async (fullUrl, folder) => {
  const publicId = extractPublicId(fullUrl);
  if (!publicId) return { result: "not found" };

  const fullPublicId = `${folder}/${publicId}`;
  console.log("Deleting public_id:", publicId);
  console.log(fullPublicId , publicId);
  

  try {
    const result = await cloudinary.uploader.destroy(fullPublicId, {
      resource_type: "auto",
    });
    console.log(result);

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
