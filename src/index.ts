import "dotenv/config";
import { Command } from "commander";
import { processMockupFolders } from "./utils/functions.js";

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
