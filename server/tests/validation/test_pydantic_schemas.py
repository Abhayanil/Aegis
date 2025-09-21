"""
Unit tests for Pydantic schema validation
Tests both valid and invalid inputs with detailed error reporting
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from src.validation.pydantic_schemas import (
    CompanyProfile,
    InvestmentMetrics,
    RiskFlag,
    BenchmarkData,
    DealMemo,
    TeamMember,
    RevenueMetrics,
    TractionMetrics,
    TeamMetrics,
    FundingMetrics,
    MetricDistribution,
    AnalysisWeightings,
    validate_deal_memo,
    validate_company_profile,
    validate_investment_metrics,
    get_validation_errors,
    normalize_weightings,
    FundingStage,
    RecommendationType,
    RiskType,
    RiskSeverity,
)


class TestCompanyProfileValidation:
    """Test company profile validation"""

    def get_valid_company_profile(self) -> Dict[str, Any]:
        return {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "name": "TechStartup Inc",
            "one_liner": "Revolutionary AI platform for enterprise automation",
            "sector": "Enterprise Software",
            "stage": FundingStage.SERIES_A,
            "founded_year": 2020,
            "location": "San Francisco, CA",
            "website": "https://techstartup.com",
            "description": "A comprehensive AI platform that helps enterprises automate their workflows.",
        }

    def test_valid_company_profile(self):
        """Test validation of a correct company profile"""
        data = self.get_valid_company_profile()
        profile = validate_company_profile(data)
        assert profile.name == "TechStartup Inc"
        assert profile.stage == FundingStage.SERIES_A

    def test_invalid_name_empty(self):
        """Test validation fails for empty name"""
        data = self.get_valid_company_profile()
        data["name"] = ""
        
        with pytest.raises(ValueError, match="Company profile validation failed"):
            validate_company_profile(data)

    def test_invalid_name_too_long(self):
        """Test validation fails for name too long"""
        data = self.get_valid_company_profile()
        data["name"] = "x" * 201  # Max is 200
        
        with pytest.raises(ValueError):
            validate_company_profile(data)

    def test_invalid_founded_year_too_old(self):
        """Test validation fails for founded year too old"""
        data = self.get_valid_company_profile()
        data["founded_year"] = 1800
        
        with pytest.raises(ValueError):
            validate_company_profile(data)

    def test_invalid_founded_year_future(self):
        """Test validation fails for future founded year"""
        data = self.get_valid_company_profile()
        data["founded_year"] = datetime.now().year + 1
        
        with pytest.raises(ValueError):
            validate_company_profile(data)

    def test_invalid_website_url(self):
        """Test validation fails for invalid website URL"""
        data = self.get_valid_company_profile()
        data["website"] = "not-a-url"
        
        with pytest.raises(ValueError):
            validate_company_profile(data)

    def test_optional_fields_missing(self):
        """Test validation passes with optional fields missing"""
        data = {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "name": "TechStartup Inc",
            "one_liner": "Revolutionary AI platform for enterprise automation",
            "sector": "Enterprise Software",
            "stage": FundingStage.SERIES_A,
            "founded_year": 2020,
            "location": "San Francisco, CA",
        }
        
        profile = validate_company_profile(data)
        assert profile.name == "TechStartup Inc"
        assert profile.website is None


class TestInvestmentMetricsValidation:
    """Test investment metrics validation"""

    def get_valid_investment_metrics(self) -> Dict[str, Any]:
        return {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "revenue": {
                "arr": 1000000,
                "mrr": 83333,
                "growth_rate": 150,
                "projected_arr": [1000000, 2000000, 4000000],
            },
            "traction": {
                "customers": 50,
                "customer_growth_rate": 20,
                "churn_rate": 5,
                "nps": 70,
            },
            "team": {
                "size": 25,
                "founders_count": 2,
                "key_hires": [
                    {
                        "name": "John Doe",
                        "role": "CTO",
                        "background": "Former Google engineer",
                        "years_experience": 10,
                        "is_founder": True,
                    }
                ],
            },
            "funding": {
                "total_raised": 5000000,
                "last_round_size": 3000000,
                "last_round_date": datetime.now(),
                "current_ask": 10000000,
                "valuation": 50000000,
            },
            "extraction_timestamp": datetime.now(),
            "source_documents": ["doc1.pdf", "doc2.docx"],
            "confidence": 0.85,
        }

    def test_valid_investment_metrics(self):
        """Test validation of correct investment metrics"""
        data = self.get_valid_investment_metrics()
        metrics = validate_investment_metrics(data)
        assert metrics.revenue.arr == 1000000
        assert metrics.confidence == 0.85

    def test_invalid_negative_arr(self):
        """Test validation fails for negative ARR"""
        data = self.get_valid_investment_metrics()
        data["revenue"]["arr"] = -1000
        
        with pytest.raises(ValueError):
            validate_investment_metrics(data)

    def test_invalid_churn_rate_over_100(self):
        """Test validation fails for churn rate over 100%"""
        data = self.get_valid_investment_metrics()
        data["traction"]["churn_rate"] = 150
        
        with pytest.raises(ValueError):
            validate_investment_metrics(data)

    def test_invalid_confidence_over_1(self):
        """Test validation fails for confidence over 1"""
        data = self.get_valid_investment_metrics()
        data["confidence"] = 1.5
        
        with pytest.raises(ValueError):
            validate_investment_metrics(data)

    def test_invalid_team_size_zero(self):
        """Test validation fails for team size of zero"""
        data = self.get_valid_investment_metrics()
        data["team"]["size"] = 0
        
        with pytest.raises(ValueError):
            validate_investment_metrics(data)

    def test_invalid_projected_arr_negative(self):
        """Test validation fails for negative projected ARR values"""
        data = self.get_valid_investment_metrics()
        data["revenue"]["projected_arr"] = [1000000, -500000, 2000000]
        
        with pytest.raises(ValueError):
            validate_investment_metrics(data)


class TestRiskFlagValidation:
    """Test risk flag validation"""

    def get_valid_risk_flag(self) -> Dict[str, Any]:
        return {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "type": RiskType.FINANCIAL_ANOMALY,
            "severity": RiskSeverity.HIGH,
            "title": "Unusual Churn Pattern",
            "description": "Customer churn rate has increased significantly in recent months without clear explanation.",
            "affected_metrics": ["churn_rate", "customer_growth_rate"],
            "suggested_mitigation": "Conduct customer interviews to understand churn drivers and implement retention strategies.",
            "source_documents": ["transcript.txt", "metrics.pdf"],
            "confidence": 0.9,
            "impact": "high",
            "likelihood": "medium",
            "category": "financial",
            "detected_at": datetime.now(),
            "evidence": ["Churn increased from 3% to 8%", "No explanation in founder updates"],
        }

    def test_valid_risk_flag(self):
        """Test validation of correct risk flag"""
        data = self.get_valid_risk_flag()
        risk_flag = RiskFlag(**data)
        assert risk_flag.type == RiskType.FINANCIAL_ANOMALY
        assert risk_flag.severity == RiskSeverity.HIGH

    def test_invalid_description_too_short(self):
        """Test validation fails for description too short"""
        data = self.get_valid_risk_flag()
        data["description"] = "Too short"
        
        with pytest.raises(ValueError):
            RiskFlag(**data)

    def test_invalid_confidence_over_1(self):
        """Test validation fails for confidence over 1"""
        data = self.get_valid_risk_flag()
        data["confidence"] = 2.0
        
        with pytest.raises(ValueError):
            RiskFlag(**data)

    def test_invalid_impact_level(self):
        """Test validation fails for invalid impact level"""
        data = self.get_valid_risk_flag()
        data["impact"] = "invalid"
        
        with pytest.raises(ValueError):
            RiskFlag(**data)


class TestBenchmarkDataValidation:
    """Test benchmark data validation"""

    def get_valid_benchmark_data(self) -> Dict[str, Any]:
        return {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "sector": "Enterprise Software",
            "sample_size": 100,
            "metrics": {
                "arr": {
                    "min": 100000,
                    "max": 50000000,
                    "median": 2000000,
                    "p25": 500000,
                    "p75": 5000000,
                    "p90": 15000000,
                    "mean": 3500000,
                    "std_dev": 8000000,
                    "sample_size": 100,
                }
            },
            "last_updated": datetime.now(),
            "data_source": "Industry Research Database",
            "methodology": "Survey of 100 enterprise software companies in Series A-C stages",
            "confidence": 0.85,
            "time_range": {
                "start_date": datetime.now() - timedelta(days=365),
                "end_date": datetime.now(),
            },
        }

    def test_valid_benchmark_data(self):
        """Test validation of correct benchmark data"""
        data = self.get_valid_benchmark_data()
        benchmark = BenchmarkData(**data)
        assert benchmark.sector == "Enterprise Software"
        assert benchmark.sample_size == 100

    def test_invalid_sample_size_zero(self):
        """Test validation fails for zero sample size"""
        data = self.get_valid_benchmark_data()
        data["sample_size"] = 0
        
        with pytest.raises(ValueError):
            BenchmarkData(**data)

    def test_invalid_confidence_negative(self):
        """Test validation fails for negative confidence"""
        data = self.get_valid_benchmark_data()
        data["confidence"] = -0.1
        
        with pytest.raises(ValueError):
            BenchmarkData(**data)

    def test_invalid_time_range_end_before_start(self):
        """Test validation fails when end date is before start date"""
        data = self.get_valid_benchmark_data()
        data["time_range"]["end_date"] = datetime.now() - timedelta(days=400)
        
        with pytest.raises(ValueError):
            BenchmarkData(**data)

    def test_invalid_metric_distribution_max_less_than_min(self):
        """Test validation fails when max is less than min in metric distribution"""
        data = self.get_valid_benchmark_data()
        data["metrics"]["arr"]["max"] = 50000  # Less than min of 100000
        
        with pytest.raises(ValueError):
            BenchmarkData(**data)


class TestAnalysisWeightings:
    """Test analysis weightings validation"""

    def test_valid_weightings_sum_to_100(self):
        """Test validation passes when weightings sum to 100"""
        weightings = AnalysisWeightings(
            market_opportunity=25.0,
            team=25.0,
            traction=20.0,
            product=15.0,
            competitive_position=15.0,
        )
        assert weightings.market_opportunity == 25.0

    def test_invalid_weightings_sum_not_100(self):
        """Test validation fails when weightings don't sum to 100"""
        with pytest.raises(ValueError, match="Weightings must sum to 100%"):
            AnalysisWeightings(
                market_opportunity=30.0,
                team=30.0,
                traction=30.0,
                product=30.0,
                competitive_position=30.0,
            )

    def test_weightings_with_floating_point_precision(self):
        """Test validation allows for floating point precision errors"""
        weightings = AnalysisWeightings(
            market_opportunity=25.001,
            team=24.999,
            traction=20.0,
            product=15.0,
            competitive_position=15.0,
        )
        assert weightings.market_opportunity == 25.001


