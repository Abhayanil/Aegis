/**
 * Integration Test Setup
 * 
 * This file runs before each integration test file to set up the test environment.
 * It configures mocks, environment variables, and test utilities.
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';

// Mock Google Cloud services globally for integration tests
vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn(() => ({
    query: vi.fn(),
    dataset: vi.fn(() => ({
      table: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue([true]),
      })),
    })),
  })),
}));

vi.mock('@google-cloud/firestore', () => ({
  Firestore: vi.fn(() => ({
    collection: vi.fn(),
    doc: vi.fn(),
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: vi.fn(() => ({
    textDetection: vi.fn(),
    documentTextDetection: vi.fn(),
  })),
}));

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(),
    })),
  })),
}));

// Mock file system operations for testing
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/test-credentials.json';
  
  // Disable console output during tests unless verbose mode is enabled
  if (!process.env.VERBOSE_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  }

  console.log('🔧 Integration test environment initialized');
});

afterAll(() => {
  // Restore console methods
  vi.restoreAllMocks();
  
  console.log('🧹 Integration test environment cleaned up');
});

// Per-test setup and teardown
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset performance tracking
  global.testStartTime = performance.now();
});

afterEach(() => {
  // Log test duration if verbose mode is enabled
  if (process.env.VERBOSE_TESTS && global.testStartTime) {
    const duration = performance.now() - global.testStartTime;
    console.log(`⏱️  Test completed in ${duration.toFixed(2)}ms`);
  }
});

// Global test utilities
declare global {
  var testStartTime: number;
  
  namespace Vi {
    interface AsserterInterface {
      toBeWithinRange(min: number, max: number): void;
      toBeValidDealMemo(): void;
      toHaveValidSchema(): void;
    }
  }
}

// Custom matchers for integration tests
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range ${min}-${max}`
          : `Expected ${received} to be within range ${min}-${max}`,
    };
  },

  toBeValidDealMemo(received: any) {
    const requiredFields = [
      'aegisDealMemo',
      'aegisDealMemo.summary',
      'aegisDealMemo.summary.companyName',
      'aegisDealMemo.summary.signalScore',
      'aegisDealMemo.keyBenchmarks',
      'aegisDealMemo.growthPotential',
      'aegisDealMemo.riskAssessment',
      'aegisDealMemo.investmentRecommendation',
    ];

    const missingFields = requiredFields.filter(field => {
      const keys = field.split('.');
      let obj = received;
      for (const key of keys) {
        if (!obj || typeof obj !== 'object' || !(key in obj)) {
          return true;
        }
        obj = obj[key];
      }
      return false;
    });

    const pass = missingFields.length === 0;
    return {
      pass,
      message: () =>
        pass
          ? 'Expected object not to be a valid deal memo'
          : `Expected object to be a valid deal memo. Missing fields: ${missingFields.join(', ')}`,
    };
  },

  toHaveValidSchema(received: any) {
    // Basic schema validation for test objects
    const isObject = received && typeof received === 'object';
    const hasRequiredStructure = isObject && Object.keys(received).length > 0;
    
    const pass = hasRequiredStructure;
    return {
      pass,
      message: () =>
        pass
          ? 'Expected object not to have valid schema'
          : 'Expected object to have valid schema structure',
    };
  },
});

// Test data factories
export const createMockDocument = (overrides: any = {}) => ({
  id: `test-doc-${Date.now()}`,
  sourceType: 'pdf',
  extractedText: 'Mock document content',
  sections: [],
  metadata: {
    filename: 'test.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    uploadedAt: new Date(),
    processingStatus: 'completed',
  },
  processingTimestamp: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockDealMemo = (overrides: any = {}) => ({
  aegisDealMemo: {
    summary: {
      companyName: 'TestCorp',
      oneLiner: 'Test company for integration tests',
      signalScore: 75,
      recommendation: 'BUY',
    },
    keyBenchmarks: [
      {
        metric: 'ARR',
        companyValue: 2000000,
        sectorMedian: 1500000,
        percentileRank: 65,
        interpretation: 'Above median performance',
      },
    ],
    growthPotential: {
      upsideSummary: 'Strong growth potential in expanding market',
      growthTimeline: '2-3 years to achieve significant scale',
    },
    riskAssessment: {
      highPriorityRisks: [],
      mediumPriorityRisks: [],
    },
    investmentRecommendation: {
      narrative: 'Compelling investment opportunity with strong fundamentals',
      keyDiligenceQuestions: [
        'What is the customer acquisition cost trend?',
        'How defensible is the competitive moat?',
      ],
    },
  },
  ...overrides,
});

export const createMockAnalysisResult = (overrides: any = {}) => ({
  companyProfile: {
    name: 'TestCorp',
    oneLiner: 'SaaS platform for enterprises',
    sector: 'SaaS',
    stage: 'series-a',
    foundedYear: 2022,
    location: 'San Francisco',
  },
  extractedMetrics: {
    revenue: { arr: 2000000, growthRate: 15 },
    traction: { customers: 150, customerGrowthRate: 10 },
    team: { size: 25, foundersCount: 2 },
    funding: { totalRaised: 1000000, currentAsk: 5000000 },
  },
  marketClaims: {
    tam: 50000000000,
    marketDescription: 'Enterprise SaaS market',
    competitiveLandscape: ['Competitor A', 'Competitor B'],
  },
  teamAssessment: {
    founders: [
      { name: 'John Doe', role: 'CEO' },
      { name: 'Jane Smith', role: 'CTO' },
    ],
    totalSize: 25,
    domainExpertise: ['SaaS', 'Enterprise Software'],
  },
  consistencyFlags: [],
  sourceDocumentIds: ['test-doc'],
  processingTime: 5000,
  analysisTimestamp: new Date(),
  ...overrides,
});

// Performance tracking utilities
export const measurePerformance = async <T>(
  operation: () => Promise<T>,
  label: string
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await operation();
  const duration = performance.now() - startTime;
  
  if (process.env.VERBOSE_TESTS) {
    console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
};

// Test environment validation
export const validateTestEnvironment = () => {
  const requiredEnvVars = ['NODE_ENV'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run in test environment');
  }
};

// Initialize test environment validation
validateTestEnvironment();