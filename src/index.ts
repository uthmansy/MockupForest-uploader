import "dotenv/config";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import { imageSize } from "image-size";
import { uploadMockupsToSupabase } from "./uploadToSupabase.js";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                   */
/* -------------------------------------------------------------------------- */

interface Group {
  id: number;
  name: string;
}

interface Layer {
  id: number;
  name: string;
  height: number;
  width: number;
  design?: string | null;
  uvPass?: string;
  mask: string;
  zIndex: number;
  groupId?: number | null;
  crop: { x: number; y: number };
  croppedAreaPixels?: any | null;
  croppedArea?: any | null;
  zoom?: number;
  type: "design" | "color";
  color?: string;
  aspectRatio: number;
  noiseThreshold?: number;
  highlightsIntensity: undefined;
  shadowIntensity: undefined;
}

interface GlobalSettings {
  name: string;
  base: string;
  uv: string;
  brightness: number;
  contrast: number;
  highlightsIntensity: number;
  uvTexture?: null;
  baseTexture?: null;
  canvasWidth: number;
  canvasHeight: number;
}

interface LayersState {
  layers: Layer[];
  groups: Group[];
  global: GlobalSettings;
  loading: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              UTILITY FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

/** Get all subfolders in a directory */
function getSubfolders(parentPath: string): string[] {
  if (!fs.existsSync(parentPath)) {
    throw new Error("❌ Parent directory does not exist");
  }

  return fs
    .readdirSync(parentPath, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => path.join(parentPath, item.name));
}

/** Write data to JSON file prettily */
function writeJSON(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Create a GlobalSettings object */
function createGlobalSettings(folderName: string): GlobalSettings {
  return {
    name: folderName,
    base: "",
    uv: "",
    brightness: 1.0,
    contrast: 1.0,
    highlightsIntensity: 2.7,
    uvTexture: null,
    baseTexture: null,
    canvasHeight: 1,
    canvasWidth: 1,
  };
}

/* -------------------------------------------------------------------------- */
/*                             MOCKUP GENERATION                              */
/* -------------------------------------------------------------------------- */

/** Generate a mockup.json structure for a single folder */
function generateMockupData(mockupFolder: string): LayersState | null {
  const files = fs.readdirSync(mockupFolder);
  const layers: Layer[] = [];
  const groups: Group[] = [{ id: 1, name: "Default Group" }];

  let beautyDimensions = { width: 2000, height: 1500 }; // fallback
  const folderName = path.basename(mockupFolder);

  const global = createGlobalSettings(folderName);

  let idCounter = 1;
  let hasBeauty = false;

  // Pass 1: detect base and uv
  for (const file of files) {
    const lower = file.toLowerCase();
    if (lower.startsWith("beauty")) {
      global.base = file;
      hasBeauty = true;

      // ✅ Get real dimensions
      try {
        const beautyPath = path.join(mockupFolder, file);
        const buffer = fs.readFileSync(beautyPath);
        const { width, height } = imageSize(buffer);
        if (width && height) beautyDimensions = { width, height };
      } catch (err) {
        console.warn(`⚠️ Could not read dimensions for ${file}:`, err);
      }
    } else if (lower.startsWith("uv")) {
      global.uv = file;
    }
  }

  if (!hasBeauty) return null;

  global.canvasWidth = beautyDimensions.width;
  global.canvasHeight = beautyDimensions.height;

  function getLayerDesignAspectRatio(id: number): number {
    const layoutFile = files.find(
      (f) =>
        f.toLowerCase() === `l${id}.jpg` || f.toLowerCase() === `l${id}.png`
    );

    if (!layoutFile) return beautyDimensions.width / beautyDimensions.height;

    try {
      const layerPath = path.join(mockupFolder, layoutFile);
      const buffer = fs.readFileSync(layerPath);
      const { width, height } = imageSize(buffer);
      if (width && height) return width / height;
    } catch (err) {
      console.warn(`⚠️ Could not read dimensions for ${layoutFile}:`, err);
    }

    // fallback if anything fails
    return beautyDimensions.width / beautyDimensions.height;
  }

  // Pass 2: detect masks
  for (const file of files) {
    const lower = file.toLowerCase();
    if (lower.startsWith("beauty") || lower.startsWith("uv")) continue;

    // Add optional -nN before extension (works for .jpg/.png etc.)
    const designMatch = file.match(
      /^m(\d+)-(.+?)-design-z(\d+)(?:-n([\d.]+))?\.(jpg|jpeg|png)$/i
    );

    const colorMatch = file.match(
      /^m(\d+)-(.+?)-color-default_([\da-fA-F]{6}|[\w\s]+)-z(\d+)(?:-n([\d.]+))?\.(jpg|jpeg|png)$/i
    );

    if (designMatch) {
      const id = parseInt(designMatch[1] ?? "0", 10);
      const name = (designMatch[2] ?? "").replace(/_/g, " ");
      const zIndex = parseInt(designMatch[3] ?? "0", 10);
      const noiseThreshold = parseFloat(designMatch[4] ?? "0");

      const designFile = files.find(
        (f) =>
          f.toLowerCase() === `d${id}.jpg` || f.toLowerCase() === `d${id}.png`
      );

      const layer: Layer = {
        id: idCounter++,
        name,
        height: beautyDimensions.height,
        width: beautyDimensions.width,
        mask: file,
        design: designFile ? designFile : null,
        zIndex,
        groupId: null,
        crop: { x: 0, y: 0 },
        zoom: 1,
        type: "design",
        aspectRatio: getLayerDesignAspectRatio(id),
        // ✅ new field
        noiseThreshold,
        highlightsIntensity: undefined,
        shadowIntensity: undefined,
      };

      layers.push(layer);
    } else if (colorMatch) {
      const id = parseInt(colorMatch[1] ?? "0", 10);
      const name = (colorMatch[2] ?? "").replace(/_/g, " ");
      let color = colorMatch[3] ?? "000000";
      const zIndex = parseInt(colorMatch[4] ?? "0", 10);
      const noiseThreshold = parseFloat(colorMatch[5] ?? "0");

      if (/^[\da-fA-F]{6}$/.test(color)) color = `#${color}`;

      const layer: Layer = {
        id: idCounter++,
        name,
        height: beautyDimensions.height,
        width: beautyDimensions.width,
        mask: file,
        zIndex,
        groupId: null,
        crop: { x: 0, y: 0 },
        zoom: 1,
        type: "color",
        color,
        aspectRatio: getLayerDesignAspectRatio(id),
        // ✅ new field
        noiseThreshold,
        highlightsIntensity: undefined,
        shadowIntensity: undefined,
      };

      layers.push(layer);
    }
  }

  // Sort layers by zIndex
  layers.sort((a, b) => a.zIndex - b.zIndex);

  return { layers, groups, global, loading: true };
}

/** Process all mockup folders */
function processMockupFolders(parentFolder: string): void {
  const absParentPath = path.resolve(parentFolder);
  console.log(`📁 Scanning parent directory: ${absParentPath}\n`);

  const mockupFolders = getSubfolders(absParentPath);

  if (mockupFolders.length === 0) {
    console.log("❌ No subfolders found in the parent directory");
    return;
  }

  console.log(`Found ${mockupFolders.length} mockup folders:\n`);
  mockupFolders.forEach((folder) =>
    console.log(`  - ${path.basename(folder)}`)
  );
  console.log();

  let processedCount = 0;
  let errorCount = 0;

  for (const folder of mockupFolders) {
    try {
      console.log(`⚙️ Processing: ${path.basename(folder)}...`);

      const data = generateMockupData(folder);
      if (!data) {
        console.log(`  ⚠️ Skipping - no beauty image found`);
        continue;
      }

      const outPath = path.join(folder, "mockup.json");
      writeJSON(outPath, data);
      console.log(
        `  ✅ Generated mockup.json with ${data.layers.length} layers`
      );
      processedCount++;
    } catch (error) {
      console.error(`  ❌ Error processing ${path.basename(folder)}:`, error);
      errorCount++;
    }
  }

  console.log(`\n🎉 Processing complete!`);
  console.log(`✅ Successfully processed: ${processedCount} folders`);
  if (errorCount > 0) console.log(`❌ Errors: ${errorCount} folders`);

  uploadMockupsToSupabase(absParentPath);
}

/* -------------------------------------------------------------------------- */
/*                                  CLI SETUP                                 */
/* -------------------------------------------------------------------------- */

const program = new Command();

program
  .name("mockup-cli")
  .description("Generate mockup JSON structure from folder contents")
  .version("1.0.0");

program
  .command("generate <parentFolderPath>")
  .description("Generate JSON data structures for all mockup folders")
  .action(processMockupFolders);

program.parse();
