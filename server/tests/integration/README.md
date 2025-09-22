# Integration Test Suite

This comprehensive integration test suite provides end-to-end testing, performance benchmarking, validation, and quality assurance for the AI Deal Memo Generation system.

## Overview

The integration test suite consists of four main components:

1. **End-to-End Tests** (`e2e.test.ts`) - Complete workflow testing from document upload to deal memo generation
2. **Performance Tests** (`performance.test.ts`) - Load testing, benchmarking, and performance regression detection
3. **Validation Tests** (`validation.test.ts`) - Deal memo accuracy, consistency, and schema compliance testing
4. **Google Cloud Integration Tests** (`google-cloud.test.ts`) - External service integration and resilience testing
5. **Quality Assurance Tests** (`quality-assurance.test.ts`) - System validation, regression testing, and A/B testing framework

## Quick Start

### Running All Integration Tests

```bash
# Run complete integration test suite
npm run test:integration

# Run with verbose output
npm run test:integration:verbose
```

### Running Specific Test Suites

```bash
# End-to-end tests only
npm run test:integration:e2e

# Performance tests only
npm run test:integration:performance

# Validation tests only
npm run test:integration:validation

# Google Cloud integration tests only
npm run test:integration:google-cloud
```

### Using the Test Runner

The custom test runner provides advanced features:

```bash
# Run specific test mode
node tests/integration/test-runner.js --mode e2e

# Enable verbose output
node tests/integration/test-runner.js --verbose

# Custom report path
node tests/integration/test-runner.js --report ./custom-report.json

# Show help
node tests/integration/test-runner.js --help
```

## Test Structure

### Directory Layout

```
tests/integration/
├── README.md                     # This file
├── e2e.test.ts                   # End-to-end integration tests
├── performance.test.ts           # Performance and load tests
├── validation.test.ts            # Deal memo validation tests
├── google-cloud.test.ts          # Google Cloud service tests
├── quality-assurance.test.ts     # Quality assurance framework
├── test-runner.ts                # Custom test runner
├── setup.ts                      # Test setup and utilities
├── global-setup.ts               # Global test environment setup
├── global-teardown.ts            # Global test cleanup
├── vitest.integration.config.ts  # Vitest configuration
├── utils/                        # Test utilities
│   ├── quality-assessor.ts       # Deal memo quality assessment
│   ├── regression-tester.ts      # Regression testing framework
│   └── ab-test-framework.ts      # A/B testing utilities
├── data/                         # Test data and baselines
├── config/                       # Test configurations
├── reports/                      # Generated test reports
└── temp/                         # Temporary test files
```

### Test Categories

#### 1. End-to-End Tests

Tests complete user workflows:
- Document upload and processing
- Deal memo generation with various configurations
- Export functionality
- Error handling and recovery
- Concurrent request handling

**Key Features:**
- Real workflow simulation
- Multi-document processing
- Custom weighting configurations
- Schema validation
- Performance thresholds

#### 2. Performance Tests

Comprehensive performance testing:
- Single document processing benchmarks
- Multi-document scaling analysis
- Concurrent request handling
- Memory usage monitoring
- Performance regression detection

**Performance Thresholds:**
- Single document: < 5 seconds
- Multiple documents: < 15 seconds
- Deal memo generation: < 20 seconds
- Concurrent requests: < 30 seconds

#### 3. Validation Tests

Deal memo quality and accuracy validation:
- Schema compliance testing
- Data accuracy verification
- Cross-document consistency checking
- Industry standard validation
- Quality metrics assessment

**Validation Criteria:**
- Schema compliance: 100%
- Data accuracy: > 85%
- Consistency score: > 90%
- Completeness: > 90%

#### 4. Google Cloud Integration Tests

External service integration testing:
- BigQuery benchmarking queries
- Firestore data persistence
- Cloud Vision OCR processing
- Vertex AI model interactions
- Service health monitoring
- Circuit breaker patterns
- Graceful degradation

#### 5. Quality Assurance Tests

Advanced quality assurance framework:
- Deal memo quality assessment
- Regression testing over time
- A/B testing for improvements
- Statistical analysis
- Bayesian optimization

## Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test
LOG_LEVEL=error

# Google Cloud (for integration tests)
GOOGLE_CLOUD_PROJECT=your-test-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/test-credentials.json

