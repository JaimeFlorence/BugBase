#!/usr/bin/env node

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const PUBLIC_DIR = './public';
const OUTPUT_DIR = './public/optimized';

// Optimization settings
const OPTIMIZATION_CONFIG = {
  jpeg: { quality: 85, progressive: true },
  png: { compressionLevel: 9, progressive: true },
  webp: { quality: 85 },
};

// Size variants for responsive images
const SIZE_VARIANTS = [
  { name: 'thumbnail', width: 150, height: 150 },
  { name: 'small', width: 400 },
  { name: 'medium', width: 800 },
  { name: 'large', width: 1200 },
  { name: 'original', width: null }, // Keep original size but optimize
];

async function getImageFiles(dir) {
  const files = [];
  const items = await readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const path = join(dir, item.name);
    
    if (item.isDirectory() && !path.includes('optimized')) {
      files.push(...await getImageFiles(path));
    } else if (item.isFile()) {
      const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        files.push(path);
      }
    }
  }

  return files;
}

async function optimizeImage(inputPath, outputPath, variant) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Skip if image is smaller than target size
    if (variant.width && metadata.width && metadata.width < variant.width) {
      return null;
    }

    let processedImage = image;

    // Resize if variant specifies dimensions
    if (variant.width || variant.height) {
      processedImage = processedImage.resize(variant.width, variant.height, {
        fit: variant.height ? 'cover' : 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format-specific optimizations
    const format = metadata.format;
    if (format === 'jpeg' || format === 'jpg') {
      processedImage = processedImage.jpeg(OPTIMIZATION_CONFIG.jpeg);
    } else if (format === 'png') {
      processedImage = processedImage.png(OPTIMIZATION_CONFIG.png);
    }

    // Save optimized image
    await processedImage.toFile(outputPath);

    // Also create WebP version
    const webpPath = outputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    await sharp(inputPath)
      .resize(variant.width, variant.height, {
        fit: variant.height ? 'cover' : 'inside',
        withoutEnlargement: true,
      })
      .webp(OPTIMIZATION_CONFIG.webp)
      .toFile(webpPath);

    const stats = await stat(outputPath);
    const originalStats = await stat(inputPath);
    const savings = ((1 - stats.size / originalStats.size) * 100).toFixed(2);

    return {
      original: inputPath,
      optimized: outputPath,
      webp: webpPath,
      originalSize: originalStats.size,
      optimizedSize: stats.size,
      savings: `${savings}%`,
    };
  } catch (error) {
    console.error(`Error optimizing ${inputPath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all image files
  const imageFiles = await getImageFiles(PUBLIC_DIR);
  console.log(`Found ${imageFiles.length} images to optimize\n`);

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  const results = [];

  // Process each image
  for (const imagePath of imageFiles) {
    const relativePath = imagePath.replace(PUBLIC_DIR + '/', '');
    console.log(`Processing: ${relativePath}`);

    // Create subdirectory structure in output
    const outputSubdir = join(OUTPUT_DIR, relativePath.substring(0, relativePath.lastIndexOf('/')));
    if (!existsSync(outputSubdir)) {
      mkdirSync(outputSubdir, { recursive: true });
    }

    // Optimize for each size variant
    for (const variant of SIZE_VARIANTS) {
      const outputFilename = variant.name === 'original' 
        ? relativePath.substring(relativePath.lastIndexOf('/') + 1)
        : `${relativePath.substring(relativePath.lastIndexOf('/') + 1, relativePath.lastIndexOf('.'))}-${variant.name}${relativePath.substring(relativePath.lastIndexOf('.'))}`;
      
      const outputPath = join(OUTPUT_DIR, relativePath.substring(0, relativePath.lastIndexOf('/')), outputFilename);
      
      const result = await optimizeImage(imagePath, outputPath, variant);
      
      if (result) {
        results.push(result);
        if (variant.name === 'original') {
          totalOriginalSize += result.originalSize;
          totalOptimizedSize += result.optimizedSize;
        }
      }
    }
  }

  // Print summary
  console.log('\n📊 Optimization Summary:');
  console.log('=======================');
  console.log(`Total images processed: ${imageFiles.length}`);
  console.log(`Total variants created: ${results.length}`);
  console.log(`Original total size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized total size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total savings: ${((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(2)}%`);

  // Generate import map for optimized images
  const importMap = {};
  results.forEach((result) => {
    const key = result.original.replace(PUBLIC_DIR + '/', '');
    if (!importMap[key]) {
      importMap[key] = {};
    }
    const variant = result.optimized.includes('-') 
      ? result.optimized.substring(result.optimized.lastIndexOf('-') + 1, result.optimized.lastIndexOf('.'))
      : 'original';
    importMap[key][variant] = {
      optimized: result.optimized.replace(PUBLIC_DIR + '/', '/'),
      webp: result.webp.replace(PUBLIC_DIR + '/', '/'),
    };
  });

  // Save import map
  const importMapPath = join('./src/assets', 'optimized-images.json');
  await fs.writeFile(importMapPath, JSON.stringify(importMap, null, 2));
  console.log(`\n✅ Import map saved to: ${importMapPath}`);
}

// Add to package.json if not exists
const fs = require('fs').promises;

main().catch(console.error);