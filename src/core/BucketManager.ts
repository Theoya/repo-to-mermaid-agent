import { FileInfo, ProcessingBucket } from '../types';
import { TokenCalculator } from './TokenCalculator';

export class BucketManager {
  private tokenCalculator: TokenCalculator;
  private maxTokensPerBucket: number;
  private tokenThreshold: number; // Percentage of max tokens to trigger bucket processing
  private hardLimit: number; // Hard limit per bucket (100k tokens)
  private skippedFiles: Array<{ path: string; size: number; reason: string }> = [];

  constructor(maxTokensPerBucket: number, tokenThreshold: number = 0.9) {
    this.tokenCalculator = new TokenCalculator();
    this.maxTokensPerBucket = maxTokensPerBucket;
    this.tokenThreshold = tokenThreshold;
    this.hardLimit = 100000; // 100k token hard limit
  }

  /**
   * Create buckets from a list of files
   */
  createBuckets(files: FileInfo[]): ProcessingBucket[] {
    const buckets: ProcessingBucket[] = [];
    let currentBucket: FileInfo[] = [];
    let currentTokenCount = 0;

    // Sort files by token count (largest first) for better packing
    const sortedFiles = this.sortFilesByTokens(files);

    for (const file of sortedFiles) {
      const fileTokens = this.tokenCalculator.calculateFileTokens(file);
      
      // Skip files that exceed the hard limit (100k tokens)
      if (fileTokens > this.hardLimit) {
        this.skippedFiles.push({
          path: file.path,
          size: file.size,
          reason: `File exceeds hard limit of ${this.hardLimit} tokens (estimated: ${fileTokens} tokens)`
        });
        console.warn(`Skipping file ${file.path}: ${fileTokens} tokens exceeds hard limit of ${this.hardLimit}`);
        continue;
      }
      
      // Check if adding this file would exceed the hard limit
      if (currentTokenCount + fileTokens > this.hardLimit && currentBucket.length > 0) {
        // Create bucket with current files
        buckets.push(this.createBucket(currentBucket, currentTokenCount));
        
        // Start new bucket
        currentBucket = [file];
        currentTokenCount = fileTokens;
      } else if (currentTokenCount + fileTokens > this.maxTokensPerBucket * this.tokenThreshold && currentBucket.length > 0) {
        // Check if adding this file would exceed the threshold
        // Create bucket with current files
        buckets.push(this.createBucket(currentBucket, currentTokenCount));
        
        // Start new bucket
        currentBucket = [file];
        currentTokenCount = fileTokens;
      } else {
        // Add file to current bucket
        currentBucket.push(file);
        currentTokenCount += fileTokens;
      }
    }

    // Add the last bucket if it has files
    if (currentBucket.length > 0) {
      buckets.push(this.createBucket(currentBucket, currentTokenCount));
    }

    return buckets;
  }

  /**
   * Create a single bucket from files
   */
  private createBucket(files: FileInfo[], totalTokens: number): ProcessingBucket {
    return {
      files,
      total_tokens: totalTokens
    };
  }

  /**
   * Sort files by token count (largest first)
   */
  private sortFilesByTokens(files: FileInfo[]): FileInfo[] {
    return [...files].sort((a, b) => b.estimated_tokens - a.estimated_tokens);
  }

  /**
   * Check if a bucket is ready for processing
   */
  isBucketReady(bucket: ProcessingBucket): boolean {
    return bucket.total_tokens >= this.maxTokensPerBucket * this.tokenThreshold;
  }

  /**
   * Check if a bucket is at capacity
   */
  isBucketAtCapacity(bucket: ProcessingBucket): boolean {
    return bucket.total_tokens >= this.maxTokensPerBucket;
  }

  /**
   * Get bucket utilization percentage
   */
  getBucketUtilization(bucket: ProcessingBucket): number {
    return (bucket.total_tokens / this.maxTokensPerBucket) * 100;
  }

  /**
   * Add a file to an existing bucket
   */
  addFileToBucket(bucket: ProcessingBucket, file: FileInfo): boolean {
    const fileTokens = this.tokenCalculator.calculateFileTokens(file);
    
    if (bucket.total_tokens + fileTokens <= this.maxTokensPerBucket) {
      bucket.files.push(file);
      bucket.total_tokens += fileTokens;
      return true;
    }
    
    return false;
  }

  /**
   * Remove a file from a bucket
   */
  removeFileFromBucket(bucket: ProcessingBucket, filePath: string): boolean {
    const fileIndex = bucket.files.findIndex(file => file.path === filePath);
    
    if (fileIndex !== -1) {
      const file = bucket.files[fileIndex];
      bucket.files.splice(fileIndex, 1);
      bucket.total_tokens -= this.tokenCalculator.calculateFileTokens(file);
      return true;
    }
    
    return false;
  }

