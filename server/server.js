import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

// Optional: OpenAI or Gemini SDKs
import OpenAI from 'openai';
// TODO: If using Google Gemini, import Google Generative AI SDK and wire in a switch

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Storage for multer (memory for processing)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper: parse various files into text
async function parseFileToText(originalName, buffer) {
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
    // Mammoth works best with docx; for doc you may need antiword or similar
    const { value } = await mammoth.extractRawText({ buffer });
    return value || '';
  }
  if (lower.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
    // TODO: Add PPT parsing (e.g., officeparser). For now, basic placeholder.
    return '[PPT parsing not implemented yet]';
  }
  if (lower.endsWith('.zip')) {
    const zip = new AdmZip(buffer);
    let aggregated = '';
    zip.getEntries().forEach((entry) => {
      if (!entry.isDirectory) {
        aggregated += `\n----- ${entry.entryName} -----\n`;
        try {
          const content = entry.getData();
          // best effort attempt to read text files within ZIP
          aggregated += content.toString('utf-8');
        } catch (e) {
          aggregated += '[Binary content skipped]';
        }
      }
    });
    return aggregated;
  }
  return '';
}

// Stub: public data providers
async function fetchPublicData(query) {
  // TODO: Replace with BigQuery or other market data source
  // Optionally call Crunchbase/PitchBook-like APIs here
  return {
    newsHighlights: [
      `Recent funding round reported for ${query || 'the company'}`,
      'Partnership announced with major logistics provider',
    ],
    sectorBenchmarks: [
      { metric: 'ARR Growth Rate', sectorMedian: '78% YoY' },
      { metric: 'NRR', sectorMedian: '105%' },
    ],
  };
}

// Build the Aegis system prompt
function buildAegisSystemPrompt() {
  return `You are Aegis, an AI Investment Analyst. Generate a structured deal memo JSON for venture analysis with:
- Summary (companyName, oneLiner, signalScore, recommendation)
- Benchmarks (metric, startupValue, sectorMedian, percentile)
- GrowthPotential (highlights[], timeline[{period,milestone}])
- RiskAssessment (high[], medium[])
- InvestmentRecommendation (narrative, checkSize, valuationCap, diligenceQuestions[])
Return JSON only under { "aegisDealMemo": { ... } } exact key.`;
}

// AI call using OpenAI
async function callAIAegis({ provider = 'openai', filesText, analystFocus, publicData }) {
  const systemPrompt = buildAegisSystemPrompt();
  const userContent = `Analyst focus: ${analystFocus || 'General'}\n\nUploaded content:\n${filesText.slice(0, 15000)}\n\nPublic data (optional):\n${JSON.stringify(publicData).slice(0, 4000)}`;

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
    const openai = new OpenAI({ apiKey });

    // gpt-4o-mini or gpt-4o depending on cost/latency
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' }
    });

    const text = response.choices?.[0]?.message?.content || '{}';
    return JSON.parse(text);
  }

  if (provider === 'gemini') {
    // TODO: Implement Gemini call with Google Generative AI SDK
    // Read GEMINI_API_KEY and call model with system prompt + user content
    // Make sure to return a parsed JSON object
    return { aegisDealMemo: { placeholder: true } };
  }

  throw new Error('Unsupported AI provider');
}

// POST /api/upload - handle files; parse to text; optionally persist to Drive
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const includePublicData = req.body.includePublicData === 'true';
    const analystFocus = req.body.analystFocus || '';

    // TODO: Hook this to Google Drive API if uploads are stored in Drive
    // Example: upload buffers to Drive and store fileIds

    let aggregatedText = '';
    for (const file of req.files || []) {
      const text = await parseFileToText(file.originalname, file.buffer);
      aggregatedText += `\n\n===== ${file.originalname} =====\n${text}`;
    }

    let publicData = null;
    if (includePublicData) {
      publicData = await fetchPublicData(analystFocus);
    }

    // Keep parsed text in memory or temporary storage
    // In production, persist to database or object storage

    return res.json({ success: true, parsedText: aggregatedText, publicData, analystFocus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload/parse failed' });
  }
});

// POST /api/deal-memo - call AI with the Aegis system prompt
app.post('/api/deal-memo', async (req, res) => {
  try {
    const { parsedText, analystFocus, publicData, provider } = req.body || {};
    const json = await callAIAegis({ provider: provider || 'openai', filesText: parsedText || '', analystFocus, publicData });

    // TODO: Add Firebase SDK call here to persist JSON results

    // TODO: Replace mock benchmarks with BigQuery query results (if benchmarking server-side)

    return res.json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

// POST /api/export - download JSON as a file
app.post('/api/export', async (req, res) => {
  try {
    const data = req.body;
    const filename = (data?.aegisDealMemo?.summary?.companyName || 'deal_memo').replace(/\s+/g, '_') + '_deal_memo.json';

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Aegis backend running on http://localhost:${port}`);
});