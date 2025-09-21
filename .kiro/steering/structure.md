# Project Structure

## Root Level
- `requirements.txt` - Global Python dependencies (Google Cloud AI Platform)
- `.gitignore` - Standard Git ignore patterns
- `.venv/` - Python virtual environment

## `/poc` - Proof of Concept
Python-based prototype for testing Gemini integration and prompt engineering.

- `README.md` - POC setup instructions and success criteria
- `requirements.txt` - POC-specific Python dependencies
- `test_gemini.py` - Main test script for Gemini API integration

**Purpose**: Validate Unit 1.2 (Core Prompt + JSON validation) before full implementation.

## `/.kiro/specs` - Feature Specifications
Structured specifications for complex feature development following spec-driven methodology.

- `/ai-deal-memo-generation/` - Core AI-powered deal memo generation system
  - `requirements.md` - User stories and acceptance criteria for document processing, benchmarking, and analysis
  - `design.md` - Microservices architecture with Google Cloud AI integration
  - `tasks.md` - Implementation plan with 22 actionable coding tasks

## `/server` - Node.js Backend
Express.js server handling file processing and AI integration.

- `package.json` - Node.js dependencies and scripts
- `server.js` - Main server application
- `.env.example` - Environment configuration template

**Key Endpoints**:
- `POST /api/upload` - File upload and text extraction
- `POST /api/deal-memo` - AI-powered deal memo generation
- `POST /api/export` - JSON export functionality

## Code Organization Patterns

### File Processing Flow
1. Upload via multer → Parse to text → Store temporarily
2. Optional public data enrichment
3. AI processing with structured prompts
4. JSON validation and export

### AI Provider Abstraction
- Unified `callAIAegis()` function supports both OpenAI and Gemini
- Provider selection via configuration
- Consistent JSON schema validation across providers
- Microservices architecture for AI analysis pipeline
- Google Cloud AI Platform integration (Vertex AI, Cloud Vision, BigQuery)

### Configuration Management
- Environment-based configuration for all integrations
- Separate development and production settings
- Placeholder configurations for planned integrations (Drive, BigQuery, Firebase)