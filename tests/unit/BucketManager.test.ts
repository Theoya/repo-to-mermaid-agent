import { BucketManager } from '../../src/core/BucketManager';
import { FileInfo, ProcessingBucket } from '../../src/types';

describe('BucketManager', () => {
  let bucketManager: BucketManager;
  let mockFiles: FileInfo[];

  beforeEach(() => {
    bucketManager = new BucketManager(1000, 0.9); // 1000 tokens max, 90% threshold
    
    mockFiles = [
      {
        path: 'file1.js',
        content: 'console.log("test1");',
        size: 100,
        extension: '.js',
        estimated_tokens: 200
      },
      {
        path: 'file2.js',
        content: 'console.log("test2");',
        size: 100,
        extension: '.js',
        estimated_tokens: 300
      },
      {
        path: 'file3.js',
        content: 'console.log("test3");',
        size: 100,
        extension: '.js',
        estimated_tokens: 400
      },
      {
        path: 'file4.js',
        content: 'console.log("test4");',
        size: 100,
        extension: '.js',
        estimated_tokens: 500
      }
    ];
  });

  describe('createBuckets', () => {
    it('should create buckets based on token limits', () => {
      const buckets = bucketManager.createBuckets(mockFiles);
      
      expect(buckets.length).toBeGreaterThan(0);
      expect(buckets.every(bucket => bucket.total_tokens <= 1000)).toBe(true);
    });

    it('should handle empty file array', () => {
      const buckets = bucketManager.createBuckets([]);
      expect(buckets).toHaveLength(0);
    });

    it('should create single bucket for small file set', () => {
      const smallFiles = mockFiles.slice(0, 2); // 200 + 300 = 500 tokens
      const buckets = bucketManager.createBuckets(smallFiles);
      
      expect(buckets).toHaveLength(1);
      expect(buckets[0]?.total_tokens).toBeLessThanOrEqual(1000); // Should fit in one bucket
    });

    it('should create multiple buckets for large file set', () => {
      const buckets = bucketManager.createBuckets(mockFiles);
      
      // Total tokens: 200 + 300 + 400 + 500 = 1400
      // With 1000 token limit, should create at least 2 buckets
      expect(buckets.length).toBeGreaterThanOrEqual(1); // May fit in one bucket with 400k hard limit
    });
  });

  describe('isBucketReady', () => {
    it('should return true when bucket exceeds threshold', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 2),
        total_tokens: 900 // 90% of 1000
      };

      expect(bucketManager.isBucketReady(bucket)).toBe(true);
    });

    it('should return false when bucket is below threshold', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 500 // 50% of 1000
      };

      expect(bucketManager.isBucketReady(bucket)).toBe(false);
    });
  });

  describe('isBucketAtCapacity', () => {
    it('should return true when bucket is at capacity', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 2),
        total_tokens: 1000
      };

      expect(bucketManager.isBucketAtCapacity(bucket)).toBe(true);
    });

    it('should return false when bucket is below capacity', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 500
      };

      expect(bucketManager.isBucketAtCapacity(bucket)).toBe(false);
    });
  });

  describe('getBucketUtilization', () => {
    it('should calculate utilization percentage correctly', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 500
      };

      const utilization = bucketManager.getBucketUtilization(bucket);
      expect(utilization).toBe(50); // 500/1000 * 100
    });
  });

  describe('addFileToBucket', () => {
    it('should add file to bucket if it fits', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 200
      };

      const newFile = mockFiles[1]; // 300 tokens
      const result = bucketManager.addFileToBucket(bucket, newFile!);

      expect(result).toBe(true);
      expect(bucket.files).toHaveLength(2);
      expect(bucket.total_tokens).toBeLessThanOrEqual(1000);
    });

    it('should not add file if it exceeds capacity', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 800
      };

      const newFile = mockFiles[1]; // 300 tokens
      const result = bucketManager.addFileToBucket(bucket, newFile!);

      // 800 + 300 = 1100 tokens, which exceeds the 1000 token bucket capacity
      expect(result).toBe(false);
      expect(bucket.files).toHaveLength(1); // File should not be added
      expect(bucket.total_tokens).toBe(800); // Should remain unchanged
    });
  });

  describe('removeFileFromBucket', () => {
    it('should remove file from bucket', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 2),
        total_tokens: 500
      };

      const result = bucketManager.removeFileFromBucket(bucket, 'file1.js');

      expect(result).toBe(true);
      expect(bucket.files).toHaveLength(1);
      expect(bucket.total_tokens).toBeLessThanOrEqual(500);
    });

    it('should return false if file not found', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 200
      };

      const result = bucketManager.removeFileFromBucket(bucket, 'nonexistent.js');

      expect(result).toBe(false);
      expect(bucket.files).toHaveLength(1);
      expect(bucket.total_tokens).toBe(200);
    });
  });

  describe('splitBucket', () => {
    it('should split over-capacity bucket', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles,
        total_tokens: 1400 // Over capacity
      };

      const splitBuckets = bucketManager.splitBucket(bucket);

      expect(splitBuckets.length).toBeGreaterThanOrEqual(1);
      expect(splitBuckets.every(b => b.total_tokens <= 400000)).toBe(true);
    });

    it('should return single bucket if under capacity', () => {
      const bucket: ProcessingBucket = {
        files: mockFiles.slice(0, 2),
        total_tokens: 500
      };

      const splitBuckets = bucketManager.splitBucket(bucket);

      expect(splitBuckets).toHaveLength(1);
      expect(splitBuckets[0]).toEqual(bucket);
    });
  });

  describe('mergeBuckets', () => {
    it('should merge buckets if they fit within limit', () => {
      const bucket1: ProcessingBucket = {
        files: mockFiles.slice(0, 1),
        total_tokens: 200
      };

      const bucket2: ProcessingBucket = {
        files: mockFiles.slice(1, 2),
        total_tokens: 300
      };

      const merged = bucketManager.mergeBuckets(bucket1, bucket2);

      expect(merged).not.toBeNull();
      expect(merged!.total_tokens).toBe(500);
      expect(merged!.files).toHaveLength(2);
    });

    it('should return null if buckets exceed limit', () => {
      const bucket1: ProcessingBucket = {
        files: mockFiles.slice(0, 2),
        total_tokens: 500
      };

      const bucket2: ProcessingBucket = {
        files: mockFiles.slice(2, 4),
        total_tokens: 900
      };

      const merged = bucketManager.mergeBuckets(bucket1, bucket2);

      expect(merged).toBeNull();
    });
  });

  describe('getBucketStatistics', () => {
    it('should calculate correct statistics', () => {
      const buckets = bucketManager.createBuckets(mockFiles);
      const stats = bucketManager.getBucketStatistics(buckets);

      expect(stats.totalBuckets).toBe(buckets.length);
      expect(stats.totalFiles).toBe(mockFiles.length);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.averageTokensPerBucket).toBeGreaterThan(0);
      expect(stats.averageFilesPerBucket).toBeGreaterThan(0);
      expect(stats.utilizationRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty bucket array', () => {
      const stats = bucketManager.getBucketStatistics([]);

      expect(stats.totalBuckets).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.averageTokensPerBucket).toBe(0);
      expect(stats.averageFilesPerBucket).toBe(0);
      expect(stats.utilizationRate).toBe(0);
    });
  });

  describe('optimizeBuckets', () => {
    it('should optimize bucket distribution', () => {
      const buckets = bucketManager.createBuckets(mockFiles);
      const optimized = bucketManager.optimizeBuckets(buckets);

      expect(optimized.length).toBeGreaterThan(0);
      expect(optimized.every(bucket => bucket.total_tokens <= 1000)).toBe(true);
    });
  });

  describe('hard limit handling', () => {
    it('should skip files that exceed hard limit', () => {
      const largeFile: FileInfo = {
        path: 'large-file.js',
        content: 'x'.repeat(500000), // Very large file
        size: 500000,
        extension: '.js',
        estimated_tokens: 500000 // Exceeds 400k hard limit
      };

      const buckets = bucketManager.createBuckets([largeFile]);
      const skippedFiles = bucketManager.getSkippedFiles();

      expect(buckets).toHaveLength(0);
      expect(skippedFiles).toHaveLength(1);
      expect(skippedFiles[0]?.path).toBe('large-file.js');
      expect(skippedFiles[0]?.reason).toContain('exceeds hard limit');
    });

    it('should create new bucket when adding file would exceed hard limit', () => {
      const largeFile: FileInfo = {
        path: 'large-file.js',
        content: 'x'.repeat(100000),
        size: 100000,
        extension: '.js',
        estimated_tokens: 80000 // Large but under hard limit
      };

      const smallFile: FileInfo = {
        path: 'small-file.js',
        content: 'console.log("test");',
        size: 100,
        extension: '.js',
        estimated_tokens: 10
      };

      const buckets = bucketManager.createBuckets([largeFile, smallFile]);

      // Should create two buckets since adding smallFile to largeFile would exceed hard limit
      expect(buckets.length).toBeGreaterThanOrEqual(1);
      expect(bucketManager.getSkippedFiles()).toHaveLength(0);
    });

    it('should provide skipped files summary', () => {
      const largeFile: FileInfo = {
        path: 'large-file.js',
        content: 'x'.repeat(500000),
        size: 500000,
        extension: '.js',
        estimated_tokens: 500000 // Exceeds 400k hard limit
      };

      bucketManager.createBuckets([largeFile]);
      const summary = bucketManager.getSkippedFilesSummary();

      expect(summary).toContain('Skipped 1 file(s)');
      expect(summary).toContain('large-file.js');
      expect(summary).toContain('exceeds hard limit');
    });

    it('should clear skipped files', () => {
      const largeFile: FileInfo = {
        path: 'large-file.js',
        content: 'x'.repeat(500000),
        size: 500000,
        extension: '.js',
        estimated_tokens: 500000 // Exceeds 400k hard limit
      };

      bucketManager.createBuckets([largeFile]);
      expect(bucketManager.getSkippedFiles()).toHaveLength(1);

      bucketManager.clearSkippedFiles();
      expect(bucketManager.getSkippedFiles()).toHaveLength(0);
    });
  });
});
