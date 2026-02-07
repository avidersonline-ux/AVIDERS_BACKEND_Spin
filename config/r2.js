const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

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
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error("❌ R2 Upload Error:", error);
    throw new Error("Failed to upload screenshot to storage");
  }
};

/**
 * ✅ ADD THIS FUNCTION: Move file between folders in R2
 */
const moveFileInR2 = async (sourceKey, destinationKey) => {
  const bucketName = process.env.R2_BUCKET_NAME || "aviders-claims";
  
  try {
    // Copy to new location
    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${sourceKey}`,
      Key: destinationKey,
    }));
    
    // Delete from old location
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: sourceKey,
    }));
    
    console.log(`✅ Moved file from ${sourceKey} to ${destinationKey}`);
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${destinationKey}`;
  } catch (error) {
    console.error('❌ R2 Move Error:', error);
    throw new Error('Failed to move file in storage');
  }
};

module.exports = { 
  uploadToR2, 
  s3Client,
  moveFileInR2  // ✅ Export the new function
};
