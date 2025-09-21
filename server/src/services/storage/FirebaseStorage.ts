// Firebase storage service for deal memo persistence
import { Firestore, CollectionReference, DocumentReference, Query, Timestamp } from '@google-cloud/firestore';
import { initializeFirestore } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { DealMemo, DealMemoInput } from '../../models/DealMemo.js';
import { BaseEntity } from '../../types/interfaces.js';

export interface StoredDealMemo extends BaseEntity {
  dealMemo: DealMemoInput;
  version: number;
  userId?: string;
  companyName: string;
  sector: string;
  tags: string[];
  isArchived: boolean;
}

export interface DealMemoQuery {
  userId?: string;
  companyName?: string;
  sector?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface DealMemoVersion {
  id: string;
  version: number;
  dealMemo: DealMemoInput;
  createdAt: Date;
  createdBy?: string;
  changeDescription?: string;
}

export class FirebaseStorage {
  private db: Firestore;
  private dealMemosCollection: CollectionReference;
  private versionsCollection: CollectionReference;
  private usersCollection: CollectionReference;

  constructor() {
    this.db = initializeFirestore();
    this.dealMemosCollection = this.db.collection('dealMemos');
    this.versionsCollection = this.db.collection('dealMemoVersions');
    this.usersCollection = this.db.collection('users');
  }

