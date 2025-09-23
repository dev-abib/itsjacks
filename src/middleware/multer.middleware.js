const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Filter for image files (jpeg, jpg, png, svg)
 */
const imageFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|svg/;
  const mimetype = filetypes.test(file.mimetype.toLowerCase());
  const extname = filetypes.test(
    file.originalname.split(".").pop().toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only JPEG, PNG, and SVG files are allowed!"));
};

/**
 * Filter for video files (mp4, webm, avi, mov)
 */
// const videoUploadPath = path.join(__dirname, "uploads/videos");

// // Ensure the folder exists
// if (!fs.existsSync(videoUploadPath)) {
//   fs.mkdirSync(videoUploadPath, { recursive: true });
// }

/**
 * Filter for video files (mp4, webm, avi, mov)
 */
// const videoFilter = (req, file, cb) => {
//   const allowedTypes = /mp4|webm|avi|mov/;
//   const mimetype = allowedTypes.test(file.mimetype.toLowerCase());
//   const extname = allowedTypes.test(
//     file.originalname.split(".").pop().toLowerCase()
//   );

//   if (mimetype && extname) {
//     return cb(null, true);
//   }
//   cb(new Error("Only MP4, WebM, AVI, and MOV video files are allowed!"));
// };

/**
 * Upload middleware for videos (max 50MB, disk storage)
 */
// const uploadVideo = multer({
//   storage: multer.diskStorage({
//     destination: (req, file, cb) => cb(null, videoUploadPath),
//     filename: (req, file, cb) => {
//       const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//       cb(null, uniqueSuffix + path.extname(file.originalname));
//     },
//   }),
//   limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
//   fileFilter: videoFilter,
// });


/**
 * Filter for invoice files (jpeg, jpg, png, svg, pdf)
 */
const invoiceFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|svg|pdf/;
  const mimetype = allowedTypes.test(file.mimetype.toLowerCase());
  const extname = allowedTypes.test(
    file.originalname.split(".").pop().toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only JPEG, PNG, SVG images or PDF files are allowed!"));
};

/**
 * Upload middleware for images (max 5MB)
 */
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: imageFilter,
});

/**
 * Upload middleware for videos (max 50MB)
 */


/**
 * Upload middleware for invoices (images or PDFs, max 10MB)
 */
const uploadInvoice = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: invoiceFilter,
});

const mixedFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|svg|pdf/;
  const mimetype = allowed.test(file.mimetype.toLowerCase());
  const extname = allowed.test(
    file.originalname.split(".").pop().toLowerCase()
  );

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, SVG images or PDF files are allowed!"));
  }
};

const uploadMixed = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: mixedFileFilter,
});

module.exports = {
  uploadImages,
  // uploadVideo,
  uploadInvoice,
  uploadMixed,
};
