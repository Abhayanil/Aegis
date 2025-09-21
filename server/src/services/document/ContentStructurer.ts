// Content structuring and section identification service
import { DocumentSection, DocumentMetadata } from '../../types/interfaces.js';
import { ProcessedDocument } from '../../models/ProcessedDocument.js';
import { logger } from '../../utils/logger.js';

export interface ContentStructuringOptions {
  enableBusinessDocumentPatterns?: boolean;
  enablePitchDeckPatterns?: boolean;
  enableFinancialDocumentPatterns?: boolean;
  minSectionLength?: number;
  maxSectionTitleLength?: number;
  confidenceThreshold?: number;
  preserveSourceAttribution?: boolean;
}

export interface StructuringResult {
  sections: DocumentSection[];
  metadata: ContentMetadata;
  warnings: string[];
}

export interface ContentMetadata {
  documentType: DocumentType;
  confidence: number;
  totalSections: number;
  averageSectionLength: number;
  identifiedPatterns: string[];
  sourceAttribution: SourceAttribution[];
}

export interface SourceAttribution {
  sectionTitle: string;
  sourceDocument: string;
  pageNumber?: number;
  extractionMethod: 'text' | 'ocr' | 'hybrid';
  confidence: number;
}

export enum DocumentType {
  PITCH_DECK = 'pitch-deck',
  BUSINESS_PLAN = 'business-plan',
  FINANCIAL_REPORT = 'financial-report',
  MEETING_TRANSCRIPT = 'meeting-transcript',
  EMAIL_THREAD = 'email-thread',
  TECHNICAL_DOCUMENT = 'technical-document',
  GENERAL_DOCUMENT = 'general-document',
}

export class ContentStructurer {
  private options: ContentStructuringOptions;
  private businessPatterns: RegExp[];
  private pitchDeckPatterns: RegExp[];
  private financialPatterns: RegExp[];

  constructor(options: ContentStructuringOptions = {}) {
    this.options = {
      enableBusinessDocumentPatterns: true,
      enablePitchDeckPatterns: true,
      enableFinancialDocumentPatterns: true,
      minSectionLength: 50,
      maxSectionTitleLength: 100,
      confidenceThreshold: 0.6,
      preserveSourceAttribution: true,
      ...options,
    };

    this.initializePatterns();
  }

  /**
   * Structures content from processed documents
   */
  async structureContent(
    documents: ProcessedDocument[],
    options?: Partial<ContentStructuringOptions>
  ): Promise<StructuringResult> {
    const opts = { ...this.options, ...options };
    const warnings: string[] = [];

    try {
      logger.info(`Starting content structuring for ${documents.length} documents`);

      // Combine all sections from documents
      const allSections = documents.flatMap(doc => doc.sections);
      
      // Detect document type
      const documentType = this.detectDocumentType(documents);
      logger.info(`Detected document type: ${documentType}`);

      // Apply document-type specific structuring
      let structuredSections: DocumentSection[];
      
      switch (documentType) {
        case DocumentType.PITCH_DECK:
          structuredSections = this.structurePitchDeck(allSections);
          break;
        case DocumentType.BUSINESS_PLAN:
          structuredSections = this.structureBusinessPlan(allSections);
          break;
        case DocumentType.FINANCIAL_REPORT:
          structuredSections = this.structureFinancialReport(allSections);
          break;
        case DocumentType.MEETING_TRANSCRIPT:
          structuredSections = this.structureMeetingTranscript(allSections);
          break;
        case DocumentType.EMAIL_THREAD:
          structuredSections = this.structureEmailThread(allSections);
          break;
        default:
          structuredSections = this.structureGenericDocument(allSections);
      }

      // Filter sections by minimum length
      const filteredSections = structuredSections.filter(section => 
        section.content.length >= (opts.minSectionLength || this.options.minSectionLength!)
      );

      if (filteredSections.length < structuredSections.length) {
        warnings.push(`Filtered out ${structuredSections.length - filteredSections.length} sections below minimum length`);
      }

      // Create source attribution
      const sourceAttribution = this.createSourceAttribution(filteredSections, documents);

      // Calculate metadata
      const metadata: ContentMetadata = {
        documentType,
        confidence: this.calculateStructuringConfidence(filteredSections, documentType),
        totalSections: filteredSections.length,
        averageSectionLength: filteredSections.length > 0 
          ? filteredSections.reduce((sum, s) => sum + s.content.length, 0) / filteredSections.length
          : 0,
        identifiedPatterns: this.getIdentifiedPatterns(filteredSections, documentType),
        sourceAttribution,
      };

      logger.info(`Content structuring completed: ${filteredSections.length} sections identified`);

      return {
        sections: filteredSections,
        metadata,
        warnings,
      };

    } catch (error) {
      logger.error('Content structuring failed:', error);
      throw new Error(`Content structuring failed: ${error.message}`);
    }
  }