# Test-specific settings
VERBOSE_TESTS=true                # Enable verbose test output
DISABLE_EXTERNAL_SERVICES=true   # Mock external services
MOCK_EXTERNAL_APIS=true          # Use mocked API responses
```

### Test Configuration Files

- `vitest.integration.config.ts` - Vitest configuration for integration tests
- `config/regression-config.json` - Regression testing parameters
- `config/ab-test-config.json` - A/B testing configurations

## Quality Assessment Framework

### Deal Memo Quality Metrics

The quality assessor evaluates deal memos across multiple dimensions:

1. **Completeness** (25% weight)
   - Required sections present
   - Sufficient detail in each section
   - Adequate number of benchmarks and risks

2. **Accuracy** (25% weight)
   - Data extraction accuracy
   - Realistic metric values
   - Consistent recommendations

3. **Consistency** (20% weight)
   - Cross-section alignment
   - Signal score vs. recommendation consistency
   - Balanced risk/growth assessment

4. **Relevance** (20% weight)
   - Investment-relevant benchmarks
   - Actionable risk factors
   - Pertinent due diligence questions

5. **Quality Metrics** (10% weight)
   - Signal score reliability
   - Risk assessment completeness
   - Recommendation clarity

### Quality Thresholds

- **Excellent**: > 0.9 overall score
- **Good**: 0.8 - 0.9 overall score
- **Acceptable**: 0.7 - 0.8 overall score
- **Needs Improvement**: < 0.7 overall score

## Regression Testing

### Baseline Management

The regression tester maintains historical baselines:
- Test case performance over time
- Quality score trends
- Processing time benchmarks
- Error rate tracking

### Regression Detection

Automatic detection of:
- Quality score degradation (> 10% decline)
- Performance regressions (> 20% slowdown)
- Increased error rates (> 5% increase)
- Schema compliance issues

### Trend Analysis

Statistical analysis of performance trends:
- Linear regression on quality scores
- Confidence intervals for predictions
- Early warning for declining performance
- Recommendations for improvement

## A/B Testing Framework

### Test Design

The A/B testing framework supports:
- Multi-variant testing (A/B/C/D...)
- Statistical significance calculation
- Bayesian analysis for continuous monitoring
- Power analysis for sample size determination

### Supported Test Types

1. **Prompt Optimization**
   - Different system prompts
   - Varied instruction formats
   - Context length variations

2. **Algorithm Improvements**
   - Weighting strategies
   - Scoring methodologies
   - Risk assessment approaches

3. **Configuration Changes**
   - Processing parameters
   - Validation thresholds
   - Output formats

### Statistical Methods

- **Frequentist**: T-tests, ANOVA, chi-square tests
- **Bayesian**: Posterior distributions, probability of superiority
- **Effect Size**: Cohen's d, eta-squared
- **Power Analysis**: Sample size recommendations

## Reporting

### Automated Reports

The test suite generates comprehensive reports:

1. **Test Execution Report**
   - Pass/fail status for all tests
   - Performance metrics
   - Error summaries
   - Recommendations

2. **Quality Assessment Report**
   - Deal memo quality scores
   - Issue identification
   - Improvement recommendations
   - Trend analysis

3. **Performance Report**
   - Benchmark results
   - Regression analysis
   - Resource usage metrics
   - Scaling characteristics

4. **A/B Test Report**
   - Statistical significance
   - Effect sizes
   - Confidence intervals
   - Implementation recommendations

### Report Formats

- **JSON**: Machine-readable detailed results
- **HTML**: Human-readable visual reports
- **CSV**: Data export for external analysis

## Best Practices

### Writing Integration Tests

1. **Test Isolation**: Each test should be independent
2. **Realistic Data**: Use representative test scenarios
3. **Error Handling**: Test both success and failure paths
4. **Performance Awareness**: Include timing assertions
5. **Cleanup**: Properly clean up test resources

### Mock Strategy

- **External Services**: Mock Google Cloud APIs for reliability
- **File System**: Mock file operations for speed
- **Network Calls**: Mock HTTP requests for consistency
- **Time-Dependent**: Mock date/time for reproducibility

### Debugging Integration Tests

1. **Verbose Mode**: Use `--verbose` flag for detailed output
2. **Isolated Execution**: Run single test files for focused debugging
3. **Log Analysis**: Check test logs in `reports/` directory
4. **Mock Inspection**: Verify mock calls and responses
5. **Performance Profiling**: Use built-in performance tracking

## Continuous Integration

### CI/CD Integration

The integration test suite is designed for CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    npm run test:integration
    npm run test:integration:performance
  env:
    NODE_ENV: test
    GOOGLE_CLOUD_PROJECT: ${{ secrets.TEST_PROJECT }}
```

### Quality Gates

Recommended quality gates for deployment:
- All integration tests pass
- Performance within thresholds
- Quality score > 0.8
- No high-severity regressions
- A/B test results statistically significant

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout values in test configuration
   - Check for hanging promises or connections
   - Verify mock responses are properly configured

2. **Mock Failures**
   - Ensure mocks are reset between tests
   - Verify mock configurations match actual usage
   - Check for race conditions in async operations

3. **Performance Variations**
   - Run tests multiple times for consistency
   - Check system resource availability
   - Consider environmental factors (CPU, memory)

4. **Quality Score Fluctuations**
   - Review test data for consistency
   - Check for changes in analysis algorithms
   - Verify baseline data is current

### Getting Help

1. Check test logs in `reports/` directory
2. Run tests with `--verbose` flag for detailed output
3. Review mock configurations in `setup.ts`
4. Examine test data in `data/` directory
5. Consult the main project documentation

## Contributing

### Adding New Tests

1. Follow existing test patterns and structure
2. Include both positive and negative test cases
3. Add appropriate performance assertions
4. Update this README with new test descriptions
5. Ensure tests are deterministic and reliable

### Updating Quality Metrics

1. Modify quality assessment criteria in `utils/quality-assessor.ts`
2. Update baseline data if metrics change significantly
3. Document changes in test reports
4. Consider backward compatibility for trend analysis

### Extending A/B Testing

1. Add new test configurations in `utils/ab-test-framework.ts`
2. Implement statistical methods as needed
3. Update reporting to include new metrics
4. Validate statistical assumptions and methods

---

For more information about the AI Deal Memo Generation system, see the main project documentation.