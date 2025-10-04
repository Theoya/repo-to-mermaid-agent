import { FileInfo } from '../types';

export class TokenCalculator {
  private readonly tokenPerCharRatio: number;

  constructor(tokenPerCharRatio: number = 4) {
    this.tokenPerCharRatio = tokenPerCharRatio;
  }

  /**
   * Calculate tokens for a single file
   */
  calculateFileTokens(file: FileInfo): number {
    // Use pre-calculated estimated_tokens if available and reasonable, otherwise calculate
    if (file.estimated_tokens !== undefined && file.estimated_tokens > 0) {
      return file.estimated_tokens;
    }
    return this.estimateTokens(file.content);
  }

  /**
   * Calculate total tokens for multiple files
   */
  calculateTotalTokens(files: FileInfo[]): number {
    return files.reduce((total, file) => total + this.calculateFileTokens(file), 0);
  }

  /**
   * Estimate tokens for text content
   */
  private estimateTokens(content: string): number {
    // More sophisticated token estimation
    // Different file types have different token densities
    
    const lines = content.split('\n');
    let tokenCount = 0;

    for (const line of lines) {
      // Remove comments and empty lines for more accurate estimation
      const trimmedLine = line.trim();
      if (trimmedLine === '' || this.isCommentLine(trimmedLine)) {
        continue;
      }

      // Count tokens in the line
      tokenCount += this.estimateLineTokens(trimmedLine);
    }

    return Math.max(1, tokenCount); // Ensure at least 1 token
  }

  /**
   * Check if a line is a comment
   */
  private isCommentLine(line: string): boolean {
    const commentPatterns = [
      /^\/\//,           // C-style single line
      /^#/,              // Python, shell, etc.
      /^\/\*/,           // C-style multi-line start
      /^\*/,             // C-style multi-line continuation
      /^<!--/,           // HTML/XML comments
      /^'/,              // Basic comment
      /^;/,              // Assembly, config files
    ];

    return commentPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Estimate tokens for a single line
   */
  private estimateLineTokens(line: string): number {
    // Split by common delimiters and count meaningful parts
    const words = line.split(/[\s,;(){}[\]"'`]+/).filter(word => word.length > 0);
    
    let tokens = 0;
    for (const word of words) {
      // Each word contributes tokens based on its length
      tokens += Math.ceil(word.length / this.tokenPerCharRatio);
    }

    // Add tokens for special characters and structure
    const specialChars = line.match(/[{}();,]/g);
    if (specialChars) {
      tokens += specialChars.length * 0.5; // Special chars are usually 0.5 tokens
    }

    return Math.max(1, Math.ceil(tokens));
  }

  /**
   * Calculate tokens for a prompt template
   */
  calculatePromptTokens(template: string, variables: Record<string, string>): number {
    let prompt = template;
    
    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return this.estimateTokens(prompt);
  }

  /**
   * Calculate tokens for system message + user message
   */
  calculateMessageTokens(systemMessage: string, userMessage: string): number {
    // Add overhead for message formatting
    const systemTokens = this.estimateTokens(systemMessage);
    const userTokens = this.estimateTokens(userMessage);
    const overhead = 10; // Approximate overhead for message formatting

    return systemTokens + userTokens + overhead;
  }

  /**
   * Get token density for different file types
   */
  getTokenDensity(extension: string): number {
    const densities: Record<string, number> = {
      '.py': 3.5,      // Python is more dense
      '.js': 4.0,      // JavaScript
      '.ts': 4.0,      // TypeScript
      '.cs': 3.8,      // C#
      '.java': 3.8,    // Java
      '.cpp': 3.5,     // C++
      '.c': 3.5,       // C
      '.h': 3.5,       // Header files
      '.hpp': 3.5,     // C++ headers
      '.go': 3.8,      // Go
      '.rs': 3.8,      // Rust
      '.php': 4.0,     // PHP
      '.rb': 3.5,      // Ruby
      '.swift': 3.8,   // Swift
      '.kt': 3.8,      // Kotlin
      '.scala': 3.8,   // Scala
      '.sql': 2.5,     // SQL is less dense
      '.yaml': 2.0,    // YAML is very dense
      '.yml': 2.0,     // YAML
      '.json': 2.5,    // JSON
      '.xml': 2.0,     // XML
      '.html': 2.5,    // HTML
      '.css': 2.0,     // CSS
      '.scss': 2.0,    // SCSS
      '.less': 2.0,    // LESS
      '.vue': 3.5,     // Vue
      '.svelte': 3.5,  // Svelte
      '.astro': 3.5,   // Astro
    };

    return densities[extension] || 4.0; // Default density
  }

  /**
   * Recalculate tokens for a file with more accurate estimation
   */
  recalculateFileTokens(file: FileInfo): FileInfo {
    const density = this.getTokenDensity(file.extension);
    const contentTokens = this.estimateTokens(file.content);
    const adjustedTokens = Math.ceil(contentTokens * (4.0 / density));

    return {
      ...file,
      estimated_tokens: adjustedTokens
    };
  }
}
