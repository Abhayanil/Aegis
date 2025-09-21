// User session management for Firebase authentication
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { initializeFirestore } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { BaseEntity } from '../../types/interfaces.js';

export interface UserSession extends BaseEntity {
  userId: string;
  email?: string;
  displayName?: string;
  sessionToken: string;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface UserProfile extends BaseEntity {
  email: string;
  displayName?: string;
  organization?: string;
  role?: string;
  preferences: {
    defaultWeightings?: {
      marketOpportunity: number;
      team: number;
      traction: number;
      product: number;
      competitivePosition: number;
    };
    notificationSettings?: {
      emailNotifications: boolean;
      analysisComplete: boolean;
      weeklyDigest: boolean;
    };
  };
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface AccessControlRule {
  userId: string;
  resource: string;
  permissions: string[];
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

export class UserSessionManager {
  private db: Firestore;
  private sessionsCollection;
  private usersCollection;
  private accessControlCollection;

  constructor() {
    this.db = initializeFirestore();
    this.sessionsCollection = this.db.collection('userSessions');
    this.usersCollection = this.db.collection('users');
    this.accessControlCollection = this.db.collection('accessControl');
  }

  /**
   * Create a new user session
   */
  async createSession(
    userId: string,
    email?: string,
    displayName?: string,
    sessionDurationHours: number = 24,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + sessionDurationHours * 60 * 60 * 1000);
      const sessionToken = this.generateSessionToken();

      const session: UserSession = {
        id: this.generateId(),
        userId,
        email,
        displayName,
        sessionToken,
        expiresAt,
        lastActivity: now,
        ipAddress,
        userAgent,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await this.sessionsCollection.doc(session.id).set(this.serializeForFirestore(session));
      
      // Update user's last login
      await this.updateUserLastLogin(userId);
      
      logger.info(`Session created for user: ${userId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and refresh a session
   */
  async validateSession(sessionToken: string): Promise<UserSession | null> {
    try {
      const snapshot = await this.sessionsCollection
        .where('sessionToken', '==', sessionToken)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const sessionDoc = snapshot.docs[0];
      const session = this.deserializeFromFirestore(sessionDoc.data()) as UserSession;

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.invalidateSession(session.id);
        return null;
      }

      // Update last activity
      const now = new Date();
      await sessionDoc.ref.update({
        lastActivity: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      session.lastActivity = now;
      session.updatedAt = now;

      return session;
    } catch (error) {
      logger.error('Failed to validate session:', error);
      throw new Error(`Failed to validate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      await this.sessionsCollection.doc(sessionId).update({
        isActive: false,
        updatedAt: Timestamp.now(),
      });
      
      logger.info(`Session invalidated: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to invalidate session:', error);
      throw new Error(`Failed to invalidate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const snapshot = await this.sessionsCollection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      const batch = this.db.batch();
      const now = Timestamp.now();

      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: now,
        });
      });

      await batch.commit();
      
      logger.info(`All sessions invalidated for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to invalidate user sessions:', error);
      throw new Error(`Failed to invalidate sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    try {
      const existingSnapshot = await this.usersCollection
        .where('email', '==', profile.email)
        .limit(1)
        .get();

      const now = new Date();

      if (!existingSnapshot.empty) {
        // Update existing user
        const userDoc = existingSnapshot.docs[0];
        const existingUser = this.deserializeFromFirestore(userDoc.data()) as UserProfile;
        
        const updatedProfile: UserProfile = {
          ...existingUser,
          ...profile,
          updatedAt: now,
        };

        await userDoc.ref.set(this.serializeForFirestore(updatedProfile));
        return updatedProfile;
      } else {
        // Create new user
        const newProfile: UserProfile = {
          id: this.generateId(),
          ...profile,
          createdAt: now,
          updatedAt: now,
        };

        await this.usersCollection.doc(newProfile.id).set(this.serializeForFirestore(newProfile));
        return newProfile;
      }
    } catch (error) {
      logger.error('Failed to create/update user profile:', error);
      throw new Error(`Failed to manage user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const doc = await this.usersCollection.doc(userId).get();
      
      if (!doc.exists) {
        return null;
      }

      return this.deserializeFromFirestore(doc.data()!) as UserProfile;
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user profile by email
   */
  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    try {
      const snapshot = await this.usersCollection
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return this.deserializeFromFirestore(snapshot.docs[0].data()) as UserProfile;
    } catch (error) {
      logger.error('Failed to get user profile by email:', error);
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check user permissions for a resource
   */
  async checkPermission(userId: string, resource: string, permission: string): Promise<boolean> {
    try {
      const snapshot = await this.accessControlCollection
        .where('userId', '==', userId)
        .where('resource', '==', resource)
        .get();

      for (const doc of snapshot.docs) {
        const rule = this.deserializeFromFirestore(doc.data()) as AccessControlRule;
        
        // Check if rule is expired
        if (rule.expiresAt && rule.expiresAt < new Date()) {
          continue;
        }

        if (rule.permissions.includes(permission) || rule.permissions.includes('*')) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: string,
    resource: string,
    permissions: string[],
    grantedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const rule: AccessControlRule = {
        userId,
        resource,
        permissions,
        grantedAt: new Date(),
        grantedBy,
        expiresAt,
      };

      await this.accessControlCollection.add(this.serializeForFirestore(rule));
      
      logger.info(`Permissions granted to user ${userId} for resource ${resource}`);
    } catch (error) {
      logger.error('Failed to grant permission:', error);
      throw new Error(`Failed to grant permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const snapshot = await this.sessionsCollection
        .where('expiresAt', '<', Timestamp.fromDate(now))
        .where('isActive', '==', true)
        .get();

      if (snapshot.empty) {
        return 0;
      }

      const batch = this.db.batch();
      const updateTime = Timestamp.now();

      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: updateTime,
        });
      });

      await batch.commit();
      
      logger.info(`Cleaned up ${snapshot.size} expired sessions`);
      return snapshot.size;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      throw new Error(`Failed to cleanup sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user's last login time
   */
  private async updateUserLastLogin(userId: string): Promise<void> {
    try {
      const userDoc = await this.usersCollection.doc(userId).get();
      if (userDoc.exists) {
        await userDoc.ref.update({
          lastLoginAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      logger.warn('Failed to update user last login:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a unique ID
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
   * Serialize data for Firestore
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