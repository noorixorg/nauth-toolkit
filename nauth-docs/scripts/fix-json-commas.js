#!/usr/bin/env node

/**
 * Fix missing commas in _category_.json files
 */

const fs = require('fs');
const path = require('path');

function fixCategoryFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Fix missing commas between JSON properties
    // Pattern: "key": value followed by "key" (missing comma)
    content = content.replace(/"([^"]+)":\s*([^,}\]]+)\s*\n\s*"([^"]+)":/g, '"$1": $2,\n  "$3":');

    // Fix missing commas in nested objects
    content = content.replace(/"([^"]+)":\s*"([^"]+)"\s*\n\s*"([^"]+)":/g, '"$1": "$2",\n    "$3":');

    // Try to parse - if it fails, try a more aggressive fix
    try {
      JSON.parse(content);
    } catch (e) {
      // More aggressive: add comma before any "key": that follows a value
      content = content.replace(/([^,}\]])\s*\n\s*"([^"]+)":/g, '$1,\n  "$2":');
      content = content.replace(/([^,}\]])\s*\n\s*}/g, '$1\n}');
    }

    // Final parse and reformat
    const json = JSON.parse(content);
    const formatted = JSON.stringify(json, null, 2) + '\n';

    fs.writeFileSync(filePath, formatted, 'utf-8');
    return true;
  } catch (error) {
    console.error(`  ✗ Error fixing ${filePath}: ${error.message}`);
    // Try manual fix for common patterns
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      // Add commas after string values before next property
      content = content.replace(/"([^"]+)":\s*"([^"]+)"\s*\n\s*"([^"]+)":/g, '"$1": "$2",\n  "$3":');
      content = content.replace(/"([^"]+)":\s*(\d+)\s*\n\s*"([^"]+)":/g, '"$1": $2,\n  "$3":');
      content = content.replace(/"([^"]+)":\s*(true|false)\s*\n\s*"([^"]+)":/g, '"$1": $2,\n  "$3":');
      content = content.replace(/"([^"]+)":\s*(true|false)\s*\n\s*}/g, '"$1": $2\n}');
      content = content.replace(/"([^"]+)":\s*(\d+)\s*\n\s*}/g, '"$1": $2\n}');

      const json = JSON.parse(content);
      const formatted = JSON.stringify(json, null, 2) + '\n';
      fs.writeFileSync(filePath, formatted, 'utf-8');
      return true;
    } catch (e2) {
      return false;
    }
  }
}

function main() {
  const apiDocsDir = path.join(__dirname, '../docs/api');
  const categoryFiles = [];

  function findFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findFiles(fullPath);
      } else if (entry.name === '_category_.json') {
        categoryFiles.push(fullPath);
      }
    }
  }

  findFiles(apiDocsDir);

  console.log(`Fixing ${categoryFiles.length} category files...\n`);

  let fixed = 0;
  for (const file of categoryFiles) {
    if (fixCategoryFile(file)) {
      fixed++;
      console.log(`  ✓ Fixed: ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`\n✅ Fixed ${fixed} files`);
}

if (require.main === module) {
  main();
}

