const multer = require("multer");
const path = require("path");

/**
 * Memory Storage: Production (Render/Vercel) ke liye behtareen hai 
 * kyunki wahan temporary files save karne ki permission nahi hoti.
 */
const storage = multer.memoryStorage();

// File filter (Excel only) - Fully Updated
const fileFilter = (req, file, cb) => {
    // 1. Allowed Extensions
    const filetypes = /xlsx|xls|csv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    /**
     * 2. Mimetypes Check
     * Added 'application/octet-stream' kyunki Vercel/Render par Excel files
     * aksar isi type mein receive hoti hain.
     */
    const allowedMimeTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel",                                        // .xls
        "text/csv",                                                         // .csv
        "application/octet-stream"                                          // Production Fix
    ];

    const isMimeValid = allowedMimeTypes.includes(file.mimetype);

    // Agar Extension sahi ho ya MimeType sahi ho, toh file allow karein
    if (extname || isMimeValid) {
        return cb(null, true);
    } else {
        /**
         * Ye wahi error message hai jo aapko frontend par mil raha tha.
         * Isse update karne se validation aur mazboot ho jayegi.
         */
        cb(new Error("Only Excel files are allowed!"), false);
    }
};

// Multer instance with limits
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = upload;