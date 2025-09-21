// Tests for Backup and Recovery Service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupRecoveryService, BackupMetadata } from '../../../src/services/storage/BackupRecoveryService.js';

// Mock Firebase
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ exists: false }),
        update: vi.fn().mockResolvedValue(undefined),
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            set: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        })),
      })),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ 
        empty: true, 
        docs: [],
        size: 0,
      }),
    })),
    batch: vi.fn(() => ({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock('@google-cloud/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('BackupRecoveryService', () => {
  let backupService: BackupRecoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    backupService = new BackupRecoveryService();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(backupService).toBeDefined();
      expect(backupService).toBeInstanceOf(BackupRecoveryService);
    });

    it('should have proper collection references', () => {
      expect((backupService as any).backupsCollection).toBeDefined();
    });
  });

  describe('createBackup', () => {
    it('should create backup metadata with proper structure', async () => {
      // Mock successful backup creation
      const mockDb = {
        collection: vi.fn((name) => {
          if (name === 'backups') {
            return {
              doc: vi.fn(() => ({
                set: vi.fn().mockResolvedValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
                collection: vi.fn(() => ({
                  doc: vi.fn(() => ({
                    set: vi.fn().mockResolvedValue(undefined),
                  })),
                })),
              })),
            };
          }
          return {
            get: vi.fn().mockResolvedValue({ docs: [] }),
          };
        }),
      };

      vi.mocked(backupService as any).db = mockDb;

      const result = await backupService.createBackup('test-user');

      expect(result).toMatchObject({
        dealMemoCount: 0,
        versionCount: 0,
        userCount: 0,
        status: 'completed',
        createdBy: 'test-user',
      });

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.backupSize).toBeGreaterThan(0);
    });

    it('should handle backup creation errors', async () => {
      const mockDb = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            set: vi.fn().mockRejectedValue(new Error('Firestore error')),
            update: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };

      vi.mocked(backupService as any).db = mockDb;

      await expect(backupService.createBackup()).rejects.toThrow('Backup failed: Firestore error');
    });
  });

  describe('listBackups', () => {
    it('should return empty array when no backups exist', async () => {
      const result = await backupService.listBackups();
      expect(result).toEqual([]);
    });

    it('should apply limit parameter', async () => {
      const mockSnapshot = {
        docs: Array(10).fill(null).map((_, i) => ({
          data: () => ({
            id: `backup-${i}`,
            timestamp: new Date(),
            status: 'completed',
            dealMemoCount: 5,
            versionCount: 10,
            userCount: 2,
            backupSize: 1000,
          }),
        })),
      };

      const mockCollection = {
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      vi.mocked(backupService as any).backupsCollection = mockCollection;
      vi.mocked(backupService as any).deserializeFromFirestore = vi.fn().mockImplementation(data => data);

      const result = await backupService.listBackups(5);

      expect(mockCollection.limit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(10); // Mock returns 10 items
    });
  });

  describe('getBackup', () => {
    it('should return null for non-existent backup', async () => {
      const result = await backupService.getBackup('non-existent-id');
      expect(result).toBeNull();
    });

    it('should throw error when backup data is missing', async () => {
      const mockMetadataDoc = {
        exists: true,
        data: () => ({ id: 'test-backup' }),
      };

      const mockDataDoc = {
        exists: false,
      };

      const mockCollection = {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockMetadataDoc),
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockDataDoc),
            })),
          })),
        })),
      };

      vi.mocked(backupService as any).backupsCollection = mockCollection;

      await expect(backupService.getBackup('test-backup')).rejects.toThrow('Backup data not found');
    });
  });

  describe('restoreFromBackup', () => {
    it('should handle dry run mode', async () => {
      const mockBackupData = {
        dealMemos: [{ id: 'deal1' }, { id: 'deal2' }],
        versions: [],
        users: [],
        metadata: { id: 'backup1' },
      };

      vi.mocked(backupService as any).getBackup = vi.fn().mockResolvedValue(mockBackupData);

      const result = await backupService.restoreFromBackup('backup1', { dryRun: true });

      expect(result).toEqual({
        restored: 2,
        skipped: 0,
        errors: [],
      });
    });

    it('should throw error for non-existent backup', async () => {
      vi.mocked(backupService as any).getBackup = vi.fn().mockResolvedValue(null);

      await expect(
        backupService.restoreFromBackup('non-existent')
      ).rejects.toThrow('Backup not found: non-existent');
    });
  });

  describe('cleanupOldBackups', () => {
    it('should return 0 when no old backups exist', async () => {
      const result = await backupService.cleanupOldBackups(30);
      expect(result).toBe(0);
    });

    it('should delete old backups and return count', async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            ref: 'backup-ref-1',
            ref: {
              collection: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ docs: [] }),
              })),
            },
          },
          {
            ref: 'backup-ref-2',
            ref: {
              collection: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ docs: [] }),
              })),
            },
          },
        ],
      };

      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockDb = {
        batch: vi.fn().mockReturnValue(mockBatch),
      };

      vi.mocked(backupService as any).backupsCollection = mockCollection;
      vi.mocked(backupService as any).db = mockDb;

      const result = await backupService.cleanupOldBackups(30);

      expect(result).toBe(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('verifyBackup', () => {
    it('should return invalid for non-existent backup', async () => {
      vi.mocked(backupService as any).getBackup = vi.fn().mockResolvedValue(null);

      const result = await backupService.verifyBackup('non-existent');

      expect(result).toEqual({
        isValid: false,
        issues: ['Backup not found'],
      });
    });

    it('should detect metadata inconsistencies', async () => {
      const mockBackupData = {
        dealMemos: [{ id: 'deal1' }, { id: 'deal2' }],
        versions: [{ id: 'v1' }],
        users: [],
        metadata: {
          dealMemoCount: 3, // Mismatch: should be 2
          versionCount: 2,  // Mismatch: should be 1
        },
      };

      vi.mocked(backupService as any).getBackup = vi.fn().mockResolvedValue(mockBackupData);

      const result = await backupService.verifyBackup('test-backup');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Deal memo count mismatch: expected 3, found 2');
      expect(result.issues).toContain('Version count mismatch: expected 2, found 1');
    });

    it('should return valid for consistent backup', async () => {
      const mockBackupData = {
        dealMemos: [
          { id: 'deal1', dealMemo: { summary: {} } },
          { id: 'deal2', dealMemo: { summary: {} } },
        ],
        versions: [{ id: 'v1' }],
        users: [],
        metadata: {
          dealMemoCount: 2,
          versionCount: 1,
        },
      };

      vi.mocked(backupService as any).getBackup = vi.fn().mockResolvedValue(mockBackupData);

      const result = await backupService.verifyBackup('test-backup');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    it('should generate unique backup IDs', () => {
      const id1 = (backupService as any).generateBackupId();
      const id2 = (backupService as any).generateBackupId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9]{6}$/);
    });

    it('should serialize and deserialize data correctly', () => {
      const testData = {
        timestamp: new Date('2023-01-01'),
        status: 'completed',
        nested: {
          createdAt: new Date('2023-01-02'),
        },
      };

      const serialized = (backupService as any).serializeForFirestore(testData);
      const deserialized = (backupService as any).deserializeFromFirestore(serialized);

      expect(deserialized.status).toBe('completed');
      expect(deserialized.timestamp).toBeInstanceOf(Date);
      expect(deserialized.nested.createdAt).toBeInstanceOf(Date);
    });
  });
});