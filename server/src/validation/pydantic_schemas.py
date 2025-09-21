"""
Pydantic models for deal memo schema validation
Provides comprehensive validation with detailed error reporting
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union, Literal
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic import HttpUrl
from uuid import UUID


class DocumentType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    TXT = "txt"
    ZIP = "zip"


class FundingStage(str, Enum):
    PRE_SEED = "pre-seed"
    SEED = "seed"
    SERIES_A = "series-a"
    SERIES_B = "series-b"
    SERIES_C = "series-c"
    LATER_STAGE = "later-stage"


class RecommendationType(str, Enum):
    STRONG_BUY = "strong-buy"
    BUY = "buy"
    HOLD = "hold"
    PASS = "pass"
    STRONG_PASS = "strong-pass"


class RiskType(str, Enum):
    INCONSISTENCY = "inconsistency"
    MARKET_SIZE = "market-size"
    FINANCIAL_ANOMALY = "financial-anomaly"
    COMPETITIVE_RISK = "competitive-risk"
    TEAM_RISK = "team-risk"
    TECHNICAL_RISK = "technical-risk"


class RiskSeverity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class BaseEntity(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class TeamMember(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=100)
    background: Optional[str] = None
    linkedin_url: Optional[HttpUrl] = None
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    education: Optional[str] = None
    previous_companies: Optional[List[str]] = None
    expertise: Optional[List[str]] = None
    is_founder: Optional[bool] = None


class SocialLinks(BaseModel):
    linkedin: Optional[HttpUrl] = None
    twitter: Optional[HttpUrl] = None
    crunchbase: Optional[HttpUrl] = None


class CompanyProfile(BaseEntity):
    name: str = Field(..., min_length=1, max_length=200)
    one_liner: str = Field(..., min_length=10, max_length=500)
    sector: str = Field(..., min_length=1, max_length=100)
    stage: FundingStage
    founded_year: int = Field(..., ge=1900, le=datetime.now().year)
    location: str = Field(..., min_length=1, max_length=200)
    website: Optional[HttpUrl] = None
    description: Optional[str] = Field(None, max_length=2000)
    logo_url: Optional[HttpUrl] = None
    social_links: Optional[SocialLinks] = None


class RevenueMetrics(BaseModel):
    arr: Optional[float] = Field(None, ge=0)
    mrr: Optional[float] = Field(None, ge=0)
    growth_rate: Optional[float] = Field(None, ge=-100, le=10000)
    projected_arr: Optional[List[float]] = None
    revenue_run_rate: Optional[float] = Field(None, ge=0)
    gross_margin: Optional[float] = Field(None, ge=0, le=100)
    net_revenue_retention: Optional[float] = Field(None, ge=0, le=500)

    @field_validator('projected_arr')
    @classmethod
    def validate_projected_arr(cls, v):
        if v is not None:
            for value in v:
                if value < 0:
                    raise ValueError('All projected ARR values must be non-negative')
        return v


class TractionMetrics(BaseModel):
    customers: Optional[int] = Field(None, ge=0)
    customer_growth_rate: Optional[float] = Field(None, ge=-100, le=10000)
    churn_rate: Optional[float] = Field(None, ge=0, le=100)
    nps: Optional[float] = Field(None, ge=-100, le=100)
    active_users: Optional[int] = Field(None, ge=0)
    conversion_rate: Optional[float] = Field(None, ge=0, le=100)
    ltv: Optional[float] = Field(None, ge=0)
    cac: Optional[float] = Field(None, ge=0)
    ltv_cac_ratio: Optional[float] = Field(None, ge=0)


class TeamMetrics(BaseModel):
    size: int = Field(..., ge=1, le=10000)
    founders_count: int = Field(..., ge=1, le=20)
    key_hires: List[TeamMember]
    engineering_team_size: Optional[int] = Field(None, ge=0)
    sales_team_size: Optional[int] = Field(None, ge=0)
    burn_rate: Optional[float] = Field(None, ge=0)
    runway: Optional[float] = Field(None, ge=0)


class FundingMetrics(BaseModel):
    total_raised: Optional[float] = Field(None, ge=0)
    last_round_size: Optional[float] = Field(None, ge=0)
    last_round_date: Optional[datetime] = None
    current_ask: Optional[float] = Field(None, ge=0)
    valuation: Optional[float] = Field(None, ge=0)
    pre_money_valuation: Optional[float] = Field(None, ge=0)
    post_money_valuation: Optional[float] = Field(None, ge=0)
    stage: Optional[FundingStage] = None
    lead_investor: Optional[str] = None
    use_of_funds: Optional[List[str]] = None


class InvestmentMetrics(BaseEntity):
    revenue: RevenueMetrics
    traction: TractionMetrics
    team: TeamMetrics
    funding: FundingMetrics
    extraction_timestamp: datetime
    source_documents: List[str]
    confidence: float = Field(..., ge=0, le=1)


class RiskFlag(BaseEntity):
    type: RiskType
    severity: RiskSeverity
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=10, max_length=1000)
    affected_metrics: List[str]
    suggested_mitigation: str = Field(..., min_length=10, max_length=1000)
    source_documents: List[str]
    confidence: float = Field(..., ge=0, le=1)
    impact: Literal["low", "medium", "high", "critical"]
    likelihood: Literal["low", "medium", "high"]
    category: Literal["financial", "market", "team", "product", "competitive", "operational"]
    detected_at: datetime
    evidence: List[str]
    related_flags: Optional[List[str]] = None


class MetricDistribution(BaseModel):
    min: float
    max: float
    median: float
    p25: float
    p75: float
    p90: float
    mean: float
    std_dev: float
    sample_size: int = Field(..., ge=1)

    @model_validator(mode='after')
    def validate_distribution(self):
        if self.max < self.min:
            raise ValueError('max must be greater than or equal to min')
        if not (self.min <= self.median <= self.max):
            raise ValueError('median must be between min and max')
        return self


class TimeRange(BaseModel):
    start_date: datetime
    end_date: datetime

    @model_validator(mode='after')
    def validate_time_range(self):
        if self.end_date < self.start_date:
            raise ValueError('end_date must be after start_date')
        return self


class BenchmarkData(BaseEntity):
    sector: str = Field(..., min_length=1, max_length=100)
    sub_sector: Optional[str] = Field(None, max_length=100)
    stage: Optional[FundingStage] = None
    geography: Optional[str] = Field(None, max_length=100)
    sample_size: int = Field(..., ge=1)
    metrics: Dict[str, MetricDistribution]
    last_updated: datetime
    data_source: str = Field(..., min_length=1, max_length=200)
    methodology: str = Field(..., min_length=10, max_length=1000)
    confidence: float = Field(..., ge=0, le=1)
    time_range: TimeRange


class BenchmarkComparison(BaseModel):
    metric: str = Field(..., min_length=1, max_length=100)
    company_value: float
    sector_median: float
    percentile: float = Field(..., ge=0, le=100)
    interpretation: str = Field(..., min_length=10, max_length=500)
    context: str = Field(..., min_length=10, max_length=500)
    recommendation: Optional[str] = Field(None, max_length=500)


class AnalysisWeightings(BaseModel):
    market_opportunity: float = Field(25.0, ge=0, le=100)
    team: float = Field(25.0, ge=0, le=100)
    traction: float = Field(20.0, ge=0, le=100)
    product: float = Field(15.0, ge=0, le=100)
    competitive_position: float = Field(15.0, ge=0, le=100)

    @model_validator(mode='after')
    def validate_weightings_sum(self):
        total = self.market_opportunity + self.team + self.traction + self.product + self.competitive_position
        if abs(total - 100.0) > 0.01:  # Allow for floating point precision
            raise ValueError(f'Weightings must sum to 100%, got {total}%')
        return self


class DealMemoSummary(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    one_liner: str = Field(..., min_length=10, max_length=500)
    sector: str = Field(..., min_length=1, max_length=100)
    stage: FundingStage
    signal_score: float = Field(..., ge=0, le=100)
    recommendation: RecommendationType
    confidence_level: float = Field(..., ge=0, le=1)
    last_updated: datetime


class RevenueProjection(BaseModel):
    year1: float = Field(..., ge=0)
    year3: float = Field(..., ge=0)
    year5: float = Field(..., ge=0)

    @model_validator(mode='after')
    def validate_revenue_progression(self):
        if self.year3 < self.year1:
            raise ValueError('year3 projection should not be less than year1')
        if self.year5 < self.year3:
            raise ValueError('year5 projection should not be less than year3')
        return self


class GrowthPotential(BaseModel):
    upside_summary: str = Field(..., min_length=50, max_length=2000)
    growth_timeline: str = Field(..., min_length=20, max_length=1000)
    key_drivers: List[str] = Field(..., min_length=1)
    scalability_factors: List[str] = Field(..., min_length=1)
    market_expansion_opportunity: str = Field(..., min_length=20, max_length=1000)
    revenue_projection: RevenueProjection

    @field_validator('key_drivers')
    @classmethod
    def validate_key_drivers(cls, v):
        for driver in v:
            if len(driver) < 5 or len(driver) > 200:
                raise ValueError('Each key driver must be between 5 and 200 characters')
        return v

    @field_validator('scalability_factors')
    @classmethod
    def validate_scalability_factors(cls, v):
        for factor in v:
            if len(factor) < 5 or len(factor) > 200:
                raise ValueError('Each scalability factor must be between 5 and 200 characters')
        return v


class RiskAssessment(BaseModel):
    overall_risk_score: float = Field(..., ge=0, le=100)
    high_priority_risks: List[RiskFlag]
    medium_priority_risks: List[RiskFlag]
    low_priority_risks: List[RiskFlag]
    risk_mitigation_plan: List[str] = Field(..., min_length=1)

    @field_validator('risk_mitigation_plan')
    @classmethod
    def validate_mitigation_plan(cls, v):
        for plan in v:
            if len(plan) < 10 or len(plan) > 500:
                raise ValueError('Each mitigation plan item must be between 10 and 500 characters')
        return v


class InvestmentRecommendation(BaseModel):
    narrative: str = Field(..., min_length=100, max_length=3000)
    investment_thesis: str = Field(..., min_length=50, max_length=2000)
    ideal_check_size: str = Field(..., min_length=5, max_length=100)
    ideal_valuation_cap: str = Field(..., min_length=5, max_length=100)
    suggested_terms: List[str] = Field(..., min_length=1)
    key_diligence_questions: List[str] = Field(..., min_length=1)
    follow_up_actions: List[str] = Field(..., min_length=1)
    timeline_to_decision: str = Field(..., min_length=5, max_length=100)

    @field_validator('suggested_terms')
    @classmethod
    def validate_suggested_terms(cls, v):
        for term in v:
            if len(term) < 5 or len(term) > 200:
                raise ValueError('Each suggested term must be between 5 and 200 characters')
        return v

    @field_validator('key_diligence_questions')
    @classmethod
    def validate_diligence_questions(cls, v):
        for question in v:
            if len(question) < 10 or len(question) > 300:
                raise ValueError('Each diligence question must be between 10 and 300 characters')
        return v

    @field_validator('follow_up_actions')
    @classmethod
    def validate_follow_up_actions(cls, v):
        for action in v:
            if len(action) < 5 or len(action) > 200:
                raise ValueError('Each follow-up action must be between 5 and 200 characters')
        return v


class DealMemoMetadata(BaseModel):
    generated_by: str = Field(..., min_length=1, max_length=100)
    analysis_version: str = Field(..., min_length=1, max_length=20)
    source_documents: List[str]
    processing_time: float = Field(..., ge=0)
    data_quality: float = Field(..., ge=0, le=1)


class AegisDealMemo(BaseModel):
    summary: DealMemoSummary
    key_benchmarks: List[BenchmarkComparison]
    growth_potential: GrowthPotential
    risk_assessment: RiskAssessment
    investment_recommendation: InvestmentRecommendation
    analysis_weightings: AnalysisWeightings
    metadata: DealMemoMetadata


class DealMemo(BaseEntity):
    aegis_deal_memo: AegisDealMemo


# Validation utility functions
def validate_deal_memo(data: Dict[str, Any]) -> DealMemo:
    """Validate deal memo data and return validated model"""
    try:
        return DealMemo(**data)
    except Exception as e:
        raise ValueError(f"Deal memo validation failed: {str(e)}")


def validate_company_profile(data: Dict[str, Any]) -> CompanyProfile:
    """Validate company profile data and return validated model"""
    try:
        return CompanyProfile(**data)
    except Exception as e:
        raise ValueError(f"Company profile validation failed: {str(e)}")


def validate_investment_metrics(data: Dict[str, Any]) -> InvestmentMetrics:
    """Validate investment metrics data and return validated model"""
    try:
        return InvestmentMetrics(**data)
    except Exception as e:
        raise ValueError(f"Investment metrics validation failed: {str(e)}")


def get_validation_errors(model_class, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Get detailed validation errors for debugging"""
    try:
        model_class(**data)
        return []
    except Exception as e:
        if hasattr(e, 'errors'):
            return e.errors()
        return [{"msg": str(e), "type": "unknown_error"}]


def normalize_weightings(weightings: Dict[str, float]) -> Dict[str, float]:
    """Normalize weightings to sum to 100%"""
    total = sum(weightings.values())
    if total == 0:
        raise ValueError("All weightings cannot be zero")
    
    return {key: (value / total) * 100 for key, value in weightings.items()}