class TestUtilityFunctions:
    """Test utility functions"""

    def test_normalize_weightings_valid(self):
        """Test normalizing weightings to sum to 100"""
        weightings = {
            "market_opportunity": 30.0,
            "team": 30.0,
            "traction": 20.0,
            "product": 10.0,
            "competitive_position": 10.0,
        }
        
        normalized = normalize_weightings(weightings)
        total = sum(normalized.values())
        assert abs(total - 100.0) < 0.01

    def test_normalize_weightings_all_zero(self):
        """Test normalizing fails when all weightings are zero"""
        weightings = {
            "market_opportunity": 0.0,
            "team": 0.0,
            "traction": 0.0,
            "product": 0.0,
            "competitive_position": 0.0,
        }
        
        with pytest.raises(ValueError, match="All weightings cannot be zero"):
            normalize_weightings(weightings)

    def test_get_validation_errors_valid_data(self):
        """Test getting validation errors for valid data returns empty list"""
        data = {
            "market_opportunity": 25.0,
            "team": 25.0,
            "traction": 20.0,
            "product": 15.0,
            "competitive_position": 15.0,
        }
        
        errors = get_validation_errors(AnalysisWeightings, data)
        assert len(errors) == 0

    def test_get_validation_errors_invalid_data(self):
        """Test getting validation errors for invalid data returns error list"""
        data = {
            "market_opportunity": 50.0,  # Will cause sum to exceed 100
            "team": 25.0,
            "traction": 20.0,
            "product": 15.0,
            "competitive_position": 15.0,
        }
        
        errors = get_validation_errors(AnalysisWeightings, data)
        assert len(errors) > 0
        assert any("Weightings must sum to 100%" in str(error) for error in errors)


