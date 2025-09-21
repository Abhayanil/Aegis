// MarketSizeValidator test suite
import { describe, it, expect, beforeEach } from 'vitest';
import { MarketSizeValidator } from '../../../src/services/risk/MarketSizeValidator.js';
import { MarketClaims } from '../../../src/models/AnalysisResult.js';
import { RiskType, RiskSeverity } from '../../../src/types/enums.js';

describe('MarketSizeValidator', () => {
  let validator: MarketSizeValidator;

  beforeEach(() => {
    validator = new MarketSizeValidator();
  });

  describe('validateMarketClaims', () => {
    it('should validate reasonable market size relationships', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9, // $100B
        sam: 10e9,  // $10B
        som: 1e9,   // $1B
        marketGrowthRate: 0.15, // 15%
        competitorCount: 5,
        competitiveLandscape: ['Competitor A', 'Competitor B', 'Competitor C'],
      };

      const result = await validator.validateMarketClaims(marketClaims, 'saas');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid TAM/SAM relationship', async () => {
      const marketClaims: MarketClaims = {
        tam: 10e9,  // $10B
        sam: 50e9,  // $50B - larger than TAM!
        marketGrowthRate: 0.15,
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'SAM (50.0B) is unrealistically large compared to TAM (10.0B)'
      );
    });

    it('should detect invalid SAM/SOM relationship', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9, // $100B
        sam: 10e9,  // $10B
        som: 20e9,  // $20B - larger than SAM!
        marketGrowthRate: 0.15,
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'SOM (20.0B) is unrealistically large compared to SAM (10.0B)'
      );
    });

    it('should warn about overly conservative SOM', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9, // $100B
        sam: 10e9,  // $10B
        som: 0.1e9, // $100M - very small compared to SAM
        marketGrowthRate: 0.15,
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'SOM appears very conservative relative to SAM - may indicate limited growth ambition'
      );
    });

    it('should detect unrealistic market growth rate', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        marketGrowthRate: 1.5, // 150% growth - unrealistic
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Market growth rate (150.0%) is unrealistically high'
      );
    });

    it('should warn about declining market', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        marketGrowthRate: -0.1, // -10% growth
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Market growth rate (-10.0%) indicates declining market'
      );
    });

    it('should validate against external data for known sectors', async () => {
      const marketClaims: MarketClaims = {
        tam: 500e9, // $500B - much larger than SaaS market estimate
        sam: 50e9,
        marketGrowthRate: 0.18,
      };

      const result = await validator.validateMarketClaims(marketClaims, 'saas');
      
      expect(result.errors).toContain(
        'TAM claim (500.0B) significantly exceeds external estimates (195.0B)'
      );
    });
  });

  describe('generateMarketSizeRiskFlags', () => {
    it('should flag inflated TAM claims', async () => {
      const marketClaims: MarketClaims = {
        tam: 2e12, // $2 trillion - unrealistically large
        sam: 100e9,
      };

      const flags = await validator.generateMarketSizeRiskFlags(
        marketClaims, 
        'saas', 
        ['pitch-deck.pdf']
      );
      
      expect(flags.length).toBeGreaterThan(0);
      const tamFlag = flags.find(f => f.title === 'Inflated TAM Claim');
      expect(tamFlag).toBeDefined();
      expect(tamFlag!.type).toBe(RiskType.MARKET_SIZE);
      expect(tamFlag!.severity).toBe(RiskSeverity.HIGH);
      expect(tamFlag!.description).toContain('2.0 trillion appears unrealistically large');
    });

    it('should flag questionable TAM/SAM ratios', async () => {
      const marketClaims: MarketClaims = {
        tam: 1000e9, // $1T
        sam: 1e9,    // $1B - ratio of 1000x
      };

      const flags = await validator.generateMarketSizeRiskFlags(marketClaims);
      
      expect(flags.length).toBeGreaterThan(0);
      const ratioFlag = flags.find(f => f.title === 'Questionable TAM/SAM Ratio');
      expect(ratioFlag).toBeDefined();
      expect(ratioFlag!.type).toBe(RiskType.MARKET_SIZE);
      expect(ratioFlag!.severity).toBe(RiskSeverity.MEDIUM);
      expect(ratioFlag!.description).toContain('1000x larger than SAM');
    });

    it('should flag unrealistic growth assumptions', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        marketGrowthRate: 0.8, // 80% growth
      };

      const flags = await validator.generateMarketSizeRiskFlags(marketClaims);
      
      expect(flags.length).toBeGreaterThan(0);
      const growthFlag = flags.find(f => f.title === 'Unrealistic Market Growth Rate');
      expect(growthFlag).toBeDefined();
      expect(growthFlag!.type).toBe(RiskType.MARKET_SIZE);
      expect(growthFlag!.severity).toBe(RiskSeverity.MEDIUM);
      expect(growthFlag!.description).toContain('80.0% appears optimistic');
    });

    it('should flag insufficient competitive analysis', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        // No competitive landscape provided
      };

      const flags = await validator.generateMarketSizeRiskFlags(marketClaims);
      
      expect(flags.length).toBeGreaterThan(0);
      const competitiveFlag = flags.find(f => f.title === 'Insufficient Competitive Analysis');
      expect(competitiveFlag).toBeDefined();
      expect(competitiveFlag!.type).toBe(RiskType.MARKET_SIZE);
      expect(competitiveFlag!.severity).toBe(RiskSeverity.MEDIUM);
      expect(competitiveFlag!.description).toBe('No competitive landscape analysis provided');
    });

    it('should flag missing market barriers analysis', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        competitiveLandscape: ['Competitor A', 'Competitor B'],
        // No barriers provided
      };

      const flags = await validator.generateMarketSizeRiskFlags(marketClaims);
      
      expect(flags).toHaveLength(1);
      expect(flags[0].type).toBe(RiskType.MARKET_SIZE);
      expect(flags[0].severity).toBe(RiskSeverity.LOW);
      expect(flags[0].title).toBe('Missing Market Barriers Analysis');
    });

    it('should handle realistic market claims without flags', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
        som: 1e9,
        marketGrowthRate: 0.15,
        competitiveLandscape: ['Competitor A', 'Competitor B', 'Competitor C'],
        barriers: ['High switching costs', 'Network effects'],
        opportunities: ['Market expansion', 'New segments'],
      };

      const flags = await validator.generateMarketSizeRiskFlags(marketClaims, 'saas');
      
      expect(flags).toHaveLength(0);
    });
  });

  describe('assessCompetitiveLandscape', () => {
    it('should assess complete competitive landscape positively', async () => {
      const marketClaims: MarketClaims = {
        competitorCount: 5,
        competitiveLandscape: ['Competitor A', 'Competitor B', 'Competitor C'],
        barriers: ['High switching costs', 'Network effects'],
        opportunities: ['Market expansion', 'New segments'],
        marketTrends: ['Digital transformation', 'Remote work'],
      };

      const assessment = await validator.assessCompetitiveLandscape(marketClaims, 'saas');
      
      expect(assessment.completenessScore).toBeGreaterThan(0.8);
      expect(assessment.missingSegments).toHaveLength(0);
      expect(assessment.competitiveGaps).toHaveLength(0);
    });

    it('should identify missing competitive analysis components', async () => {
      const marketClaims: MarketClaims = {
        competitorCount: 1, // Too few competitors
        // Missing competitive landscape, barriers, opportunities
      };

      const assessment = await validator.assessCompetitiveLandscape(marketClaims);
      
      expect(assessment.completenessScore).toBeLessThan(0.5);
      expect(assessment.missingSegments).toContain('Direct competitors');
      expect(assessment.missingSegments).toContain('Market entry barriers');
      expect(assessment.competitiveGaps).toContain(
        'Insufficient competitor identification - market may be more competitive than claimed'
      );
    });

    it('should identify overlooked competitors for known sectors', async () => {
      const marketClaims: MarketClaims = {
        competitorCount: 2,
        competitiveLandscape: ['Small Competitor A', 'Small Competitor B'],
        // Missing major SaaS players like Salesforce, Microsoft
      };

      const assessment = await validator.assessCompetitiveLandscape(marketClaims, 'saas');
      
      expect(assessment.overlookedCompetitors.length).toBeGreaterThan(0);
      expect(assessment.overlookedCompetitors).toContain('Salesforce');
      expect(assessment.completenessScore).toBeLessThan(0.7);
    });

    it('should handle overly fragmented competitive landscape', async () => {
      const marketClaims: MarketClaims = {
        competitorCount: 60, // Too many competitors
        competitiveLandscape: Array.from({ length: 60 }, (_, i) => `Competitor ${i + 1}`),
      };

      const assessment = await validator.assessCompetitiveLandscape(marketClaims);
      
      expect(assessment.competitiveGaps).toContain(
        'Overly fragmented competitive landscape - may indicate market definition issues'
      );
    });

    it('should calculate market coverage score accurately', async () => {
      const completeMarketClaims: MarketClaims = {
        competitorCount: 5,
        competitiveLandscape: ['A', 'B', 'C'],
        barriers: ['Barrier 1'],
        opportunities: ['Opportunity 1'],
        marketTrends: ['Trend 1'],
      };

      const incompleteMarketClaims: MarketClaims = {
        competitorCount: 5,
        // Missing most components
      };

      const completeAssessment = await validator.assessCompetitiveLandscape(completeMarketClaims);
      const incompleteAssessment = await validator.assessCompetitiveLandscape(incompleteMarketClaims);
      
      expect(completeAssessment.marketCoverageScore).toBeGreaterThan(
        incompleteAssessment.marketCoverageScore
      );
    });
  });

  describe('custom thresholds', () => {
    it('should use custom thresholds when provided', async () => {
      const customValidator = new MarketSizeValidator({
        tamToSamRatio: {
          min: 5,  // More strict TAM/SAM ratio
          max: 20,
        },
      });

      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 30e9, // Ratio of ~3.3, which would be valid for default but invalid for custom
      };

      const result = await customValidator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'SAM (30.0B) is unrealistically large compared to TAM (100.0B)'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing market size data gracefully', async () => {
      const marketClaims: MarketClaims = {
        marketDescription: 'Some market description',
        // No TAM, SAM, or SOM
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'No market size data provided - unable to assess market opportunity'
      );
    });

    it('should handle zero or negative market sizes', async () => {
      const marketClaims: MarketClaims = {
        tam: 0,
        sam: -1e9, // Negative SAM
      };

      const result = await validator.validateMarketClaims(marketClaims);
      
      // Should handle gracefully without crashing
      expect(result).toBeDefined();
    });

    it('should handle unknown sectors gracefully', async () => {
      const marketClaims: MarketClaims = {
        tam: 100e9,
        sam: 10e9,
      };

      const result = await validator.validateMarketClaims(marketClaims, 'unknown-sector');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'No external market data available for sector: unknown-sector'
      );
    });
  });

  describe('realistic vs inflated scenarios', () => {
    it('should pass realistic fintech market claims', async () => {
      const realisticClaims: MarketClaims = {
        tam: 300e9,  // $300B - close to actual fintech TAM
        sam: 45e9,   // $45B - reasonable SAM
        som: 2e9,    // $2B - achievable SOM
        marketGrowthRate: 0.22, // 22% - realistic for fintech
        competitorCount: 8,
        competitiveLandscape: ['Stripe', 'Square', 'Adyen', 'Newer Competitor'],
        barriers: ['Regulatory compliance', 'Trust and security'],
        opportunities: ['SMB expansion', 'International markets'],
        marketTrends: ['Digital payments growth', 'Embedded finance'],
      };

      const validation = await validator.validateMarketClaims(realisticClaims, 'fintech');
      const flags = await validator.generateMarketSizeRiskFlags(realisticClaims, 'fintech');
      const assessment = await validator.assessCompetitiveLandscape(realisticClaims, 'fintech');
      
      expect(validation.isValid).toBe(true);
      expect(flags).toHaveLength(0);
      expect(assessment.completenessScore).toBeGreaterThan(0.8);
    });

    it('should flag inflated fintech market claims', async () => {
      const inflatedClaims: MarketClaims = {
        tam: 2e12,   // $2T - way too large for fintech
        sam: 500e9,  // $500B - unrealistic SAM
        som: 100e9,  // $100B - overly optimistic SOM
        marketGrowthRate: 0.75, // 75% - unrealistic growth
        competitorCount: 1, // Claiming no real competition
        competitiveLandscape: ['Some small player'],
        // Missing barriers and opportunities analysis
      };

      const validation = await validator.validateMarketClaims(inflatedClaims, 'fintech');
      const flags = await validator.generateMarketSizeRiskFlags(inflatedClaims, 'fintech');
      const assessment = await validator.assessCompetitiveLandscape(inflatedClaims, 'fintech');
      
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(flags.length).toBeGreaterThan(2); // Multiple risk flags
      expect(assessment.completenessScore).toBeLessThan(0.5);
      expect(assessment.overlookedCompetitors).toContain('Stripe');
    });

    it('should handle moderately optimistic but plausible claims', async () => {
      const optimisticClaims: MarketClaims = {
        tam: 400e9,  // $400B - slightly higher than estimates
        sam: 80e9,   // $80B - optimistic but not crazy
        som: 5e9,    // $5B - ambitious but achievable
        marketGrowthRate: 0.35, // 35% - high but possible for emerging segments
        competitorCount: 3,
        competitiveLandscape: ['Major Player', 'Growing Competitor', 'Niche Player'],
        barriers: ['Network effects', 'Regulatory moats'],
        opportunities: ['Emerging markets', 'New use cases'],
      };

      const validation = await validator.validateMarketClaims(optimisticClaims, 'fintech');
      const flags = await validator.generateMarketSizeRiskFlags(optimisticClaims, 'fintech');
      
      expect(validation.isValid).toBe(true); // Should pass validation
      // The validation might not have warnings if the claims are within reasonable bounds
      expect(flags.length).toBeLessThan(3); // Should have minimal risk flags
    });
  });
});