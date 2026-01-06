const XLSX = require("xlsx");
const path = require("path");

// ===============================
// ✅ Task 25: Parse Excel file
// ===============================
const parseExcelFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                msg: "No file uploaded",
            });
        }

        // Uploaded file path
        const filePath = path.join(__dirname, "../uploads", req.file.filename);

        // Excel file read
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // First sheet
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);

        res.status(200).json({
            success: true,
            msg: "Excel file parsed successfully",
            data,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: "Error parsing Excel file",
            error: error.message,
        });
    }
};

// ===============================
// ✅ Task 27: Validate Excel Data
// ===============================
const validateExcelData = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, msg: "No file uploaded" });
        }

        const filePath = path.join(__dirname, "../uploads", req.file.filename);
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (!data.length) {
            return res.status(400).json({ success: false, msg: "Excel file is empty" });
        }

        const errors = [];
        const validData = [];
        const phoneRegex = /^[0-9]{10,15}$/; // basic phone validation

        data.forEach((row, index) => {
            const rowErrors = [];

            if (!row.name || row.name.toString().trim() === "") {
                rowErrors.push("Name is required");
            }

            if (!row.phone || !phoneRegex.test(row.phone.toString().trim())) {
                rowErrors.push("Phone is invalid or missing (10-15 digits expected)");
            }

            if (!row.course || row.course.toString().trim() === "") {
                rowErrors.push("Course is required");
            }

            if (rowErrors.length > 0) {
                errors.push({ row: index + 2, errors: rowErrors }); // +2: sheet rows start at 2
            } else {
                validData.push(row);
            }
        });

        res.status(200).json({
            success: true,
            msg: "Validation completed",
            totalRows: data.length,
            validRows: validData.length,
            invalidRows: errors.length,
            errors,
            validData, // optional: valid rows for further use
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: "Error validating Excel file",
            error: error.message,
        });
    }
};

module.exports = { parseExcelFile, validateExcelData };
