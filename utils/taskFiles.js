// Task completion proof on Cloudinary, stored like the admission photos: as
// "authenticated" assets that only open through signed URLs handed out to
// logged-in users who can see the task.
const crypto = require("crypto");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { isConfigured } = require("./cloudinary"); // also applies the Cloudinary config

const TASK_FOLDER = "Ideoversity_task_proofs";

const safeBaseName = (name) =>
	path.basename(name || "file", path.extname(name || ""))
		.replace(/[^a-zA-Z0-9-_]+/g, "_")
		.slice(0, 60) || "file";

// Uploads one proof file and resolves with what the Task stores about it.
const uploadTaskProof = (file, taskId, isImage) =>
	new Promise((resolve, reject) => {
		const resourceType = isImage ? "image" : "raw";
		const ext = path.extname(file.originalname || "").toLowerCase();
		const unique = `${safeBaseName(file.originalname)}-${crypto.randomBytes(6).toString("hex")}`;
		// Raw files keep their extension in the id so the download opens correctly
		const publicId = isImage ? unique : `${unique}${ext}`;

		const stream = cloudinary.uploader.upload_stream(
			{
				folder: `${TASK_FOLDER}/${taskId}`,
				public_id: publicId,
				resource_type: resourceType,
				type: "authenticated",
				overwrite: false,
			},
			(err, result) =>
				err
					? reject(err)
					: resolve({
						publicId: result.public_id,
						resourceType,
						name: path.basename(file.originalname || "file"),
						mimeType: file.mimetype,
						size: file.size,
					})
		);
		stream.end(file.buffer);
	});

const proofUrl = (file) =>
	file?.publicId
		? cloudinary.url(file.publicId, {
			type: "authenticated",
			sign_url: true,
			secure: true,
			resource_type: file.resourceType || "image",
		})
		: "";

// Best effort - used to clean up when saving the submission fails.
const deleteTaskProofs = (files) =>
	Promise.allSettled(
		(files || []).map((f) =>
			cloudinary.uploader.destroy(f.publicId, { type: "authenticated", resource_type: f.resourceType, invalidate: true })
		)
	);

module.exports = { isConfigured, uploadTaskProof, proofUrl, deleteTaskProofs };
