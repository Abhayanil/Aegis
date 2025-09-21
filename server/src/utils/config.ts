import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment validation schema
const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // OpenAI configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  
  // Google Cloud configuration
  GOOGLE_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  
  // Vertex AI configuration
  VERTEX_AI_LOCATION: z.string().default('us-central1'),
  VERTEX_AI_MODEL: z.string().default('gemini-1.5-pro'),
  
  // Vision API configuration
  VISION_API_ENDPOINT: z.string().optional(),
  
  // BigQuery configuration
  BIGQUERY_DATASET: z.string().default('market_data'),
  BIGQUERY_TABLE: z.string().default('sector_benchmarks'),
  
  // Firebase configuration
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default('(default)'),
  
  // Google Drive configuration
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
});

// Validate and export configuration
const env = envSchema.parse(process.env);

export const appConfig = {
  server: {
    port: parseInt(env.PORT),
    nodeEnv: env.NODE_ENV,
  },
  
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  },
  
  googleCloud: {
    projectId: env.GOOGLE_PROJECT_ID || 'aegis-dev-project',
    applicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS,
    geminiApiKey: env.GEMINI_API_KEY,
    
    vertexAI: {
      location: env.VERTEX_AI_LOCATION,
      model: env.VERTEX_AI_MODEL,
    },
    
    vision: {
      endpoint: env.VISION_API_ENDPOINT,
    },
    
    bigQuery: {
      dataset: env.BIGQUERY_DATASET,
      table: env.BIGQUERY_TABLE,
    },
    
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      databaseId: env.FIRESTORE_DATABASE_ID,
    },
    
    drive: {
      clientId: env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
      refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN,
    },
  },
  
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
} as const;

export type AppConfig = typeof appConfig;