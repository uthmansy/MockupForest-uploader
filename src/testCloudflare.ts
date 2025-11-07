import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./lib/cloudflare.js";

// Validate env vars (they must be set in terminal or system)
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error("❌ Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
}

const BUCKET_NAME = "files"; // ← CHANGE THIS!

async function testUpload() {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: "hello.txt",
      Body: "Uploaded via CMD + tsc! 🚀",
    })
  );
  console.log("✅ Success! File uploaded to R2.");
}

testUpload().catch(console.error);
