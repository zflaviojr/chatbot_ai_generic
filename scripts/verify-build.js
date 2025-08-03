#!/usr/bin/env node

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying production build...\n');

// Check frontend build
const frontendDistDir = join(rootDir, 'frontend', 'dist');
const requiredFrontendFiles = [
  'index.html',
  'assets/js',
  'assets/css'
];

console.log('📦 Checking frontend build...');
let frontendValid = true;

if (!existsSync(frontendDistDir)) {
  console.log('❌ Frontend dist directory not found');
  frontendValid = false;
} else {
  for (const file of requiredFrontendFiles) {
    const filePath = join(frontendDistDir, file);
    if (!existsSync(filePath)) {
      console.log(`❌ Missing: ${file}`);
      frontendValid = false;
    } else {
      console.log(`✅ Found: ${file}`);
    }
  }
  
  // Check bundle size
  const indexPath = join(frontendDistDir, 'index.html');
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf8');
    if (indexContent.includes('assets/js/') && indexContent.includes('assets/css/')) {
      console.log('✅ Assets properly referenced in index.html');
    } else {
      console.log('⚠️ Assets may not be properly referenced in index.html');
    }
  }
}

// Check backend configuration
console.log('\n🔧 Checking backend configuration...');
let backendValid = true;

const backendDir = join(rootDir, 'backend');
const requiredBackendFiles = [
  'src/server.js',
  'src/config/environment.js',
  'package.json',
  'Dockerfile'
];

for (const file of requiredBackendFiles) {
  const filePath = join(backendDir, file);
  if (!existsSync(filePath)) {
    console.log(`❌ Missing: ${file}`);
    backendValid = false;
  } else {
    console.log(`✅ Found: ${file}`);
  }
}

// Check environment files
console.log('\n🌍 Checking environment configuration...');
const envFiles = [
  'backend/.env.production',
  'backend/.env.development',
  'frontend/.env.production',
  'frontend/.env.development'
];

let envValid = true;
for (const envFile of envFiles) {
  const filePath = join(rootDir, envFile);
  if (!existsSync(filePath)) {
    console.log(`❌ Missing: ${envFile}`);
    envValid = false;
  } else {
    console.log(`✅ Found: ${envFile}`);
  }
}

// Check Docker configuration
console.log('\n🐳 Checking Docker configuration...');
const dockerFiles = [
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'backend/Dockerfile',
  'nginx.conf'
];

let dockerValid = true;
for (const dockerFile of dockerFiles) {
  const filePath = join(rootDir, dockerFile);
  if (!existsSync(filePath)) {
    console.log(`❌ Missing: ${dockerFile}`);
    dockerValid = false;
  } else {
    console.log(`✅ Found: ${dockerFile}`);
  }
}

// Summary
console.log('\n📋 Build Verification Summary:');
console.log(`Frontend Build: ${frontendValid ? '✅ Valid' : '❌ Invalid'}`);
console.log(`Backend Config: ${backendValid ? '✅ Valid' : '❌ Invalid'}`);
console.log(`Environment: ${envValid ? '✅ Valid' : '❌ Invalid'}`);
console.log(`Docker Config: ${dockerValid ? '✅ Valid' : '❌ Invalid'}`);

const overallValid = frontendValid && backendValid && envValid && dockerValid;
console.log(`\nOverall Status: ${overallValid ? '✅ Ready for deployment' : '❌ Issues found'}`);

if (!overallValid) {
  console.log('\n⚠️ Please fix the issues above before deploying to production.');
  process.exit(1);
} else {
  console.log('\n🎉 Build verification passed! Ready for production deployment.');
}

process.exit(0);