  /**
   * Detects the type of document based on content patterns
   */
  private detectDocumentType(documents: ProcessedDocument[]): DocumentType {
    const allText = documents.map(doc => doc.extractedText).join(' ').toLowerCase();
    const allSections = documents.flatMap(doc => doc.sections);
    const sectionTitles = allSections.map(s => s.title.toLowerCase());

    // Check for pitch deck patterns
    const pitchDeckIndicators = [
      'problem', 'solution', 'market size', 'business model', 'traction',
      'team', 'funding', 'competition', 'go-to-market', 'financial projections'
    ];
    const pitchDeckMatches = pitchDeckIndicators.filter(indicator => 
      sectionTitles.some(title => title.includes(indicator)) || allText.includes(indicator)
    ).length;

    if (pitchDeckMatches >= 4) {
      return DocumentType.PITCH_DECK;
    }

    // Check for business plan patterns
    const businessPlanIndicators = [
      'executive summary', 'company description', 'market analysis',
      'organization management', 'service line', 'marketing sales',
      'funding request', 'financial projections', 'appendix'
    ];
    const businessPlanMatches = businessPlanIndicators.filter(indicator =>
      sectionTitles.some(title => title.includes(indicator)) || allText.includes(indicator)
    ).length;

    if (businessPlanMatches >= 4) {
      return DocumentType.BUSINESS_PLAN;
    }

    // Check for financial report patterns
    const financialIndicators = [
      'revenue', 'profit', 'loss', 'balance sheet', 'cash flow',
      'income statement', 'assets', 'liabilities', 'equity'
    ];
    const financialMatches = financialIndicators.filter(indicator =>
      allText.includes(indicator)
    ).length;

    if (financialMatches >= 3) {
      return DocumentType.FINANCIAL_REPORT;
    }

    // Check for meeting transcript patterns (more specific)
    const transcriptPatterns = [
      /\b\w+:\s+[A-Z]/.test(allText), // Speaker: Text pattern
      allText.includes('transcript'),
      sectionTitles.some(title => title.includes(':')), // Speaker sections
    ];
    const transcriptMatches = transcriptPatterns.filter(Boolean).length;
    
    if (transcriptMatches >= 2) {
      return DocumentType.MEETING_TRANSCRIPT;
    }

    // Check for email patterns
    if (allText.includes('from:') || allText.includes('to:') || 
        allText.includes('subject:') || allText.includes('sent:')) {
      return DocumentType.EMAIL_THREAD;
    }

    return DocumentType.GENERAL_DOCUMENT;
  }

