# XRD Transform - Quick Start

## Run It Now (Easy Way - Workspace Script)

```bash
# 1. From workspace root
cd /path/to/portal-workspace

# 2. Transform template-namespace XRD
./scripts/xrd-transform.sh template-namespace/configuration/xrd.yaml

# 3. With verbose output
./scripts/xrd-transform.sh -v template-namespace/configuration/xrd.yaml

# 4. From stdin (pipe)
cat template-namespace/configuration/xrd.yaml | ./scripts/xrd-transform.sh

# 5. Save to file
./scripts/xrd-transform.sh template-namespace/configuration/xrd.yaml > /tmp/generated-template.yaml

# 6. View generated template
cat /tmp/generated-template.yaml | head -50
```

## Alternative: Direct CLI (From Plugin Directory)

```bash
# 1. Navigate to ingestor plugin
cd plugins/ingestor

# 2. Transform template-namespace XRD
cat ../../../template-namespace/configuration/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts

# 3. With verbose output
cat ../../../template-namespace/configuration/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts -v
```

## What You Get

**Input:** Crossplane XRD (CompositeResourceDefinition)
**Output:**
- ✅ Backstage Template entity (scaffolder.backstage.io/v1beta3)
- ✅ API Documentation entity (backstage.io/v1alpha1)

## One-Liner for Testing

```bash
# From workspace root (recommended)
./scripts/xrd-transform.sh -v template-namespace/configuration/xrd.yaml

# Or from plugin directory
cd plugins/ingestor && \
cat ../../../template-namespace/configuration/xrd.yaml | \
npx ts-node --project tsconfig.cli.json src/xrd-transform/cli/xrd-transform-cli.ts -v
```

## Directory Structure

```
plugins/ingestor/
├── templates/              ← Handlebars templates (customizable!)
│   ├── backstage/
│   │   ├── default.hbs
│   │   └── simple.hbs
│   └── api/
│       └── default.hbs
│
└── src/
    └── xrd-transform/      ← Transform tool
        ├── lib/            ← Core library
        ├── helpers/        ← Template helpers
        └── cli/            ← CLI wrapper
```

## Common Options

```bash
# Use custom templates
-t /path/to/templates

# Save to directory
-o ./output

# JSON format instead of YAML
-f json

# See what's happening
-v

# Watch for changes
--watch
```

## See Full Examples

📖 [XRD Transform Examples](./docs/xrd-transform-examples.md)

## Test Other XRDs

```bash
# From workspace root (easy)
./scripts/xrd-transform.sh template-whoami/xrd.yaml
./scripts/xrd-transform.sh template-cloudflare-dnsrecord/xrd.yaml

# Or from plugin directory
cat ../../../template-whoami/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts

cat ../../../template-cloudflare-dnsrecord/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts
```

## Integration with Backstage

The plugin uses the same library automatically:

```typescript
// In XRDTemplateEntityProvider
const transformer = new XRDTransformer();
const entities = await transformer.transform(xrdData);
// Returns Backstage Template + API entities
```

**No CLI needed in production** - the plugin discovers XRDs from Kubernetes and transforms them automatically!
