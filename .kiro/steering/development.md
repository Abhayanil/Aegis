---
inclusion: manual
---

# Development Guidelines

## Spec-Driven Development
When implementing complex features, follow the established spec methodology:

1. **Requirements Phase**: Create detailed user stories with EARS format acceptance criteria
2. **Design Phase**: Develop comprehensive architecture with component interfaces and data models
3. **Implementation Phase**: Execute tasks incrementally with test-driven development

## AI Deal Memo Generation Implementation
The core system follows a microservices architecture with these key principles:

### Service Organization
- **Document Processing**: Multi-format parsing with Google Cloud Vision OCR
- **AI Analysis**: Gemini-powered entity extraction and consistency checking
- **Benchmarking**: BigQuery integration for sector comparisons
- **Risk Detection**: Automated inconsistency flagging and anomaly detection
- **Deal Memo Generation**: Configurable scoring with structured JSON output

### Implementation Priorities
1. Start with data models and validation schemas
2. Build document processing pipeline with comprehensive error handling
3. Integrate Google Cloud AI services with proper retry logic
4. Implement benchmarking and risk detection engines
5. Create deal memo generation with customizable weightings
6. Add comprehensive testing and monitoring

### Code Quality Standards
- TypeScript interfaces for all data structures
- Comprehensive error handling with graceful degradation
- Unit tests for all business logic components
- Integration tests for external service interactions
- Performance monitoring and structured logging

### Google Cloud Integration Patterns
- Use service account authentication for all Google Cloud services
- Implement connection pooling and request queuing for API calls
- Add circuit breaker patterns for external service failures
- Cache frequently accessed data (benchmarks, sector classifications)
- Monitor API quotas and implement rate limiting

## Testing Strategy
- Mock external services for unit testing
- Use test datasets for integration testing
- Validate JSON schema compliance for all outputs
- Test error scenarios and recovery mechanisms
- Performance test with realistic document sizes and volumes