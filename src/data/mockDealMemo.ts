import { DealMemo } from '../types';

export const mockDealMemo: DealMemo = {
  summary: {
    companyName: "TechFlow Analytics",
    oneLiner: "AI-powered supply chain optimization platform for enterprise logistics",
    signalScore: 87,
    recommendation: "Strong Buy"
  },
  benchmarks: [
    {
      metric: "ARR Growth Rate",
      startupValue: "145% YoY",
      sectorMedian: "78% YoY", 
      percentile: "92nd"
    },
    {
      metric: "Net Revenue Retention",
      startupValue: "118%",
      sectorMedian: "105%",
      percentile: "78th"
    },
    {
      metric: "Customer Acquisition Cost",
      startupValue: "$2,400",
      sectorMedian: "$4,100",
      percentile: "85th"
    },
    {
      metric: "Gross Margin",
      startupValue: "82%",
      sectorMedian: "71%",
      percentile: "81st"
    },
    {
      metric: "Burn Multiple",
      startupValue: "0.8x",
      sectorMedian: "1.4x",
      percentile: "89th"
    }
  ],
  growthPotential: {
    highlights: [
      "Large TAM of $145B in supply chain management software",
      "Proprietary AI algorithms with 3x accuracy improvement over competitors", 
      "Strong customer retention with 95% renewal rate",
      "Expanding into adjacent markets (inventory management, demand forecasting)"
    ],
    timeline: [
      {
        period: "6-12 months",
        milestone: "Series A completion, team expansion to 50+ employees"
      },
      {
        period: "12-18 months", 
        milestone: "International expansion, $10M ARR milestone"
      },
      {
        period: "24-36 months",
        milestone: "Series B readiness, potential acquisition targets identified"
      }
    ]
  },
  riskAssessment: {
    high: [
      "Competitive landscape intensifying with well-funded incumbents",
      "Key technical talent concentrated in small team",
      "Customer concentration risk with top 3 clients representing 60% of revenue"
    ],
    medium: [
      "Regulatory compliance requirements in international markets",
      "Scaling customer success operations as client base grows",
      "Integration complexity with enterprise legacy systems"
    ]
  },
  investmentRecommendation: {
    narrative: "TechFlow Analytics presents a compelling investment opportunity in the rapidly growing supply chain optimization market. The company demonstrates exceptional unit economics, strong product-market fit evidenced by best-in-class NRR, and a defensible AI moat. While competitive risks exist, the team's execution track record and expanding market opportunity support a strong buy recommendation.",
    checkSize: "$2.5M - $4M",
    valuationCap: "$45M - $55M",
    diligenceQuestions: [
      "What is the IP protection strategy for core AI algorithms?",
      "How does the sales team plan to reduce customer concentration?",
      "What are the key technical hiring priorities for the next 12 months?",
      "Can management provide references for churned customers?",
      "What is the competitive differentiation against [specific competitor]?"
    ]
  }
};