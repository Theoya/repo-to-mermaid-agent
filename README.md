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

The simplest way to generate a Mermaid diagram:

```bash
# Generate diagram with all defaults
mermaid-gen

# Or specify custom output file
mermaid-gen --output my-diagram.mermaid
```

That's it! The tool will automatically:
- Use the configuration from `mermaid_generator_config.yaml` (if present)
- Process all relevant files in your repository
- **Automatically exclude `node_modules` and other build artifacts** (no configuration needed)
- Generate a color-coded Mermaid diagram
- Use optimized defaults (100k tokens, GPT-5 model)

## What Gets Excluded Automatically

The tool automatically excludes common build and dependency directories:
- `node_modules` (always excluded)
- `.git`, `dist`, `build`, `target`, `bin`, `obj`
- `.next`, `.nuxt`, `.cache`, `.parcel-cache`
- `coverage`, `.nyc_output`
- `.vscode`, `.idea`
- `*.log`, `*.tmp`, `*.temp`, `*.min.js`, `*.min.css`

This means you can run `mermaid-gen` in any project and it will focus on your actual source code, not build artifacts or dependencies.

## GitHub Action Setup

To automatically generate Mermaid diagrams in your CI/CD pipeline:

1. **Copy the workflow file** from `.github/workflows/mermaid_generator_config.yaml` to your repository root
2. **Add the workflow** to your `.github/workflows/` directory
3. **Set up secrets** in your repository settings:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GITHUB_TOKEN`: Automatically provided by GitHub

The action will:
- Run on pushes to main/develop branches
- Generate updated Mermaid diagrams
- Create pull requests with the updated diagrams
- Use the same smart exclusions (no node_modules processing)

### Advanced Usage

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
  -t, --token-limit <number>     Token limit per processing batch (default: 100000)
  -f, --file-types <types>       Comma-separated file extensions (default: auto-detect)
  -o, --output <path>            Output file path (default: repo.mermaid)
  -c, --config <path>            Configuration file path (default: mermaid_generator_config.yaml)
  -r, --recursive                Process files recursively (default: true)
  -s, --specific-files <files>   Comma-separated list of specific files
  -e, --existing-mermaid <path>  Path to existing Mermaid file to build upon
  -p, --llm-provider <provider>  LLM provider: openai, claude, grok (default: openai)
  -m, --llm-model <model>        LLM model to use (default: gpt-5)
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

Create a `mermaid_generator_config.yaml` file to customize behavior:

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
  model: "gpt-5"
  max_tokens: 100000
  temperature: 0.1
  additional_instructions: ""  # Additional context/instructions for the LLM

output:
  format: "mermaid"
  file_path: "repo.mermaid"
  include_summary: true

# Color scheme for Mermaid diagrams
colors:
  tests: "#e17055"        # Orange for tests and testing suites
  config: "#fdcb6e"       # Yellow for configuration files and tools
  core: "#0984e3"         # Blue for core functionality or business logic
  llm: "#55efc4"          # Green for LLM related components
  output: "#6c5ce7"       # Purple for output and rendering components

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
            --token-limit 100000 \
            --file-types "cs,py,js,ts,jsx,tsx" \
            --output "repo.mermaid" \
            --llm-provider "openai" \
            --llm-model "gpt-5" \
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

## Color-Coded Diagrams

The generator creates beautiful, color-coded Mermaid diagrams that make it easy to understand your codebase architecture at a glance:

- 🟠 **Orange (#e17055)** - Tests and testing suites
- 🟡 **Yellow (#fdcb6e)** - Configuration files and tools  
- 🔵 **Blue (#0984e3)** - Core functionality or business logic
- 🟢 **Green (#55efc4)** - LLM related components
- 🟣 **Purple (#6c5ce7)** - Output and rendering components

You can customize these colors in your `mermaid_generator_config.yaml` file. The LLM automatically applies the appropriate colors based on the component type, making your diagrams more readable and professional-looking.

## Customizing LLM Analysis

You can provide additional context and instructions to the LLM to customize how it analyzes your codebase. Add the `additional_instructions` field to your `mermaid_generator_config.yaml`:

```yaml
llm:
  provider: "openai"
  model: "gpt-5"
  max_tokens: 100000
  temperature: 0.1
  additional_instructions: |
    Focus on the microservices architecture and API endpoints.
    Pay special attention to database connections and data flow.
    Highlight any security-related components or authentication flows.
    Emphasize the relationship between frontend and backend services.
```

### Example Use Cases

**For API Documentation:**
```yaml
additional_instructions: |
  Focus on REST API endpoints, request/response patterns, and data models.
  Include HTTP methods, status codes, and authentication requirements.
  Highlight API versioning and rate limiting mechanisms.
```

**For Security Analysis:**
```yaml
additional_instructions: |
  Identify security-related components, authentication mechanisms, and authorization flows.
  Highlight data encryption, input validation, and security middleware.
  Pay attention to sensitive data handling and compliance requirements.
```

**For Performance Optimization:**
```yaml
additional_instructions: |
  Focus on performance-critical components, caching mechanisms, and database queries.
  Identify potential bottlenecks, async processing, and optimization opportunities.
  Highlight monitoring, logging, and observability features.
```

## LLM Providers

### OpenAI
```bash
mermaid-gen --llm-provider openai --llm-model gpt-5 --llm-api-key YOUR_OPENAI_API_KEY
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
mermaid-gen --file-types "cs,csproj,sln" --token-limit 100000 --output "docs/solution-architecture.mermaid"
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
