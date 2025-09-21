// Google Cloud service initialization utilities
import { BigQuery } from '@google-cloud/bigquery';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VertexAI } from '@google-cloud/vertexai';
import { appConfig } from './config.js';
import { logger } from './logger.js';

// Initialize Google Cloud clients
let bigQueryClient: BigQuery | null = null;
let firestoreClient: Firestore | null = null;
let storageClient: Storage | null = null;
let visionClient: ImageAnnotatorClient | null = null;
let vertexAIClient: VertexAI | null = null;

export function initializeBigQuery(): BigQuery {
  if (!bigQueryClient) {
    try {
      const config: any = {
        projectId: appConfig.googleCloud.projectId,
      };
      
      if (appConfig.googleCloud.applicationCredentials) {
        config.keyFilename = appConfig.googleCloud.applicationCredentials;
      }
      
      bigQueryClient = new BigQuery(config);
      logger.info('BigQuery client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize BigQuery client:', error);
      throw error;
    }
  }
  return bigQueryClient;
}

export function initializeFirestore(): Firestore {
  if (!firestoreClient) {
    try {
      const config: any = {
        projectId: appConfig.googleCloud.firebase.projectId || appConfig.googleCloud.projectId,
        databaseId: appConfig.googleCloud.firebase.databaseId,
      };

      if (appConfig.googleCloud.applicationCredentials) {
        config.keyFilename = appConfig.googleCloud.applicationCredentials;
      } else if (appConfig.googleCloud.firebase.clientEmail && appConfig.googleCloud.firebase.privateKey) {
        config.credentials = {
          client_email: appConfig.googleCloud.firebase.clientEmail,
          private_key: appConfig.googleCloud.firebase.privateKey,
        };
      }

      firestoreClient = new Firestore(config);
      logger.info('Firestore client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firestore client:', error);
      throw error;
    }
  }
  return firestoreClient;
}

export function initializeStorage(): Storage {
  if (!storageClient) {
    try {
      const config: any = {
        projectId: appConfig.googleCloud.projectId,
      };
      
      if (appConfig.googleCloud.applicationCredentials) {
        config.keyFilename = appConfig.googleCloud.applicationCredentials;
      }
      
      storageClient = new Storage(config);
      logger.info('Cloud Storage client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Cloud Storage client:', error);
      throw error;
    }
  }
  return storageClient;
}

export function initializeVision(): ImageAnnotatorClient {
  if (!visionClient) {
    try {
      const config: any = {
        projectId: appConfig.googleCloud.projectId,
      };
      
      if (appConfig.googleCloud.applicationCredentials) {
        config.keyFilename = appConfig.googleCloud.applicationCredentials;
      }
      
      visionClient = new ImageAnnotatorClient(config);
      logger.info('Vision API client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Vision API client:', error);
      throw error;
    }
  }
  return visionClient;
}

export function initializeVertexAI(): VertexAI {
  if (!vertexAIClient) {
    try {
      vertexAIClient = new VertexAI({
        project: appConfig.googleCloud.projectId,
        location: appConfig.googleCloud.vertexAI.location,
      });
      logger.info('Vertex AI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Vertex AI client:', error);
      throw error;
    }
  }
  return vertexAIClient;
}

// Health check functions
export async function checkBigQueryHealth(): Promise<boolean> {
  try {
    const client = initializeBigQuery();
    await client.getDatasets({ maxResults: 1 });
    return true;
  } catch (error) {
    logger.error('BigQuery health check failed:', error);
    return false;
  }
}

export async function checkFirestoreHealth(): Promise<boolean> {
  try {
    const client = initializeFirestore();
    await client.listCollections();
    return true;
  } catch (error) {
    logger.error('Firestore health check failed:', error);
    return false;
  }
}

export async function checkVisionHealth(): Promise<boolean> {
  try {
    const client = initializeVision();
    // Simple health check - this will fail gracefully if credentials are invalid
    await client.getProjectId();
    return true;
  } catch (error) {
    logger.error('Vision API health check failed:', error);
    return false;
  }
}

// Cleanup functions
export function cleanup(): void {
  bigQueryClient = null;
  firestoreClient = null;
  storageClient = null;
  visionClient = null;
  vertexAIClient = null;
  logger.info('Google Cloud clients cleaned up');
}