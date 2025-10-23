import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadMockupsToSupabase(parentFolder: string) {
  const absParent = path.resolve(parentFolder);
  const folders = fs
    .readdirSync(absParent, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(absParent, d.name));

  console.log(`📦 Uploading mockups from: ${absParent}`);

  for (const folder of folders) {
    const folderName = path.basename(folder);
    const jsonPath = path.join(folder, "mockup.json");

    if (!fs.existsSync(jsonPath)) {
      console.log(`⚠️ Skipping ${folderName} — no mockup.json found.`);
      continue;
    }

    try {
      console.log(`\n🚀 Processing "${folderName}"...`);

      // 1️⃣ Read mockup.json
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      const mockupTitle = jsonData.global?.name || folderName;
      const slug = mockupTitle.toLowerCase().replace(/\s+/g, "-");
      const body = JSON.stringify(jsonData, null, 2);
      const fileSize = `${(Buffer.byteLength(body) / 1024).toFixed(2)} KB`;

      // 2️⃣ Upload folder assets
      const files = fs.readdirSync(folder);
      const uploadedFiles: string[] = [];

      for (const file of files) {
        const filePath = path.join(folder, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        const fileBuffer = fs.readFileSync(filePath);
        const storagePath = `online-mockups/${folderName}/${file}`;

        const { error: uploadError } = await supabase.storage
          .from("files") // changed bucket
          .upload(storagePath, fileBuffer, {
            contentType: getMimeType(file),
            upsert: true,
          });

        if (uploadError)
          throw new Error(`Upload failed for ${file}: ${uploadError.message}`);
        uploadedFiles.push(storagePath);
      }

      // 3️⃣ Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("files") // changed bucket
        .getPublicUrl(`online-mockups/${folderName}/beauty.jpg`); // specific preview file
      const baseFolderUrl = publicUrlData?.publicUrl || null;

      // 4️⃣ Insert DB record
      const record = {
        title: mockupTitle,
        slug,
        description: `"${mockupTitle}"`,
        file_size: "NIL",
        file_type: "application/json",
        author: "MockupForest",
        is_editable: true,
        mockup_data: jsonData,
        source_url: baseFolderUrl,
        preview_url: null,
      };

      const { error: dbError } = await supabase.from("mockups").insert(record);
      if (dbError)
        throw new Error(`Database insert failed: ${dbError.message}`);

      console.log(
        `✅ Successfully uploaded "${mockupTitle}" (${uploadedFiles.length} files)`
      );
    } catch (err) {
      console.error(
        `❌ Error processing "${folderName}": ${(err as Error).message}`
      );

      // 5️⃣ Rollback uploaded files
      console.log(`🧹 Rolling back uploaded files for "${folderName}"...`);
      const { error: cleanupError } = await supabase.storage
        .from("files")
        .remove(
          fs
            .readdirSync(folder)
            .filter((f) => fs.statSync(path.join(folder, f)).isFile())
            .map((f) => `online-mockups/${folderName}/${f}`)
        );

      if (cleanupError) {
        console.error(`⚠️ Rollback failed: ${cleanupError.message}`);
      } else {
        console.log(`✅ Rollback complete for "${folderName}"`);
      }
    }
  }

  console.log("\n🎉 All done!");
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
