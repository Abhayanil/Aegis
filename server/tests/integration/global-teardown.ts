/**
 * Global Teardown for Integration Tests
 * 
 * This file runs once after all integration tests to clean up the global test environment.
 * It handles cleanup of test data, temporary files, and external connections.
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  const startTime = performance.now();
  
  console.log('🧹 Starting global integration test teardown...');

  try {
    // Clean up temporary files
    await cleanupTemporaryFiles();
    
    // Close any open connections
    await closeConnections();
    
    // Generate final test summary
    await generateTestSummary();
    
    // Clean up test environment
    await cleanupTestEnvironment();

    const duration = performance.now() - startTime;
    console.log(`✅ Global teardown completed in ${duration.toFixed(2)}ms`);
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

async function cleanupTemporaryFiles() {
  console.log('🗑️  Cleaning up temporary files...');
  
  const tempDir = path.join(__dirname, 'temp');
  
  try {
    const files = await fs.readdir(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        await fs.unlink(filePath);
        console.log(`  Removed: ${file}`);
      } else if (stats.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
        console.log(`  Removed directory: ${file}`);
      }
    }
    
    console.log('✅ Temporary files cleaned up');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('⚠️  Failed to clean up temporary files:', error.message);
    }
  }
}

async function closeConnections() {
  console.log('🔌 Closing connections...');
  
  // Close any database connections, HTTP servers, or other resources
  // that might have been opened during testing
  
  // In a real implementation, you would close:
  // - Database connections
  // - HTTP servers
  // - WebSocket connections
  // - File watchers
  // - Timers and intervals
  
  // For now, we'll just clear any global timers
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Connections closed');
}

async function generateTestSummary() {
  console.log('📊 Generating test summary...');
  
  try {
    const reportsDir = path.join(__dirname, 'reports');
    const resultsPath = path.join(reportsDir, 'results.json');
    
    // Check if test results exist
    try {
      await fs.access(resultsPath);
      
      const resultsContent = await fs.readFile(resultsPath, 'utf-8');
      const results = JSON.parse(resultsContent);
      
      // Generate a simple summary
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.numTotalTests || 0,
        passedTests: results.numPassedTests || 0,
        failedTests: results.numFailedTests || 0,
        skippedTests: results.numPendingTests || 0,
        duration: results.testResults?.reduce((total, suite) => {
          return total + (suite.perfStats?.runtime || 0);
        }, 0) || 0,
        suites: results.testResults?.map(suite => ({
          name: suite.name,
          tests: suite.assertionResults?.length || 0,
          passed: suite.assertionResults?.filter(test => test.status === 'passed').length || 0,
          failed: suite.assertionResults?.filter(test => test.status === 'failed').length || 0,
          duration: suite.perfStats?.runtime || 0,
        })) || [],
      };
      
      const summaryPath = path.join(reportsDir, 'summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log('📈 Test Summary:');
      console.log(`  Total Tests: ${summary.totalTests}`);
      console.log(`  Passed: ${summary.passedTests}`);
      console.log(`  Failed: ${summary.failedTests}`);
      console.log(`  Skipped: ${summary.skippedTests}`);
      console.log(`  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
      console.log(`  Summary saved to: ${summaryPath}`);
      
    } catch (error) {
      console.log('  No test results found to summarize');
    }
    
    console.log('✅ Test summary generated');
  } catch (error) {
    console.warn('⚠️  Failed to generate test summary:', error.message);
  }
}

async function cleanupTestEnvironment() {
  console.log('🔧 Cleaning up test environment...');
  
  // Reset environment variables
  delete process.env.TEST_MODE;
  delete process.env.MOCK_EXTERNAL_APIS;
  delete process.env.DISABLE_EXTERNAL_SERVICES;
  
  // Clear global test configurations
  if (global.mockServiceConfigs) {
    delete global.mockServiceConfigs;
  }
  
  // Clear any global test state
  if (global.testStartTime) {
    delete global.testStartTime;
  }
  
  console.log('✅ Test environment cleaned up');
}

// Additional cleanup utilities that can be called from individual tests
export async function cleanupTestData(testId: string) {
  console.log(`🧹 Cleaning up test data for: ${testId}`);
  
  // Clean up any test-specific data
  // This could include:
  // - Removing test documents from storage
  // - Clearing test database records
  // - Removing temporary files created by specific tests
  
  const tempDir = path.join(__dirname, 'temp');
  const testFiles = await fs.readdir(tempDir).catch(() => []);
  
  for (const file of testFiles) {
    if (file.includes(testId)) {
      const filePath = path.join(tempDir, file);
      await fs.unlink(filePath).catch(() => {});
      console.log(`  Removed test file: ${file}`);
    }
  }
}

export async function generatePerformanceReport(testResults: any[]) {
  console.log('📊 Generating performance report...');
  
  const reportsDir = path.join(__dirname, 'reports');
  
  try {
    await fs.access(reportsDir);
  } catch {
    await fs.mkdir(reportsDir, { recursive: true });
  }
  
  const performanceData = testResults.map(result => ({
    testName: result.testName,
    duration: result.duration,
    memoryUsage: result.memoryUsage,
    cpuUsage: result.cpuUsage,
    timestamp: result.timestamp,
  }));
  
  const reportPath = path.join(reportsDir, 'performance-report.json');
  await fs.writeFile(reportPath, JSON.stringify(performanceData, null, 2));
  
  console.log(`📈 Performance report saved to: ${reportPath}`);
}

export async function archiveTestResults() {
  console.log('📦 Archiving test results...');
  
  const reportsDir = path.join(__dirname, 'reports');
  const archiveDir = path.join(__dirname, 'archive');
  
  try {
    await fs.access(reportsDir);
    
    // Create archive directory if it doesn't exist
    try {
      await fs.access(archiveDir);
    } catch {
      await fs.mkdir(archiveDir, { recursive: true });
    }
    
    // Create timestamp-based archive folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveSubDir = path.join(archiveDir, `test-results-${timestamp}`);
    await fs.mkdir(archiveSubDir, { recursive: true });
    
    // Copy all report files to archive
    const reportFiles = await fs.readdir(reportsDir);
    
    for (const file of reportFiles) {
      const sourcePath = path.join(reportsDir, file);
      const destPath = path.join(archiveSubDir, file);
      
      const stats = await fs.stat(sourcePath);
      if (stats.isFile()) {
        await fs.copyFile(sourcePath, destPath);
        console.log(`  Archived: ${file}`);
      }
    }
    
    console.log(`✅ Test results archived to: ${archiveSubDir}`);
  } catch (error) {
    console.warn('⚠️  Failed to archive test results:', error.message);
  }
}