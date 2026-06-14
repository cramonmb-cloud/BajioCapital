const fs = require('fs');
const path = require('path');

const versionFilePath = path.join(__dirname, '../src/version.ts');

let currentVersion = "3.1.30";

if (fs.existsSync(versionFilePath)) {
  try {
    const content = fs.readFileSync(versionFilePath, 'utf8');
    const match = content.match(/VERSION\s*=\s*["']([^"']+)["']/);
    if (match) {
      currentVersion = match[1];
    }
  } catch (e) {
    console.error("Error reading version file, resetting to default", e);
  }
}

const parts = currentVersion.split('.');
if (parts.length === 3) {
  let patch = parseInt(parts[2], 10);
  if (!isNaN(patch)) {
    patch += 10;
    parts[2] = patch.toString();
  }
}

const newVersion = parts.join('.');
fs.writeFileSync(versionFilePath, `export const VERSION = "${newVersion}";\n`, 'utf8');
console.log(`Version incremented to: ${newVersion}`);
