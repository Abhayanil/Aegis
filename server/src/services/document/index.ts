// Document processing service exports
export * from './DocumentProcessor.js';
export * from './TextExtractor.js';
export * from './OCRProcessor.js';
export * from './ContentStructurer.js';
export * from './parsers/BaseParser.js';
export * from './parsers/PDFParser.js';
export * from './parsers/DOCXParser.js';
export * from './parsers/PPTXParser.js';
export * from './parsers/TXTParser.js';

// Module identifier
export const DOCUMENT_SERVICE_MODULE = 'document-processing';