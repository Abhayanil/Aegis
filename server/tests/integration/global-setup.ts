/**
 * Global Setup for Integration Tests
 * 
 * This file runs once before all integration tests to set up the global test environment.
 * It handles database connections, external service mocking, and test data preparation.
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const startTime = performance.now();
  
  console.log('🚀 Starting global integration test setup...');

  try {
    // Set up test environment
    await setupTestEnvironment();
    
    // Create test directories
    await createTestDirectories();
    
    // Prepare test fixtures
    await prepareTestFixtures();
    
    // Initialize mock services
    await initializeMockServices();
    
    // Validate test dependencies
    await validateTestDependencies();

    const duration = performance.now() - startTime;
    console.log(`✅ Global setup completed in ${duration.toFixed(2)}ms`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/test-credentials.json';
  
  // Disable external service calls in test environment
  process.env.DISABLE_EXTERNAL_SERVICES = 'true';
  
  // Set test-specific configuration
  process.env.TEST_MODE = 'integration';
  process.env.MOCK_EXTERNAL_APIS = 'true';
  
  console.log('✅ Test environment configured');
}

async function createTestDirectories() {
  console.log('📁 Creating test directories...');
  
  const directories = [
    path.join(__dirname, 'reports'),
    path.join(__dirname, 'coverage'),
    path.join(__dirname, '../fixtures'),
    path.join(__dirname, 'temp'),
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`  Created: ${path.relative(__dirname, dir)}`);
    }
  }
  
  console.log('✅ Test directories ready');
}

async function prepareTestFixtures() {
  console.log('📄 Preparing test fixtures...');
  
  const fixturesDir = path.join(__dirname, '../fixtures');
  
  // Create sample PDF content (mock binary data)
  const samplePdfPath = path.join(fixturesDir, 'sample-pitch-deck.pdf');
  try {
    await fs.access(samplePdfPath);
  } catch {
    const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(TestCorp - SaaS Platform) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`);
    
    await fs.writeFile(samplePdfPath, pdfContent);
    console.log('  Created: sample-pitch-deck.pdf');
  }

  // Create sample transcript
  const sampleTranscriptPath = path.join(fixturesDir, 'sample-transcript.txt');
  try {
    await fs.access(sampleTranscriptPath);
  } catch {
    const transcriptContent = `
Founder: Thank you for taking the time to meet with us today. I'm John Doe, CEO of TestCorp.

Investor: Great to meet you, John. Can you start by telling us about TestCorp?

Founder: Absolutely. TestCorp is a SaaS platform that helps enterprise customers automate their workflow processes. We've been operating for about 2 years now and have seen tremendous growth.

Investor: That sounds interesting. Can you share some metrics?

Founder: Of course. We currently have $2 million in annual recurring revenue, growing at about 15% month-over-month. We serve 150 enterprise customers with a 95% retention rate.

Investor: Impressive growth. Tell me about your team.

Founder: We have a team of 25 people, including myself and my co-founder Jane Smith, who serves as our CTO. Jane has over 10 years of experience in enterprise software development.

Investor: What about the market opportunity?

Founder: The total addressable market for workflow automation is approximately $50 billion. We're specifically targeting the mid-market segment, which represents about $15 billion of that opportunity.

Investor: And funding?

Founder: We previously raised a $1 million seed round 18 months ago. We're now raising a $5 million Series A to expand our sales team and accelerate our growth.

Investor: What are your main competitors?

Founder: Our primary competitors are Competitor A and Competitor B, but we differentiate ourselves through our AI-powered automation capabilities and superior user experience.

Investor: Thank you for the overview. We'll be in touch soon.

Founder: Thank you for your time and consideration.
    `.trim();
    
    await fs.writeFile(sampleTranscriptPath, transcriptContent);
    console.log('  Created: sample-transcript.txt');
  }

  // Create sample financial document (mock DOCX content)
  const sampleFinancialsPath = path.join(fixturesDir, 'sample-financials.docx');
  try {
    await fs.access(sampleFinancialsPath);
  } catch {
    // Create a minimal ZIP structure that mimics a DOCX file
    const docxContent = Buffer.from('PK\x03\x04'); // ZIP file signature
    await fs.writeFile(sampleFinancialsPath, docxContent);
    console.log('  Created: sample-financials.docx');
  }

  // Create sample image for OCR testing
  const sampleImagePath = path.join(fixturesDir, 'sample-image.png');
  try {
    await fs.access(sampleImagePath);
  } catch {
    // Create a minimal PNG file (1x1 pixel)
    const pngContent = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x01, 0x5C, 0xC2, 0xD5, 0x7E,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82
    ]);
    
    await fs.writeFile(sampleImagePath, pngContent);
    console.log('  Created: sample-image.png');
  }

  console.log('✅ Test fixtures prepared');
}

async function initializeMockServices() {
  console.log('🔧 Initializing mock services...');
  
  // Set up mock service configurations
  const mockConfigs = {
    bigquery: {
      projectId: 'test-project',
      datasetId: 'test_dataset',
      tableId: 'benchmark_data',
    },
    firestore: {
      projectId: 'test-project',
      collectionName: 'dealMemos',
    },
    vertexai: {
      projectId: 'test-project',
      location: 'us-central1',
      model: 'gemini-1.5-pro',
    },
    vision: {
      projectId: 'test-project',
      features: ['TEXT_DETECTION'],
    },
  };

  // Store mock configurations for tests to use
  global.mockServiceConfigs = mockConfigs;
  
  console.log('✅ Mock services initialized');
}

async function validateTestDependencies() {
  console.log('🔍 Validating test dependencies...');
  
  const checks = [
    checkNodeVersion(),
    checkRequiredPackages(),
    checkTestFiles(),
  ];

  const results = await Promise.allSettled(checks);
  const failures = results.filter(r => r.status === 'rejected');

  if (failures.length > 0) {
    console.error('❌ Dependency validation failed:');
    failures.forEach((failure, index) => {
      console.error(`  ${index + 1}. ${failure.reason}`);
    });
    throw new Error('Test dependencies validation failed');
  }
  
  console.log('✅ Test dependencies validated');
}

async function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum version: 18.x`);
  }
}

async function checkRequiredPackages() {
  const packageJsonPath = path.join(__dirname, '../../package.json');
  
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const requiredPackages = [
      'vitest',
      'supertest',
      '@google-cloud/bigquery',
      '@google-cloud/firestore',
      '@google-cloud/vision',
      '@google-cloud/vertexai',
    ];

    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const missingPackages = requiredPackages.filter(pkg => !allDependencies[pkg]);
    
    if (missingPackages.length > 0) {
      throw new Error(`Missing required packages: ${missingPackages.join(', ')}`);
    }
  } catch (error) {
    throw new Error(`Failed to validate packages: ${error.message}`);
  }
}

async function checkTestFiles() {
  const testFiles = [
    'e2e.test.ts',
    'performance.test.ts',
    'validation.test.ts',
    'google-cloud.test.ts',
  ];

  for (const testFile of testFiles) {
    const testFilePath = path.join(__dirname, testFile);
    try {
      await fs.access(testFilePath);
    } catch {
      throw new Error(`Test file not found: ${testFile}`);
    }
  }
}

// Declare global types for mock configurations
declare global {
  var mockServiceConfigs: {
    bigquery: any;
    firestore: any;
    vertexai: any;
    vision: any;
  };
}