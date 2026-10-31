// Complaint photos on Cloudinary, stored like the task proofs: as
// "authenticated" assets that only open through signed URLs handed out to
// the people who can see the complaint.
const crypto = require("crypto");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { isConfigured } = require("./cloudinary"); // also applies the Cloudinary config

const COMPLAINT_FOLDER = "Ideoversity_complaints";

const safeBaseName = (name) =>
	path.basename(name || "photo", path.extname(name || ""))
		.replace(/[^a-zA-Z0-9-_]+/g, "_")
		.slice(0, 60) || "photo";

// Uploads one photo and resolves with what the Complaint stores about it.
const uploadComplaintPhoto = (file, complaintId) =>
	new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: `${COMPLAINT_FOLDER}/${complaintId}`,
				public_id: `${safeBaseName(file.originalname)}-${crypto.randomBytes(6).toString("hex")}`,
				resource_type: "image",
				type: "authenticated",
				overwrite: false,
			},
			(err, result) =>
				err
					? reject(err)
					: resolve({ publicId: result.public_id, name: path.basename(file.originalname || "photo"), size: file.size })
		);
		stream.end(file.buffer);
	});

const complaintPhotoUrl = (photo) =>
	photo?.publicId
		? cloudinary.url(photo.publicId, { type: "authenticated", sign_url: true, secure: true, resource_type: "image" })
		: "";

// Best effort - used when saving fails and when a complaint is deleted.
const deleteComplaintPhotos = (photos) =>
	Promise.allSettled(
		(photos || []).map((p) =>
			cloudinary.uploader.destroy(p.publicId, { type: "authenticated", resource_type: "image", invalidate: true })
		)
	);

module.exports = { isConfigured, uploadComplaintPhoto, complaintPhotoUrl, deleteComplaintPhotos };
