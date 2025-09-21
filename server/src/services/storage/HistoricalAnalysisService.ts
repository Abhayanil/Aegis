// Historical analysis and comparison service for deal memos
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { initializeFirestore } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { StoredDealMemo, DealMemoQuery } from './FirebaseStorage.js';
import { DealMemoVersion } from './FirebaseStorage.js';

export interface HistoricalQuery {
  companyName?: string;
  sector?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  signalScoreRange?: {
    min: number;
    max: number;
  };
  recommendation?: string;
  tags?: string[];
  limit?: number;
}

export interface ComparisonResult {
  dealMemo1: StoredDealMemo;
  dealMemo2: StoredDealMemo;
  differences: {
    signalScore: number;
    recommendation: boolean;
    sector: boolean;
    keyMetrics: string[];
  };
  similarity: number;
}

export interface TrendAnalysis {
  sector: string;
  timeframe: {
    from: Date;
    to: Date;
  };
  dealCount: number;
  averageSignalScore: number;
  recommendationDistribution: Record<string, number>;
  scoreProgression: Array<{
    date: Date;
    averageScore: number;
    dealCount: number;
  }>;
}

export interface VersionComparison {
  dealMemoId: string;
  version1: DealMemoVersion;
  version2: DealMemoVersion;
  changes: {
    signalScore?: {
      old: number;
      new: number;
      change: number;
    };
    recommendation?: {
      old: string;
      new: string;
    };
    keyMetrics: string[];
    riskChanges: string[];
  };
}

export class HistoricalAnalysisService {
  private db: Firestore;
  private dealMemosCollection;
  private versionsCollection;

  constructor() {
    this.db = initializeFirestore();
    this.dealMemosCollection = this.db.collection('dealMemos');
    this.versionsCollection = this.db.collection('dealMemoVersions');
  }

