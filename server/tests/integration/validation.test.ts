import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Import routes
import uploadRoutes from '../../src/routes/upload.js';
import dealMemoRoutes from '../../src/routes/dealMemo.js';

// Import validation utilities
import { validateDealMemoSchema } from '../../src/utils/validation.js';

// Import services for mocking
import { DocumentProcessorFactory } from '../../src/services/document/DocumentProcessor.js';
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';
import { ConsistencyChecker } from '../../src/services/ai/ConsistencyChecker.js';
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';

// Import types
import { DealMemo } from '../../src/models/DealMemo.js';
import { ProcessedDocument } from '../../src/models/ProcessedDocument.js';
import { AnalysisResult } from '../../src/models/AnalysisResult.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);
app.use('/api/deal-memo', dealMemoRoutes);

describe('Deal Memo Validation and Quality Assurance', () => {
  let mockServices: any;
  let testScenarios: TestScenario[];

  beforeAll(async () => {
    // Load test scenarios with expected outputs
    testScenarios = await loadTestScenarios();
  });

  beforeEach(() => {
    mockServices = setupValidationMocks();
  });

  describe('Schema Validation', () => {
    it('should generate deal memos that comply with the required schema', async () => {
      const scenario = testScenarios.find(s => s.name === 'complete-saas-company');
      expect(scenario).toBeDefined();

      // Configure mocks with scenario data
      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .attach('files', Buffer.from(scenario!.documents.transcript), 'transcript.txt')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;

      // Validate schema compliance
      const validationResult = await validateDealMemoSchema(dealMemo);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Validate required top-level structure
      expect(dealMemo.aegisDealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary).toBeDefined();
      expect(dealMemo.aegisDealMemo.keyBenchmarks).toBeInstanceOf(Array);
      expect(dealMemo.aegisDealMemo.growthPotential).toBeDefined();
      expect(dealMemo.aegisDealMemo.riskAssessment).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation).toBeDefined();

      // Validate summary fields
      const summary = dealMemo.aegisDealMemo.summary;
      expect(summary.companyName).toBeTypeOf('string');
      expect(summary.companyName.length).toBeGreaterThan(0);
      expect(summary.oneLiner).toBeTypeOf('string');
      expect(summary.signalScore).toBeTypeOf('number');
      expect(summary.signalScore).toBeGreaterThanOrEqual(0);
      expect(summary.signalScore).toBeLessThanOrEqual(100);
      expect(['STRONG_BUY', 'BUY', 'HOLD', 'PASS']).toContain(summary.recommendation);

      // Validate growth potential
      const growthPotential = dealMemo.aegisDealMemo.growthPotential;
      expect(growthPotential.upsideSummary).toBeTypeOf('string');
      expect(growthPotential.growthTimeline).toBeTypeOf('string');

      // Validate risk assessment
      const riskAssessment = dealMemo.aegisDealMemo.riskAssessment;
      expect(riskAssessment.highPriorityRisks).toBeInstanceOf(Array);
      expect(riskAssessment.mediumPriorityRisks).toBeInstanceOf(Array);

      // Validate investment recommendation
      const investmentRec = dealMemo.aegisDealMemo.investmentRecommendation;
      expect(investmentRec.narrative).toBeTypeOf('string');
      expect(investmentRec.keyDiligenceQuestions).toBeInstanceOf(Array);
      expect(investmentRec.keyDiligenceQuestions.length).toBeGreaterThan(0);
    });

    it('should validate all risk flags have required fields', async () => {
      const scenario = testScenarios.find(s => s.name === 'high-risk-company');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          includeRiskAssessment: true
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const allRisks = [
        ...dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks,
        ...dealMemo.aegisDealMemo.riskAssessment.mediumPriorityRisks
      ];

      allRisks.forEach((risk: any) => {
        expect(risk.type).toBeDefined();
        expect(risk.severity).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(risk.severity);
        expect(risk.description).toBeTypeOf('string');
        expect(risk.description.length).toBeGreaterThan(0);
        expect(risk.affectedMetrics).toBeInstanceOf(Array);
        expect(risk.suggestedMitigation).toBeTypeOf('string');
        expect(risk.sourceDocuments).toBeInstanceOf(Array);
      });
    });

    it('should validate benchmark data structure', async () => {
      const scenario = testScenarios.find(s => s.name === 'benchmarkable-company');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          includeBenchmarking: true
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const benchmarks = dealMemo.aegisDealMemo.keyBenchmarks;

      expect(benchmarks).toBeInstanceOf(Array);
      expect(benchmarks.length).toBeGreaterThan(0);

      benchmarks.forEach((benchmark: any) => {
        expect(benchmark.metric).toBeTypeOf('string');
        expect(benchmark.companyValue).toBeDefined();
        expect(benchmark.sectorMedian).toBeDefined();
        expect(benchmark.percentileRank).toBeTypeOf('number');
        expect(benchmark.percentileRank).toBeGreaterThanOrEqual(0);
        expect(benchmark.percentileRank).toBeLessThanOrEqual(100);
        expect(benchmark.interpretation).toBeTypeOf('string');
      });
    });
  });

  describe('Data Accuracy Validation', () => {
    it('should extract accurate financial metrics from documents', async () => {
      const scenario = testScenarios.find(s => s.name === 'financial-metrics-test');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .attach('files', Buffer.from(scenario!.documents.financials), 'financials.docx')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      // Verify extracted metrics match expected values from scenario
      const expectedMetrics = scenario!.expectedOutputs.extractedMetrics;
      const actualAnalysis = mockServices.geminiAnalyzer.analyzeContent.mock.results[0].value;

      expect(actualAnalysis.extractedMetrics.revenue.arr).toBe(expectedMetrics.revenue.arr);
      expect(actualAnalysis.extractedMetrics.traction.customers).toBe(expectedMetrics.traction.customers);
      expect(actualAnalysis.extractedMetrics.team.size).toBe(expectedMetrics.team.size);
      expect(actualAnalysis.extractedMetrics.funding.totalRaised).toBe(expectedMetrics.funding.totalRaised);
    });

    it('should maintain consistency across multiple document sources', async () => {
      const scenario = testScenarios.find(s => s.name === 'consistency-test');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .attach('files', Buffer.from(scenario!.documents.transcript), 'transcript.txt')
        .attach('files', Buffer.from(scenario!.documents.financials), 'financials.docx')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      // Verify consistency checker was called
      expect(mockServices.consistencyChecker.checkConsistency).toHaveBeenCalled();

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const consistencyRisks = dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks
        .filter((risk: any) => risk.type === 'INCONSISTENCY');

      // Should have identified expected inconsistencies
      expect(consistencyRisks.length).toBe(scenario!.expectedOutputs.expectedInconsistencies.length);
    });

    it('should calculate signal scores accurately based on weightings', async () => {
      const scenario = testScenarios.find(s => s.name === 'scoring-test');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      // Test different weighting configurations
      const weightingConfigs = [
        { marketOpportunity: 40, team: 20, traction: 20, product: 10, competitivePosition: 10 },
        { marketOpportunity: 20, team: 40, traction: 20, product: 10, competitivePosition: 10 },
        { marketOpportunity: 20, team: 20, traction: 40, product: 10, competitivePosition: 10 }
      ];

      const scores: number[] = [];

      for (const weightings of weightingConfigs) {
        const dealMemoResponse = await request(app)
          .post('/api/deal-memo/generate')
          .send({
            documentIds,
            sessionId: uploadResponse.body.data.sessionId,
            analysisWeightings: weightings
          })
          .expect(200);

        const signalScore = dealMemoResponse.body.data.dealMemo.aegisDealMemo.summary.signalScore;
        scores.push(signalScore);

        // Verify score is within valid range
        expect(signalScore).toBeGreaterThanOrEqual(0);
        expect(signalScore).toBeLessThanOrEqual(100);
      }

      // Verify different weightings produce different scores
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeGreaterThan(1);
    });
  });

  describe('Consistency Validation', () => {
    it('should identify metric inconsistencies across documents', async () => {
      const scenario = testScenarios.find(s => s.name === 'inconsistent-metrics');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .attach('files', Buffer.from(scenario!.documents.transcript), 'transcript.txt')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const inconsistencyRisks = dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks
        .filter((risk: any) => risk.type === 'INCONSISTENCY');

      expect(inconsistencyRisks.length).toBeGreaterThan(0);

      // Verify inconsistency details
      inconsistencyRisks.forEach((risk: any) => {
        expect(risk.description).toContain('inconsistent');
        expect(risk.affectedMetrics.length).toBeGreaterThan(0);
        expect(risk.sourceDocuments.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should validate market size claims against realistic benchmarks', async () => {
      const scenario = testScenarios.find(s => s.name === 'market-size-validation');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          includeRiskAssessment: true
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const marketRisks = dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks
        .filter((risk: any) => risk.type === 'MARKET_SIZE');

      if (scenario!.expectedOutputs.shouldFlagMarketSize) {
        expect(marketRisks.length).toBeGreaterThan(0);
        marketRisks.forEach((risk: any) => {
          expect(risk.description).toMatch(/market size|TAM|addressable market/i);
        });
      } else {
        expect(marketRisks.length).toBe(0);
      }
    });

    it('should validate team assessment accuracy', async () => {
      const scenario = testScenarios.find(s => s.name === 'team-assessment');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .attach('files', Buffer.from(scenario!.documents.transcript), 'transcript.txt')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      // Verify team assessment matches expected output
      const actualAnalysis = mockServices.geminiAnalyzer.analyzeContent.mock.results[0].value;
      const expectedTeam = scenario!.expectedOutputs.teamAssessment;

      expect(actualAnalysis.teamAssessment.totalSize).toBe(expectedTeam.totalSize);
      expect(actualAnalysis.teamAssessment.founders.length).toBe(expectedTeam.founders.length);
      expect(actualAnalysis.teamAssessment.domainExpertise).toEqual(expectedTeam.domainExpertise);
    });
  });

  describe('Quality Metrics', () => {
    it('should generate comprehensive due diligence questions', async () => {
      const scenario = testScenarios.find(s => s.name === 'due-diligence-test');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const diligenceQuestions = dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions;

      expect(diligenceQuestions).toBeInstanceOf(Array);
      expect(diligenceQuestions.length).toBeGreaterThanOrEqual(5);
      expect(diligenceQuestions.length).toBeLessThanOrEqual(15);

      // Verify questions cover key areas
      const questionText = diligenceQuestions.join(' ').toLowerCase();
      expect(questionText).toMatch(/revenue|financial|metric/);
      expect(questionText).toMatch(/team|founder|experience/);
      expect(questionText).toMatch(/market|competition|customer/);
      expect(questionText).toMatch(/product|technology|development/);

      // Verify questions are well-formed
      diligenceQuestions.forEach((question: string) => {
        expect(question.length).toBeGreaterThan(10);
        expect(question.endsWith('?')).toBe(true);
      });
    });

    it('should provide actionable investment recommendations', async () => {
      const scenario = testScenarios.find(s => s.name === 'investment-recommendation');
      expect(scenario).toBeDefined();

      configureMocksForScenario(mockServices, scenario!);

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(scenario!.documents.pitchDeck), 'pitch-deck.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      const recommendation = dealMemo.aegisDealMemo.investmentRecommendation;

      expect(recommendation.narrative).toBeTypeOf('string');
      expect(recommendation.narrative.length).toBeGreaterThan(100);

      // Verify narrative contains key investment thesis elements
      const narrative = recommendation.narrative.toLowerCase();
      expect(narrative).toMatch(/investment|opportunity|potential/);
      expect(narrative).toMatch(/market|customer|revenue/);
      expect(narrative).toMatch(/team|founder|experience/);

      // Verify specific recommendations are provided
      if (recommendation.idealCheckSize) {
        expect(recommendation.idealCheckSize).toMatch(/\$[\d,]+[km]?/i);
      }
      if (recommendation.idealValuationCap) {
        expect(recommendation.idealValuationCap).toMatch(/\$[\d,]+[km]?/i);
      }
    });

    it('should maintain quality across different company types', async () => {
      const companyTypes = ['saas-company', 'hardware-company', 'marketplace-company'];
      const qualityMetrics: any[] = [];

      for (const companyType of companyTypes) {
        const scenario = testScenarios.find(s => s.name === companyType);
        if (!scenario) continue;

        configureMocksForScenario(mockServices, scenario);

        const uploadResponse = await request(app)
          .post('/api/upload')
          .attach('files', Buffer.from(scenario.documents.pitchDeck), 'pitch-deck.pdf')
          .expect(200);

        const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

        const dealMemoResponse = await request(app)
          .post('/api/deal-memo/generate')
          .send({
            documentIds,
            sessionId: uploadResponse.body.data.sessionId
          })
          .expect(200);

        const dealMemo = dealMemoResponse.body.data.dealMemo;

        // Calculate quality metrics
        const metrics = {
          companyType,
          signalScore: dealMemo.aegisDealMemo.summary.signalScore,
          benchmarkCount: dealMemo.aegisDealMemo.keyBenchmarks.length,
          riskCount: dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks.length +
                    dealMemo.aegisDealMemo.riskAssessment.mediumPriorityRisks.length,
          diligenceQuestionCount: dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions.length,
          narrativeLength: dealMemo.aegisDealMemo.investmentRecommendation.narrative.length,
        };

        qualityMetrics.push(metrics);

        // Verify minimum quality standards
        expect(metrics.signalScore).toBeGreaterThanOrEqual(0);
        expect(metrics.benchmarkCount).toBeGreaterThanOrEqual(3);
        expect(metrics.diligenceQuestionCount).toBeGreaterThanOrEqual(5);
        expect(metrics.narrativeLength).toBeGreaterThan(100);
      }

      console.log('Quality metrics across company types:', qualityMetrics);

      // Verify consistent quality across different company types
      const avgSignalScore = qualityMetrics.reduce((sum, m) => sum + m.signalScore, 0) / qualityMetrics.length;
      const signalScoreVariance = qualityMetrics.reduce((sum, m) => sum + Math.pow(m.signalScore - avgSignalScore, 2), 0) / qualityMetrics.length;
      
      expect(signalScoreVariance).toBeLessThan(500); // Reasonable variance in signal scores
    });
  });
});

// Helper functions and types
interface TestScenario {
  name: string;
  documents: {
    pitchDeck: string;
    transcript?: string;
    financials?: string;
  };
  expectedOutputs: {
    extractedMetrics?: any;
    teamAssessment?: any;
    expectedInconsistencies?: any[];
    shouldFlagMarketSize?: boolean;
  };
}

async function loadTestScenarios(): Promise<TestScenario[]> {
  return [
    {
      name: 'complete-saas-company',
      documents: {
        pitchDeck: `
          TestCorp - SaaS Platform for Enterprise
          
          Company Overview:
          - Founded in 2022 by John Doe (CEO) and Jane Smith (CTO)
          - Based in San Francisco
          - Enterprise SaaS platform for workflow automation
          
          Traction:
          - $2M ARR with 15% month-over-month growth
          - 150 enterprise customers
          - 95% customer retention rate
          - Team of 25 people
          
          Market:
          - $50B total addressable market
          - Targeting mid-market enterprises
          - Key competitors: Competitor A, Competitor B
          
          Funding:
          - Previously raised $1M seed round
          - Currently raising $5M Series A
        `,
        transcript: `
          Founder: We're TestCorp, and we've built a SaaS platform that helps enterprises automate their workflows.
          We currently have $2M in annual recurring revenue and are growing 15% month-over-month.
          Our team consists of 25 people, including myself and my co-founder Jane who has 10 years of experience.
          We're raising $5M to expand our sales team and accelerate growth.
        `
      },
      expectedOutputs: {
        extractedMetrics: {
          revenue: { arr: 2000000, growthRate: 15 },
          traction: { customers: 150, churnRate: 5 },
          team: { size: 25, foundersCount: 2 },
          funding: { totalRaised: 1000000, currentAsk: 5000000 }
        }
      }
    },
    {
      name: 'high-risk-company',
      documents: {
        pitchDeck: `
          RiskyStartup - Unproven Market
          
          Company Overview:
          - Founded 6 months ago
          - Completely new market category
          - No clear competitors
          
          Traction:
          - $50K ARR
          - 5 customers (all friends and family)
          - High churn rate (40% monthly)
          - Team of 3 people
          
          Market:
          - $1T total addressable market (our estimate)
          - Creating entirely new market category
          
          Funding:
          - No previous funding
          - Raising $2M seed round
        `
      },
      expectedOutputs: {
        expectedInconsistencies: [],
        shouldFlagMarketSize: true
      }
    },
    {
      name: 'inconsistent-metrics',
      documents: {
        pitchDeck: `
          InconsistentCorp
          - $1M ARR
          - 100 customers
          - Team of 20 people
        `,
        transcript: `
          Founder: We have $1.5M in annual recurring revenue with 120 customers and a team of 25 people.
        `
      },
      expectedOutputs: {
        expectedInconsistencies: [
          { metric: 'arr', values: [1000000, 1500000] },
          { metric: 'customers', values: [100, 120] },
          { metric: 'teamSize', values: [20, 25] }
        ]
      }
    },
    // Add more test scenarios...
  ];
}

function configureMocksForScenario(mockServices: any, scenario: TestScenario) {
  // Configure document processor mock
  mockServices.documentProcessor.processDocument.mockImplementation(async (buffer: Buffer, filename: string) => {
    const content = buffer.toString();
    return {
      document: {
        id: `${scenario.name}-${filename}`,
        sourceType: filename.endsWith('.pdf') ? 'pdf' : 'txt',
        extractedText: content,
        sections: [{ title: 'Content', content, sourceDocument: filename }],
        metadata: {
          filename,
          fileSize: buffer.length,
          mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed',
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      validation: { isValid: true, errors: [], warnings: [] },
      processingLogs: [],
      warnings: [],
    };
  });

  // Configure AI analyzer mock based on scenario
  mockServices.geminiAnalyzer.analyzeContent.mockResolvedValue({
    companyProfile: {
      name: scenario.name.replace(/-/g, ' '),
      oneLiner: 'Test company for validation',
      sector: 'SaaS',
      stage: 'seed',
      foundedYear: 2022,
      location: 'San Francisco',
    },
    extractedMetrics: scenario.expectedOutputs.extractedMetrics || {
      revenue: { arr: 1000000, growthRate: 10 },
      traction: { customers: 100, churnRate: 10 },
      team: { size: 20, foundersCount: 2 },
      funding: { totalRaised: 500000, currentAsk: 2000000 },
    },
    marketClaims: {
      tam: scenario.expectedOutputs.shouldFlagMarketSize ? 1000000000000 : 10000000000,
      marketDescription: 'Test market',
      competitiveLandscape: ['Competitor A'],
    },
    teamAssessment: scenario.expectedOutputs.teamAssessment || {
      founders: [
        { name: 'John Doe', role: 'CEO' },
        { name: 'Jane Smith', role: 'CTO' },
      ],
      totalSize: 20,
      domainExpertise: ['SaaS'],
    },
    consistencyFlags: scenario.expectedOutputs.expectedInconsistencies || [],
    sourceDocumentIds: [`${scenario.name}-doc`],
    processingTime: 1000,
    analysisTimestamp: new Date(),
  });

  // Configure consistency checker mock
  mockServices.consistencyChecker.checkConsistency.mockResolvedValue(
    scenario.expectedOutputs.expectedInconsistencies || []
  );
}

function setupValidationMocks() {
  const mockDocumentProcessor = {
    processDocument: vi.fn(),
    validateContent: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    detectFileType: vi.fn().mockReturnValue('application/pdf'),
  };

  const mockGeminiAnalyzer = {
    analyzeContent: vi.fn(),
    extractEntities: vi.fn().mockResolvedValue({}),
    validateConsistency: vi.fn().mockResolvedValue([]),
  };

  const mockConsistencyChecker = {
    checkConsistency: vi.fn(),
    validateMetrics: vi.fn().mockResolvedValue([]),
  };

  const mockBigQueryConnector = {
    getBenchmarks: vi.fn().mockResolvedValue({
      sector: 'SaaS',
      sampleSize: 100,
      metrics: {
        arr: { p25: 500000, p50: 1500000, p75: 5000000, p90: 15000000 },
        growthRate: { p25: 5, p50: 12, p75: 25, p90: 50 },
        teamSize: { p25: 10, p50: 20, p75: 50, p90: 100 },
      },
      lastUpdated: new Date(),
    }),
  };

  // Apply mocks
  vi.mocked(DocumentProcessorFactory).mockImplementation(() => mockDocumentProcessor);
  vi.mocked(GeminiAnalyzer).mockImplementation(() => mockGeminiAnalyzer);
  vi.mocked(ConsistencyChecker).mockImplementation(() => mockConsistencyChecker);
  vi.mocked(BigQueryConnector).mockImplementation(() => mockBigQueryConnector);

  return {
    documentProcessor: mockDocumentProcessor,
    geminiAnalyzer: mockGeminiAnalyzer,
    consistencyChecker: mockConsistencyChecker,
    bigQueryConnector: mockBigQueryConnector,
  };
}