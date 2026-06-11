#!/usr/bin/env node

/**
 * Fix JSON formatting in _category_.json files
 */

const fs = require('fs');
const path = require('path');

function fixCategoryFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove sorted property if it exists
    content = content.replace(/,\s*"sorted":\s*true/g, '');
    content = content.replace(/"sorted":\s*true,?\s*/g, '');

    // Fix trailing commas before closing braces/brackets
    content = content.replace(/,(\s*[}\]])/g, '$1');

    // Parse and reformat JSON
    const json = JSON.parse(content);
    const formatted = JSON.stringify(json, null, 2) + '\n';

    fs.writeFileSync(filePath, formatted, 'utf-8');
    return true;
  } catch (error) {
    console.error(`  ✗ Error fixing ${filePath}: ${error.message}`);
    return false;
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
    }
  }

  console.log(`✅ Fixed ${fixed} files`);
}

if (require.main === module) {
  main();
}