class TestDealMemoValidation:
    """Test complete deal memo validation"""

    def get_valid_deal_memo(self) -> Dict[str, Any]:
        return {
            "id": str(uuid4()),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "aegis_deal_memo": {
                "summary": {
                    "company_name": "TechStartup Inc",
                    "one_liner": "Revolutionary AI platform for enterprise automation",
                    "sector": "Enterprise Software",
                    "stage": FundingStage.SERIES_A,
                    "signal_score": 85.0,
                    "recommendation": RecommendationType.BUY,
                    "confidence_level": 0.9,
                    "last_updated": datetime.now(),
                },
                "key_benchmarks": [
                    {
                        "metric": "ARR",
                        "company_value": 1000000.0,
                        "sector_median": 2000000.0,
                        "percentile": 40.0,
                        "interpretation": "Below median but showing strong growth trajectory",
                        "context": "Company is earlier stage than typical Series A",
                        "recommendation": "Monitor growth rate closely",
                    }
                ],
                "growth_potential": {
                    "upside_summary": "Strong potential for 10x growth over 5 years driven by market expansion and product development.",
                    "growth_timeline": "Expect 3x growth in next 18 months with Series B funding",
                    "key_drivers": ["Market expansion", "Product development", "Team scaling"],
                    "scalability_factors": ["Cloud-native architecture", "API-first design"],
                    "market_expansion_opportunity": "Large addressable market with low penetration",
                    "revenue_projection": {
                        "year1": 2000000.0,
                        "year3": 10000000.0,
                        "year5": 50000000.0,
                    },
                },
                "risk_assessment": {
                    "overall_risk_score": 35.0,
                    "high_priority_risks": [],
                    "medium_priority_risks": [],
                    "low_priority_risks": [],
                    "risk_mitigation_plan": [
                        "Regular customer feedback collection",
                        "Competitive monitoring",
                    ],
                },
                "investment_recommendation": {
                    "narrative": "TechStartup Inc represents a compelling investment opportunity in the rapidly growing enterprise automation market. The company has demonstrated strong product-market fit with impressive early traction and a world-class founding team.",
                    "investment_thesis": "Enterprise automation is a massive market opportunity with TechStartup positioned to capture significant market share.",
                    "ideal_check_size": "$2-5M",
                    "ideal_valuation_cap": "$25M cap",
                    "suggested_terms": ["Board seat", "Pro rata rights", "Anti-dilution protection"],
                    "key_diligence_questions": [
                        "What is the customer acquisition cost trend?",
                        "How defensible is the technology moat?",
                        "What are the key competitive threats?",
                    ],
                    "follow_up_actions": ["Reference calls with customers", "Technical deep dive"],
                    "timeline_to_decision": "2-3 weeks",
                },
                "analysis_weightings": {
                    "market_opportunity": 25.0,
                    "team": 25.0,
                    "traction": 20.0,
                    "product": 15.0,
                    "competitive_position": 15.0,
                },
                "metadata": {
                    "generated_by": "Aegis AI v1.0",
                    "analysis_version": "1.0.0",
                    "source_documents": ["pitch_deck.pdf", "transcript.txt"],
                    "processing_time": 45.2,
                    "data_quality": 0.85,
                },
            },
        }

    def test_valid_deal_memo(self):
        """Test validation of complete valid deal memo"""
        data = self.get_valid_deal_memo()
        deal_memo = validate_deal_memo(data)
        assert deal_memo.aegis_deal_memo.summary.company_name == "TechStartup Inc"
        assert deal_memo.aegis_deal_memo.summary.signal_score == 85.0

    def test_invalid_signal_score_over_100(self):
        """Test validation fails for signal score over 100"""
        data = self.get_valid_deal_memo()
        data["aegis_deal_memo"]["summary"]["signal_score"] = 150.0
        
        with pytest.raises(ValueError):
            validate_deal_memo(data)

    def test_invalid_revenue_projection_decreasing(self):
        """Test validation fails for decreasing revenue projections"""
        data = self.get_valid_deal_memo()
        data["aegis_deal_memo"]["growth_potential"]["revenue_projection"]["year3"] = 1000000.0  # Less than year1
        
        with pytest.raises(ValueError):
            validate_deal_memo(data)

    def test_invalid_weightings_not_sum_100(self):
        """Test validation fails when analysis weightings don't sum to 100"""
        data = self.get_valid_deal_memo()
        data["aegis_deal_memo"]["analysis_weightings"]["market_opportunity"] = 50.0  # Will cause sum to exceed 100
        
        with pytest.raises(ValueError):
            validate_deal_memo(data)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])