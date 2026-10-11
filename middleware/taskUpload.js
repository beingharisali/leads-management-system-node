const multer = require("multer");
const path = require("path");
const { isImageBuffer } = require("./admissionUpload");

// Completion proof: screenshots / photos and common documents.
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB each

const ALLOWED = {
	".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
	".pdf": "pdf",
	".doc": "ole", ".xls": "ole",
	".docx": "zip", ".xlsx": "zip", ".pptx": "zip",
	".txt": "text", ".csv": "text",
};

const uploadError = (message) => {
	const err = new Error(message);
	err.isUploadError = true; // error-handler turns this into a 400
	return err;
};

const fileFilter = (req, file, cb) => {
	const ext = path.extname(file.originalname || "").toLowerCase();
	if (ALLOWED[ext]) return cb(null, true);
	cb(uploadError("Proof files must be images (JPG, PNG, WebP), PDF, Word, Excel, PowerPoint or text files."), false);
};

const taskProofUpload = multer({
	storage: multer.memoryStorage(),
	fileFilter,
	limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES, fields: 10 },
}).array("files", MAX_FILES);

// The extension and mimetype come from the browser; check the bytes match.
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const contentMatches = (file) => {
	const buf = file.buffer;
	const kind = ALLOWED[path.extname(file.originalname || "").toLowerCase()];
	if (!buf || buf.length === 0) return false;

	switch (kind) {
		case "image": return isImageBuffer(buf);
		case "pdf": return buf.toString("ascii", 0, 5) === "%PDF-";
		case "ole": return buf.subarray(0, 8).equals(OLE_MAGIC);
		case "zip": return buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
		case "text": return !buf.subarray(0, 8000).includes(0); // no binary data
		default: return false;
	}
};

const isImageFile = (file) => ALLOWED[path.extname(file.originalname || "").toLowerCase()] === "image";

module.exports = { taskProofUpload, contentMatches, isImageFile, uploadError };
