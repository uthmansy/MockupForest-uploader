import { S3Client } from "@aws-sdk/client-s3";

// Ensure env vars are defined
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing R2 credentials: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set"
  );
}

export const s3 = new S3Client({
  region: "auto",
  endpoint: "https://392c51f4f089b29ece9746568848c204.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
