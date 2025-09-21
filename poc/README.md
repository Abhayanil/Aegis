# Milestone 1 — Static Analysis POC

This folder is for Unit 1.2 (Core Prompt + JSON validation) using Gemini via Vertex AI.

## Prerequisites
- Google Cloud project (Vertex AI enabled)
- Python 3.10+
- Google Cloud SDK (`gcloud`)

## Setup
1) Install dependencies
```bash
pip install -r requirements.txt
```

2) Authenticate and set project
```bash
gcloud auth application-default login
gcloud config set project <YOUR_GCP_PROJECT_ID>
```

3) Run the test
```bash
python test_gemini.py
```

- Edit `INPUT_TEXT` inside `test_gemini.py` to paste a chunk from a deck.
- Adjust `MODEL_NAME` or location via environment variables if desired.

## Success Criteria
- Script prints a valid JSON under the exact wrapper key:
```json
{
  "aegisDealMemo": { ... }
}
```
- If JSON invalid, the script prints raw output and explains validation errors. Iterate on the prompt.

## Notes
- This is isolated (no Cloud Functions yet). Focuses on prompt quality and JSON structure fidelity.
- For Unit 1.1 (PDF text extraction via Vision API + Cloud Function), implement separately after validating Unit 1.2.