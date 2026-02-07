const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

/**
 * Upload a file to Cloudflare R2
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string} mimetype
 * @returns {Promise<string>} Public URL of the uploaded file
 */
const uploadToR2 = async (fileBuffer, fileName, mimetype) => {
  const bucketName = process.env.R2_BUCKET_NAME || "aviders-claims";

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));

    // Return the URL. If you have a custom domain/CDN configured:
    // return `https://cdn.aviders.com/${fileName}`;

    // Fallback to R2 public URL format (if enabled) or standard endpoint
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error("❌ R2 Upload Error:", error);
    throw new Error("Failed to upload screenshot to storage");
  }
};

module.exports = { uploadToR2 };
