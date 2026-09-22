const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Leads",
            required: true,
        },
        csr: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: Number,
            required: [true, "Please provide sale amount"],
        },
        status: {
            type: String,
            enum: ["completed", "pending"],
            default: "completed",
        },
    },
    { timestamps: true }
);

/* ===================== INDEXING ===================== */
saleSchema.index({ csr: 1, createdAt: -1 });
saleSchema.index({ lead: 1 });
saleSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Sale", saleSchema);
