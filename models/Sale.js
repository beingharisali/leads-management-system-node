const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Leads",
            required: [true, "Sale must be linked to a lead"],
        },
        csr: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "CSR information is required for sales tracking"],
        },
        amount: {
            type: Number,
            required: [true, "Please provide sale amount"],
            min: [0, "Sale amount cannot be negative"]
        },
        // NEW: Course copy kar rahe hain Lead se taake agar lead delete bhi ho jaye, 
        // toh sales record mein data rahe (Data Integrity)
        course: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: ["completed", "pending", "refunded", "cancelled"],
            default: "completed",
        },
        // NEW: Kis admin ne sale verify ki?
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // NEW: Payment method (e.g., Bank Transfer, Cash, EasyPaisa)
        paymentMethod: {
            type: String,
            default: "Bank Transfer"
        },
        remarks: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

/* ===================== INDEXING ===================== */
// Performance behtar karne ke liye
saleSchema.index({ csr: 1, createdAt: -1 });
saleSchema.index({ lead: 1 });

/* ===================== VIRTUALS ===================== */
// Profit calculation ke liye virtual field use ki ja sakti hai (If needed)

const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
module.exports = Sale;