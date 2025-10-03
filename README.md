# Mermaid Codebase Generator

A powerful tool that generates comprehensive Mermaid diagrams from your codebase using Large Language Models (LLMs). Perfect for understanding architecture, documenting systems, and visualizing code relationships.

## Features

- **Smart File Discovery**: Recursively scan repositories or process specific files
- **LLM-Powered Analysis**: Uses OpenAI, Claude, or other LLMs to understand code structure
- **Token-Aware Processing**: Intelligently buckets files based on token limits
- **Iterative Processing**: Builds comprehensive diagrams by processing code in chunks
- **GitHub Integration**: Automatically creates PRs with updated diagrams
- **Highly Configurable**: Customize file types, processing limits, and output formats
- **Comprehensive Testing**: Full unit and integration test coverage

## Quick Start

### Installation

```bash
# Install globally
npm install -g mermaid-codebase-generator

# Or use with npx (recommended)
npx mermaid-codebase-generator@latest
```

### Basic Usage

```bash
# Generate diagram for current directory
mermaid-gen --llm-api-key YOUR_OPENAI_API_KEY

# Process specific file types
mermaid-gen --file-types "cs,py,js,ts" --llm-api-key YOUR_OPENAI_API_KEY

# Custom output location
mermaid-gen --output "docs/architecture.mermaid" --llm-api-key YOUR_OPENAI_API_KEY
```

## Configuration

### Command Line Options

```bash
mermaid-gen [options] [directory]

Options:
  -t, --token-limit <number>     Token limit per processing batch (default: 60000)
  -f, --file-types <types>       Comma-separated file extensions (default: auto-detect)
  -o, --output <path>            Output file path (default: repo.mermaid)
  -c, --config <path>            Configuration file path (default: config.yml)
  -r, --recursive                Process files recursively (default: true)
  -s, --specific-files <files>   Comma-separated list of specific files
  -e, --existing-mermaid <path>  Path to existing Mermaid file to build upon
  -p, --llm-provider <provider>  LLM provider: openai, claude, grok (default: openai)
  -m, --llm-model <model>        LLM model to use (default: gpt-4)
  -k, --llm-api-key <key>        LLM API key (or set via environment variable)
  -g, --github-token <token>     GitHub token for PR creation
  -O, --github-owner <owner>     GitHub repository owner
  -R, --github-repo <repo>       GitHub repository name
  -b, --github-branch <branch>   GitHub branch for PR (default: mermaid-update)
  -d, --dry-run                  Run without making changes
  -v, --verbose                  Enable verbose output
  -h, --help                     Display help
  -V, --version                  Display version
```

### Configuration File

Create a `config.yml` file to customize behavior:

```yaml
file_types:
  - .cs
  - .py
  - .js
  - .ts
  - .jsx
  - .tsx
  - .java
  - .go
  - .rs

exclude_patterns:
  - node_modules
  - .git
  - dist
  - build
  - target

llm:
  provider: "openai"
  model: "gpt-4"
  max_tokens: 60000
  temperature: 0.1

output:
  format: "mermaid"
  file_path: "repo.mermaid"
  include_summary: true

github:
  branch: "mermaid-update"
  commit_message: "Update Mermaid diagram"
  pr_title: "Update repository architecture diagram"
  pr_body: "Automatically generated Mermaid diagram of the codebase architecture"
```

## GitHub Actions Integration

### Basic Workflow

Create `.github/workflows/generate-mermaid.yml`:

```yaml
name: Generate Mermaid Diagram

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  generate-mermaid:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Generate Mermaid diagram
        run: npx mermaid-codebase-generator@latest --file-types "cs,py,js,ts"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Workflow with PR Creation

```yaml
name: Generate Mermaid Diagram

on:
  push:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  generate-mermaid:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Generate Mermaid diagram
        run: |
          npx mermaid-codebase-generator@latest \
            --token-limit 60000 \
            --file-types "cs,py,js,ts,jsx,tsx" \
            --output "repo.mermaid" \
            --llm-provider "openai" \
            --llm-model "gpt-4" \
            --github-owner "${{ github.repository_owner }}" \
            --github-repo "${{ github.event.repository.name }}" \
            --github-branch "mermaid-update" \
            --verbose
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Create Pull Request
        if: github.event_name != 'pull_request'
        run: |
          if git diff --quiet; then
            echo "No changes to commit"
            exit 0
          fi
          
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          
          git checkout -b mermaid-update
          git add repo.mermaid
          git commit -m "Update Mermaid diagram"
          git push origin mermaid-update
          
          gh pr create \
            --title "Update repository architecture diagram" \
            --body "Automatically generated Mermaid diagram of the codebase architecture" \
            --base main \
            --head mermaid-update \
            --label "automated,mermaid,documentation,architecture"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Supported File Types

The generator supports a wide range of programming languages and file types:

- **Web**: `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`
- **Backend**: `.py`, `.cs`, `.java`, `.go`, `.rs`, `.php`, `.rb`
- **Mobile**: `.swift`, `.kt`, `.dart`
- **Data**: `.sql`, `.r`, `.m`, `.mm`
- **Config**: `.yaml`, `.yml`, `.json`, `.xml`, `.html`, `.css`
- **Scripts**: `.sh`, `.ps1`, `.bat`
- **And many more...**

## LLM Providers

### OpenAI
```bash
mermaid-gen --llm-provider openai --llm-model gpt-4 --llm-api-key YOUR_OPENAI_API_KEY
```

### Claude (Anthropic)
```bash
mermaid-gen --llm-provider claude --llm-model claude-3-sonnet-20240229 --llm-api-key YOUR_ANTHROPIC_API_KEY
```

### Environment Variables
```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export GITHUB_TOKEN="your-github-token"
```

## Examples

### Simple TypeScript Project
```bash
mermaid-gen --file-types "ts,js,json" --output "docs/architecture.mermaid"
```

### Large C# Solution
```bash
mermaid-gen --file-types "cs,csproj,sln" --token-limit 60000 --output "docs/solution-architecture.mermaid"
```

### Python Microservices
```bash
mermaid-gen --file-types "py,yaml,json" --recursive --output "docs/microservices.mermaid"
```

### React Frontend
```bash
mermaid-gen --file-types "tsx,ts,js,jsx,css,scss" --output "docs/frontend-architecture.mermaid"
```

## Development

### Setup
```bash
git clone <repository>
cd mermaid-codebase-generator
npm install
npm run build
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests (requires OPENAI_API_KEY)
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Building
```bash
npm run build
npm run lint
```

## Architecture

The tool is built with a modular architecture:

- **File Discovery**: Recursively finds and filters files
- **Token Calculator**: Estimates token usage for different file types
- **Bucket Manager**: Groups files based on token limits
- **LLM Interface**: Abstract interface for different LLM providers
- **Mermaid Generator**: Creates and merges Mermaid diagrams
- **State Manager**: Tracks processing progress and handles resumption
- **GitHub Integration**: Creates PRs and manages repository interactions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- [Documentation](https://github.com/your-org/mermaid-codebase-generator/wiki)
- [Issue Tracker](https://github.com/your-org/mermaid-codebase-generator/issues)
- [Discussions](https://github.com/your-org/mermaid-codebase-generator/discussions)
