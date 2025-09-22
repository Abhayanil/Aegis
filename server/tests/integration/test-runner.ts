#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * This script orchestrates the execution of integration tests with proper setup,
 * teardown, and reporting. It can be run in different modes:
 * - Full integration test suite
 * - Performance benchmarking only
 * - Validation tests only
 * - Google Cloud integration tests only
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestSuite {
  name: string;
  file: string;
  description: string;
  timeout: number;
  dependencies: string[];
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  error?: string;
  stats?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'e2e',
    file: 'e2e.test.ts',
    description: 'End-to-end integration tests',
    timeout: 60000,
    dependencies: ['document-processing', 'ai-analysis', 'storage'],
  },
  {
    name: 'performance',
    file: 'performance.test.ts',
    description: 'Performance and load testing',
    timeout: 120000,
    dependencies: ['all-services'],
  },
  {
    name: 'validation',
    file: 'validation.test.ts',
    description: 'Deal memo validation and quality assurance',
    timeout: 45000,
    dependencies: ['ai-analysis', 'validation-schemas'],
  },
  {
    name: 'google-cloud',
    file: 'google-cloud.test.ts',
    description: 'Google Cloud service integration tests',
    timeout: 30000,
    dependencies: ['google-cloud-credentials'],
  },
];

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private verbose: boolean = false;
  private mode: string = 'all';
  private reportPath: string;

  constructor(options: { verbose?: boolean; mode?: string; reportPath?: string } = {}) {
    this.verbose = options.verbose || false;
    this.mode = options.mode || 'all';
    this.reportPath = options.reportPath || path.join(__dirname, 'test-results.json');
  }

  async run(): Promise<void> {
    this.startTime = performance.now();
    
    console.log('🚀 Starting Integration Test Suite');
    console.log(`Mode: ${this.mode}`);
    console.log(`Verbose: ${this.verbose}`);
    console.log('─'.repeat(50));

    try {
      await this.setupTestEnvironment();
      await this.runTestSuites();
      await this.generateReport();
      await this.cleanup();
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }

    const totalDuration = performance.now() - this.startTime;
    const passedSuites = this.results.filter(r => r.passed).length;
    const totalSuites = this.results.length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 Integration Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Test Suites: ${passedSuites}/${totalSuites} passed`);
    
    if (passedSuites === totalSuites) {
      console.log('✅ All integration tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some integration tests failed');
      process.exit(1);
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');

    // Check for required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = this.verbose ? 'debug' : 'error';

    // Create test fixtures directory if it doesn't exist
    const fixturesDir = path.join(__dirname, '../fixtures');
    try {
      await fs.access(fixturesDir);
    } catch {
      await fs.mkdir(fixturesDir, { recursive: true });
      console.log('📁 Created test fixtures directory');
    }

    // Verify test dependencies
    await this.verifyDependencies();

    console.log('✅ Test environment setup complete');
  }

  private async verifyDependencies(): Promise<void> {
    const checks = [
      this.checkNodeModules(),
      this.checkTypeScriptCompilation(),
      this.checkTestFixtures(),
    ];

    const results = await Promise.allSettled(checks);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      console.error('❌ Dependency checks failed:');
      failures.forEach((failure, index) => {
        console.error(`  ${index + 1}. ${failure.reason}`);
      });
      throw new Error('Dependency verification failed');
    }
  }

  private async checkNodeModules(): Promise<void> {
    const nodeModulesPath = path.join(__dirname, '../../node_modules');
    try {
      await fs.access(nodeModulesPath);
    } catch {
      throw new Error('node_modules not found. Run npm install first.');
    }
  }

  private async checkTypeScriptCompilation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tsc = spawn('npx', ['tsc', '--noEmit'], {
        cwd: path.join(__dirname, '../..'),
        stdio: this.verbose ? 'inherit' : 'pipe',
      });

      tsc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('TypeScript compilation failed'));
        }
      });

      tsc.on('error', (error) => {
        reject(new Error(`TypeScript check failed: ${error.message}`));
      });
    });
  }

  private async checkTestFixtures(): Promise<void> {
    const fixturesPath = path.join(__dirname, '../fixtures');
    const requiredFixtures = ['sample.txt'];

    for (const fixture of requiredFixtures) {
      const fixturePath = path.join(fixturesPath, fixture);
      try {
        await fs.access(fixturePath);
      } catch {
        // Create minimal fixture if it doesn't exist
        await fs.writeFile(fixturePath, 'Sample test content');
        console.log(`📄 Created test fixture: ${fixture}`);
      }
    }
  }

  private async runTestSuites(): Promise<void> {
    const suitesToRun = this.getSuitesToRun();

    console.log(`\n🧪 Running ${suitesToRun.length} test suite(s)...\n`);

    for (const suite of suitesToRun) {
      await this.runTestSuite(suite);
    }
  }

  private getSuitesToRun(): TestSuite[] {
    if (this.mode === 'all') {
      return TEST_SUITES;
    }

    const suite = TEST_SUITES.find(s => s.name === this.mode);
    if (!suite) {
      throw new Error(`Unknown test mode: ${this.mode}`);
    }

    return [suite];
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running ${suite.name}: ${suite.description}`);
    
    const startTime = performance.now();
    
    try {
      const result = await this.executeVitest(suite);
      const duration = performance.now() - startTime;

      this.results.push({
        suite: suite.name,
        passed: result.success,
        duration,
        stats: result.stats,
      });

      if (result.success) {
        console.log(`✅ ${suite.name} passed (${(duration / 1000).toFixed(2)}s)`);
      } else {
        console.log(`❌ ${suite.name} failed (${(duration / 1000).toFixed(2)}s)`);
      }

    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      console.log(`❌ ${suite.name} failed with error (${(duration / 1000).toFixed(2)}s)`);
      if (this.verbose) {
        console.error(error);
      }
    }

    console.log(''); // Empty line for readability
  }

  private async executeVitest(suite: TestSuite): Promise<{ success: boolean; stats?: any }> {
    return new Promise((resolve, reject) => {
      const testFile = path.join(__dirname, suite.file);
      const args = [
        'vitest',
        'run',
        testFile,
        '--reporter=json',
        '--no-coverage',
      ];

      if (this.verbose) {
        args.push('--reporter=verbose');
      }

      const vitest = spawn('npx', args, {
        cwd: path.join(__dirname, '../..'),
        stdio: this.verbose ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
        timeout: suite.timeout,
      });

      let stdout = '';
      let stderr = '';

      if (!this.verbose) {
        vitest.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        vitest.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      vitest.on('close', (code) => {
        if (code === 0) {
          let stats;
          try {
            // Try to parse JSON output for stats
            const jsonMatch = stdout.match(/\{.*"testResults".*\}/s);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              stats = {
                total: result.numTotalTests || 0,
                passed: result.numPassedTests || 0,
                failed: result.numFailedTests || 0,
                skipped: result.numPendingTests || 0,
              };
            }
          } catch {
            // Ignore JSON parsing errors
          }

          resolve({ success: true, stats });
        } else {
          resolve({ success: false });
        }
      });

      vitest.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        vitest.kill('SIGTERM');
        reject(new Error(`Test suite ${suite.name} timed out after ${suite.timeout}ms`));
      }, suite.timeout);
    });
  }

  private async generateReport(): Promise<void> {
    console.log('📄 Generating test report...');

    const report = {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      totalDuration: performance.now() - this.startTime,
      summary: {
        totalSuites: this.results.length,
        passedSuites: this.results.filter(r => r.passed).length,
        failedSuites: this.results.filter(r => !r.passed).length,
      },
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV,
      },
    };

    await fs.writeFile(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Test report saved to: ${this.reportPath}`);

    // Also generate a simple HTML report
    await this.generateHtmlReport(report);
  }

  private async generateHtmlReport(report: any): Promise<void> {
    const htmlPath = this.reportPath.replace('.json', '.html');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4f8; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #d4edda; }
        .failed { background: #f8d7da; }
        .suite { margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .duration { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Mode: ${report.mode}</p>
        <p>Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>${report.summary.totalSuites}</h3>
            <p>Total Suites</p>
        </div>
        <div class="metric passed">
            <h3>${report.summary.passedSuites}</h3>
            <p>Passed</p>
        </div>
        <div class="metric failed">
            <h3>${report.summary.failedSuites}</h3>
            <p>Failed</p>
        </div>
    </div>
    
    <h2>Test Results</h2>
    ${report.results.map((result: TestResult) => `
        <div class="suite ${result.passed ? 'passed' : 'failed'}">
            <h3>${result.suite} ${result.passed ? '✅' : '❌'}</h3>
            <p class="duration">Duration: ${(result.duration / 1000).toFixed(2)}s</p>
            ${result.stats ? `
                <p>Tests: ${result.stats.passed}/${result.stats.total} passed</p>
            ` : ''}
            ${result.error ? `<p>Error: ${result.error}</p>` : ''}
        </div>
    `).join('')}
    
    <div class="header" style="margin-top: 30px;">
        <h3>Environment</h3>
        <p>Node.js: ${report.environment.nodeVersion}</p>
        <p>Platform: ${report.environment.platform} (${report.environment.arch})</p>
        <p>Environment: ${report.environment.env}</p>
    </div>
</body>
</html>
    `;

    await fs.writeFile(htmlPath, html);
    console.log(`🌐 HTML report saved to: ${htmlPath}`);
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    
    // Clean up any temporary files or resources
    // This is where you would close database connections, 
    // clean up test data, etc.
    
    console.log('✅ Cleanup complete');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: any = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--mode' || arg === '-m') {
      options.mode = args[++i];
    } else if (arg === '--report' || arg === '-r') {
      options.reportPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Integration Test Runner

Usage: node test-runner.js [options]

Options:
  --verbose, -v          Enable verbose output
  --mode, -m <mode>      Test mode: all, e2e, performance, validation, google-cloud
  --report, -r <path>    Custom report output path
  --help, -h             Show this help message

Examples:
  node test-runner.js                    # Run all tests
  node test-runner.js --mode e2e         # Run only e2e tests
  node test-runner.js --verbose          # Run with verbose output
  node test-runner.js --mode performance # Run only performance tests
      `);
      process.exit(0);
    }
  }

  const runner = new IntegrationTestRunner(options);
  await runner.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner, TEST_SUITES };