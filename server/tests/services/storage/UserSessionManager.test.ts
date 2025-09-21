// Integration tests for User Session Manager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserSessionManager, UserSession, UserProfile } from '../../../src/services/storage/UserSessionManager.js';

// Mock Firebase
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      })),
      add: vi.fn(),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(),
          })),
          get: vi.fn(),
        })),
        limit: vi.fn(() => ({
          get: vi.fn(),
        })),
        get: vi.fn(),
      })),
    })),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn(),
    })),
  })),
}));

vi.mock('@google-cloud/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('UserSessionManager', () => {
  let sessionManager: UserSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new UserSessionManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a new user session successfully', async () => {
      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
      };
      const mockUserDoc = {
        exists: true,
        ref: {
          update: vi.fn().mockResolvedValue(undefined),
        },
      };
      const mockCollection = {
        doc: vi.fn()
          .mockReturnValueOnce(mockDoc) // sessions collection
          .mockReturnValueOnce(mockUserDoc), // users collection
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).usersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        }),
      };

      const result = await sessionManager.createSession(
        'user-123',
        'test@example.com',
        'Test User',
        24,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        isActive: true,
        version: 1,
      });

      expect(result.sessionToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should handle session creation errors', async () => {
      const mockDoc = {
        set: vi.fn().mockRejectedValue(new Error('Firestore error')),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      await expect(
        sessionManager.createSession('user-123', 'test@example.com')
      ).rejects.toThrow('Failed to create session: Firestore error');
    });
  });

  describe('validateSession', () => {
    it('should validate and refresh an active session', async () => {
      const mockSessionData = {
        id: 'session-123',
        userId: 'user-123',
        sessionToken: 'valid-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        lastActivity: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDoc = {
        ref: {
          update: vi.fn().mockResolvedValue(undefined),
        },
      };

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockSessionData,
            ref: mockDoc.ref,
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockSessionData);

      const result = await sessionManager.validateSession('valid-token');

      expect(result).toMatchObject({
        id: 'session-123',
        userId: 'user-123',
        sessionToken: 'valid-token',
        isActive: true,
      });

      expect(mockDoc.ref.update).toHaveBeenCalledWith({
        lastActivity: expect.any(Object),
        updatedAt: expect.any(Object),
      });
    });

    it('should return null for expired session', async () => {
      const mockSessionData = {
        id: 'session-123',
        userId: 'user-123',
        sessionToken: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        lastActivity: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockSessionData,
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockSessionData);
      vi.mocked(sessionManager as any).invalidateSession = vi.fn().mockResolvedValue(undefined);

      const result = await sessionManager.validateSession('expired-token');

      expect(result).toBeNull();
      expect((sessionManager as any).invalidateSession).toHaveBeenCalledWith('session-123');
    });

    it('should return null for non-existent session', async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.validateSession('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate a session', async () => {
      const mockDoc = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      await sessionManager.invalidateSession('session-123');

      expect(mockDoc.update).toHaveBeenCalledWith({
        isActive: false,
        updatedAt: expect.any(Object),
      });
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions for a user', async () => {
      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockSnapshot = {
        docs: [
          { ref: 'session-ref-1' },
          { ref: 'session-ref-2' },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
        batch: vi.fn().mockReturnValue(mockBatch),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      await sessionManager.invalidateAllUserSessions('user-123');

      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('createOrUpdateUserProfile', () => {
    it('should create a new user profile', async () => {
      const mockProfile = {
        email: 'test@example.com',
        displayName: 'Test User',
        organization: 'Test Corp',
        role: 'Analyst',
        preferences: {
          defaultWeightings: {
            marketOpportunity: 25,
            team: 25,
            traction: 20,
            product: 15,
            competitivePosition: 15,
          },
          notificationSettings: {
            emailNotifications: true,
            analysisComplete: true,
            weeklyDigest: false,
          },
        },
        isActive: true,
      };

      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = {
        ...mockQuery,
        doc: vi.fn().mockReturnValue(mockDoc),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.createOrUpdateUserProfile(mockProfile);

      expect(result).toMatchObject({
        email: 'test@example.com',
        displayName: 'Test User',
        organization: 'Test Corp',
        role: 'Analyst',
        isActive: true,
      });

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should update an existing user profile', async () => {
      const existingProfile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Old Name',
        organization: 'Old Corp',
        role: 'Analyst',
        preferences: {},
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const updateData = {
        email: 'test@example.com',
        displayName: 'New Name',
        organization: 'New Corp',
        role: 'Senior Analyst',
        preferences: {},
        isActive: true,
      };

      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => existingProfile,
            ref: mockDoc,
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(existingProfile);

      const result = await sessionManager.createOrUpdateUserProfile(updateData);

      expect(result.displayName).toBe('New Name');
      expect(result.organization).toBe('New Corp');
      expect(result.role).toBe('Senior Analyst');
      expect(result.id).toBe('user-123');
      expect(mockDoc.set).toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    it('should retrieve user profile by ID', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        organization: 'Test Corp',
        role: 'Analyst',
        preferences: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockProfile,
        }),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockProfile);

      const result = await sessionManager.getUserProfile('user-123');

      expect(result).toEqual(mockProfile);
      expect(mockDoc.get).toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: false,
        }),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.getUserProfile('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('checkPermission', () => {
    it('should return true for valid permission', async () => {
      const mockRule = {
        userId: 'user-123',
        resource: 'deal-memos',
        permissions: ['read', 'write'],
        grantedAt: new Date(),
        expiresAt: null,
      };

      const mockSnapshot = {
        docs: [
          {
            data: () => mockRule,
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockRule);

      const result = await sessionManager.checkPermission('user-123', 'deal-memos', 'read');

      expect(result).toBe(true);
    });

    it('should return false for invalid permission', async () => {
      const mockSnapshot = {
        docs: [],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.checkPermission('user-123', 'deal-memos', 'delete');

      expect(result).toBe(false);
    });

    it('should return false for expired permission', async () => {
      const mockRule = {
        userId: 'user-123',
        resource: 'deal-memos',
        permissions: ['read'],
        grantedAt: new Date('2023-01-01'),
        expiresAt: new Date('2023-01-02'), // Expired
      };

      const mockSnapshot = {
        docs: [
          {
            data: () => mockRule,
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;
      vi.mocked(sessionManager as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockRule);

      const result = await sessionManager.checkPermission('user-123', 'deal-memos', 'read');

      expect(result).toBe(false);
    });
  });

  describe('grantPermission', () => {
    it('should grant permission to user', async () => {
      const mockCollection = {
        add: vi.fn().mockResolvedValue({ id: 'rule-id' }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      await sessionManager.grantPermission(
        'user-123',
        'deal-memos',
        ['read', 'write'],
        'admin-456',
        new Date('2024-12-31')
      );

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          resource: 'deal-memos',
          permissions: ['read', 'write'],
          grantedBy: 'admin-456',
        })
      );
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockSnapshot = {
        empty: false,
        size: 3,
        docs: [
          { ref: 'session-ref-1' },
          { ref: 'session-ref-2' },
          { ref: 'session-ref-3' },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
        batch: vi.fn().mockReturnValue(mockBatch),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.cleanupExpiredSessions();

      expect(result).toBe(3);
      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should return 0 when no expired sessions', async () => {
      const mockSnapshot = {
        empty: true,
        size: 0,
        docs: [],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(sessionManager as any).db = mockDb;

      const result = await sessionManager.cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });
});