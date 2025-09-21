// WeightingManager test suite
import { describe, it, expect, beforeEach } from 'vitest';
import { WeightingManager, WeightingProfile } from '../../../src/services/dealMemo/WeightingManager.js';
import { AnalysisWeightings } from '../../../src/models/DealMemo.js';

describe('WeightingManager', () => {
  let weightingManager: WeightingManager;

  beforeEach(() => {
    weightingManager = new WeightingManager();
  });

  describe('initialization', () => {
    it('should initialize with default profiles', () => {
      const profiles = weightingManager.getAllProfiles();
      expect(profiles).toHaveLength(3);
      
      const defaultProfile = weightingManager.getDefaultProfile();
      expect(defaultProfile.name).toBe('Balanced Analysis');
      expect(defaultProfile.isDefault).toBe(true);
    });

    it('should have correct default weightings', () => {
      const defaultWeightings = WeightingManager.getDefaultWeightings();
      expect(defaultWeightings).toEqual({
        marketOpportunity: 25,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 15
      });
    });
  });

  describe('validateWeightings', () => {
    it('should validate correct weightings', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 30,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 10
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weightings that do not sum to 100%', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 30,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 5 // Total: 95%
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Total weightings must sum to 100%');
    });

    it('should reject negative weightings', () => {
      const weightings: Partial<AnalysisWeightings> = {
        marketOpportunity: -5,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 45
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('cannot be negative');
    });

    it('should reject weightings over 100%', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 150,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 15
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('cannot exceed 100%'))).toBe(true);
    });

    it('should warn about zero weightings by default', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 30,
        product: 0,
        competitivePosition: 0
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('is set to 0');
    });

    it('should allow zero weightings when configured', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 50,
        team: 50,
        traction: 0,
        product: 0,
        competitivePosition: 0
      };

      const result = weightingManager.validateWeightings(weightings, { allowZeroWeights: true });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle missing weights when not required', () => {
      const weightings: Partial<AnalysisWeightings> = {
        marketOpportunity: 50,
        team: 50
      };

      const result = weightingManager.validateWeightings(weightings, { requireAllWeights: false });
      expect(result.isValid).toBe(true); // Should pass when not requiring all weights and sum is 100%
    });

    it('should accept weightings within tolerance', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 25.1,
        team: 25.1,
        traction: 19.9,
        product: 14.9,
        competitivePosition: 15.0
      };

      const result = weightingManager.validateWeightings(weightings, { tolerancePercent: 1 });
      expect(result.isValid).toBe(true);
    });
  });

  describe('normalizeWeightings', () => {
    it('should normalize weightings to sum to 100%', () => {
      const weightings: Partial<AnalysisWeightings> = {
        marketOpportunity: 30,
        team: 30,
        traction: 20,
        product: 10,
        competitivePosition: 5 // Total: 95%
      };

      const normalized = weightingManager.normalizeWeightings(weightings);
      const total = Object.values(normalized).reduce((sum, weight) => sum + weight, 0);
      
      expect(Math.abs(total - 100)).toBeLessThan(0.01);
      expect(normalized.marketOpportunity).toBeCloseTo(31.58, 2);
      expect(normalized.team).toBeCloseTo(31.58, 2);
    });

    it('should fill missing weights with defaults', () => {
      const weightings: Partial<AnalysisWeightings> = {
        marketOpportunity: 50,
        team: 50
      };

      const normalized = weightingManager.normalizeWeightings(weightings);
      
      expect(normalized.marketOpportunity).toBeDefined();
      expect(normalized.team).toBeDefined();
      expect(normalized.traction).toBeDefined();
      expect(normalized.product).toBeDefined();
      expect(normalized.competitivePosition).toBeDefined();
    });

    it('should return defaults when all weights are zero', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 0,
        team: 0,
        traction: 0,
        product: 0,
        competitivePosition: 0
      };

      const normalized = weightingManager.normalizeWeightings(weightings);
      expect(normalized).toEqual(WeightingManager.getDefaultWeightings());
    });
  });

  describe('profile management', () => {
    it('should create a new profile', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      const profile = weightingManager.createProfile(
        'Custom Profile',
        'A custom weighting profile',
        weightings
      );

      expect(profile.name).toBe('Custom Profile');
      expect(profile.description).toBe('A custom weighting profile');
      expect(profile.weightings).toEqual(weightings);
      expect(profile.id).toBe('custom-profile');
    });

    it('should generate unique IDs for profiles with same name', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      const profile1 = weightingManager.createProfile('Test Profile', 'First', weightings);
      const profile2 = weightingManager.createProfile('Test Profile', 'Second', weightings);

      expect(profile1.id).toBe('test-profile');
      expect(profile2.id).toBe('test-profile-1');
    });

    it('should reject invalid weightings when creating profile', () => {
      const invalidWeightings: Partial<AnalysisWeightings> = {
        marketOpportunity: 150,
        team: 25
      };

      expect(() => {
        weightingManager.createProfile('Invalid', 'Invalid profile', invalidWeightings);
      }).toThrow('Invalid weightings');
    });

    it('should update an existing profile', async () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      const profile = weightingManager.createProfile('Test', 'Original', weightings);
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updatedProfile = weightingManager.updateProfile(profile.id, {
        name: 'Updated Test',
        description: 'Updated description'
      });

      expect(updatedProfile.name).toBe('Updated Test');
      expect(updatedProfile.description).toBe('Updated description');
      expect(updatedProfile.updatedAt.getTime()).toBeGreaterThan(profile.updatedAt.getTime());
    });

    it('should not allow updating default profile weightings', () => {
      const defaultProfile = weightingManager.getDefaultProfile();
      
      expect(() => {
        weightingManager.updateProfile(defaultProfile.id, {
          weightings: { marketOpportunity: 50, team: 50, traction: 0, product: 0, competitivePosition: 0 }
        });
      }).toThrow('Cannot modify weightings of default profile');
    });

    it('should retrieve profile by ID', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      const created = weightingManager.createProfile('Test', 'Test profile', weightings);
      const retrieved = weightingManager.getProfile(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent profile', () => {
      const profile = weightingManager.getProfile('non-existent');
      expect(profile).toBeUndefined();
    });

    it('should delete non-default profiles', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      const profile = weightingManager.createProfile('Test', 'Test profile', weightings);
      const deleted = weightingManager.deleteProfile(profile.id);

      expect(deleted).toBe(true);
      expect(weightingManager.getProfile(profile.id)).toBeUndefined();
    });

    it('should not delete default profile', () => {
      const defaultProfile = weightingManager.getDefaultProfile();
      
      expect(() => {
        weightingManager.deleteProfile(defaultProfile.id);
      }).toThrow('Cannot delete default weighting profile');
    });

    it('should return false when deleting non-existent profile', () => {
      const deleted = weightingManager.deleteProfile('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('import/export', () => {
    it('should export all profiles', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 40,
        team: 30,
        traction: 15,
        product: 10,
        competitivePosition: 5
      };

      weightingManager.createProfile('Export Test', 'Test profile', weightings);
      const exported = weightingManager.exportProfiles();

      expect(exported).toHaveLength(4); // 3 default + 1 custom
      expect(exported.some(p => p.name === 'Export Test')).toBe(true);
    });

    it('should import valid profiles', () => {
      const profiles: WeightingProfile[] = [
        {
          id: 'imported-1',
          name: 'Imported Profile',
          description: 'An imported profile',
          weightings: {
            marketOpportunity: 30,
            team: 30,
            traction: 20,
            product: 10,
            competitivePosition: 10
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      weightingManager.importProfiles(profiles);
      const imported = weightingManager.getProfile('imported-1');

      expect(imported).toBeDefined();
      expect(imported?.name).toBe('Imported Profile');
    });

    it('should skip invalid profiles during import', () => {
      const profiles: WeightingProfile[] = [
        {
          id: 'invalid-1',
          name: 'Invalid Profile',
          description: 'An invalid profile',
          weightings: {
            marketOpportunity: 150, // Invalid
            team: 30,
            traction: 20,
            product: 10,
            competitivePosition: 10
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      weightingManager.importProfiles(profiles);
      const imported = weightingManager.getProfile('invalid-1');

      expect(imported).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle floating point precision issues', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 33.33,
        team: 33.33,
        traction: 33.34,
        product: 0,
        competitivePosition: 0
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(true);
    });

    it('should handle very small weightings', () => {
      const weightings: AnalysisWeightings = {
        marketOpportunity: 99.99,
        team: 0.01,
        traction: 0,
        product: 0,
        competitivePosition: 0
      };

      const result = weightingManager.validateWeightings(weightings, { allowZeroWeights: true });
      expect(result.isValid).toBe(true);
    });

    it('should handle non-numeric values gracefully', () => {
      const weightings = {
        marketOpportunity: 'invalid' as any,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 15
      };

      const result = weightingManager.validateWeightings(weightings);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be a number');
    });
  });
});