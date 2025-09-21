// Team analysis and background validation service
import { TeamMember } from '../../types/interfaces.js';
import { CompanyProfile } from '../../models/CompanyProfile.js';
import { BenchmarkData } from '../../models/BenchmarkData.js';
import { BigQueryConnector } from './BigQueryConnector.js';
import { logger } from '../../utils/logger.js';

export interface TeamAnalysisResult {
  overallScore: number;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  roleAnalysis: RoleAnalysis;
  experienceAnalysis: ExperienceAnalysis;
  diversityAnalysis: DiversityAnalysis;
  benchmarkComparison: TeamBenchmarkComparison;
}

export interface RoleAnalysis {
  coverage: {
    technical: boolean;
    business: boolean;
    product: boolean;
    sales: boolean;
    marketing: boolean;
  };
  gaps: string[];
  score: number;
}

export interface ExperienceAnalysis {
  averageYears: number;
  domainExperience: number;
  startupExperience: number;
  leadershipExperience: number;
  score: number;
}

export interface DiversityAnalysis {
  backgroundDiversity: number;
  educationDiversity: number;
  industryDiversity: number;
  score: number;
}

export interface TeamBenchmarkComparison {
  teamSizePercentile: number;
  founderCountPercentile: number;
  experiencePercentile: number;
  sectorComparison: string;
}

export interface SectorCriteria {
  criticalRoles: string[];
  preferredExperience: string[];
  minimumYears: number;
  idealTeamSize: { min: number; max: number };
}

export class TeamAnalyzer {
  private bigQueryConnector: BigQueryConnector;
  private sectorCriteria: Map<string, SectorCriteria> = new Map();

  constructor(bigQueryConnector: BigQueryConnector) {
    this.bigQueryConnector = bigQueryConnector;
    this.initializeSectorCriteria();
  }

