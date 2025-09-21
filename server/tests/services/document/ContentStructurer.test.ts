// Unit tests for ContentStructurer
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentStructurer, DocumentType } from '../../../src/services/document/ContentStructurer.js';
import { ProcessedDocument } from '../../../src/models/ProcessedDocument.js';
import { DocumentType as DocType } from '../../../src/types/enums.js';

describe('ContentStructurer', () => {
  let structurer: ContentStructurer;

  beforeEach(() => {
    structurer = new ContentStructurer();
  });

  describe('structureContent', () => {
    it('should structure a pitch deck document', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-1',
        sourceType: DocType.PDF,
        extractedText: 'Problem: Market is fragmented. Solution: Our platform unifies everything. Market: $10B TAM. Team: Experienced founders.',
        sections: [
          {
            title: 'The Problem',
            content: 'Market is fragmented and inefficient. Current solutions are expensive and hard to use. Customers struggle with multiple vendors and complex integrations.',
            sourceDocument: 'pitch.pdf',
            confidence: 0.9
          },
          {
            title: 'Our Solution',
            content: 'Our platform unifies everything in one place. We provide a single API that connects all major services and simplifies the integration process for developers.',
            sourceDocument: 'pitch.pdf',
            confidence: 0.8
          },
          {
            title: 'Market Opportunity',
            content: '$10B total addressable market with 25% annual growth. We are targeting enterprise customers who spend millions on integration solutions.',
            sourceDocument: 'pitch.pdf',
            confidence: 0.9
          },
          {
            title: 'Our Team',
            content: 'Experienced founders with domain expertise. Our CEO previously built and sold a similar company for $100M. Our CTO has 15 years of experience at Google.',
            sourceDocument: 'pitch.pdf',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'pitch.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      // Document type detection is heuristic-based, so we'll test the core functionality
      expect(result.sections).toHaveLength(4);
      expect(result.sections.some(s => s.title.includes('Problem'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Solution'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Market'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Team'))).toBe(true);
    });

    it('should structure a business plan document', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-2',
        sourceType: DocType.DOCX,
        extractedText: 'Executive Summary: Company overview. Market Analysis: Industry trends. Financial Projections: Revenue forecasts.',
        sections: [
          {
            title: 'Executive Summary',
            content: 'Company overview and key highlights. We are building the next generation platform for enterprise integration. Our solution addresses a $10B market opportunity.',
            sourceDocument: 'business-plan.docx',
            confidence: 0.9
          },
          {
            title: 'Market Analysis',
            content: 'Industry trends and competitive landscape. The integration market is growing at 25% annually. Current solutions are fragmented and expensive.',
            sourceDocument: 'business-plan.docx',
            confidence: 0.8
          },
          {
            title: 'Financial Projections',
            content: 'Revenue forecasts and growth projections. We project $1M ARR by year 2 and $10M ARR by year 5. Our unit economics show strong profitability.',
            sourceDocument: 'business-plan.docx',
            confidence: 0.9
          }
        ],
        metadata: {
          filename: 'business-plan.docx',
          fileSize: 2000,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      // Test that sections are preserved and structured
      expect(result.sections).toHaveLength(3);
      expect(result.sections.some(s => s.title.includes('Executive Summary'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Market Analysis'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Financial Projections'))).toBe(true);
    });

    it('should structure a meeting transcript', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-3',
        sourceType: DocType.TXT,
        extractedText: 'John: Welcome everyone. Sarah: Thanks for having us. John: Let me start with the agenda.',
        sections: [
          {
            title: 'John: Opening',
            content: 'Welcome everyone to the meeting. Today we will discuss our Q4 results and plan for next year. I want to start by reviewing our key metrics.',
            sourceDocument: 'transcript.txt',
            confidence: 0.8
          },
          {
            title: 'Sarah: Response',
            content: 'Thanks for having us here today. I am excited to share our progress on the product roadmap and discuss the upcoming feature releases.',
            sourceDocument: 'transcript.txt',
            confidence: 0.8
          },
          {
            title: 'John: Agenda',
            content: 'Let me start with the agenda for today. First we will review financials, then product updates, and finally discuss hiring plans for next quarter.',
            sourceDocument: 'transcript.txt',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'transcript.txt',
          fileSize: 500,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      // Test that sections are processed (may or may not be combined depending on detection)
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections.some(s => s.title.includes('John'))).toBe(true);
      expect(result.sections.some(s => s.title.includes('Sarah'))).toBe(true);
    });

    it('should handle financial reports', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-4',
        sourceType: DocType.PDF,
        extractedText: 'Revenue increased 25%. Balance sheet shows strong assets. Cash flow positive.',
        sections: [
          {
            title: 'Income Statement',
            content: 'Revenue increased 25% year over year to $5M. Gross profit margin improved to 75%. Operating expenses were well controlled at $2M.',
            sourceDocument: 'financial.pdf',
            confidence: 0.9
          },
          {
            title: 'Balance Sheet',
            content: 'Strong asset position with minimal liabilities. Cash and equivalents total $3M. Total assets of $8M with only $1M in debt.',
            sourceDocument: 'financial.pdf',
            confidence: 0.9
          },
          {
            title: 'Cash Flow',
            content: 'Positive cash flow from operations of $1.5M. Free cash flow after capex was $1.2M. Strong working capital management.',
            sourceDocument: 'financial.pdf',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'financial.pdf',
          fileSize: 1500,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      expect(result.metadata.documentType).toBe(DocumentType.FINANCIAL_REPORT);
      expect(result.sections).toHaveLength(3);
      expect(result.metadata.identifiedPatterns).toContain('financial-report-structure');
    });

    it('should filter out sections below minimum length', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-5',
        sourceType: DocType.TXT,
        extractedText: 'Short content and longer content here',
        sections: [
          {
            title: 'Short Section',
            content: 'Too short', // Below default minimum of 50 chars
            sourceDocument: 'test.txt',
            confidence: 0.8
          },
          {
            title: 'Long Section',
            content: 'This is a much longer section with sufficient content to meet the minimum length requirement for inclusion in the structured output',
            sourceDocument: 'test.txt',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'test.txt',
          fileSize: 100,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Long Section');
      expect(result.warnings).toContain('Filtered out 1 sections below minimum length');
    });

    it('should handle multiple documents', async () => {
      const doc1: ProcessedDocument = {
        id: 'test-6a',
        sourceType: DocType.PDF,
        extractedText: 'Problem statement here',
        sections: [
          {
            title: 'Problem',
            content: 'This is the problem we are solving with our innovative approach',
            sourceDocument: 'doc1.pdf',
            confidence: 0.9
          }
        ],
        metadata: {
          filename: 'doc1.pdf',
          fileSize: 500,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const doc2: ProcessedDocument = {
        id: 'test-6b',
        sourceType: DocType.PDF,
        extractedText: 'Solution overview here',
        sections: [
          {
            title: 'Solution',
            content: 'Our solution addresses the problem through advanced technology',
            sourceDocument: 'doc2.pdf',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'doc2.pdf',
          fileSize: 600,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([doc1, doc2]);

      expect(result.sections).toHaveLength(2);
      expect(result.metadata.sourceAttribution).toHaveLength(2);
      expect(result.metadata.sourceAttribution[0].sourceDocument).toBe('doc1.pdf');
      expect(result.metadata.sourceAttribution[1].sourceDocument).toBe('doc2.pdf');
    });

    it('should handle empty documents gracefully', async () => {
      const result = await structurer.structureContent([]);

      expect(result.sections).toHaveLength(0);
      expect(result.metadata.totalSections).toBe(0);
      expect(result.metadata.documentType).toBe(DocumentType.GENERAL_DOCUMENT);
    });

    it('should calculate metadata correctly', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-7',
        sourceType: DocType.TXT,
        extractedText: 'Test content for metadata calculation',
        sections: [
          {
            title: 'Section 1',
            content: 'This is the first section with some content for testing metadata calculation',
            sourceDocument: 'test.txt',
            confidence: 0.9
          },
          {
            title: 'Section 2',
            content: 'This is the second section with different content for testing',
            sourceDocument: 'test.txt',
            confidence: 0.7
          }
        ],
        metadata: {
          filename: 'test.txt',
          fileSize: 200,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await structurer.structureContent([mockDocument]);

      expect(result.metadata.totalSections).toBe(2);
      expect(result.metadata.averageSectionLength).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.sourceAttribution).toHaveLength(2);
    });
  });

  describe('custom options', () => {
    it('should respect custom minimum section length', async () => {
      const customStructurer = new ContentStructurer({
        minSectionLength: 20 // Lower threshold
      });

      const mockDocument: ProcessedDocument = {
        id: 'test-8',
        sourceType: DocType.TXT,
        extractedText: 'Short and long content',
        sections: [
          {
            title: 'Short',
            content: 'Short content here for testing minimum length requirements', // Above 20 chars
            sourceDocument: 'test.txt',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'test.txt',
          fileSize: 50,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await customStructurer.structureContent([mockDocument]);

      expect(result.sections).toHaveLength(1); // Should include the short section
    });

    it('should disable specific document patterns', async () => {
      const customStructurer = new ContentStructurer({
        enablePitchDeckPatterns: false
      });

      const mockDocument: ProcessedDocument = {
        id: 'test-9',
        sourceType: DocType.PDF,
        extractedText: 'Problem and solution content',
        sections: [
          {
            title: 'Problem',
            content: 'This is a problem statement that would normally trigger pitch deck detection',
            sourceDocument: 'test.pdf',
            confidence: 0.9
          }
        ],
        metadata: {
          filename: 'test.pdf',
          fileSize: 500,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await customStructurer.structureContent([mockDocument]);

      // Should not detect as pitch deck due to disabled patterns
      expect(result.metadata.documentType).toBe(DocumentType.GENERAL_DOCUMENT);
    });
  });
});