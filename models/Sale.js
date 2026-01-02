const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "leads",
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

module.exports = mongoose.model("Sale", saleSchema);
