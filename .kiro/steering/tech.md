# Technology Stack

## Backend (Node.js)
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **File Processing**: 
  - PDF parsing: `pdf-parse`
  - Word docs: `mammoth`
  - ZIP files: `adm-zip`
  - File uploads: `multer`
- **AI Integration**: 
  - OpenAI SDK for GPT models
  - Google Cloud AI Platform for Gemini
- **Environment**: `dotenv` for configuration

## Python POC
- **AI Platform**: Google Cloud Vertex AI
- **Validation**: Pydantic for JSON schema validation
- **Environment**: `python-dotenv`

## Google Cloud AI Platform
- **Vertex AI**: Model orchestration and Gemini integration
- **Cloud Vision API**: OCR and image-to-text processing
- **BigQuery**: Market data benchmarking and sector analysis
- **Firebase**: Deal memo persistence and user data storage
- **Agent Builder**: Future conversational AI capabilities

## Planned Integrations
- Google Drive API (file storage)
- Advanced benchmarking datasets
- Real-time market data feeds

## Common Commands

### Server Development
```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Production start
npm start
```

### Python POC
```bash
# Install dependencies
pip install -r poc/requirements.txt

# Authenticate with Google Cloud
gcloud auth application-default login
gcloud config set project <PROJECT_ID>

# Run POC test
python poc/test_gemini.py
```

## Environment Configuration
- Copy `server/.env.example` to `server/.env`
- Set required API keys (OPENAI_API_KEY, GEMINI_API_KEY)
- Configure Google Cloud project settings