  /**
   * Query historical deal memos with advanced filters
   */
  async queryHistoricalData(query: HistoricalQuery): Promise<StoredDealMemo[]> {
    try {
      let firestoreQuery = this.dealMemosCollection.where('isArchived', '==', false);

      // Apply filters
      if (query.companyName) {
        firestoreQuery = firestoreQuery.where('companyName', '==', query.companyName);
      }

      if (query.sector) {
        firestoreQuery = firestoreQuery.where('sector', '==', query.sector);
      }

      if (query.dateRange) {
        firestoreQuery = firestoreQuery
          .where('createdAt', '>=', Timestamp.fromDate(query.dateRange.from))
          .where('createdAt', '<=', Timestamp.fromDate(query.dateRange.to));
      }

      if (query.tags && query.tags.length > 0) {
        firestoreQuery = firestoreQuery.where('tags', 'array-contains-any', query.tags);
      }

      // Apply ordering and limit
      firestoreQuery = firestoreQuery.orderBy('createdAt', 'desc');
      
      if (query.limit) {
        firestoreQuery = firestoreQuery.limit(query.limit);
      }

      const snapshot = await firestoreQuery.get();
      let results = snapshot.docs.map(doc => 
        this.deserializeFromFirestore(doc.data()) as StoredDealMemo
      );

      // Apply client-side filters for complex queries
      if (query.signalScoreRange) {
        results = results.filter(memo => {
          const score = memo.dealMemo.summary.signalScore;
          return score >= query.signalScoreRange!.min && score <= query.signalScoreRange!.max;
        });
      }

      if (query.recommendation) {
        results = results.filter(memo => 
          memo.dealMemo.summary.recommendation === query.recommendation
        );
      }

      return results;

    } catch (error) {
      logger.error('Failed to query historical data:', error);
      throw new Error(`Historical query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare two deal memos
   */
  async compareDealMemos(id1: string, id2: string): Promise<ComparisonResult | null> {
    try {
      const [doc1, doc2] = await Promise.all([
        this.dealMemosCollection.doc(id1).get(),
        this.dealMemosCollection.doc(id2).get(),
      ]);

      if (!doc1.exists || !doc2.exists) {
        return null;
      }

      const dealMemo1 = this.deserializeFromFirestore(doc1.data()) as StoredDealMemo;
      const dealMemo2 = this.deserializeFromFirestore(doc2.data()) as StoredDealMemo;

      const differences = {
        signalScore: Math.abs(
          dealMemo1.dealMemo.summary.signalScore - dealMemo2.dealMemo.summary.signalScore
        ),
        recommendation: dealMemo1.dealMemo.summary.recommendation !== dealMemo2.dealMemo.summary.recommendation,
        sector: dealMemo1.sector !== dealMemo2.sector,
        keyMetrics: this.compareKeyMetrics(dealMemo1, dealMemo2),
      };

      const similarity = this.calculateSimilarity(dealMemo1, dealMemo2);

      return {
        dealMemo1,
        dealMemo2,
        differences,
        similarity,
      };

    } catch (error) {
      logger.error('Failed to compare deal memos:', error);
      throw new Error(`Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze trends in a sector over time
   */
  async analyzeSectorTrends(
    sector: string,
    timeframe: { from: Date; to: Date },
    intervalDays: number = 30
  ): Promise<TrendAnalysis> {
    try {
      const query: HistoricalQuery = {
        sector,
        dateRange: timeframe,
      };

      const dealMemos = await this.queryHistoricalData(query);

      if (dealMemos.length === 0) {
        throw new Error(`No deal memos found for sector: ${sector}`);
      }

      // Calculate basic statistics
      const totalScore = dealMemos.reduce((sum, memo) => sum + memo.dealMemo.summary.signalScore, 0);
      const averageSignalScore = totalScore / dealMemos.length;

      // Calculate recommendation distribution
      const recommendationDistribution: Record<string, number> = {};
      dealMemos.forEach(memo => {
        const rec = memo.dealMemo.summary.recommendation;
        recommendationDistribution[rec] = (recommendationDistribution[rec] || 0) + 1;
      });

      // Calculate score progression over time
      const scoreProgression = this.calculateScoreProgression(dealMemos, timeframe, intervalDays);

      return {
        sector,
        timeframe,
        dealCount: dealMemos.length,
        averageSignalScore,
        recommendationDistribution,
        scoreProgression,
      };

    } catch (error) {
      logger.error('Failed to analyze sector trends:', error);
      throw new Error(`Trend analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare different versions of the same deal memo
   */
  async compareVersions(dealMemoId: string, version1: number, version2: number): Promise<VersionComparison | null> {
    try {
      const versionsSnapshot = await this.versionsCollection
        .where('dealMemoId', '==', dealMemoId)
        .where('version', 'in', [version1, version2])
        .get();

      if (versionsSnapshot.size !== 2) {
        return null;
      }

      const versions = versionsSnapshot.docs.map(doc => 
        this.deserializeFromFirestore(doc.data()) as DealMemoVersion
      );

      const v1 = versions.find(v => v.version === version1)!;
      const v2 = versions.find(v => v.version === version2)!;

      const changes = {
        keyMetrics: this.compareVersionMetrics(v1, v2),
        riskChanges: this.compareVersionRisks(v1, v2),
      } as any;

      // Compare signal scores
      if (v1.dealMemo.summary.signalScore !== v2.dealMemo.summary.signalScore) {
        changes.signalScore = {
          old: v1.dealMemo.summary.signalScore,
          new: v2.dealMemo.summary.signalScore,
          change: v2.dealMemo.summary.signalScore - v1.dealMemo.summary.signalScore,
        };
      }

      // Compare recommendations
      if (v1.dealMemo.summary.recommendation !== v2.dealMemo.summary.recommendation) {
        changes.recommendation = {
          old: v1.dealMemo.summary.recommendation,
          new: v2.dealMemo.summary.recommendation,
        };
      }

      return {
        dealMemoId,
        version1: v1,
        version2: v2,
        changes,
      };

    } catch (error) {
      logger.error('Failed to compare versions:', error);
      throw new Error(`Version comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deal memo evolution timeline
   */
  async getDealMemoTimeline(dealMemoId: string): Promise<DealMemoVersion[]> {
    try {
      const snapshot = await this.versionsCollection
        .where('dealMemoId', '==', dealMemoId)
        .orderBy('version', 'asc')
        .get();

      return snapshot.docs.map(doc => 
        this.deserializeFromFirestore(doc.data()) as DealMemoVersion
      );

    } catch (error) {
      logger.error('Failed to get deal memo timeline:', error);
      throw new Error(`Timeline retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find similar deal memos based on characteristics
   */
  async findSimilarDealMemos(
    referenceDealMemo: StoredDealMemo,
    limit: number = 10
  ): Promise<Array<{ dealMemo: StoredDealMemo; similarity: number }>> {
    try {
      // Query deal memos in the same sector first
      const sectorQuery: HistoricalQuery = {
        sector: referenceDealMemo.sector,
        limit: 100, // Get more to calculate similarity
      };

      const candidates = await this.queryHistoricalData(sectorQuery);
      
      // Filter out the reference deal memo itself
      const filteredCandidates = candidates.filter(memo => memo.id !== referenceDealMemo.id);

      // Calculate similarity scores
      const similarities = filteredCandidates.map(candidate => ({
        dealMemo: candidate,
        similarity: this.calculateSimilarity(referenceDealMemo, candidate),
      }));

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to find similar deal memos:', error);
      throw new Error(`Similarity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate similarity between two deal memos
   */
  private calculateSimilarity(memo1: StoredDealMemo, memo2: StoredDealMemo): number {
    let similarity = 0;
    let factors = 0;

    // Sector similarity (high weight)
    if (memo1.sector === memo2.sector) {
      similarity += 0.3;
    }
    factors += 0.3;

    // Signal score similarity (medium weight)
    const scoreDiff = Math.abs(memo1.dealMemo.summary.signalScore - memo2.dealMemo.summary.signalScore);
    const scoreSimiliarity = Math.max(0, 1 - scoreDiff / 100);
    similarity += scoreSimiliarity * 0.25;
    factors += 0.25;

    // Recommendation similarity (medium weight)
    if (memo1.dealMemo.summary.recommendation === memo2.dealMemo.summary.recommendation) {
      similarity += 0.2;
    }
    factors += 0.2;

    // Stage similarity (low weight)
    if (memo1.dealMemo.summary.stage === memo2.dealMemo.summary.stage) {
      similarity += 0.15;
    }
    factors += 0.15;

    // Tag overlap (low weight)
    const tagOverlap = this.calculateTagOverlap(memo1.tags, memo2.tags);
    similarity += tagOverlap * 0.1;
    factors += 0.1;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate tag overlap between two arrays
   */
  private calculateTagOverlap(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 && tags2.length === 0) return 1;
    if (tags1.length === 0 || tags2.length === 0) return 0;

    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Compare key metrics between two deal memos
   */
  private compareKeyMetrics(memo1: StoredDealMemo, memo2: StoredDealMemo): string[] {
    const differences: string[] = [];

    // Compare signal scores
    const scoreDiff = Math.abs(memo1.dealMemo.summary.signalScore - memo2.dealMemo.summary.signalScore);
    if (scoreDiff > 5) {
      differences.push(`Signal score difference: ${scoreDiff.toFixed(1)} points`);
    }

    // Compare confidence levels
    const confidenceDiff = Math.abs(memo1.dealMemo.summary.confidenceLevel - memo2.dealMemo.summary.confidenceLevel);
    if (confidenceDiff > 0.1) {
      differences.push(`Confidence level difference: ${(confidenceDiff * 100).toFixed(1)}%`);
    }

    return differences;
  }

  /**
   * Compare metrics between two versions
   */
  private compareVersionMetrics(v1: DealMemoVersion, v2: DealMemoVersion): string[] {
    const differences: string[] = [];

    // Compare signal scores
    if (v1.dealMemo.summary.signalScore !== v2.dealMemo.summary.signalScore) {
      const change = v2.dealMemo.summary.signalScore - v1.dealMemo.summary.signalScore;
      differences.push(`Signal score changed by ${change > 0 ? '+' : ''}${change.toFixed(1)} points`);
    }

    // Compare confidence levels
    if (v1.dealMemo.summary.confidenceLevel !== v2.dealMemo.summary.confidenceLevel) {
      const change = v2.dealMemo.summary.confidenceLevel - v1.dealMemo.summary.confidenceLevel;
      differences.push(`Confidence level changed by ${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}%`);
    }

    return differences;
  }

  /**
   * Compare risks between two versions
   */
  private compareVersionRisks(v1: DealMemoVersion, v2: DealMemoVersion): string[] {
    const changes: string[] = [];

    const v1HighRisks = v1.dealMemo.riskAssessment.highPriorityRisks.length;
    const v2HighRisks = v2.dealMemo.riskAssessment.highPriorityRisks.length;

    if (v1HighRisks !== v2HighRisks) {
      const change = v2HighRisks - v1HighRisks;
      changes.push(`High priority risks changed by ${change > 0 ? '+' : ''}${change}`);
    }

    const v1MediumRisks = v1.dealMemo.riskAssessment.mediumPriorityRisks.length;
    const v2MediumRisks = v2.dealMemo.riskAssessment.mediumPriorityRisks.length;

    if (v1MediumRisks !== v2MediumRisks) {
      const change = v2MediumRisks - v1MediumRisks;
      changes.push(`Medium priority risks changed by ${change > 0 ? '+' : ''}${change}`);
    }

    return changes;
  }

  /**
   * Calculate score progression over time intervals
   */
  private calculateScoreProgression(
    dealMemos: StoredDealMemo[],
    timeframe: { from: Date; to: Date },
    intervalDays: number
  ): Array<{ date: Date; averageScore: number; dealCount: number }> {
    const progression: Array<{ date: Date; averageScore: number; dealCount: number }> = [];
    
    const startTime = timeframe.from.getTime();
    const endTime = timeframe.to.getTime();
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    for (let time = startTime; time <= endTime; time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(Math.min(time + intervalMs, endTime));

      const intervalMemos = dealMemos.filter(memo => {
        const memoTime = memo.createdAt.getTime();
        return memoTime >= intervalStart.getTime() && memoTime < intervalEnd.getTime();
      });

      if (intervalMemos.length > 0) {
        const totalScore = intervalMemos.reduce((sum, memo) => sum + memo.dealMemo.summary.signalScore, 0);
        const averageScore = totalScore / intervalMemos.length;

        progression.push({
          date: intervalStart,
          averageScore,
          dealCount: intervalMemos.length,
        });
      }
    }

    return progression;
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