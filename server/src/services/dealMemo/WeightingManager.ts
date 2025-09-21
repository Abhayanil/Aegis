// Weighting management for customizable analysis parameters
import { AnalysisWeightings } from '../../models/DealMemo.js';
import { ValidationResult } from '../../types/interfaces.js';

export interface WeightingProfile {
  id: string;
  name: string;
  description: string;
  weightings: AnalysisWeightings;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
}

export interface WeightingValidationOptions {
  allowZeroWeights?: boolean;
  tolerancePercent?: number;
  requireAllWeights?: boolean;
}

export class WeightingManager {
  private static readonly DEFAULT_WEIGHTINGS: AnalysisWeightings = {
    marketOpportunity: 25,
    team: 25,
    traction: 20,
    product: 15,
    competitivePosition: 15
  };

  private static readonly WEIGHTING_TOLERANCE = 0.01; // 1% tolerance for floating point precision
  private profiles: Map<string, WeightingProfile> = new Map();

  constructor() {
    this.initializeDefaultProfiles();
  }

  /**
   * Initialize default weighting profiles
   */
  private initializeDefaultProfiles(): void {
    const defaultProfile: WeightingProfile = {
      id: 'default',
      name: 'Balanced Analysis',
      description: 'Standard balanced weighting across all investment criteria',
      weightings: { ...WeightingManager.DEFAULT_WEIGHTINGS },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true
    };

    const growthFocusedProfile: WeightingProfile = {
      id: 'growth-focused',
      name: 'Growth-Focused',
      description: 'Emphasizes traction and market opportunity over other factors',
      weightings: {
        marketOpportunity: 35,
        team: 20,
        traction: 30,
        product: 10,
        competitivePosition: 5
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const teamFocusedProfile: WeightingProfile = {
      id: 'team-focused',
      name: 'Team-Focused',
      description: 'Prioritizes team quality and experience',
      weightings: {
        marketOpportunity: 20,
        team: 40,
        traction: 15,
        product: 15,
        competitivePosition: 10
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.profiles.set(defaultProfile.id, defaultProfile);
    this.profiles.set(growthFocusedProfile.id, growthFocusedProfile);
    this.profiles.set(teamFocusedProfile.id, teamFocusedProfile);
  }

  /**
   * Validate weighting configuration
   */
  validateWeightings(
    weightings: Partial<AnalysisWeightings>, 
    options: WeightingValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const {
      allowZeroWeights = false,
      tolerancePercent = 1,
      requireAllWeights = true
    } = options;

    // Check if all required weights are provided
    if (requireAllWeights) {
      const requiredWeights = Object.keys(WeightingManager.DEFAULT_WEIGHTINGS) as (keyof AnalysisWeightings)[];
      for (const weight of requiredWeights) {
        if (weightings[weight] === undefined || weightings[weight] === null) {
          errors.push(`Missing required weighting: ${weight}`);
        }
      }
    }

    // Validate individual weight values
    for (const [key, value] of Object.entries(weightings)) {
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number') {
          errors.push(`Weighting ${key} must be a number, got ${typeof value}`);
          continue;
        }

        if (value < 0) {
          errors.push(`Weighting ${key} cannot be negative: ${value}`);
        }

        if (value > 100) {
          errors.push(`Weighting ${key} cannot exceed 100%: ${value}`);
        }

        if (!allowZeroWeights && value === 0) {
          warnings.push(`Weighting ${key} is set to 0, which will exclude this factor from analysis`);
        }
      }
    }

    // Check total sum only if we have values for validation
    const providedWeights = Object.entries(weightings)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([_, value]) => value as number);

    if (providedWeights.length > 0) {
      const totalWeight = providedWeights.reduce((sum, weight) => sum + weight, 0);
      const expectedTotal = 100;
      const tolerance = expectedTotal * (tolerancePercent / 100);

      if (Math.abs(totalWeight - expectedTotal) > tolerance) {
        errors.push(
          `Total weightings must sum to 100% (±${tolerancePercent}%), got ${totalWeight.toFixed(2)}%`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Normalize weightings to sum to 100%
   */
  normalizeWeightings(weightings: Partial<AnalysisWeightings>): AnalysisWeightings {
    // Fill in missing weights with defaults
    const completeWeightings: AnalysisWeightings = {
      marketOpportunity: weightings.marketOpportunity ?? WeightingManager.DEFAULT_WEIGHTINGS.marketOpportunity,
      team: weightings.team ?? WeightingManager.DEFAULT_WEIGHTINGS.team,
      traction: weightings.traction ?? WeightingManager.DEFAULT_WEIGHTINGS.traction,
      product: weightings.product ?? WeightingManager.DEFAULT_WEIGHTINGS.product,
      competitivePosition: weightings.competitivePosition ?? WeightingManager.DEFAULT_WEIGHTINGS.competitivePosition
    };

    // Calculate current total
    const currentTotal = Object.values(completeWeightings).reduce((sum, weight) => sum + weight, 0);

    // If total is 0, return defaults
    if (currentTotal === 0) {
      return { ...WeightingManager.DEFAULT_WEIGHTINGS };
    }

    // Normalize to 100%
    const normalizationFactor = 100 / currentTotal;
    
    return {
      marketOpportunity: Math.round(completeWeightings.marketOpportunity * normalizationFactor * 100) / 100,
      team: Math.round(completeWeightings.team * normalizationFactor * 100) / 100,
      traction: Math.round(completeWeightings.traction * normalizationFactor * 100) / 100,
      product: Math.round(completeWeightings.product * normalizationFactor * 100) / 100,
      competitivePosition: Math.round(completeWeightings.competitivePosition * normalizationFactor * 100) / 100
    };
  }

  /**
   * Create a new weighting profile
   */
  createProfile(
    name: string,
    description: string,
    weightings: Partial<AnalysisWeightings>
  ): WeightingProfile {
    const validation = this.validateWeightings(weightings);
    if (!validation.isValid) {
      throw new Error(`Invalid weightings: ${validation.errors.join(', ')}`);
    }

    const normalizedWeightings = this.normalizeWeightings(weightings);
    const id = this.generateProfileId(name);

    const profile: WeightingProfile = {
      id,
      name,
      description,
      weightings: normalizedWeightings,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.profiles.set(id, profile);
    return profile;
  }

  /**
   * Update an existing weighting profile
   */
  updateProfile(
    id: string,
    updates: Partial<Pick<WeightingProfile, 'name' | 'description' | 'weightings'>>
  ): WeightingProfile {
    const existingProfile = this.profiles.get(id);
    if (!existingProfile) {
      throw new Error(`Weighting profile not found: ${id}`);
    }

    if (existingProfile.isDefault && updates.weightings) {
      throw new Error('Cannot modify weightings of default profile');
    }

    let updatedWeightings = existingProfile.weightings;
    if (updates.weightings) {
      const validation = this.validateWeightings(updates.weightings);
      if (!validation.isValid) {
        throw new Error(`Invalid weightings: ${validation.errors.join(', ')}`);
      }
      updatedWeightings = this.normalizeWeightings(updates.weightings);
    }

    const updatedProfile: WeightingProfile = {
      ...existingProfile,
      ...updates,
      weightings: updatedWeightings,
      updatedAt: new Date()
    };

    this.profiles.set(id, updatedProfile);
    return updatedProfile;
  }

  /**
   * Get a weighting profile by ID
   */
  getProfile(id: string): WeightingProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all weighting profiles
   */
  getAllProfiles(): WeightingProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get default weighting profile
   */
  getDefaultProfile(): WeightingProfile {
    const defaultProfile = Array.from(this.profiles.values()).find(p => p.isDefault);
    if (!defaultProfile) {
      throw new Error('Default weighting profile not found');
    }
    return defaultProfile;
  }

  /**
   * Delete a weighting profile
   */
  deleteProfile(id: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile) {
      return false;
    }

    if (profile.isDefault) {
      throw new Error('Cannot delete default weighting profile');
    }

    return this.profiles.delete(id);
  }

  /**
   * Get default weightings
   */
  static getDefaultWeightings(): AnalysisWeightings {
    return { ...WeightingManager.DEFAULT_WEIGHTINGS };
  }

  /**
   * Generate a unique profile ID from name
   */
  private generateProfileId(name: string): string {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
    let id = baseId;
    let counter = 1;

    while (this.profiles.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    return id;
  }

  /**
   * Export profiles for persistence
   */
  exportProfiles(): WeightingProfile[] {
    return this.getAllProfiles();
  }

  /**
   * Import profiles from persistence
   */
  importProfiles(profiles: WeightingProfile[]): void {
    for (const profile of profiles) {
      // Validate before importing
      const validation = this.validateWeightings(profile.weightings);
      if (validation.isValid) {
        this.profiles.set(profile.id, profile);
      }
    }
  }
}