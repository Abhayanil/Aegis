"""
Unit 1.2 — Core Prompt Engineering & JSON Validation (Gemini via Vertex AI)

Quick start:
1) Install deps:  pip install -r requirements.txt
2) Auth:
   - gcloud auth application-default login
   - gcloud config set project <YOUR_GCP_PROJECT_ID>
   Or set GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON.
3) Run:  python test_gemini.py

Edit the INPUT_TEXT and SCHEMA to match your memo structure. The script will:
- Build the Aegis system prompt
- Call Gemini 1.5 Pro via Vertex AI
- Validate the response against a Pydantic schema
- Print the validated JSON
"""

import json
import os
from typing import List, Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

load_dotenv()

# ========= Config =========
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-pro-001")

# Provide manual text chunk for initial testing
INPUT_TEXT = (
    "TechFlow Analytics is an AI-powered supply chain optimization platform. "
    "Revenue grew 145% YoY with 95% renewal. Expanding into inventory and demand forecasting. "
    "Gross margin 82%. Burn multiple 0.8x."
)

# ========= Schema =========
class Benchmark(BaseModel):
    metric: str
    startupValue: str
    sectorMedian: str
    percentile: str

class TimelineItem(BaseModel):
    period: str
    milestone: str

class DealMemo(BaseModel):
    summary: BaseModel = Field(..., description="Summary object with companyName, oneLiner, signalScore, recommendation")
    benchmarks: List[Benchmark]
    growthPotential: BaseModel = Field(..., description="object with highlights (list[str]) and timeline (list[TimelineItem])")
    riskAssessment: BaseModel = Field(..., description="object with high (list[str]) and medium (list[str])")
    investmentRecommendation: BaseModel = Field(..., description="object with narrative, checkSize, valuationCap, diligenceQuestions (list[str])")

class MemoWrapper(BaseModel):
    aegisDealMemo: DealMemo


def build_aegis_prompt() -> str:
    return (
        "You are Aegis, an AI Investment Analyst. Generate a structured deal memo JSON for venture analysis with the following shape:\n"
        "{\n"
        "  \"aegisDealMemo\": {\n"
        "    \"summary\": {\"companyName\": string, \"oneLiner\": string, \"signalScore\": number, \"recommendation\": one of ['Strong Buy','Buy','Hold','Pass']},\n"
        "    \"benchmarks\": [{\"metric\": string, \"startupValue\": string, \"sectorMedian\": string, \"percentile\": string}],\n"
        "    \"growthPotential\": {\"highlights\": [string], \"timeline\": [{\"period\": string, \"milestone\": string}]},\n"
        "    \"riskAssessment\": {\"high\": [string], \"medium\": [string]},\n"
        "    \"investmentRecommendation\": {\"narrative\": string, \"checkSize\": string, \"valuationCap\": string, \"diligenceQuestions\": [string]}\n"
        "  }\n"
        "}\n"
        "Rules:\n"
        "- Return ONLY valid JSON.\n"
        "- Do not include markdown fences.\n"
        "- Make reasonable assumptions if data is missing.\n"
    )


def main():
    if not PROJECT_ID:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID in env.")

    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    model = GenerativeModel(MODEL_NAME)

    system_prompt = build_aegis_prompt()

    contents = [
        Part.from_text(system_prompt),
        Part.from_text("Input text (from pitch deck or transcript):\n" + INPUT_TEXT),
    ]

    config = GenerationConfig(
        temperature=0.2,
        max_output_tokens=2048,
        response_mime_type="application/json",  # strongly nudges JSON output
    )

    print("Calling Gemini...\n")
    response = model.generate_content(contents, generation_config=config)

    text = response.text
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        print("Raw model output:\n", text)
        raise SystemExit(f"Model did not return valid JSON: {e}")

    try:
        validated = MemoWrapper.model_validate(parsed)
    except ValidationError as e:
        print("Raw JSON:\n", json.dumps(parsed, indent=2))
        raise SystemExit(f"JSON failed schema validation:\n{e}")

    print("Validated JSON:\n")
    print(json.dumps(validated.model_dump(), indent=2))


if __name__ == "__main__":
    main()