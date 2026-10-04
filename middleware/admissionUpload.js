const multer = require("multer");

// Photos on the public admission form: ID card + selfie. The page shrinks
// them to JPEGs under ~1.7 MB before sending, so 5 MB is a generous cap.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
	if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
	const err = new Error("Photos must be JPG, PNG or WebP images.");
	err.isUploadError = true; // error-handler turns this into a 400
	cb(err, false);
};

const admissionUpload = multer({
	storage: multer.memoryStorage(),
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 20 },
}).fields([
	{ name: "idCard", maxCount: 1 },
	{ name: "selfie", maxCount: 1 },
]);

// Payment screenshot the CSR uploads when marking an admission paid
const paymentUpload = multer({
	storage: multer.memoryStorage(),
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
}).single("screenshot");

// The mimetype comes from the browser; check the file really is an image.
const isImageBuffer = (buf) => {
	if (!buf || buf.length < 12) return false;
	const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
	const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	const webp = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
	return jpeg || png || webp;
};

module.exports = { admissionUpload, paymentUpload, isImageBuffer };
