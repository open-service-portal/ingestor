# Changelog

All notable changes to the Backstage Ingestor Plugin will be documented in this file.

## [1.1.0] - 2025-01-26

### Added

#### CLI Tools
- **Ingestor CLI** - Command-line tool for ingesting Kubernetes resources from files/directories
  - Support for single files, directories, and stdin input
  - Preview mode to see what would be generated without creating files
  - Validation mode to check resources without processing
  - Configurable output format (YAML/JSON) and directory structure
  - Custom owner, namespace, and tag assignment

- **Export CLI** - Tool for extracting entities from Backstage catalog
  - Filter by kind, namespace, owner, and tags
  - Preview and list modes for exploration
  - Manifest generation for audit trails
  - Organized output by entity type
  - Support for remote Backstage instances with authentication

#### Architecture Improvements
- **Unified Ingestion Engine** - Shared core logic between CLI and runtime
  - Consistent XRD transformation regardless of execution environment
  - Adapter pattern for clean separation of concerns
  - Dependency injection for better testability
  - Modular validators and builders

- **Core Components**:
  - `IngestionEngine` - Main pipeline orchestrator
  - `ResourceValidator` - XRD and K8s resource validation
  - `XRDEntityBuilder` - Transform XRDs to Backstage entities
  - `CLIAdapter` - Handle file I/O for CLI
  - `RuntimeAdapter` - Bridge with Backstage backend
  - `BackstageClient` - REST API communication

### Changed
- Restructured codebase with clear separation between core, CLI, and runtime
- Updated package.json with CLI configurations and dependencies
- Enhanced README with comprehensive CLI documentation

### Technical Details
- TypeScript implementation with strict typing
- Commander.js for CLI argument parsing
- Separate compilation configuration for CLI tools
- Support for global npm installation

## [1.0.0] - 2025-01-26

### Added
- Initial standalone plugin extracted from TeraSky fork
- Renamed from `kubernetes-ingestor` to `ingestor`
- Basic Kubernetes resource discovery
- Crossplane XRD support
- Entity provider system
- Integration with Backstage catalog