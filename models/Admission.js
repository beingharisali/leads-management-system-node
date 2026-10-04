const mongoose = require("mongoose");

// An admission form submitted through a CSR's public link. A copy is kept
// here and forwarded to the Ideoversity LMS (utils/lmsClient.js), where the
// admin reviews it. `sync` tracks that hand-off so failed sends are retried.
const admissionSchema = new mongoose.Schema(
	{
		// Shown on the student's receipt, e.g. "IDV-20261004-7F3A9C"
		receiptId: { type: String, required: true, unique: true },

		// ---- Form fields ----
		fullName: { type: String, required: [true, "Full name is required"], trim: true },
		phone: { type: String, required: [true, "Phone number is required"], trim: true },
		// courseId is from config/admissionForm.js; course is its display name
		courseId: { type: String, required: true, trim: true },
		course: { type: String, required: [true, "Course is required"], trim: true },

		// Cloudinary public_ids (authenticated assets, see utils/cloudinary.js)
		idCardPhoto: { type: String, required: true },
		selfiePhoto: { type: String, required: true },
		selfieMethod: { type: String, enum: ["camera"], default: "camera" },

		// What the student agreed to. `termsHash` is the SHA-256 of `snapshot`,
		// the exact terms, course details and statement shown on the page.
		consent: {
			accepted: { type: Boolean, required: true },
			acceptedAt: { type: Date, required: true },
			termsVersion: { type: String, required: true },
			termsHash: { type: String, required: true },
			snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
		},

		// CSR whose link was used
		csr: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		// Lead this submission was attached to (existing or newly created)
		lead: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Leads",
			default: null,
		},

		ip: { type: String, default: "" },
		userAgent: { type: String, default: "" },

		// False until the CSR has seen the "new admission" alert
		csrSeen: { type: Boolean, default: false },

		// Registration payment. The student sends the screenshot to the CSR on
		// WhatsApp; the CSR uploads it and marks the admission paid, which also
		// records a Sale and closes the lead as Paid.
		payment: {
			status: { type: String, enum: ["pending", "paid"], default: "pending" },
			amount: { type: Number, default: null },
			// Cloudinary public_id of the payment screenshot
			screenshotPhoto: { type: String, default: "" },
			paidAt: { type: Date, default: null },
			markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
			sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null },
		},

		sync: {
			status: {
				type: String,
				enum: ["pending", "synced", "failed"],
				default: "pending",
			},
			attempts: { type: Number, default: 0 },
			lastError: { type: String, default: "" },
			lastAttemptAt: { type: Date, default: null },
			syncedAt: { type: Date, default: null },
			// _id of the record on the LMS side
			lmsId: { type: String, default: "" },
		},
	},
	{ timestamps: true }
);

admissionSchema.index({ csr: 1, createdAt: -1 });
admissionSchema.index({ csr: 1, csrSeen: 1 });
admissionSchema.index({ "sync.status": 1, "sync.attempts": 1 });

const Admission = mongoose.models.Admission || mongoose.model("Admission", admissionSchema);
module.exports = Admission;
