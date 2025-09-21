// Company profile data model
import { FundingStage } from '../types/enums.js';
import { BaseEntity } from '../types/interfaces.js';

export interface CompanyProfile extends BaseEntity {
  name: string;
  oneLiner: string;
  sector: string;
  stage: FundingStage;
  foundedYear: number;
  location: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    crunchbase?: string;
  };
}

export interface CompanyProfileInput {
  name: string;
  oneLiner: string;
  sector: string;
  stage: FundingStage;
  foundedYear: number;
  location: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    crunchbase?: string;
  };
}