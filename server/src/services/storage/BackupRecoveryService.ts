// Backup and recovery service for critical deal memo data
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { initializeFirestore } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { StoredDealMemo } from './FirebaseStorage.js';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  dealMemoCount: number;
  versionCount: number;
  userCount: number;
  backupSize: number;
  status: 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  createdBy?: string;
}

export interface BackupData {
  dealMemos: StoredDealMemo[];
  versions: any[];
  users: any[];
  metadata: BackupMetadata;
}

export interface RecoveryOptions {
  targetDate?: Date;
  includeVersions?: boolean;
  includeUsers?: boolean;
  dryRun?: boolean;
}

export class BackupRecoveryService {
  private db: Firestore;
  private backupsCollection;

  constructor() {
    this.db = initializeFirestore();
    this.backupsCollection = this.db.collection('backups');
  }

  /**
   * Create a full backup of all deal memo data
   */
  async createBackup(createdBy?: string): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const startTime = new Date();
    
    try {
      logger.info(`Starting backup creation: ${backupId}`);
      
      // Initialize backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: startTime,
        dealMemoCount: 0,
        versionCount: 0,
        userCount: 0,
        backupSize: 0,
        status: 'in_progress',
        createdBy,
      };

      // Store initial metadata
      await this.backupsCollection.doc(backupId).set(this.serializeForFirestore(metadata));

      // Backup deal memos
      const dealMemosSnapshot = await this.db.collection('dealMemos').get();
      const dealMemos = dealMemosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...this.deserializeFromFirestore(doc.data()),
      }));

      // Backup versions
      const versionsSnapshot = await this.db.collection('dealMemoVersions').get();
      const versions = versionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...this.deserializeFromFirestore(doc.data()),
      }));

      // Backup users
      const usersSnapshot = await this.db.collection('users').get();
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...this.deserializeFromFirestore(doc.data()),
      }));

      // Create backup data
      const backupData: BackupData = {
        dealMemos,
        versions,
        users,
        metadata,
      };

      // Calculate backup size (approximate)
      const backupSize = JSON.stringify(backupData).length;

      // Update metadata
      metadata.dealMemoCount = dealMemos.length;
      metadata.versionCount = versions.length;
      metadata.userCount = users.length;
      metadata.backupSize = backupSize;
      metadata.status = 'completed';

      // Store backup data
      await this.backupsCollection.doc(backupId).collection('data').doc('backup').set(backupData);
      
      // Update metadata
      await this.backupsCollection.doc(backupId).update(this.serializeForFirestore(metadata));

      logger.info(`Backup completed successfully: ${backupId}, size: ${backupSize} bytes`);
      return metadata;

    } catch (error) {
      logger.error(`Backup failed: ${backupId}`, error);
      
      // Update metadata with error
      const errorMetadata: Partial<BackupMetadata> = {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };

      try {
        await this.backupsCollection.doc(backupId).update(this.serializeForFirestore(errorMetadata));
      } catch (updateError) {
        logger.error('Failed to update backup metadata with error', updateError);
      }

      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups(limit: number = 50): Promise<BackupMetadata[]> {
    try {
      const snapshot = await this.backupsCollection
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => 
        this.deserializeFromFirestore(doc.data()) as BackupMetadata
      );
    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw new Error(`Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get backup details
   */
  async getBackup(backupId: string): Promise<BackupData | null> {
    try {
      const metadataDoc = await this.backupsCollection.doc(backupId).get();
      
      if (!metadataDoc.exists) {
        return null;
      }

      const dataDoc = await this.backupsCollection
        .doc(backupId)
        .collection('data')
        .doc('backup')
        .get();

      if (!dataDoc.exists) {
        throw new Error('Backup data not found');
      }

      return this.deserializeFromFirestore(dataDoc.data()) as BackupData;
    } catch (error) {
      logger.error('Failed to get backup:', error);
      throw new Error(`Failed to get backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(
    backupId: string, 
    options: RecoveryOptions = {}
  ): Promise<{ restored: number; skipped: number; errors: string[] }> {
    try {
      logger.info(`Starting restore from backup: ${backupId}`);
      
      const backupData = await this.getBackup(backupId);
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const results = {
        restored: 0,
        skipped: 0,
        errors: [] as string[],
      };

      if (options.dryRun) {
        logger.info('Dry run mode - no actual restoration will be performed');
        return {
          restored: backupData.dealMemos.length,
          skipped: 0,
          errors: [],
        };
      }

      // Restore deal memos
      for (const dealMemo of backupData.dealMemos) {
        try {
          const docRef = this.db.collection('dealMemos').doc(dealMemo.id);
          const existingDoc = await docRef.get();
          
          if (existingDoc.exists && !options.targetDate) {
            results.skipped++;
            continue;
          }

          await docRef.set(this.serializeForFirestore(dealMemo));
          results.restored++;
        } catch (error) {
          const errorMsg = `Failed to restore deal memo ${dealMemo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Restore versions if requested
      if (options.includeVersions && backupData.versions) {
        for (const version of backupData.versions) {
          try {
            await this.db.collection('dealMemoVersions').add(this.serializeForFirestore(version));
          } catch (error) {
            const errorMsg = `Failed to restore version ${version.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            results.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }
      }

      // Restore users if requested
      if (options.includeUsers && backupData.users) {
        for (const user of backupData.users) {
          try {
            const docRef = this.db.collection('users').doc(user.id);
            const existingDoc = await docRef.get();
            
            if (!existingDoc.exists) {
              await docRef.set(this.serializeForFirestore(user));
            }
          } catch (error) {
            const errorMsg = `Failed to restore user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            results.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }
      }

      logger.info(`Restore completed: ${results.restored} restored, ${results.skipped} skipped, ${results.errors.length} errors`);
      return results;

    } catch (error) {
      logger.error('Restore failed:', error);
      throw new Error(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const snapshot = await this.backupsCollection
        .where('timestamp', '<', Timestamp.fromDate(cutoffDate))
        .get();

      if (snapshot.empty) {
        return 0;
      }

      const batch = this.db.batch();
      let deletedCount = 0;

      for (const doc of snapshot.docs) {
        // Delete backup data subcollection
        const dataSnapshot = await doc.ref.collection('data').get();
        dataSnapshot.docs.forEach(dataDoc => {
          batch.delete(dataDoc.ref);
        });

        // Delete main backup document
        batch.delete(doc.ref);
        deletedCount++;
      }

      await batch.commit();
      
      logger.info(`Cleaned up ${deletedCount} old backups`);
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{ isValid: boolean; issues: string[] }> {
    try {
      const backupData = await this.getBackup(backupId);
      if (!backupData) {
        return { isValid: false, issues: ['Backup not found'] };
      }

      const issues: string[] = [];

      // Check metadata consistency
      if (backupData.dealMemos.length !== backupData.metadata.dealMemoCount) {
        issues.push(`Deal memo count mismatch: expected ${backupData.metadata.dealMemoCount}, found ${backupData.dealMemos.length}`);
      }

      if (backupData.versions.length !== backupData.metadata.versionCount) {
        issues.push(`Version count mismatch: expected ${backupData.metadata.versionCount}, found ${backupData.versions.length}`);
      }

      // Check data integrity
      for (const dealMemo of backupData.dealMemos) {
        if (!dealMemo.id || !dealMemo.dealMemo) {
          issues.push(`Invalid deal memo structure: ${dealMemo.id}`);
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Generate a unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Serialize data for Firestore storage
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
   * Deserialize data from Firestore
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
}