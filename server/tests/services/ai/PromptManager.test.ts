// Unit tests for PromptManager
import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from '../../../src/services/ai/PromptManager.js';
import { AnalysisContext } from '../../../src/types/interfaces.js';
import { AnalysisType, FundingStage } from '../../../src/types/enums.js';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('Template Management', () => {
    it('should initialize with default templates', () => {
      const templates = promptManager.getAvailableTemplates();
      expect(templates).toContain('company_profile');
      expect(templates).toContain('investment_metrics');
      expect(templates).toContain('market_claims');
      expect(templates).toContain('team_assessment');
      expect(templates.length).toBeGreaterThanOrEqual(4);
    });

    it('should retrieve template by name', () => {
      const template = promptManager.getTemplate('company_profile');
      expect(template).toBeDefined();
      expect(template?.name).toBe('company_profile');
      expect(template?.systemPrompt).toContain('investment analyst');
      expect(template?.requiredVariables).toContain('documentText');
    });

    it('should return null for non-existent template', () => {
      const template = promptManager.getTemplate('non_existent');
      expect(template).toBeNull();
    });

    it('should add custom template', () => {
      const customTemplate = {
        name: 'custom_test',
        description: 'Test template',
        systemPrompt: 'Test system prompt',
        userPromptTemplate: 'Test user prompt with {variable}',
        requiredVariables: ['variable'],
        temperature: 0.5,
        maxTokens: 1000,
      };

      promptManager.addTemplate(customTemplate);
      const retrieved = promptManager.getTemplate('custom_test');
      expect(retrieved).toEqual(customTemplate);
    });
  });

  describe('Prompt Generation', () => {
    it('should generate prompt with basic context', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
      };
      const variables = {
        documentText: 'Sample document content for testing',
      };

      const prompt = promptManager.generatePrompt('company_profile', context, variables);
      
      expect(prompt).toBeDefined();
      expect(prompt?.systemPrompt).toContain('investment analyst');
      expect(prompt?.userPrompt).toContain('Sample document content for testing');
      expect(prompt?.temperature).toBe(0.1);
      expect(prompt?.outputSchema).toBeDefined();
    });

    it('should generate prompt with company context', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
        companyName: 'TestCorp',
        sector: 'SaaS',
        stage: FundingStage.SEED,
      };
      const variables = {
        documentText: 'Sample document content',
      };

      const prompt = promptManager.generatePrompt('company_profile', context, variables);
      
      expect(prompt?.systemPrompt).toContain('TestCorp');
      expect(prompt?.systemPrompt).toContain('SaaS');
      expect(prompt?.systemPrompt).toContain('seed');
    });

    it('should apply custom prompts from context', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
        customPrompts: {
          company_profile: 'Focus on technical aspects',
        },
      };
      const variables = {
        documentText: 'Sample document content',
      };

      const prompt = promptManager.generatePrompt('company_profile', context, variables);
      
      expect(prompt?.systemPrompt).toContain('Focus on technical aspects');
    });

    it('should return null for missing template', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
      };
      const variables = {
        documentText: 'Sample document content',
      };

      const prompt = promptManager.generatePrompt('non_existent', context, variables);
      expect(prompt).toBeNull();
    });

    it('should return null for missing required variables', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
      };
      const variables = {}; // Missing documentText

      const prompt = promptManager.generatePrompt('company_profile', context, variables);
      expect(prompt).toBeNull();
    });

    it('should replace multiple variables in template', () => {
      const customTemplate = {
        name: 'multi_variable_test',
        description: 'Test template with multiple variables',
        systemPrompt: 'System prompt',
        userPromptTemplate: 'Analyze {documentText} for company {companyName} in {sector}',
        requiredVariables: ['documentText', 'companyName', 'sector'],
      };

      promptManager.addTemplate(customTemplate);

      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
      };
      const variables = {
        documentText: 'sample text',
        companyName: 'TestCorp',
        sector: 'fintech',
      };

      const prompt = promptManager.generatePrompt('multi_variable_test', context, variables);
      
      expect(prompt?.userPrompt).toBe('Analyze sample text for company TestCorp in fintech');
    });
  });

  describe('Analysis Workflow', () => {
    it('should generate complete analysis workflow', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
        companyName: 'TestCorp',
      };
      const documentText = 'Sample startup pitch deck content';

      const prompts = promptManager.generateAnalysisWorkflow(context, documentText);
      
      expect(prompts).toHaveLength(4);
      expect(prompts[0].userPrompt).toContain(documentText);
      expect(prompts[1].userPrompt).toContain(documentText);
      expect(prompts[2].userPrompt).toContain(documentText);
      expect(prompts[3].userPrompt).toContain(documentText);
    });

    it('should handle empty document text', () => {
      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
      };
      const documentText = '';

      const prompts = promptManager.generateAnalysisWorkflow(context, documentText);
      
      // Empty document text should still generate prompts, but they may fail validation
      // The workflow should return empty array when required variables are missing
      expect(prompts).toHaveLength(0);
    });
  });

  describe('Template Validation', () => {
    it('should validate company profile template schema', () => {
      const template = promptManager.getTemplate('company_profile');
      expect(template?.outputSchema).toBeDefined();
      expect(template?.outputSchema?.properties).toHaveProperty('name');
      expect(template?.outputSchema?.properties).toHaveProperty('oneLiner');
      expect(template?.outputSchema?.properties).toHaveProperty('sector');
      expect(template?.outputSchema?.required).toContain('name');
    });

    it('should validate investment metrics template schema', () => {
      const template = promptManager.getTemplate('investment_metrics');
      expect(template?.outputSchema).toBeDefined();
      expect(template?.outputSchema?.properties).toHaveProperty('revenue');
      expect(template?.outputSchema?.properties).toHaveProperty('traction');
      expect(template?.outputSchema?.properties).toHaveProperty('team');
      expect(template?.outputSchema?.properties).toHaveProperty('funding');
    });

    it('should validate market claims template schema', () => {
      const template = promptManager.getTemplate('market_claims');
      expect(template?.outputSchema).toBeDefined();
      expect(template?.outputSchema?.properties).toHaveProperty('tam');
      expect(template?.outputSchema?.properties).toHaveProperty('competitiveLandscape');
      expect(template?.outputSchema?.properties).toHaveProperty('marketTrends');
    });

    it('should validate team assessment template schema', () => {
      const template = promptManager.getTemplate('team_assessment');
      expect(template?.outputSchema).toBeDefined();
      expect(template?.outputSchema?.properties).toHaveProperty('founders');
      expect(template?.outputSchema?.properties).toHaveProperty('totalSize');
      expect(template?.outputSchema?.required).toContain('founders');
    });
  });

  describe('Template Configuration', () => {
    it('should have appropriate temperature settings', () => {
      const companyTemplate = promptManager.getTemplate('company_profile');
      const metricsTemplate = promptManager.getTemplate('investment_metrics');
      
      expect(companyTemplate?.temperature).toBe(0.1);
      expect(metricsTemplate?.temperature).toBe(0.1);
    });

    it('should have reasonable token limits', () => {
      const templates = promptManager.getAvailableTemplates();
      
      templates.forEach(templateName => {
        const template = promptManager.getTemplate(templateName);
        expect(template?.maxTokens).toBeGreaterThan(1000);
        expect(template?.maxTokens).toBeLessThanOrEqual(5000);
      });
    });

    it('should have all required variables defined', () => {
      const templates = promptManager.getAvailableTemplates();
      
      templates.forEach(templateName => {
        const template = promptManager.getTemplate(templateName);
        expect(template?.requiredVariables).toBeDefined();
        expect(template?.requiredVariables.length).toBeGreaterThan(0);
      });
    });
  });
});