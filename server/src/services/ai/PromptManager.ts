// Prompt management for structured AI analysis
import { AnalysisContext } from '../../types/interfaces.js';
import { AnalysisType } from '../../types/enums.js';
import { logger } from '../../utils/logger.js';

export interface AnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}

export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema?: Record<string, any>;
  requiredVariables: string[];
  temperature?: number;
  maxTokens?: number;
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default prompt templates for different analysis types
   */
  private initializeDefaultTemplates(): void {
    // Company profile extraction template
    this.templates.set('company_profile', {
      name: 'company_profile',
      description: 'Extract basic company information and profile',
      systemPrompt: `You are an expert investment analyst specializing in startup evaluation. 
Your task is to extract structured company profile information from startup documents.
Focus on factual information and avoid speculation. If information is not explicitly stated, mark it as null.
Provide confidence scores for extracted data based on clarity and explicitness in the source material.`,
      userPromptTemplate: `Analyze the following startup document(s) and extract the company profile information.

Document Content:
{documentText}

Extract the following information in JSON format:
- Company name
- One-liner description
- Primary sector/industry
- Funding stage
- Founded year
- Location/headquarters
- Website URL
- Detailed description
- Social media links (LinkedIn, Twitter, Crunchbase)

Return only valid JSON with the specified structure.`,
      outputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          oneLiner: { type: 'string' },
          sector: { type: 'string' },
          stage: { type: 'string', enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'ipo'] },
          foundedYear: { type: 'number' },
          location: { type: 'string' },
          website: { type: 'string' },
          description: { type: 'string' },
          socialLinks: {
            type: 'object',
            properties: {
              linkedin: { type: 'string' },
              twitter: { type: 'string' },
              crunchbase: { type: 'string' }
            }
          }
        },
        required: ['name', 'oneLiner', 'sector', 'stage', 'foundedYear', 'location']
      },
      requiredVariables: ['documentText'],
      temperature: 0.1,
      maxTokens: 2000
    });

    // Investment metrics extraction template
    this.templates.set('investment_metrics', {
      name: 'investment_metrics',
      description: 'Extract financial and operational metrics',
      systemPrompt: `You are an expert financial analyst specializing in startup metrics extraction.
Extract quantitative metrics from startup documents with high precision.
Pay special attention to revenue figures, growth rates, customer metrics, and team size.
Always include the source context for each metric and confidence level.
Convert all financial figures to USD if currency is specified.`,
      userPromptTemplate: `Analyze the following startup document(s) and extract investment metrics.

Document Content:
{documentText}

Extract the following metrics in JSON format:
- Revenue metrics (ARR, MRR, growth rate, projections, gross margin)
- Traction metrics (customers, growth rate, churn, NPS, active users, conversion rates)
- Team metrics (total size, founders count, key hires, burn rate, runway)
- Funding metrics (total raised, last round details, current ask, valuation)

For each metric, include:
- The actual value
- Confidence level (0-1)
- Source context (brief quote from document)

Return only valid JSON with the specified structure.`,
      outputSchema: {
        type: 'object',
        properties: {
          revenue: {
            type: 'object',
            properties: {
              arr: { type: 'number' },
              mrr: { type: 'number' },
              growthRate: { type: 'number' },
              projectedArr: { type: 'array', items: { type: 'number' } },
              grossMargin: { type: 'number' }
            }
          },
          traction: {
            type: 'object',
            properties: {
              customers: { type: 'number' },
              customerGrowthRate: { type: 'number' },
              churnRate: { type: 'number' },
              nps: { type: 'number' },
              activeUsers: { type: 'number' },
              conversionRate: { type: 'number' }
            }
          },
          team: {
            type: 'object',
            properties: {
              size: { type: 'number' },
              foundersCount: { type: 'number' },
              burnRate: { type: 'number' },
              runway: { type: 'number' }
            },
            required: ['size', 'foundersCount']
          },
          funding: {
            type: 'object',
            properties: {
              totalRaised: { type: 'number' },
              lastRoundSize: { type: 'number' },
              currentAsk: { type: 'number' },
              valuation: { type: 'number' }
            }
          }
        },
        required: ['revenue', 'traction', 'team', 'funding']
      },
      requiredVariables: ['documentText'],
      temperature: 0.1,
      maxTokens: 3000
    });

    // Market claims extraction template
    this.templates.set('market_claims', {
      name: 'market_claims',
      description: 'Extract market size claims and competitive analysis',
      systemPrompt: `You are an expert market analyst specializing in startup market analysis.
Extract market size claims, competitive landscape information, and market positioning from startup documents.
Be critical of market size claims and note any assumptions or methodologies mentioned.
Identify direct and indirect competitors mentioned in the documents.`,
      userPromptTemplate: `Analyze the following startup document(s) and extract market claims and competitive information.

Document Content:
{documentText}

Extract the following information in JSON format:
- Market size claims (TAM, SAM, SOM)
- Market growth rate
- Target market description
- Competitive landscape (direct and indirect competitors)
- Competitive advantages claimed
- Market trends mentioned
- Barriers to entry
- Market opportunities

For market size figures, note the methodology if mentioned.
For competitors, distinguish between direct and indirect competition.

Return only valid JSON with the specified structure.`,
      outputSchema: {
        type: 'object',
        properties: {
          tam: { type: 'number' },
          sam: { type: 'number' },
          som: { type: 'number' },
          marketGrowthRate: { type: 'number' },
          marketDescription: { type: 'string' },
          targetMarket: { type: 'string' },
          competitiveLandscape: { type: 'array', items: { type: 'string' } },
          marketTrends: { type: 'array', items: { type: 'string' } },
          barriers: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } }
        }
      },
      requiredVariables: ['documentText'],
      temperature: 0.2,
      maxTokens: 2500
    });

    // Team assessment template
    this.templates.set('team_assessment', {
      name: 'team_assessment',
      description: 'Extract and assess team information',
      systemPrompt: `You are an expert talent analyst specializing in startup team evaluation.
Extract detailed information about founders, key employees, and advisors.
Focus on relevant experience, education, previous companies, and domain expertise.
Assess the team composition and identify potential gaps or strengths.`,
      userPromptTemplate: `Analyze the following startup document(s) and extract team information.

Document Content:
{documentText}

Extract detailed information about:
- Founders (names, roles, backgrounds, experience, education)
- Key employees (names, roles, backgrounds)
- Advisors (names, expertise, backgrounds)
- Overall team composition and expertise areas

For each person, extract:
- Name and role
- Years of experience
- Previous companies
- Education background
- Specific expertise areas
- LinkedIn profile if mentioned

Return only valid JSON with the specified structure.`,
      outputSchema: {
        type: 'object',
        properties: {
          founders: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                background: { type: 'string' },
                yearsExperience: { type: 'number' },
                education: { type: 'string' },
                previousCompanies: { type: 'array', items: { type: 'string' } },
                expertise: { type: 'array', items: { type: 'string' } },
                linkedinUrl: { type: 'string' }
              },
              required: ['name', 'role']
            }
          },
          keyEmployees: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                background: { type: 'string' },
                expertise: { type: 'array', items: { type: 'string' } }
              },
              required: ['name', 'role']
            }
          },
          advisors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                expertise: { type: 'array', items: { type: 'string' } },
                background: { type: 'string' }
              },
              required: ['name']
            }
          },
          totalSize: { type: 'number' },
          domainExpertise: { type: 'array', items: { type: 'string' } }
        },
        required: ['founders', 'totalSize']
      },
      requiredVariables: ['documentText'],
      temperature: 0.2,
      maxTokens: 3000
    });

    logger.info(`Initialized ${this.templates.size} prompt templates`);
  }

  /**
   * Get a prompt template by name
   */
  getTemplate(name: string): PromptTemplate | null {
    return this.templates.get(name) || null;
  }

  /**
   * Generate a complete analysis prompt from template and context
   */
  generatePrompt(templateName: string, context: AnalysisContext, variables: Record<string, string>): AnalysisPrompt | null {
    const template = this.templates.get(templateName);
    if (!template) {
      logger.error(`Template not found: ${templateName}`);
      return null;
    }

    // Validate required variables
    const missingVariables = template.requiredVariables.filter(variable => !variables[variable]);
    if (missingVariables.length > 0) {
      logger.error(`Missing required variables for template ${templateName}:`, missingVariables);
      return null;
    }

    // Replace variables in user prompt template
    let userPrompt = template.userPromptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    // Add context-specific customizations
    let systemPrompt = template.systemPrompt;
    if (context.companyName) {
      systemPrompt += `\n\nCompany being analyzed: ${context.companyName}`;
    }
    if (context.sector) {
      systemPrompt += `\nSector: ${context.sector}`;
    }
    if (context.stage) {
      systemPrompt += `\nFunding stage: ${context.stage}`;
    }

    // Apply custom prompts if provided
    if (context.customPrompts && context.customPrompts[templateName]) {
      systemPrompt += `\n\nAdditional instructions: ${context.customPrompts[templateName]}`;
    }

    return {
      systemPrompt,
      userPrompt,
      outputSchema: template.outputSchema,
      temperature: template.temperature || 0.1,
      maxTokens: template.maxTokens || 2000
    };
  }

  /**
   * Add or update a custom prompt template
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
    logger.info(`Added/updated prompt template: ${template.name}`);
  }

  /**
   * Get all available template names
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Generate prompts for a complete analysis workflow
   */
  generateAnalysisWorkflow(context: AnalysisContext, documentText: string): AnalysisPrompt[] {
    const prompts: AnalysisPrompt[] = [];
    const variables = { documentText };

    // Standard analysis workflow
    const workflowTemplates = [
      'company_profile',
      'investment_metrics',
      'market_claims',
      'team_assessment'
    ];

    for (const templateName of workflowTemplates) {
      const prompt = this.generatePrompt(templateName, context, variables);
      if (prompt) {
        prompts.push(prompt);
      }
    }

    return prompts;
  }
}