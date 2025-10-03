import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { FileInfo, Config } from '../types';

export class FileDiscovery {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Discover files based on configuration
   */
  async discoverFiles(
    rootPath: string,
    specificFiles?: string[],
    recursive: boolean = true
  ): Promise<FileInfo[]> {
    if (specificFiles && specificFiles.length > 0) {
      return this.loadSpecificFiles(specificFiles);
    }

    if (recursive) {
      return this.discoverFilesRecursively(rootPath);
    }

    return this.discoverFilesInDirectory(rootPath);
  }

  /**
   * Load specific files from a list
   */
  private async loadSpecificFiles(filePaths: string[]): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    for (const filePath of filePaths) {
      try {
        const fileInfo = await this.loadFileInfo(filePath);
        if (fileInfo) {
          files.push(fileInfo);
        }
      } catch (error) {
        console.warn(`Warning: Could not load file ${filePath}: ${error}`);
      }
    }

    return files;
  }

  /**
   * Discover files recursively using glob patterns
   */
  private async discoverFilesRecursively(rootPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    // Create glob patterns for each file type
    const patterns = this.config.file_types.map(ext => 
      path.join(rootPath, '**', `*${ext}`)
    );

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          ignore: this.config.exclude_patterns.map(p => 
            path.join(rootPath, '**', p)
          ),
          nodir: true
        });

        for (const match of matches) {
          try {
            const fileInfo = await this.loadFileInfo(match);
            if (fileInfo) {
              files.push(fileInfo);
            }
          } catch (error) {
            console.warn(`Warning: Could not load file ${match}: ${error}`);
          }
        }
      } catch (error) {
        console.warn(`Warning: Error processing pattern ${pattern}: ${error}`);
      }
    }

    return files;
  }

  /**
   * Discover files in a single directory (non-recursive)
   */
  private async discoverFilesInDirectory(dirPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const extension = path.extname(entry.name);
          
          if (this.config.file_types.includes(extension)) {
            try {
              const fileInfo = await this.loadFileInfo(filePath);
              if (fileInfo) {
                files.push(fileInfo);
              }
            } catch (error) {
              console.warn(`Warning: Could not load file ${filePath}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Error reading directory ${dirPath}: ${error}`);
    }

    return files;
  }

  /**
   * Load file information and content
   */
  private async loadFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath);

      return {
        path: filePath,
        content,
        size: stats.size,
        extension,
        estimated_tokens: this.estimateTokens(content)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Estimate token count for a file (rough approximation)
   */
  private estimateTokens(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters for most languages
    // This is a simplified approach - in production, you might want to use
    // a more sophisticated tokenizer
    return Math.ceil(content.length / 4);
  }

  /**
   * Filter files by size (optional utility)
   */
  filterBySize(files: FileInfo[], maxSizeBytes: number): FileInfo[] {
    return files.filter(file => file.size <= maxSizeBytes);
  }

  /**
   * Sort files by size (largest first)
   */
  sortBySize(files: FileInfo[]): FileInfo[] {
    return files.sort((a, b) => b.size - a.size);
  }

  /**
   * Sort files by token count (largest first)
   */
  sortByTokens(files: FileInfo[]): FileInfo[] {
    return files.sort((a, b) => b.estimated_tokens - a.estimated_tokens);
  }
}