  /**
   * Analyze team composition and background
   */
  async analyzeTeam(
    teamMembers: TeamMember[],
    companyProfile: CompanyProfile,
    benchmarkData?: BenchmarkData
  ): Promise<TeamAnalysisResult> {
    try {
      logger.info(`Analyzing team of ${teamMembers.length} members for ${companyProfile.sector} company`);

      const roleAnalysis = this.analyzeRoles(teamMembers, companyProfile.sector);
      const experienceAnalysis = this.analyzeExperience(teamMembers, companyProfile.sector);
      const diversityAnalysis = this.analyzeDiversity(teamMembers);
      
      let benchmarkComparison: TeamBenchmarkComparison;
      if (benchmarkData) {
        benchmarkComparison = this.compareToBenchmarks(teamMembers, benchmarkData);
      } else {
        // Get benchmark data if not provided
        const sectorBenchmarks = await this.bigQueryConnector.getBenchmarkData({
          sector: companyProfile.sector,
          stage: companyProfile.stage
        });
        benchmarkComparison = sectorBenchmarks.length > 0 
          ? this.compareToBenchmarks(teamMembers, sectorBenchmarks[0])
          : this.getDefaultBenchmarkComparison(teamMembers);
      }

      const overallScore = this.calculateOverallScore(roleAnalysis, experienceAnalysis, diversityAnalysis);
      const { strengths, concerns, recommendations } = this.generateInsights(
        roleAnalysis,
        experienceAnalysis,
        diversityAnalysis,
        benchmarkComparison,
        companyProfile.sector
      );

      const result: TeamAnalysisResult = {
        overallScore,
        strengths,
        concerns,
        recommendations,
        roleAnalysis,
        experienceAnalysis,
        diversityAnalysis,
        benchmarkComparison
      };

      logger.info(`Team analysis completed. Overall score: ${overallScore}`);
      return result;

    } catch (error) {
      logger.error('Error in team analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze role coverage and gaps
   */
  private analyzeRoles(teamMembers: TeamMember[], sector: string): RoleAnalysis {
    const criteria = this.sectorCriteria.get(sector) || this.sectorCriteria.get('default')!;
    const roles = teamMembers.map(member => member.role.toLowerCase());
    
    const coverage = {
      technical: this.hasRole(roles, ['cto', 'engineer', 'developer', 'technical', 'architect']),
      business: this.hasRole(roles, ['ceo', 'coo', 'founder', 'business', 'operations']),
      product: this.hasRole(roles, ['cpo', 'product', 'design', 'ux', 'ui']),
      sales: this.hasRole(roles, ['sales', 'revenue', 'business development', 'partnerships']),
      marketing: this.hasRole(roles, ['cmo', 'marketing', 'growth', 'brand', 'content'])
    };

    const gaps: string[] = [];
    const criticalRoles = criteria.criticalRoles;

    if (!coverage.technical && criticalRoles.includes('technical')) {
      gaps.push('Technical leadership (CTO/Lead Engineer)');
    }
    if (!coverage.business && criticalRoles.includes('business')) {
      gaps.push('Business leadership (CEO/COO)');
    }
    if (!coverage.product && criticalRoles.includes('product')) {
      gaps.push('Product leadership (CPO/Product Manager)');
    }
    if (!coverage.sales && criticalRoles.includes('sales')) {
      gaps.push('Sales leadership (VP Sales/Business Development)');
    }
    if (!coverage.marketing && criticalRoles.includes('marketing')) {
      gaps.push('Marketing leadership (CMO/Growth)');
    }

    // Calculate score based on coverage of critical roles
    const coveredCriticalRoles = criticalRoles.filter(role => {
      switch (role) {
        case 'technical': return coverage.technical;
        case 'business': return coverage.business;
        case 'product': return coverage.product;
        case 'sales': return coverage.sales;
        case 'marketing': return coverage.marketing;
        default: return false;
      }
    }).length;

    const score = Math.round((coveredCriticalRoles / criticalRoles.length) * 100);

    return { coverage, gaps, score };
  }

  /**
   * Analyze team experience levels
   */
  private analyzeExperience(teamMembers: TeamMember[], sector: string): ExperienceAnalysis {
    const criteria = this.sectorCriteria.get(sector) || this.sectorCriteria.get('default')!;
    
    const experiencedMembers = teamMembers.filter(member => member.yearsExperience && member.yearsExperience > 0);
    const averageYears = experiencedMembers.length > 0
      ? experiencedMembers.reduce((sum, member) => sum + (member.yearsExperience || 0), 0) / experiencedMembers.length
      : 0;

    // Analyze domain experience
    const domainExperienceCount = teamMembers.filter(member => 
      this.hasDomainExperience(member, sector)
    ).length;
    const domainExperience = teamMembers.length > 0 ? (domainExperienceCount / teamMembers.length) * 100 : 0;

    // Analyze startup experience
    const startupExperienceCount = teamMembers.filter(member =>
      this.hasStartupExperience(member)
    ).length;
    const startupExperience = teamMembers.length > 0 ? (startupExperienceCount / teamMembers.length) * 100 : 0;

    // Analyze leadership experience
    const leadershipExperienceCount = teamMembers.filter(member =>
      this.hasLeadershipExperience(member)
    ).length;
    const leadershipExperience = teamMembers.length > 0 ? (leadershipExperienceCount / teamMembers.length) * 100 : 0;

    // Calculate experience score
    let score = 0;
    score += Math.min(averageYears / criteria.minimumYears, 1) * 30; // 30% for average years
    score += (domainExperience / 100) * 25; // 25% for domain experience
    score += (startupExperience / 100) * 25; // 25% for startup experience
    score += (leadershipExperience / 100) * 20; // 20% for leadership experience

    return {
      averageYears: Math.round(averageYears * 10) / 10,
      domainExperience: Math.round(domainExperience),
      startupExperience: Math.round(startupExperience),
      leadershipExperience: Math.round(leadershipExperience),
      score: Math.round(score)
    };
  }

  /**
   * Analyze team diversity
   */
  private analyzeDiversity(teamMembers: TeamMember[]): DiversityAnalysis {
    if (teamMembers.length === 0) {
      return { backgroundDiversity: 0, educationDiversity: 0, industryDiversity: 0, score: 0 };
    }

    // Background diversity (based on previous companies)
    const allCompanies = teamMembers.flatMap(member => member.previousCompanies || []);
    const uniqueCompanies = new Set(allCompanies);
    const backgroundDiversity = allCompanies.length > 0 ? (uniqueCompanies.size / allCompanies.length) * 100 : 0;

    // Education diversity
    const educations = teamMembers.map(member => member.education).filter(Boolean);
    const uniqueEducations = new Set(educations);
    const educationDiversity = educations.length > 0 ? (uniqueEducations.size / educations.length) * 100 : 0;

    // Industry diversity (based on expertise)
    const allExpertise = teamMembers.flatMap(member => member.expertise || []);
    const uniqueExpertise = new Set(allExpertise);
    const industryDiversity = allExpertise.length > 0 ? (uniqueExpertise.size / allExpertise.length) * 100 : 0;

    // Calculate diversity score (balanced approach - not too diverse, not too homogeneous)
    const optimalDiversity = 60; // 60% is considered optimal
    const backgroundScore = 100 - Math.abs(backgroundDiversity - optimalDiversity);
    const educationScore = 100 - Math.abs(educationDiversity - optimalDiversity);
    const industryScore = 100 - Math.abs(industryDiversity - optimalDiversity);
    
    const score = Math.round((backgroundScore + educationScore + industryScore) / 3);

    return {
      backgroundDiversity: Math.round(backgroundDiversity),
      educationDiversity: Math.round(educationDiversity),
      industryDiversity: Math.round(industryDiversity),
      score: Math.max(0, score)
    };
  }

  /**
   * Compare team to sector benchmarks
   */
  private compareToBenchmarks(teamMembers: TeamMember[], benchmarkData: BenchmarkData): TeamBenchmarkComparison {
    const teamSize = teamMembers.length;
    const founderCount = teamMembers.filter(member => member.isFounder).length;
    const averageExperience = teamMembers.reduce((sum, member) => sum + (member.yearsExperience || 0), 0) / teamMembers.length;

    // Calculate percentiles based on benchmark data
    const teamSizePercentile = benchmarkData.metrics.team_size 
      ? this.calculatePercentile(teamSize, benchmarkData.metrics.team_size)
      : 50;

    const founderCountPercentile = benchmarkData.metrics.founder_count
      ? this.calculatePercentile(founderCount, benchmarkData.metrics.founder_count)
      : 50;

    const experiencePercentile = benchmarkData.metrics.avg_experience
      ? this.calculatePercentile(averageExperience, benchmarkData.metrics.avg_experience)
      : 50;

    const sectorComparison = this.generateSectorComparison(
      teamSizePercentile,
      founderCountPercentile,
      experiencePercentile,
      benchmarkData.sector
    );

    return {
      teamSizePercentile,
      founderCountPercentile,
      experiencePercentile,
      sectorComparison
    };
  }

  /**
   * Calculate overall team score
   */
  private calculateOverallScore(
    roleAnalysis: RoleAnalysis,
    experienceAnalysis: ExperienceAnalysis,
    diversityAnalysis: DiversityAnalysis
  ): number {
    const weights = {
      roles: 0.4,      // 40% - most important
      experience: 0.35, // 35% - very important
      diversity: 0.25   // 25% - important but not critical
    };

    const weightedScore = 
      (roleAnalysis.score * weights.roles) +
      (experienceAnalysis.score * weights.experience) +
      (diversityAnalysis.score * weights.diversity);

    return Math.round(weightedScore);
  }

  /**
   * Generate insights and recommendations
   */
  private generateInsights(
    roleAnalysis: RoleAnalysis,
    experienceAnalysis: ExperienceAnalysis,
    diversityAnalysis: DiversityAnalysis,
    benchmarkComparison: TeamBenchmarkComparison,
    sector: string
  ): { strengths: string[]; concerns: string[]; recommendations: string[] } {
    const strengths: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Role analysis insights
    if (roleAnalysis.score >= 80) {
      strengths.push('Strong role coverage across critical functions');
    } else if (roleAnalysis.score < 60) {
      concerns.push('Significant gaps in critical roles');
      recommendations.push('Prioritize hiring for missing critical roles: ' + roleAnalysis.gaps.join(', '));
    }

    // Experience analysis insights
    if (experienceAnalysis.averageYears >= 8) {
      strengths.push('Highly experienced team with strong track record');
    } else if (experienceAnalysis.averageYears < 3) {
      concerns.push('Limited overall experience in the team');
      recommendations.push('Consider adding senior advisors or experienced hires');
    }

    if (experienceAnalysis.domainExperience >= 60) {
      strengths.push('Strong domain expertise relevant to the sector');
    } else if (experienceAnalysis.domainExperience < 30) {
      concerns.push('Limited domain experience in ' + sector);
      recommendations.push('Recruit team members with specific ' + sector + ' experience');
    }

    if (experienceAnalysis.startupExperience >= 50) {
      strengths.push('Good startup experience across the team');
    } else if (experienceAnalysis.startupExperience < 25) {
      concerns.push('Limited startup experience');
      recommendations.push('Consider startup mentors or advisors to guide execution');
    }

    // Diversity insights
    if (diversityAnalysis.score >= 70) {
      strengths.push('Well-balanced team diversity');
    } else if (diversityAnalysis.score < 40) {
      concerns.push('Team may benefit from more diverse backgrounds');
      recommendations.push('Consider diversity in future hiring to bring different perspectives');
    }

    // Benchmark insights
    if (benchmarkComparison.teamSizePercentile < 25) {
      concerns.push('Team size below sector average');
      recommendations.push('Evaluate if current team size is sufficient for growth plans');
    } else if (benchmarkComparison.teamSizePercentile > 75) {
      concerns.push('Team size above sector average - monitor burn rate');
    }

    if (benchmarkComparison.experiencePercentile > 75) {
      strengths.push('Team experience above sector average');
    } else if (benchmarkComparison.experiencePercentile < 25) {
      concerns.push('Team experience below sector average');
    }

    return { strengths, concerns, recommendations };
  }

  /**
   * Helper methods
   */
  private hasRole(roles: string[], keywords: string[]): boolean {
    return roles.some(role => keywords.some(keyword => role.includes(keyword)));
  }

  private hasDomainExperience(member: TeamMember, sector: string): boolean {
    const sectorKeywords = this.getSectorKeywords(sector);
    const memberText = `${member.background || ''} ${member.expertise?.join(' ') || ''} ${member.previousCompanies?.join(' ') || ''}`.toLowerCase();
    return sectorKeywords.some(keyword => memberText.includes(keyword));
  }

  private hasStartupExperience(member: TeamMember): boolean {
    const startupIndicators = ['startup', 'founder', 'early-stage', 'seed', 'series a', 'venture'];
    const memberText = `${member.background || ''} ${member.previousCompanies?.join(' ') || ''}`.toLowerCase();
    return startupIndicators.some(indicator => memberText.includes(indicator));
  }

  private hasLeadershipExperience(member: TeamMember): boolean {
    const leadershipRoles = ['ceo', 'cto', 'cpo', 'cmo', 'vp', 'director', 'head', 'lead', 'manager', 'founder'];
    return leadershipRoles.some(role => member.role.toLowerCase().includes(role));
  }

  private getSectorKeywords(sector: string): string[] {
    const sectorKeywords: Record<string, string[]> = {
      'fintech': ['finance', 'banking', 'payment', 'lending', 'crypto', 'blockchain', 'financial'],
      'healthtech': ['health', 'medical', 'healthcare', 'biotech', 'pharma', 'clinical'],
      'edtech': ['education', 'learning', 'school', 'university', 'training', 'academic'],
      'enterprise-software': ['enterprise', 'b2b', 'saas', 'software', 'platform', 'cloud'],
      'consumer': ['consumer', 'b2c', 'marketplace', 'social', 'mobile', 'retail'],
      'deeptech': ['ai', 'ml', 'robotics', 'iot', 'quantum', 'computer vision']
    };
    return sectorKeywords[sector] || [];
  }

  private calculatePercentile(value: number, distribution: any): number {
    if (!distribution) return 50;
    
    if (value <= distribution.p25) return 25;
    if (value <= distribution.median) return 50;
    if (value <= distribution.p75) return 75;
    if (value <= distribution.p90) return 90;
    return 95;
  }

  private generateSectorComparison(
    teamSizePercentile: number,
    founderCountPercentile: number,
    experiencePercentile: number,
    sector: string
  ): string {
    const avgPercentile = (teamSizePercentile + founderCountPercentile + experiencePercentile) / 3;
    
    if (avgPercentile >= 75) {
      return `Team metrics above average for ${sector} companies`;
    } else if (avgPercentile >= 50) {
      return `Team metrics at or above median for ${sector} companies`;
    } else if (avgPercentile >= 25) {
      return `Team metrics below median for ${sector} companies`;
    } else {
      return `Team metrics significantly below average for ${sector} companies`;
    }
  }

  private getDefaultBenchmarkComparison(teamMembers: TeamMember[]): TeamBenchmarkComparison {
    return {
      teamSizePercentile: 50,
      founderCountPercentile: 50,
      experiencePercentile: 50,
      sectorComparison: 'Benchmark data not available for comparison'
    };
  }

  /**
   * Initialize sector-specific criteria
   */
  private initializeSectorCriteria(): void {
    this.sectorCriteria.set('fintech', {
      criticalRoles: ['technical', 'business', 'product'],
      preferredExperience: ['financial services', 'payments', 'banking', 'compliance'],
      minimumYears: 5,
      idealTeamSize: { min: 8, max: 25 }
    });

    this.sectorCriteria.set('healthtech', {
      criticalRoles: ['technical', 'business', 'product'],
      preferredExperience: ['healthcare', 'medical devices', 'clinical', 'regulatory'],
      minimumYears: 6,
      idealTeamSize: { min: 10, max: 30 }
    });

    this.sectorCriteria.set('edtech', {
      criticalRoles: ['technical', 'business', 'product'],
      preferredExperience: ['education', 'learning', 'curriculum', 'pedagogy'],
      minimumYears: 4,
      idealTeamSize: { min: 6, max: 20 }
    });

    this.sectorCriteria.set('enterprise-software', {
      criticalRoles: ['technical', 'business', 'sales'],
      preferredExperience: ['enterprise software', 'b2b sales', 'saas', 'cloud'],
      minimumYears: 5,
      idealTeamSize: { min: 8, max: 25 }
    });

    this.sectorCriteria.set('consumer', {
      criticalRoles: ['technical', 'business', 'product', 'marketing'],
      preferredExperience: ['consumer products', 'mobile apps', 'user experience', 'growth'],
      minimumYears: 4,
      idealTeamSize: { min: 6, max: 20 }
    });

    this.sectorCriteria.set('deeptech', {
      criticalRoles: ['technical', 'business', 'product'],
      preferredExperience: ['ai/ml', 'research', 'phd', 'patents', 'deep tech'],
      minimumYears: 7,
      idealTeamSize: { min: 10, max: 35 }
    });

    this.sectorCriteria.set('default', {
      criticalRoles: ['technical', 'business'],
      preferredExperience: ['startup', 'technology', 'business development'],
      minimumYears: 4,
      idealTeamSize: { min: 5, max: 20 }
    });
  }
}