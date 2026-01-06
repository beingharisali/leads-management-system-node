const XLSX = require("xlsx");
const path = require("path");

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

module.exports = { parseExcelFile };
