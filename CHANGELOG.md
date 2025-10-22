# [2.2.0](https://github.com/open-service-portal/ingestor/compare/v2.1.1...v2.2.0) (2025-10-22)


### Features

* add version label support to Backstage template generation ([#28](https://github.com/open-service-portal/ingestor/issues/28)) ([39b63b3](https://github.com/open-service-portal/ingestor/commit/39b63b37358d8cf299d6c5473279c4e2998715f9)), closes [#XX](https://github.com/open-service-portal/ingestor/issues/XX)

## [2.1.1](https://github.com/open-service-portal/ingestor/compare/v2.1.0...v2.1.1) (2025-10-22)


### Bug Fixes

* auto-detect dev vs production environment in bin scripts ([#26](https://github.com/open-service-portal/ingestor/issues/26)) ([b592fdc](https://github.com/open-service-portal/ingestor/commit/b592fdc646350cf5443a29eb581bd24bb15d23f7))

# [2.1.0](https://github.com/open-service-portal/ingestor/compare/v2.0.0...v2.1.0) (2025-10-21)


### Features

* restore git and changelog plugins to commit version to package.json ([#25](https://github.com/open-service-portal/ingestor/issues/25)) ([19f3531](https://github.com/open-service-portal/ingestor/commit/19f3531edd91c8e42278e523427068148a763d3d))

# Changelog

All notable changes to the Backstage Ingestor Plugin will be documented in this file.

## Unreleased

## v1.2.0 (2025-10-21)

### CI/CD
- Add automated changelog generation on PR merge
- Add tag-triggered release workflow
- Add PR title validation for conventional commits
- Changelog now updates automatically when PR tests pass

### Fixed
- **Removed broken catalog:register step from default template** - The step was failing because `kube:apply` doesn't output `repoContentsUrl`. Resources are now automatically discovered by the Kubernetes ingestor instead.
  - Removed `catalog:register` step that expected `repoContentsUrl` from `kube:apply`
  - Updated workflow info message to reflect auto-discovery
  - Added catalog discovery note in create-resource output
  - Fixes validation error: "Invalid input passed to action catalog:register"

### Changed

#### Self-Contained Template Architecture
- **YAML Merge at Template Level** - Sub-templates now contain full YAML structure (`spec.parameters`, `spec.steps`, `spec.output`)
  - Main template provides base structure (metadata + `spec.owner/type`)
  - Sub-templates provide complete `spec` sections with full context
  - Transform engine merges all templates using YAML-aware deep merge
  - No more manual indentation with `{{{indent ...}}}` helper
  - Sub-templates are self-contained and reusable across contexts
  - Cleaner, more maintainable template code

### Added

#### Template System Enhancements
- **Template-Level Output Section** - Outputs now display in final results panel after template execution
  - Created `templates/output/` directory with reusable output blocks
  - `download-manifest.hbs` - Manifest download link with data URL
  - `pr-link.hbs` - Pull request link for GitOps workflows
  - `gitops-summary.hbs` - GitOps workflow summary information
  - Output section integrated into main backstage template structure

#### Multi-Template Building Block Pattern
- **Comma-Separated Template Composition** - Mix and match template building blocks
  - Supports all three template types: parameters, steps, and output
  - Usage: `openportal.dev/template-output: "download,pr,summary"`
  - YAML-aware deep merge algorithm properly combines multiple templates
  - Arrays are concatenated (e.g., multiple links combined under single `links:` key)
  - Objects are merged recursively with conflict resolution
  - New methods: `renderMultipleSubTemplates()`, `deepMergeYaml()`

#### Testing Infrastructure Overhaul
- **Flattened Test Structure** - Scenario-based organization with clear naming conventions
  - `tests/<scenario>/test-<case>.yaml` - Test fixtures
  - `tests/<scenario>/assert-<case>.yaml` - Expected outputs
  - `tests/output/` - Shared generated output directory
  - `tests/templates/` - Minimal test templates for fast, focused testing
  - Unified test runner `run-tests.sh` with automatic scenario discovery
  - E2E tests use production templates, feature tests use minimal test templates

#### Comprehensive Test Coverage
- **7 Test Scenarios** covering all transform engine features (15 tests, all passing ✅)
  - `scope/` (2 tests) - Namespaced vs Cluster resource detection
  - `multi-templates/` (1 test) - Comma-separated template composition
  - `yaml-merge/` (1 test) - Three-way merge, nested object merging
  - `annotations/` (3 tests) - XRD annotation handling (tags, description, owner)
  - `helpers/` (3 tests) - Handlebars helper functions (slugify, replace, conditionals)
  - `properties/` (3 tests) - Property extraction (types, required, enum)
  - `e2e/` (2 tests) - Production template validation (namespace, whoami)

### Fixed
- **GitOps Template Outputs** - Fixed missing output display in Backstage UI
  - Removed unsupported output sections from `debug:log` action
  - Added proper outputs to `generateManifest` and `create-pull-request` steps
  - Enhanced PR creation step with visual workflow status indicators

#### Scripts and Tools
- **xrd-transform.sh wrapper script** - Shell script for easy CLI access
  - Located at `scripts/xrd-transform.sh` for convenient transformation
  - Delegates to `bin/ingestor` for consistent execution
  - Workspace-level wrapper at `portal-workspace/scripts/template-ingest.sh`
  - Support for debug, validate, and output directory options
- **backstage-export.sh script** - Export entities from Backstage catalog (NEW)
  - Fetch entities via Backstage REST API
  - Filter by kind, namespace, owner, tags, name
  - Auto-detects API token from config files
  - Organize output by entity type or flat structure
  - Generate export manifest with metadata
  - Preview and list modes for exploration
  - Delegates to `bin/backstage-export` for consistent execution
  - Workspace wrapper at `portal-workspace/scripts/template-export.sh`
- **Bin scripts architecture** - npm-compatible entry points
  - `bin/ingestor` - XRD transform CLI (delegates to xrd-transform-cli.ts)
  - `bin/backstage-export` - Backstage export CLI (delegates to backstage-export-cli.ts)
  - Both configure ts-node with `tsconfig.cli.json` for CommonJS module resolution
  - Provides npm package compatibility when plugin is installed
  - Shell wrappers handle path resolution and user-friendly interfaces
- **--only filter** - Generate specific entity types
  - `--only template` generates only Backstage Template entities
  - `--only api` generates only API documentation entities
  - Works with all other CLI options (watch, verbose, etc.)

#### Template System Enhancements
- **Modular template architecture** - Separate templates for parameters and steps
  - `parameters/` directory for form field templates
  - `steps/` directory for workflow step templates
  - Annotation-based template selection (openportal.dev/template-parameters, openportal.dev/template-steps)
  - Reusable template components for common patterns
  - Cluster-scoped template variants without namespace parameters

#### XRD Annotation Support
- **Parameter defaults via annotations** - `openportal.dev/parameter.*` for XRD-level config overrides
- **GitOps configuration** - Support for GitOps workflow with PR-based resource creation
- **Template selection annotations** - Full control over template, API, parameters, and steps templates
- **Tag annotation** - `openportal.dev/tags` for comma-separated tag lists

#### Configuration Improvements
- **Flexible entity naming** - `nameModel` configuration option
  - Options: 'name', 'name-cluster', 'name-namespace', 'name-namespace-cluster'
  - Controls metadata.name format for catalog entities
- **Configurable entity titles** - `titleModel` configuration option
  - Options: 'name', 'name-cluster', 'name-namespace', 'kind-name', 'kind-name-cluster'
  - Defaults to 'name' for clean, simple display names

#### Development Features
- **Kubectl context detection** - Automatic cluster detection and config loading in CLI
- **Debug template** - Special template for inspecting transformation variables
- **Intelligent XRD discovery** - Priority-based search for XRDs in directories
- **API entity enhancements** - Support for minLength, maxLength, and lifecycle annotations

#### XR Status Links (from v1.1.0)
- **Auto-generation from status fields** - Extract URLs from Crossplane XR status
  - Support for common URL patterns: domain, fqdn, url, endpoint, ingress.host
  - Support for array fields: endpoints[], urls[]
  - Support for additional fields: address, hostname, externalURL
  - Generate Google DNS query links for FQDN fields
  - Merge status links with existing annotation links
  - Comprehensive unit tests for link extraction

### Changed

#### Breaking Changes
- **Configuration structure simplified** - `kubernetesIngestor` → `ingestor`, `components` → `kubernetes`
- **GitOps config flattened** - `gitops.ordersRepo.*` → `gitops.*` (removed nesting)
- **titleModel now defaults to 'name'** - Entities always have a clean display name
- **Annotation namespace migration** - Moved to standard `backstage.io/*` where appropriate
- **Template selector annotations** - Changed from `backstage.io/*` to `openportal.dev/*` for project-specific features

#### Architecture Refactoring
- **Removed old unified engine** - Eliminated 16,000+ lines of abstraction layers
  - Deleted `core/` directory with old engine
  - Removed `entity-builders/`, `template-handlers/`, `version-handlers/`, `yaml-builders/`
  - Plugin now uses xrd-transform as a library (not shared engine)
- **Code organization improvements** - Renamed `providers` to `data-providers` for clarity
- **Simplified XRDTemplateEntityProvider** - Reduced from ~300 lines to ~180 lines

#### Template Improvements
- **Unified scope handling** - Single template handles both namespaced and cluster-scoped resources
- **Improved property filtering** - Filter duplicate 'name' property from Resource Configuration
- **Conditional sections** - Omit empty Resource Configuration section when no properties
- **Merged form sections** - Combined Basic Information and Resource Configuration
- **Better YAML formatting** - Proper quoting of descriptions and values
- **Tag extraction** - Extract tags from annotation instead of iterating label values

### Fixed

#### Entity Generation
- **Strip _xrdBaseName from entities** - Remove internal field before catalog registration
- **Quote property descriptions** - Prevent YAML indentation errors with special characters
- **API template quoting** - Quote description fields in OpenAPI schema
- **Managed-by-location annotation** - Add to templates to silence catalog warnings
- **Lifecycle annotation** - Use proper lifecycle stage instead of API version

#### Missing Implementations
- **Handlebars helpers** - Add missing `replace`, `indent`, `hasAny`, `split`, `trim` helpers
- **Entity builder classes** - Implement missing `ComponentEntityBuilder` and `SystemEntityBuilder`
- **Crossplane methods** - Add `withCrossplaneClaimMetadata` and `withCrossplaneXRMetadata`

#### File Handling
- **Cleaner filenames** - Use template-kind pattern (e.g., `name-default-api.yaml`)
- **Debug template output** - Generate `name-debug.yaml` for debug template
- **Explicit base names** - Use `_xrdBaseName` field for clean filename generation

### Removed
- **Unused configuration options** - Removed `tagsLabel`, `defaultNamespace`, `claims.ingestAllClaims`
- **Legacy code** - Removed ~16,000+ lines of unused abstraction layers
- **Old module files** - Removed `module-new.ts` and other deprecated files

### Documentation
- **CLAUDE.md** - New comprehensive development guide for the plugin
- **XRD Annotations Reference** - Complete guide to all annotation options
- **XRD Transform Examples** - Detailed usage guide with examples
- **Architecture documentation** - Updated for new template-based system
- **Test suite README** - Comprehensive testing documentation
- **Configuration reference** - Updated for new config structure
- **Quick start guide** - Copy-paste examples for immediate use

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