  /**
   * Structures pitch deck content
   */
  private structurePitchDeck(sections: DocumentSection[]): DocumentSection[] {
    const pitchDeckOrder = [
      'title', 'problem', 'solution', 'market', 'product', 'traction',
      'business model', 'competition', 'team', 'financials', 'funding', 'appendix'
    ];

    const structuredSections: DocumentSection[] = [];
    const usedSections = new Set<number>();

    // First pass: match sections to standard pitch deck structure
    for (const expectedSection of pitchDeckOrder) {
      for (let i = 0; i < sections.length; i++) {
        if (usedSections.has(i)) continue;

        const section = sections[i];
        if (this.matchesPitchDeckSection(section.title, expectedSection)) {
          structuredSections.push({
            ...section,
            title: this.standardizePitchDeckTitle(expectedSection),
            confidence: Math.max(section.confidence || 0.5, 0.8),
          });
          usedSections.add(i);
          break;
        }
      }
    }

    // Second pass: add remaining sections
    for (let i = 0; i < sections.length; i++) {
      if (!usedSections.has(i)) {
        structuredSections.push(sections[i]);
      }
    }

    return structuredSections;
  }

  /**
   * Structures business plan content
   */
  private structureBusinessPlan(sections: DocumentSection[]): DocumentSection[] {
    const businessPlanOrder = [
      'executive summary', 'company description', 'market analysis',
      'organization management', 'service line', 'marketing sales',
      'funding request', 'financial projections', 'appendix'
    ];

    return this.reorderSectionsByPattern(sections, businessPlanOrder);
  }

  /**
   * Structures financial report content
   */
  private structureFinancialReport(sections: DocumentSection[]): DocumentSection[] {
    const financialOrder = [
      'summary', 'income statement', 'balance sheet', 'cash flow',
      'notes', 'analysis', 'appendix'
    ];

    return this.reorderSectionsByPattern(sections, financialOrder);
  }

  /**
   * Structures meeting transcript content
   */
  private structureMeetingTranscript(sections: DocumentSection[]): DocumentSection[] {
    // For transcripts, maintain chronological order but group by speaker
    const speakerSections: { [speaker: string]: DocumentSection[] } = {};
    const otherSections: DocumentSection[] = [];

    for (const section of sections) {
      const speakerMatch = section.title.match(/^([^:]+):/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        if (!speakerSections[speaker]) {
          speakerSections[speaker] = [];
        }
        speakerSections[speaker].push(section);
      } else {
        otherSections.push(section);
      }
    }

    // Combine speaker sections
    const structuredSections: DocumentSection[] = [];
    
    // Add non-speaker sections first (agenda, etc.)
    structuredSections.push(...otherSections);

    // Add speaker sections
    for (const [speaker, speakerSectionList] of Object.entries(speakerSections)) {
      if (speakerSectionList.length > 1) {
        // Combine multiple sections from same speaker
        const combinedContent = speakerSectionList.map(s => s.content).join('\n\n');
        structuredSections.push({
          title: `${speaker} (Combined)`,
          content: combinedContent,
          sourceDocument: speakerSectionList[0].sourceDocument,
          confidence: 0.9,
        });
      } else {
        structuredSections.push(...speakerSectionList);
      }
    }

    return structuredSections;
  }

  /**
   * Structures email thread content
   */
  private structureEmailThread(sections: DocumentSection[]): DocumentSection[] {
    // Sort by timestamp if available, otherwise maintain order
    return sections.sort((a, b) => {
      // Try to extract timestamps from titles or content
      const timestampA = this.extractTimestamp(a.title + ' ' + a.content);
      const timestampB = this.extractTimestamp(b.title + ' ' + b.content);
      
      if (timestampA && timestampB) {
        return timestampA.getTime() - timestampB.getTime();
      }
      
      return 0; // Maintain original order if no timestamps
    });
  }

  /**
   * Structures generic document content
   */
  private structureGenericDocument(sections: DocumentSection[]): DocumentSection[] {
    // For generic documents, improve section titles and merge related sections
    const improvedSections: DocumentSection[] = [];
    
    for (const section of sections) {
      const improvedTitle = this.improveSectionTitle(section.title);
      improvedSections.push({
        ...section,
        title: improvedTitle,
      });
    }

    return this.mergeRelatedSections(improvedSections);
  }

