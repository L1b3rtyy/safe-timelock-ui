// This script updates the version in package.json by incrementing the patch version. It is run before each release.
import fs from "fs";
import packageJson from "./package.json" with { type: "json" };

const currentVersion = packageJson.version;
let [major, minor, patch] = currentVersion.split(".");
packageJson.version = major + "." + minor + "." + (parseInt(patch)+1);
fs.writeFileSync("./package.json", JSON.stringify(packageJson, null, 2));
console.log(`Version updated to ${packageJson.version}`);