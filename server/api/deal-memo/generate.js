// Vercel serverless function for deal memo generation

// Mock data service for development
class MockDataService {
  static async simulateProcessingDelay(type) {
    const delays = {
      upload: 500,
      analyze: 1000,
      benchmark: 800,
      generate: 1200
    };
    await new Promise(resolve => setTimeout(resolve, delays[type] || 500));
  }

  static createMockAnalysisResult(documentIds) {
    return {
      companyProfile: {
        name: 'TestCorp AI',
        oneLiner: 'AI-powered workflow automation for enterprise teams',
        sector: 'Enterprise Software',
        stage: 'Series A',
        foundedYear: 2021,
        location: 'San Francisco, CA',
        website: 'https://testcorp.ai',
        employees: 25,
      },
      extractedMetrics: {
        revenue: {
          arr: 2000000,
          mrr: 166667,
          growthRate: 15,
          revenueModel: 'SaaS Subscription',
        },
        traction: {
          customers: 150,
          customerGrowthRate: 12,
          churnRate: 3.5,
          nps: 72,
        },
        team: {
          size: 25,
          foundersCount: 2,
          engineeringCount: 12,
          salesCount: 4,
        },
        funding: {
          totalRaised: 5000000,
          currentAsk: 15000000,
          lastRoundSize: 3000000,
          lastRoundDate: '2023-06-15',
        },
        product: {
          launchDate: '2022-03-01',
          activeUsers: 2500,
          features: ['AI Automation', 'Workflow Builder', 'Analytics Dashboard'],
        },
      },
      marketClaims: {
        tam: 50000000000,
        sam: 5000000000,
        som: 500000000,
        marketDescription: 'Enterprise workflow automation market growing at 25% CAGR',
        competitiveLandscape: ['Zapier', 'Microsoft Power Automate', 'UiPath'],
        marketTrends: ['AI Integration', 'No-Code Solutions', 'Remote Work Tools'],
      },
      teamAssessment: {
        founders: [
          {
            name: 'Jane Smith',
            role: 'CEO',
            experience: 'Former VP Engineering at Salesforce, 10+ years in enterprise software',
            education: 'Stanford CS',
          },
          {
            name: 'John Doe',
            role: 'CTO',
            experience: 'Former Senior Engineer at Google, AI/ML expertise',
            education: 'MIT CS',
          },
        ],
        totalSize: 25,
        domainExpertise: ['Enterprise Software', 'AI/ML', 'Workflow Automation'],
        keyHires: ['VP Sales from HubSpot', 'Head of Product from Slack'],
        advisors: ['Former Salesforce Executive', 'AI Research Professor'],
      },
      consistencyFlags: [
        {
          type: 'METRIC_INCONSISTENCY',
          description: 'Customer count growth rate seems optimistic compared to revenue growth',
          severity: 'MEDIUM',
          affectedMetrics: ['customer_count', 'revenue_growth'],
          sourceDocuments: documentIds,
        },
      ],
      sourceDocumentIds: documentIds,
      processingTime: 2500,
      analysisTimestamp: new Date().toISOString(),
      confidence: 0.85,
      dataQuality: {
        completeness: 0.9,
        accuracy: 0.85,
        consistency: 0.8,
      },
    };
  }