  /**
   * Matches section title to pitch deck section
   */
  private matchesPitchDeckSection(title: string, expectedSection: string): boolean {
    const titleLower = title.toLowerCase();
    const expectedLower = expectedSection.toLowerCase();

    // Direct match
    if (titleLower.includes(expectedLower)) return true;

    // Pattern-based matching
    const patterns: { [key: string]: string[] } = {
      'problem': ['challenge', 'issue', 'pain point'],
      'solution': ['approach', 'our solution', 'how we solve'],
      'market': ['market size', 'tam', 'addressable market', 'opportunity'],
      'product': ['our product', 'platform', 'technology'],
      'traction': ['growth', 'metrics', 'progress', 'milestones'],
      'business model': ['revenue model', 'monetization', 'how we make money'],
      'competition': ['competitive landscape', 'competitors', 'alternatives'],
      'team': ['our team', 'founders', 'leadership'],
      'financials': ['financial projections', 'projections', 'forecast'],
      'funding': ['investment', 'raise', 'capital', 'funding ask'],
    };

    const synonyms = patterns[expectedLower] || [];
    return synonyms.some(synonym => titleLower.includes(synonym));
  }

  /**
   * Standardizes pitch deck section titles
   */
  private standardizePitchDeckTitle(section: string): string {
    const standardTitles: { [key: string]: string } = {
      'title': 'Company Overview',
      'problem': 'Problem Statement',
      'solution': 'Our Solution',
      'market': 'Market Opportunity',
      'product': 'Product Overview',
      'traction': 'Traction & Metrics',
      'business model': 'Business Model',
      'competition': 'Competitive Analysis',
      'team': 'Team',
      'financials': 'Financial Projections',
      'funding': 'Funding Request',
      'appendix': 'Appendix',
    };

    return standardTitles[section] || section.charAt(0).toUpperCase() + section.slice(1);
  }

  /**
   * Reorders sections based on expected pattern
   */
  private reorderSectionsByPattern(sections: DocumentSection[], pattern: string[]): DocumentSection[] {
    const reordered: DocumentSection[] = [];
    const used = new Set<number>();

    for (const expectedSection of pattern) {
      for (let i = 0; i < sections.length; i++) {
        if (used.has(i)) continue;
        
        if (sections[i].title.toLowerCase().includes(expectedSection.toLowerCase())) {
          reordered.push(sections[i]);
          used.add(i);
          break;
        }
      }
    }

    // Add remaining sections
    for (let i = 0; i < sections.length; i++) {
      if (!used.has(i)) {
        reordered.push(sections[i]);
      }
    }

    return reordered;
  }

  /**
   * Improves section titles for better readability
   */
  private improveSectionTitle(title: string): string {
    // Remove excessive whitespace
    let improved = title.trim().replace(/\s+/g, ' ');

    // Capitalize first letter of each word for titles
    if (improved.length < 50) {
      improved = improved.replace(/\b\w/g, l => l.toUpperCase());
    }

    // Remove common prefixes
    improved = improved.replace(/^(section|chapter|part)\s+\d+:?\s*/i, '');

    return improved;
  }

  /**
   * Merges related sections based on content similarity
   */
  private mergeRelatedSections(sections: DocumentSection[]): DocumentSection[] {
    // Simple implementation - merge sections with very similar titles
    const merged: DocumentSection[] = [];
    const used = new Set<number>();

    for (let i = 0; i < sections.length; i++) {
      if (used.has(i)) continue;

      const currentSection = sections[i];
      const relatedSections = [currentSection];
      used.add(i);

      // Look for similar sections
      for (let j = i + 1; j < sections.length; j++) {
        if (used.has(j)) continue;

        if (this.areSectionsSimilar(currentSection.title, sections[j].title)) {
          relatedSections.push(sections[j]);
          used.add(j);
        }
      }

      if (relatedSections.length > 1) {
        // Merge sections
        const combinedContent = relatedSections.map(s => s.content).join('\n\n');
        merged.push({
          title: currentSection.title,
          content: combinedContent,
          sourceDocument: currentSection.sourceDocument,
          confidence: Math.max(...relatedSections.map(s => s.confidence || 0.5)),
        });
      } else {
        merged.push(currentSection);
      }
    }

    return merged;
  }

