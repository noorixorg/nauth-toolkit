#!/usr/bin/env node

/**
 * Remove sidebar_position from all API documentation files
 * to enable automatic alphabetical sorting by Docusaurus
 */

const fs = require('fs');
const path = require('path');

/**
 * Remove sidebar_position line from front matter
 *
 * @param {string} filePath - Path to the markdown file
 * @returns {boolean} True if file was modified
 */
function removeSidebarPosition(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file has sidebar_position
    if (!content.includes('sidebar_position:')) {
      return false;
    }

    // Split by front matter delimiter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      // No front matter, skip
      return false;
    }

    const frontMatter = match[1];
    const body = match[2];

    // Remove sidebar_position line (with or without value)
    const updatedFrontMatter = frontMatter
      .split('\n')
      .filter(line => !line.trim().startsWith('sidebar_position:'))
      .join('\n')
      .trim();

    // Reconstruct file
    let newContent;
    if (updatedFrontMatter) {
      // Front matter still exists
      newContent = `---\n${updatedFrontMatter}\n---\n${body}`;
    } else {
      // Front matter is now empty, remove it entirely
      newContent = body;
    }

    // Only write if content changed
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Recursively find all markdown files
 *
 * @param {string} dir - Directory to search
 * @param {string[]} results - Array to collect results
 */
function findMarkdownFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, results);
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Main function
 */
function main() {
  const apiDocsDir = path.join(__dirname, '../docs/api');

  if (!fs.existsSync(apiDocsDir)) {
    console.error(`Error: API docs directory not found: ${apiDocsDir}`);
    process.exit(1);
  }

  console.log('Finding all markdown files in API docs...\n');
  const allMarkdownFiles = findMarkdownFiles(apiDocsDir);

  console.log(`Found ${allMarkdownFiles.length} markdown files\n`);
  console.log('Removing sidebar_position from front matter...\n');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const filePath of allMarkdownFiles) {
    const updated = removeSidebarPosition(filePath);
    if (updated) {
      updatedCount++;
      console.log(`  ✓ Updated: ${path.relative(process.cwd(), filePath)}`);
    } else {
      skippedCount++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Updated: ${updatedCount} files`);
  console.log(`   Skipped: ${skippedCount} files (no sidebar_position found)`);
  console.log(`\nAll files will now be sorted alphabetically by Docusaurus.`);
}

if (require.main === module) {
  main();
}

module.exports = { removeSidebarPosition, findMarkdownFiles };