  static createMockDealMemo(analysisResult) {
    const signalScore = 8.5;
    
    return {
      id: `deal-memo-${Date.now()}`,
      aegisDealMemo: {
        summary: {
          companyName: analysisResult.companyProfile.name,
          oneLiner: analysisResult.companyProfile.oneLiner,
          sector: analysisResult.companyProfile.sector,
          signalScore: signalScore,
          recommendation: 'STRONG MEET',
          keyHighlights: [
            'Strong technical team with proven track record',
            'Growing market with clear product-market fit',
            'Impressive customer retention and growth metrics',
          ],
          redFlags: [
            'Customer acquisition cost trending upward',
            'Competitive landscape intensifying',
          ],
        },
        keyBenchmarks: [
          {
            metric: 'ARR',
            companyValue: '$2.0M',
            sectorMedian: '$1.5M',
            percentileRank: 75,
            interpretation: 'Above sector median, indicating strong revenue performance',
          },
          {
            metric: 'Growth Rate',
            companyValue: '15%',
            sectorMedian: '12%',
            percentileRank: 68,
            interpretation: 'Solid growth rate, slightly above sector average',
          },
          {
            metric: 'Team Size',
            companyValue: '25',
            sectorMedian: '20',
            percentileRank: 60,
            interpretation: 'Appropriate team size for current stage and revenue',
          },
          {
            metric: 'Customer Count',
            companyValue: '150',
            sectorMedian: '120',
            percentileRank: 65,
            interpretation: 'Good customer base for current ARR level',
          },
        ],
        growthPotential: {
          marketOpportunity: {
            score: 8.5,
            reasoning: 'Large and growing TAM with clear market trends supporting the product',
            timeline: '3-5 years to capture significant market share',
            keyDrivers: ['AI adoption', 'Remote work trends', 'Automation demand'],
          },
          competitivePosition: {
            score: 7.5,
            reasoning: 'Strong technical differentiation but facing established competitors',
            advantages: ['AI-first approach', 'Enterprise focus', 'Technical team'],
            threats: ['Big tech competition', 'Market saturation risk'],
          },
          scalabilityAssessment: {
            score: 8.0,
            reasoning: 'SaaS model with good unit economics and expansion potential',
            factors: ['Product scalability', 'Team quality', 'Market size'],
          },
        },
        riskAssessment: {
          highPriorityRisks: [
            {
              type: 'MARKET_RISK',
              description: 'Increasing competition from established players like Microsoft and Google',
              severity: 'HIGH',
              affectedMetrics: ['customer_acquisition_cost', 'market_share'],
              suggestedMitigation: 'Focus on unique AI capabilities and enterprise relationships',
              sourceDocuments: ['pitch-deck.pdf'],
            },
          ],
          mediumPriorityRisks: [
            {
              type: 'EXECUTION_RISK',
              description: 'Scaling customer success and support operations',
              severity: 'MEDIUM',
              affectedMetrics: ['churn_rate', 'customer_satisfaction'],
              suggestedMitigation: 'Invest in customer success team and automation tools',
              sourceDocuments: ['financial-model.xlsx'],
            },
          ],
        },
        investmentRecommendation: {
          recommendation: 'STRONG MEET',
          confidenceLevel: 'HIGH',
          suggestedNextSteps: [
            'Deep dive on competitive differentiation',
            'Reference calls with key customers',
            'Technical due diligence on AI capabilities',
          ],
          dueDiligenceQuestions: [
            'What is the specific AI/ML advantage over competitors?',
            'How defensible is the current market position?',
            'What are the plans for international expansion?',
          ],
          investmentThesis: 'Strong technical team addressing a large market with a differentiated AI-first approach. Good traction and metrics support the growth story.',
          keyRisks: ['Competitive pressure', 'Market saturation'],
          keyOpportunities: ['AI market growth', 'Enterprise digital transformation'],
        },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        analysisVersion: '1.0',
        documentCount: analysisResult.sourceDocumentIds.length,
        processingTime: 3500,
      },
    };
  }
}

// Simple logger
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
  error: (message, error) => console.error(`[ERROR] ${message}`, error || ''),
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed',
      },
    });
  }

  try {
    const {
      documentIds,
      sessionId,
      analysisWeightings,
      includeRiskAssessment = true,
      includeBenchmarking = true,
      includeCompetitiveAnalysis = false,
      detailedFinancialAnalysis = false,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session ID is required',
        },
      });
    }

    const startTime = Date.now();
    logger.info(`Starting deal memo generation for session ${sessionId}`, {
      documentCount: documentIds?.length || 0,
      includeRiskAssessment,
      includeBenchmarking,
    });

    // Use mock data for development
    await MockDataService.simulateProcessingDelay('analyze');
    
    // Create mock analysis result
    const mockDocumentIds = documentIds || [`mock-doc-${Date.now()}`];
    const analysisResult = MockDataService.createMockAnalysisResult(mockDocumentIds);
    
    await MockDataService.simulateProcessingDelay('benchmark');
    
    // Generate mock deal memo
    const dealMemo = MockDataService.createMockDealMemo(analysisResult);
    
    await MockDataService.simulateProcessingDelay('generate');
    
    const processingTime = Date.now() - startTime;
    const dealMemoId = `deal-memo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`Mock deal memo generation completed for session ${sessionId}`, {
      dealMemoId,
      processingTime,
      signalScore: dealMemo.aegisDealMemo.summary.signalScore,
    });

    res.json({
      success: true,
      data: {
        dealMemo,
        dealMemoId,
        processingTime,
        warnings: analysisResult.consistencyFlags.length > 0 ? [
          `Found ${analysisResult.consistencyFlags.length} consistency issues in the analysis`,
        ] : undefined,
      },
    });
  } catch (error) {
    console.error('Deal memo generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred during deal memo generation',
      },
    });
  }
}