  /**
   * Checks if two section titles are similar
   */
  private areSectionsSimilar(title1: string, title2: string): boolean {
    const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '');
    const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '');

    // Simple similarity check - same first few words
    const words1 = t1.split(/\s+/).slice(0, 3);
    const words2 = t2.split(/\s+/).slice(0, 3);

    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length >= 2;
  }

  /**
   * Extracts timestamp from text
   */
  private extractTimestamp(text: string): Date | null {
    // Simple timestamp extraction - can be enhanced
    const patterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{2}-\d{2}/,
      /\w+ \d{1,2}, \d{4}/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Creates source attribution for sections
   */
  private createSourceAttribution(
    sections: DocumentSection[], 
    documents: ProcessedDocument[]
  ): SourceAttribution[] {
    return sections.map(section => ({
      sectionTitle: section.title,
      sourceDocument: section.sourceDocument,
      pageNumber: section.pageNumber,
      extractionMethod: this.getExtractionMethod(section, documents),
      confidence: section.confidence || 0.5,
    }));
  }

  /**
   * Gets extraction method for a section
   */
  private getExtractionMethod(
    section: DocumentSection, 
    documents: ProcessedDocument[]
  ): 'text' | 'ocr' | 'hybrid' {
    const sourceDoc = documents.find(doc => 
      doc.metadata.filename === section.sourceDocument
    );
    
    return sourceDoc?.extractionMethod || 'text';
  }

  /**
   * Calculates confidence score for structuring
   */
  private calculateStructuringConfidence(
    sections: DocumentSection[], 
    documentType: DocumentType
  ): number {
    if (sections.length === 0) return 0;

    const avgSectionConfidence = sections.reduce((sum, s) => 
      sum + (s.confidence || 0.5), 0
    ) / sections.length;

    // Boost confidence for well-structured document types
    const typeBoost = documentType === DocumentType.GENERAL_DOCUMENT ? 0 : 0.1;

    return Math.min(avgSectionConfidence + typeBoost, 1.0);
  }

  /**
   * Gets identified patterns for the document type
   */
  private getIdentifiedPatterns(
    sections: DocumentSection[], 
    documentType: DocumentType
  ): string[] {
    const patterns: string[] = [];

    switch (documentType) {
      case DocumentType.PITCH_DECK:
        patterns.push('pitch-deck-structure');
        break;
      case DocumentType.BUSINESS_PLAN:
        patterns.push('business-plan-structure');
        break;
      case DocumentType.FINANCIAL_REPORT:
        patterns.push('financial-report-structure');
        break;
      case DocumentType.MEETING_TRANSCRIPT:
        patterns.push('speaker-identification');
        break;
      case DocumentType.EMAIL_THREAD:
        patterns.push('chronological-ordering');
        break;
    }

    // Add additional patterns based on content
    const allTitles = sections.map(s => s.title.toLowerCase()).join(' ');
    
    if (allTitles.includes('executive summary')) {
      patterns.push('executive-summary');
    }
    
    if (allTitles.includes('financial') || allTitles.includes('revenue')) {
      patterns.push('financial-content');
    }

    return patterns;
  }

  /**
   * Initializes pattern matching regular expressions
   */
  private initializePatterns(): void {
    this.businessPatterns = [
      /executive\s+summary/i,
      /business\s+model/i,
      /market\s+analysis/i,
      /financial\s+projections/i,
    ];

    this.pitchDeckPatterns = [
      /problem\s+statement/i,
      /solution/i,
      /market\s+opportunity/i,
      /traction/i,
      /team/i,
      /funding/i,
    ];

    this.financialPatterns = [
      /income\s+statement/i,
      /balance\s+sheet/i,
      /cash\s+flow/i,
      /revenue/i,
      /profit/i,
      /loss/i,
    ];
  }
}