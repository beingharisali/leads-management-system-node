const multer = require("multer");
const path = require("path");

/**
 * Memory Storage use karne se server par files jama nahi hongi
 * aur Excel parsing direct buffer se ho jayegi.
 */
const storage = multer.memoryStorage();

// File filter (Excel only)
const fileFilter = (req, file, cb) => {
    // Excel aur CSV ki extensions
    const filetypes = /xlsx|xls|csv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    // Mimetypes check (kuch browsers mein different hote hain isliye extname zyada reliable hai)
    const mimetype =
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.mimetype === "text/csv";

    if (extname || mimetype) {
        return cb(null, true);
    } else {
        // Agar file excel nahi hai toh error bhejain
        cb(new Error("Error: Only Excel files (.xlsx, .xls, .csv) are allowed!"), false);
    }
};

// Multer instance with limits
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB maximum limit
    }
});

module.exports = upload;