  /**
   * Store a new deal memo
   */
  async storeDealMemo(
    dealMemoInput: DealMemoInput,
    userId?: string,
    tags: string[] = []
  ): Promise<StoredDealMemo> {
    try {
      const now = new Date();
      const id = this.generateId();
      
      const storedDealMemo: StoredDealMemo = {
        id,
        dealMemo: dealMemoInput,
        version: 1,
        userId,
        companyName: dealMemoInput.summary.companyName,
        sector: dealMemoInput.summary.sector,
        tags,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      // Store the deal memo
      await this.dealMemosCollection.doc(id).set(this.serializeForFirestore(storedDealMemo));
      
      // Store the initial version
      await this.storeVersion(id, 1, dealMemoInput, userId, 'Initial version');
      
      logger.info(`Deal memo stored successfully: ${id}`);
      return storedDealMemo;
    } catch (error) {
      logger.error('Failed to store deal memo:', error);
      throw new Error(`Failed to store deal memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing deal memo (creates new version)
   */
  async updateDealMemo(
    id: string,
    dealMemoInput: DealMemoInput,
    userId?: string,
    changeDescription?: string
  ): Promise<StoredDealMemo> {
    try {
      const docRef = this.dealMemosCollection.doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error(`Deal memo not found: ${id}`);
      }

      const existingData = this.deserializeFromFirestore(doc.data()!) as StoredDealMemo;
      const newVersion = existingData.version + 1;
      const now = new Date();

      const updatedDealMemo: StoredDealMemo = {
        ...existingData,
        dealMemo: dealMemoInput,
        version: newVersion,
        companyName: dealMemoInput.summary.companyName,
        sector: dealMemoInput.summary.sector,
        updatedAt: now,
      };

      // Update the main document
      await docRef.set(this.serializeForFirestore(updatedDealMemo));
      
      // Store the new version
      await this.storeVersion(id, newVersion, dealMemoInput, userId, changeDescription);
      
      logger.info(`Deal memo updated successfully: ${id}, version: ${newVersion}`);
      return updatedDealMemo;
    } catch (error) {
      logger.error('Failed to update deal memo:', error);
      throw new Error(`Failed to update deal memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a deal memo by ID
   */
  async getDealMemo(id: string): Promise<StoredDealMemo | null> {
    try {
      const doc = await this.dealMemosCollection.doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      return this.deserializeFromFirestore(doc.data()!) as StoredDealMemo;
    } catch (error) {
      logger.error('Failed to retrieve deal memo:', error);
      throw new Error(`Failed to retrieve deal memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query deal memos with filters
   */
  async queryDealMemos(query: DealMemoQuery): Promise<StoredDealMemo[]> {
    try {
      let firestoreQuery: Query = this.dealMemosCollection;

      // Apply filters
      if (query.userId) {
        firestoreQuery = firestoreQuery.where('userId', '==', query.userId);
      }
      
      if (query.companyName) {
        firestoreQuery = firestoreQuery.where('companyName', '==', query.companyName);
      }
      
      if (query.sector) {
        firestoreQuery = firestoreQuery.where('sector', '==', query.sector);
      }
      
      if (query.tags && query.tags.length > 0) {
        firestoreQuery = firestoreQuery.where('tags', 'array-contains-any', query.tags);
      }
      
      if (query.dateFrom) {
        firestoreQuery = firestoreQuery.where('createdAt', '>=', Timestamp.fromDate(query.dateFrom));
      }
      
      if (query.dateTo) {
        firestoreQuery = firestoreQuery.where('createdAt', '<=', Timestamp.fromDate(query.dateTo));
      }

      // Apply ordering and limits
      firestoreQuery = firestoreQuery.orderBy('updatedAt', 'desc');
      
      if (query.limit) {
        firestoreQuery = firestoreQuery.limit(query.limit);
      }
      
      if (query.offset) {
        firestoreQuery = firestoreQuery.offset(query.offset);
      }

      const snapshot = await firestoreQuery.get();
      
      return snapshot.docs.map(doc => 
        this.deserializeFromFirestore(doc.data()) as StoredDealMemo
      );
    } catch (error) {
      logger.error('Failed to query deal memos:', error);
      throw new Error(`Failed to query deal memos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all versions of a deal memo
   */
  async getDealMemoVersions(dealMemoId: string): Promise<DealMemoVersion[]> {
    try {
      const snapshot = await this.versionsCollection
        .where('dealMemoId', '==', dealMemoId)
        .orderBy('version', 'desc')
        .get();

      return snapshot.docs.map(doc => {
        const data = this.deserializeFromFirestore(doc.data());
        return {
          id: doc.id,
          version: data.version,
          dealMemo: data.dealMemo,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          changeDescription: data.changeDescription,
        };
      });
    } catch (error) {
      logger.error('Failed to retrieve deal memo versions:', error);
      throw new Error(`Failed to retrieve versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive a deal memo
   */
  async archiveDealMemo(id: string): Promise<void> {
    try {
      await this.dealMemosCollection.doc(id).update({
        isArchived: true,
        updatedAt: Timestamp.now(),
      });
      
      logger.info(`Deal memo archived: ${id}`);
    } catch (error) {
      logger.error('Failed to archive deal memo:', error);
      throw new Error(`Failed to archive deal memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a deal memo and all its versions
   */
  async deleteDealMemo(id: string): Promise<void> {
    try {
      const batch = this.db.batch();
      
      // Delete main document
      batch.delete(this.dealMemosCollection.doc(id));
      
      // Delete all versions
      const versionsSnapshot = await this.versionsCollection
        .where('dealMemoId', '==', id)
        .get();
      
      versionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      logger.info(`Deal memo and versions deleted: ${id}`);
    } catch (error) {
      logger.error('Failed to delete deal memo:', error);
      throw new Error(`Failed to delete deal memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a version of a deal memo
   */
  private async storeVersion(
    dealMemoId: string,
    version: number,
    dealMemo: DealMemoInput,
    createdBy?: string,
    changeDescription?: string
  ): Promise<void> {
    const versionData = {
      dealMemoId,
      version,
      dealMemo,
      createdAt: new Date(),
      createdBy,
      changeDescription,
    };

    await this.versionsCollection.add(this.serializeForFirestore(versionData));
  }

  /**
   * Generate a unique ID for documents
   */
  private generateId(): string {
    try {
      return this.db.collection('_').doc().id;
    } catch (error) {
      // Fallback to a simple UUID-like string for testing
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }

  /**
   * Serialize data for Firestore storage (convert Dates to Timestamps)
   */
  private serializeForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (data instanceof Date) {
      return Timestamp.fromDate(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.serializeForFirestore(item));
    }
    
    if (typeof data === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeForFirestore(value);
      }
      return serialized;
    }
    
    return data;
  }

  /**
   * Deserialize data from Firestore (convert Timestamps to Dates)
   */
  private deserializeFromFirestore(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    // Check if it's a Firestore Timestamp by checking for toDate method
    if (data && typeof data === 'object' && typeof data.toDate === 'function') {
      return data.toDate();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.deserializeFromFirestore(item));
    }
    
    if (typeof data === 'object') {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        deserialized[key] = this.deserializeFromFirestore(value);
      }
      return deserialized;
    }
    
    return data;
  }

  /**
   * Health check for Firebase connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.listCollections();
      return true;
    } catch (error) {
      logger.error('Firebase health check failed:', error);
      return false;
    }
  }
}