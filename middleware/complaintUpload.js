const multer = require("multer");
const path = require("path");
const { uploadError } = require("./taskUpload");
const { MAX_COMPLAINT_PHOTOS } = require("../models/Complaint");

// Optional photos / screenshots attached to a complaint.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB each
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const fileFilter = (req, file, cb) => {
	const ext = path.extname(file.originalname || "").toLowerCase();
	if (IMAGE_EXTENSIONS.includes(ext)) return cb(null, true);
	cb(uploadError("Photos must be JPG, PNG or WebP images."), false);
};

const complaintPhotoUpload = (req, res, next) =>
	multer({
		storage: multer.memoryStorage(),
		fileFilter,
		limits: { fileSize: MAX_FILE_SIZE, files: MAX_COMPLAINT_PHOTOS, fields: 10 },
	}).array("photos", MAX_COMPLAINT_PHOTOS)(req, res, (err) => {
		if (err instanceof multer.MulterError && ["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(err.code)) {
			return next(uploadError(`You can attach up to ${MAX_COMPLAINT_PHOTOS} photos.`));
		}
		next(err);
	});

module.exports = { complaintPhotoUpload };
