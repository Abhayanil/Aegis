# Requirements Document

## Introduction

The AI Deal Memo Generation feature is the core capability of Aegis that transforms unstructured startup data into structured, actionable investment analysis. This system ingests multiple data sources (pitch decks, call transcripts, founder updates, emails), performs sector benchmarking, identifies risk indicators, and generates comprehensive deal memos with customizable investment weightings. The feature leverages Google AI technologies to provide venture capital firms with consistent, data-driven investment recommendations.

## Requirements

### Requirement 1

**User Story:** As an investment analyst, I want to upload and process multiple document types (pitch decks, call transcripts, founder updates, emails) so that I can extract key investment signals from all available startup data.

#### Acceptance Criteria

1. WHEN a user uploads a PDF pitch deck THEN the system SHALL extract text content and identify key sections (value proposition, market size, traction metrics, team, funding ask)
2. WHEN a user uploads a PowerPoint file THEN the system SHALL convert slides to text and preserve slide structure for context
3. WHEN a user uploads call transcripts THEN the system SHALL parse speaker segments and extract founder responses to key questions
4. WHEN a user uploads founder emails or updates THEN the system SHALL identify KPI mentions, progress updates, and timeline commitments
5. IF any document fails to process THEN the system SHALL provide specific error messages and continue processing other documents
6. WHEN multiple documents are uploaded THEN the system SHALL maintain document source attribution for all extracted data points

### Requirement 2

**User Story:** As an investment analyst, I want the system to benchmark startups against sector peers using financial and operational metrics so that I can understand relative performance and market positioning.

#### Acceptance Criteria

1. WHEN startup metrics are extracted THEN the system SHALL query BigQuery for comparable companies in the same sector
2. WHEN sector data is available THEN the system SHALL calculate percentile rankings for key metrics (ARR growth, revenue multiples, team size, funding velocity)
3. WHEN benchmarking is complete THEN the system SHALL identify metrics where the startup significantly outperforms or underperforms sector medians
4. IF sector data is insufficient THEN the system SHALL flag limited benchmark availability and use broader market comparisons
5. WHEN team analysis is requested THEN the system SHALL evaluate founder backgrounds against successful exits in similar sectors

### Requirement 3

**User Story:** As an investment analyst, I want the system to automatically flag potential risk indicators and inconsistencies so that I can identify due diligence priorities before meetings.

#### Acceptance Criteria

1. WHEN processing multiple data sources THEN the system SHALL cross-reference metrics for consistency (e.g., ARR mentioned in deck vs. call transcript)
2. WHEN market size claims are made THEN the system SHALL validate TAM/SAM calculations against known market research
3. WHEN churn or retention metrics are provided THEN the system SHALL flag unusual patterns or missing cohort data
4. WHEN competitive claims are made THEN the system SHALL identify potential blind spots or overlooked competitors
5. WHEN financial projections are analyzed THEN the system SHALL flag unrealistic growth assumptions or unit economics
6. IF critical inconsistencies are found THEN the system SHALL categorize risks as high, medium, or low priority with specific descriptions

### Requirement 4

**User Story:** As an investment analyst, I want to receive structured deal memos with growth potential analysis and investment recommendations so that I can make informed investment decisions efficiently.

#### Acceptance Criteria

1. WHEN analysis is complete THEN the system SHALL generate a structured JSON deal memo following the specified schema
2. WHEN calculating signal scores THEN the system SHALL apply configurable weightings for market opportunity, team, traction, product, and competitive moat
3. WHEN generating recommendations THEN the system SHALL provide clear rationale linking data points to investment thesis
4. WHEN identifying growth potential THEN the system SHALL outline specific drivers and realistic timeline to scale
5. WHEN creating due diligence questions THEN the system SHALL prioritize areas with highest risk or uncertainty
6. IF data is insufficient for confident analysis THEN the system SHALL clearly indicate areas requiring founder clarification

### Requirement 5

**User Story:** As an investment partner, I want to customize analysis weightings based on our fund's investment strategy so that deal memos reflect our specific evaluation criteria.

#### Acceptance Criteria

1. WHEN configuring analysis parameters THEN the system SHALL allow adjustment of weightings for market (25%), team (25%), traction (20%), product (15%), and competitive moat (15%)
2. WHEN weightings are modified THEN the system SHALL recalculate signal scores and update recommendations accordingly
3. WHEN strategy profiles are saved THEN the system SHALL allow reuse of weighting configurations for consistent analysis
4. IF custom weightings total more or less than 100% THEN the system SHALL normalize values and notify the user
5. WHEN generating recommendations THEN the system SHALL indicate which weighting profile was used for transparency

### Requirement 6

**User Story:** As an investment analyst, I want the system to integrate with Google AI technologies for enhanced document processing and analysis so that I can leverage advanced AI capabilities for more accurate insights.

#### Acceptance Criteria

1. WHEN processing documents THEN the system SHALL use Google Cloud Vision API for OCR and image-to-text conversion
2. WHEN analyzing text content THEN the system SHALL use Gemini models for natural language understanding and entity extraction
3. WHEN performing sector analysis THEN the system SHALL query BigQuery datasets for market benchmarking data
4. WHEN storing results THEN the system SHALL use Firebase for persistent deal memo storage and retrieval
5. WHEN building complex analysis workflows THEN the system SHALL leverage Vertex AI for orchestrating multi-step AI processes
6. IF any Google AI service is unavailable THEN the system SHALL gracefully degrade functionality and notify users of limitations