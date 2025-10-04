"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDiscovery = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class FileDiscovery {
    constructor(config) {
        this.config = config;
    }
    /**
     * Discover files based on configuration
     */
    async discoverFiles(rootPath, specificFiles, recursive = true) {
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
    async loadSpecificFiles(filePaths) {
        const files = [];
        for (const filePath of filePaths) {
            try {
                const fileInfo = await this.loadFileInfo(filePath);
                if (fileInfo) {
                    files.push(fileInfo);
                }
            }
            catch (error) {
                console.warn(`Warning: Could not load file ${filePath}: ${error}`);
            }
        }
        return files;
    }
    /**
     * Discover files recursively using glob patterns
     */
    async discoverFilesRecursively(rootPath) {
        const files = [];
        // Create glob patterns for each file type
        const patterns = this.config.file_types.map(ext => `${rootPath}/**/*${ext}`);
        for (const pattern of patterns) {
            try {
                const matches = await (0, glob_1.glob)(pattern, {
                    ignore: this.config.exclude_patterns.map(p => `${rootPath}/**/${p}`),
                    nodir: true
                });
                for (const match of matches) {
                    try {
                        const fileInfo = await this.loadFileInfo(match);
                        if (fileInfo) {
                            files.push(fileInfo);
                        }
                    }
                    catch (error) {
                        console.warn(`Warning: Could not load file ${match}: ${error}`);
                    }
                }
            }
            catch (error) {
                console.warn(`Warning: Error processing pattern ${pattern}: ${error}`);
            }
        }
        return files;
    }
    /**
     * Discover files in a single directory (non-recursive)
     */
    async discoverFilesInDirectory(dirPath) {
        const files = [];
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
                        }
                        catch (error) {
                            console.warn(`Warning: Could not load file ${filePath}: ${error}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            throw new Error(`Error reading directory ${dirPath}: ${error}`);
        }
        return files;
    }
    /**
     * Load file information and content
     */
    async loadFileInfo(filePath) {
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
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Estimate token count for a file (rough approximation)
     */
    estimateTokens(content) {
        // Rough estimation: 1 token ≈ 4 characters for most languages
        // This is a simplified approach - in production, you might want to use
        // a more sophisticated tokenizer
        return Math.ceil(content.length / 4);
    }
    /**
     * Filter files by size (optional utility)
     */
    filterBySize(files, maxSizeBytes) {
        return files.filter(file => file.size <= maxSizeBytes);
    }
    /**
     * Sort files by size (largest first)
     */
    sortBySize(files) {
        return files.sort((a, b) => b.size - a.size);
    }
    /**
     * Sort files by token count (largest first)
     */
    sortByTokens(files) {
        return files.sort((a, b) => b.estimated_tokens - a.estimated_tokens);
    }
}
exports.FileDiscovery = FileDiscovery;
