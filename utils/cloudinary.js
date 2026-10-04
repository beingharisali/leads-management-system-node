// Admission photos (ID card, selfie) on Cloudinary - same account as the LMS.
// They're uploaded as "authenticated" assets: the plain URL doesn't work, only
// signed URLs generated here, which are handed to logged-in staff and the LMS.
const cloudinary = require("cloudinary").v2;

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true,
});

const ADMISSION_FOLDER = "Ideoversity_admissions";

const isConfigured = () =>
	Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Uploads an image buffer and resolves with its public_id.
const uploadAdmissionPhoto = (buffer, publicId) =>
	new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: ADMISSION_FOLDER,
				public_id: publicId,
				resource_type: "image",
				type: "authenticated",
				overwrite: false,
			},
			(err, result) => (err ? reject(err) : resolve(result.public_id))
		);
		stream.end(buffer);
	});

const photoUrl = (publicId) =>
	publicId
		? cloudinary.url(publicId, { type: "authenticated", sign_url: true, secure: true, resource_type: "image" })
		: "";

// Best effort - used to clean up when saving the admission fails.
const deleteAdmissionPhotos = (publicIds) =>
	Promise.allSettled(
		publicIds.filter(Boolean).map((id) =>
			cloudinary.uploader.destroy(id, { type: "authenticated", resource_type: "image", invalidate: true })
		)
	);

module.exports = { isConfigured, uploadAdmissionPhoto, photoUrl, deleteAdmissionPhotos };
