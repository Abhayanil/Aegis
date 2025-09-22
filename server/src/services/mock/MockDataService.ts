/**
 * Mock Data Service for Local Development
 * 
 * This service provides mock data for testing the frontend interface
 * without requiring real API keys or external services.
 */

import { DealMemo } from '../models/DealMemo.js';
import { ProcessedDocument } from '../models/ProcessedDocument.js';
import { AnalysisResult } from '../models/AnalysisResult.js';

export class MockDataService {
  static createMockProcessedDocument(filename: string): ProcessedDocument {
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceType: filename.endsWith('.pdf') ? 'pdf' : filename.endsWith('.docx') ? 'docx' : 'txt',
      extractedText: `Mock extracted text from ${filename}. This would contain the actual document content in a real implementation.`,
      sections: [
        {
          title: 'Company Overview',
          content: 'TestCorp is a SaaS platform serving enterprise customers with AI-powered workflow automation.',
          sourceDocument: filename,
        },
        {
          title: 'Financial Metrics',
          content: 'Current ARR: $2M, Growth Rate: 15% MoM, Customer Count: 150, Team Size: 25',
          sourceDocument: filename,
        },
      ],
      metadata: {
        filename,
        fileSize: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
        mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 
                  filename.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                  'text/plain',
        uploadedAt: new Date().toISOString(),
        processingStatus: 'completed',
      },
      processingTimestamp: new Date().toISOString(),
      processingDuration: Math.floor(Math.random() * 3000) + 500, // 0.5-3.5 seconds
      wordCount: Math.floor(Math.random() * 5000) + 500,
      language: 'en',
      encoding: 'utf-8',
      extractionMethod: 'text',
      quality: {
        textClarity: 0.85 + Math.random() * 0.15,
        structurePreservation: 0.8 + Math.random() * 0.2,
        completeness: 0.9 + Math.random() * 0.1,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  static createMockAnalysisResult(documentIds: string[]): AnalysisResult {
    return {
      companyProfile: {
        name: 'TestCorp',
        oneLiner: 'AI-powered workflow automation platform for enterprise customers',
        sector: 'SaaS',
        stage: 'series-a',
        foundedYear: 2022,
        location: 'San Francisco, CA',
        website: 'https://testcorp.com',
        employees: 25,
      },
      extractedMetrics: {
        revenue: {
          arr: 2000000,
          mrr: 166667,
          growthRate: 15,
          revenueModel: 'subscription',
        },
        traction: {
          customers: 150,
          customerGrowthRate: 12,
          churnRate: 4,
          nps: 65,
        },
        team: {
          size: 25,
          foundersCount: 2,
          engineeringCount: 15,
          salesCount: 5,
        },
        funding: {
          totalRaised: 1000000,
          currentAsk: 5000000,
          lastRoundSize: 1000000,
          lastRoundDate: '2023-06-15',
        },
        product: {
          launchDate: '2022-03-01',
          activeUsers: 1200,
          features: ['AI Automation', 'Enterprise Integration', 'Analytics Dashboard'],
        },
      },
      marketClaims: {
        tam: 50000000000,
        sam: 15000000000,
        som: 2000000000,
        marketDescription: 'Enterprise workflow automation market experiencing rapid growth driven by AI adoption',
        competitiveLandscape: ['UiPath', 'Automation Anywhere', 'Microsoft Power Automate'],
        marketTrends: ['AI Integration', 'No-Code Solutions', 'Enterprise Digital Transformation'],
      },
      teamAssessment: {
        founders: [
          {
            name: 'John Doe',
            role: 'CEO',
            experience: '10 years in enterprise software, former VP at Salesforce',
            education: 'MBA Stanford, BS Computer Science MIT',
          },
          {
            name: 'Jane Smith',
            role: 'CTO',
            experience: '8 years in AI/ML, former Senior Engineer at Google',
            education: 'PhD Computer Science Stanford',
          },
        ],
        totalSize: 25,
        domainExpertise: ['Enterprise Software', 'AI/ML', 'SaaS', 'Workflow Automation'],
        keyHires: ['VP of Sales (ex-Workday)', 'Head of Product (ex-Slack)'],
        advisors: ['Former CTO of Workday', 'Ex-VP Sales at Salesforce'],
      },
      consistencyFlags: [
        {
          type: 'minor_discrepancy',
          description: 'ARR mentioned as $2M in pitch deck but $2.1M in transcript',
          severity: 'low',
          affectedMetrics: ['revenue.arr'],
          sourceDocuments: documentIds,
        },
      ],
      sourceDocumentIds: documentIds,
      processingTime: Math.floor(Math.random() * 5000) + 2000, // 2-7 seconds
      analysisTimestamp: new Date().toISOString(),
      confidence: 0.87,
      dataQuality: {
        completeness: 0.92,
        accuracy: 0.88,
        consistency: 0.85,
      },
    };
  }

  static createMockDealMemo(analysisResult: AnalysisResult): DealMemo {
    const signalScore = this.calculateMockSignalScore(analysisResult);
    const recommendation = this.getMockRecommendation(signalScore);

    return {
      aegisDealMemo: {
        summary: {
          companyName: analysisResult.companyProfile.name,
          oneLiner: analysisResult.companyProfile.oneLiner,
          signalScore,
          recommendation,
        },
        keyBenchmarks: [
          {
            metric: 'Annual Recurring Revenue',
            companyValue: analysisResult.extractedMetrics.revenue.arr,
            sectorMedian: 1500000,
            percentileRank: 65,
            interpretation: 'Above median performance for Series A SaaS companies',
          },
          {
            metric: 'Monthly Growth Rate',
            companyValue: analysisResult.extractedMetrics.revenue.growthRate,
            sectorMedian: 12,
            percentileRank: 72,
            interpretation: 'Strong growth rate indicating healthy product-market fit',
          },
          {
            metric: 'Customer Count',
            companyValue: analysisResult.extractedMetrics.traction.customers,
            sectorMedian: 120,
            percentileRank: 68,
            interpretation: 'Good customer base size for current stage',
          },
          {
            metric: 'Team Size',
            companyValue: analysisResult.extractedMetrics.team.size,
            sectorMedian: 20,
            percentileRank: 60,
            interpretation: 'Appropriate team size for current revenue level',
          },
          {
            metric: 'Customer Churn Rate',
            companyValue: analysisResult.extractedMetrics.traction.churnRate,
            sectorMedian: 6,
            percentileRank: 75,
            interpretation: 'Low churn rate indicates strong product stickiness',
          },
        ],
        growthPotential: {
          upsideSummary: 'TestCorp operates in a rapidly expanding $50B workflow automation market with strong AI tailwinds. The company has demonstrated product-market fit with 150 enterprise customers and 15% monthly growth. Key growth drivers include expanding into adjacent markets, international expansion, and leveraging AI capabilities for competitive differentiation.',
          growthTimeline: 'Short-term (6-12 months): Scale sales team and expand customer base to 300+ customers. Medium-term (1-2 years): International expansion and product line extensions. Long-term (2-3 years): Potential market leadership position with $50M+ ARR and strategic exit opportunities.',
        },
        riskAssessment: {
          highPriorityRisks: [
            {
              type: 'COMPETITIVE_RISK',
              severity: 'HIGH',
              description: 'Large incumbents like Microsoft and UiPath have significant resources and market presence that could limit TestCorp\'s growth potential',
              affectedMetrics: ['market_share', 'customer_acquisition'],
              suggestedMitigation: 'Focus on differentiated AI capabilities and superior customer experience to build defensible moats',
              sourceDocuments: ['pitch-deck.pdf'],
            },
            {
              type: 'EXECUTION_RISK',
              severity: 'HIGH',
              description: 'Scaling sales team while maintaining product quality and customer satisfaction presents execution challenges',
              affectedMetrics: ['growth_rate', 'churn_rate'],
              suggestedMitigation: 'Implement robust hiring processes, sales training programs, and customer success initiatives',
              sourceDocuments: ['transcript.txt'],
            },
          ],
          mediumPriorityRisks: [
            {
              type: 'MARKET_RISK',
              severity: 'MEDIUM',
              description: 'Economic downturn could reduce enterprise software spending and delay sales cycles',
              affectedMetrics: ['revenue_growth', 'customer_acquisition'],
              suggestedMitigation: 'Diversify customer base across industries and company sizes, focus on ROI-driven value proposition',
              sourceDocuments: ['pitch-deck.pdf'],
            },
            {
              type: 'TECHNOLOGY_RISK',
              severity: 'MEDIUM',
              description: 'Rapid AI advancement could make current technology stack obsolete or require significant R&D investment',
              affectedMetrics: ['product_competitiveness', 'development_costs'],
              suggestedMitigation: 'Maintain strong R&D investment and partnerships with AI technology providers',
              sourceDocuments: ['transcript.txt'],
            },
          ],
        },
        investmentRecommendation: {
          narrative: 'TestCorp presents a compelling investment opportunity in the high-growth workflow automation market. The company has demonstrated strong product-market fit with $2M ARR, 15% monthly growth, and low churn rates. The experienced founding team, led by former Salesforce and Google executives, provides confidence in execution capability. While competitive and execution risks exist, the market opportunity and early traction justify investment at appropriate valuation levels.',
          keyDiligenceQuestions: [
            'What is the customer acquisition cost trend over the past 12 months?',
            'How defensible is the AI technology moat against larger competitors?',
            'What are the specific plans for international expansion and timeline?',
            'How will the company maintain product quality while scaling the engineering team?',
            'What is the competitive response from Microsoft and UiPath to AI-powered solutions?',
            'What are the unit economics at different customer segments and deal sizes?',
            'How sticky is the product integration with customer workflows?',
            'What is the roadmap for expanding beyond workflow automation?',
          ],
          idealCheckSize: '$2M - $3M',
          idealValuationCap: '$15M - $18M',
        },
      },
    };
  }

  private static calculateMockSignalScore(analysisResult: AnalysisResult): number {
    // Simple scoring algorithm for demo purposes
    let score = 5.0; // Base score

    // Revenue growth factor
    if (analysisResult.extractedMetrics.revenue.growthRate > 20) score += 1.5;
    else if (analysisResult.extractedMetrics.revenue.growthRate > 10) score += 1.0;
    else if (analysisResult.extractedMetrics.revenue.growthRate > 5) score += 0.5;

    // ARR factor
    if (analysisResult.extractedMetrics.revenue.arr > 5000000) score += 1.5;
    else if (analysisResult.extractedMetrics.revenue.arr > 1000000) score += 1.0;
    else if (analysisResult.extractedMetrics.revenue.arr > 500000) score += 0.5;

    // Team size factor
    if (analysisResult.extractedMetrics.team.size > 20) score += 0.5;
    else if (analysisResult.extractedMetrics.team.size > 10) score += 0.3;

    // Churn factor
    if (analysisResult.extractedMetrics.traction.churnRate < 5) score += 0.5;
    else if (analysisResult.extractedMetrics.traction.churnRate > 10) score -= 0.5;

    // Add some randomness for demo
    score += (Math.random() - 0.5) * 0.5;

    return Math.min(Math.max(score, 1.0), 10.0);
  }

  private static getMockRecommendation(signalScore: number): string {
    if (signalScore >= 8.0) return 'STRONG_BUY';
    if (signalScore >= 6.5) return 'BUY';
    if (signalScore >= 5.0) return 'HOLD';
    return 'PASS';
  }

  static async simulateProcessingDelay(stage: string): Promise<void> {
    const delays = {
      'upload': 500,
      'extract': 1000,
      'analyze': 2000,
      'benchmark': 800,
      'generate': 1200,
    };

    const delay = delays[stage as keyof typeof delays] || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}