  /**
   * Split a bucket that's over capacity
   */
  splitBucket(bucket: ProcessingBucket): ProcessingBucket[] {
    if (bucket.total_tokens <= this.maxTokensPerBucket) {
      return [bucket];
    }

    const buckets: ProcessingBucket[] = [];
    let currentBucket: FileInfo[] = [];
    let currentTokenCount = 0;

    // Sort files by token count (largest first)
    const sortedFiles = this.sortFilesByTokens(bucket.files);

    for (const file of sortedFiles) {
      const fileTokens = this.tokenCalculator.calculateFileTokens(file);
      
      if (currentTokenCount + fileTokens > this.maxTokensPerBucket && currentBucket.length > 0) {
        buckets.push(this.createBucket(currentBucket, currentTokenCount));
        currentBucket = [file];
        currentTokenCount = fileTokens;
      } else {
        currentBucket.push(file);
        currentTokenCount += fileTokens;
      }
    }

    if (currentBucket.length > 0) {
      buckets.push(this.createBucket(currentBucket, currentTokenCount));
    }

    return buckets;
  }

  /**
   * Merge two buckets if they fit within token limit
   */
  mergeBuckets(bucket1: ProcessingBucket, bucket2: ProcessingBucket): ProcessingBucket | null {
    const totalTokens = bucket1.total_tokens + bucket2.total_tokens;
    
    if (totalTokens <= this.maxTokensPerBucket) {
      return {
        files: [...bucket1.files, ...bucket2.files],
        total_tokens: totalTokens,
        summary: bucket1.summary || bucket2.summary,
        mermaid_content: bucket1.mermaid_content || bucket2.mermaid_content
      };
    }
    
    return null;
  }

  /**
   * Get statistics about buckets
   */
  getBucketStatistics(buckets: ProcessingBucket[]): {
    totalBuckets: number;
    totalFiles: number;
    totalTokens: number;
    averageTokensPerBucket: number;
    averageFilesPerBucket: number;
    utilizationRate: number;
  } {
    const totalFiles = buckets.reduce((sum, bucket) => sum + bucket.files.length, 0);
    const totalTokens = buckets.reduce((sum, bucket) => sum + bucket.total_tokens, 0);
    const averageTokensPerBucket = buckets.length > 0 ? totalTokens / buckets.length : 0;
    const averageFilesPerBucket = buckets.length > 0 ? totalFiles / buckets.length : 0;
    const utilizationRate = buckets.length > 0 ? (totalTokens / (buckets.length * this.maxTokensPerBucket)) * 100 : 0;

    return {
      totalBuckets: buckets.length,
      totalFiles,
      totalTokens,
      averageTokensPerBucket,
      averageFilesPerBucket,
      utilizationRate
    };
  }

  /**
   * Optimize bucket distribution
   */
  optimizeBuckets(buckets: ProcessingBucket[]): ProcessingBucket[] {
    const optimized: ProcessingBucket[] = [];
    const underutilized: ProcessingBucket[] = [];
    const overutilized: ProcessingBucket[] = [];

    // Categorize buckets
    for (const bucket of buckets) {
      const utilization = this.getBucketUtilization(bucket);
      
      if (utilization < 50) {
        underutilized.push(bucket);
      } else if (utilization > 100) {
        overutilized.push(bucket);
      } else {
        optimized.push(bucket);
      }
    }

    // Split overutilized buckets
    for (const bucket of overutilized) {
      const splitBuckets = this.splitBucket(bucket);
      optimized.push(...splitBuckets);
    }

    // Try to merge underutilized buckets
    while (underutilized.length > 1) {
      const bucket1 = underutilized.shift()!;
      const bucket2 = underutilized.shift()!;
      
      const merged = this.mergeBuckets(bucket1, bucket2);
      if (merged) {
        underutilized.push(merged);
      } else {
        optimized.push(bucket1, bucket2);
      }
    }

    // Add remaining underutilized buckets
    optimized.push(...underutilized);

    return optimized;
  }

  /**
   * Get information about skipped files
   */
  getSkippedFiles(): Array<{ path: string; size: number; reason: string }> {
    return [...this.skippedFiles];
  }

  /**
   * Get summary of skipped files
   */
  getSkippedFilesSummary(): string {
    if (this.skippedFiles.length === 0) {
      return 'No files were skipped.';
    }

    let summary = `Skipped ${this.skippedFiles.length} file(s):\n`;
    for (const skipped of this.skippedFiles) {
      summary += `- ${skipped.path} (${skipped.size} bytes): ${skipped.reason}\n`;
    }
    return summary;
  }

  /**
   * Clear skipped files list
   */
  clearSkippedFiles(): void {
    this.skippedFiles = [];
  }
}
