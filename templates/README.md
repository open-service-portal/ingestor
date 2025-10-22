# Ingestor Templates - Customization Guide

Welcome! You've just initialized custom templates for the ingestor plugin. These templates control how Crossplane XRDs (Composite Resource Definitions) are transformed into Backstage software templates.

## What Are These Templates?

The ingestor plugin automatically discovers XRDs from your Kubernetes clusters and converts them into user-friendly forms in Backstage. These Handlebars templates define:
- **What form fields** users see when creating resources
- **What workflows** execute when users submit the form (direct apply vs GitOps PR)
- **What output** users see after creating a resource

Think of templates as the "UI generator" for your infrastructure-as-code resources.

## Directory Structure

```
ingestor-templates/
├── README.md              # This file - your guide to customization
├── backstage/             # Main template structure
│   ├── default.hbs        # Primary template (works for all resource types)
│   └── debug.hbs          # Debugging template (shows all available data)
├── parameters/            # Form field definitions
│   ├── default.hbs        # Standard fields (name, namespace, resource properties)
│   └── gitops.hbs         # GitOps fields (repository, branch overrides)
├── steps/                 # Workflow definitions
│   ├── default.hbs        # Direct kubectl apply workflow
│   └── gitops.hbs         # PR-based GitOps workflow
├── output/                # User feedback after execution
│   ├── default.hbs        # Download manifest link
│   ├── pr-link.hbs        # Pull request link
│   ├── gitops.hbs         # GitOps summary
│   ├── download-manifest.hbs  # Building block: download link
│   └── gitops-summary.hbs     # Building block: summary text
└── api/                   # API documentation entities
    └── default.hbs        # OpenAPI documentation template
```

## Quick Start: Making Your First Customization

### Example 1: Add Your Organization's Branding

Edit `backstage/default.hbs` to add custom tags:

```handlebars
# Find the tags section:
tags:
  - crossplane
  - {{xrd.spec.group}}
  - acme-corp  # ← Add your organization tag
```

**Save, restart Backstage**, and all new XRD-generated templates will include your tag!

### Example 2: Customize GitOps PR Titles

Edit `steps/gitops.hbs` to change how PRs are titled:

```handlebars
# Find the title line in create-pull-request action:
title: "feat(infra): new {{xrd.spec.names.kind}} - \${{ parameters.name }}"
# ← Changed from generic "Create" to semantic commit style
```

### Example 3: Add Parameter Validation

Edit `parameters/default.hbs` to enforce naming rules:

```handlebars
name:
  title: Resource Name
  type: string
  description: Must be lowercase with dashes
  pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
  minLength: 3      # ← Add minimum length
  maxLength: 63     # ← Add maximum length
```

## How Templates Work

### 1. XRDs Choose Their Templates

Your XRDs specify which templates to use via annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: databases.platform.io
  annotations:
    # These annotations select which templates to use:
    backstage.io/template: "default"              # Main structure
    backstage.io/template-parameters: "default"   # Form fields
    backstage.io/template-steps: "gitops"         # Workflow (use gitops.hbs)
    backstage.io/template-output: "default,pr-link,gitops"  # User feedback
```

**No annotation?** The ingestor uses `default` for everything.

### 2. Templates Are Merged Together

The ingestor renders each template separately and merges them:

1. **Main template** (`backstage/default.hbs`) → Base structure
2. **Parameters template** → Form fields section
3. **Steps template** → Workflow section
4. **Output template** → Links and summary section
5. **YAML merge** → Combined into final template

This modular approach means you can mix and match templates!

### 3. Templates Have Access to Data

Templates can use these variables:

```handlebars
{{!-- XRD information --}}
{{xrd.spec.group}}                 # e.g., "platform.io"
{{xrd.spec.names.kind}}            # e.g., "Database"
{{xrd.spec.scope}}                 # "Namespaced" or "Cluster"

{{!-- Configuration from app-config.yaml --}}
{{config.gitops.ordersRepo.owner}} # GitHub org/user
{{config.gitops.ordersRepo.repo}}  # Repository name
{{config.gitops.ordersRepo.targetBranch}}  # Target branch

{{!-- Metadata (from CLI execution) --}}
{{metadata.cluster}}               # Current kubectl context
{{metadata.source}}                # Where XRD came from

{{!-- Backstage variables (user input at runtime) --}}
{{{backstageVar "parameters.name"}}}  # User's resource name
```

**Important:** Use triple braces `{{{...}}}` for Backstage variables to prevent HTML escaping!

## Common Customizations

### Add Team-Specific Tags

```handlebars
{{!-- backstage/default.hbs --}}
tags:
  - crossplane
  - {{xrd.spec.group}}
  - {{#if (includes xrd.spec.group "database")}}database-team{{/if}}
  - {{#if (includes xrd.spec.group "networking")}}network-team{{/if}}
```

### Customize Form Field Labels

```handlebars
{{!-- parameters/default.hbs --}}
name:
  title: 🏷️ Resource Identifier  # ← Add emoji and friendly title
  type: string
  description: A unique name for your {{xrd.spec.names.kind}}
```

### Change PR Description Format

```handlebars
{{!-- steps/gitops.hbs --}}
description: |
  ## 🚀 New {{xrd.spec.names.kind}} Request

  **Resource Name**: \${{ parameters.name }}
  **Requested By**: \${{ user.entity.metadata.name }}
  **Team**: \${{ user.entity.spec.memberOf[0] }}

  Please review and merge to deploy this resource.
```

### Add Conditional Fields Based on XRD Type

```handlebars
{{!-- parameters/default.hbs --}}
{{#if (includes xrd.spec.group "database")}}
backup:
  title: Enable Backups
  type: boolean
  default: true
  description: Automated daily backups
{{/if}}
```

## Testing Your Changes

### 1. Restart Backstage

```bash
# Stop Backstage if running (Ctrl+C)
# Start it again:
yarn start
```

The ingestor loads templates at startup, so you need to restart after making changes.

### 2. Find an XRD-Generated Template

1. Go to **Create** in Backstage
2. Look for templates with type `crossplane` tag
3. Click one to see the form

### 3. Check Your Customizations

- Form fields changed? Check `parameters/` templates
- Workflow steps different? Check `steps/` templates
- Output messages changed? Check `output/` templates

### 4. Test with CLI (Advanced)

If you have the ingestor plugin workspace:

```bash
cd plugins/ingestor
yarn run ingestor transform path/to/xrd.yaml
# Review the generated template YAML
```

## Available Helper Functions

Use these in your templates:

```handlebars
{{!-- Text manipulation --}}
{{slugify "My Database"}}          # → "my-database"
{{trim "  text  "}}                # → "text"

{{!-- XRD data extraction --}}
{{extractTitle xrd}}               # Gets human-readable title
{{getAnnotation xrd "key"}}        # Gets annotation value
{{getLabel xrd "key"}}             # Gets label value

{{!-- Conditionals --}}
{{#if (eq xrd.spec.scope "Namespaced")}}...{{/if}}
{{#if (includes xrd.spec.group "database")}}...{{/if}}

{{!-- Arrays --}}
{{#each properties}}{{name}}: {{type}}{{/each}}
{{#each (split tags ",")}}{{this}}{{/each}}

{{!-- Backstage variable preservation --}}
{{{backstageVar "parameters.name"}}}  # ← Triple braces!
```

## Understanding Workflows

### Default Workflow (Direct Apply)

**Template:** `steps/default.hbs`

**What it does:**
1. User fills form → Backstage
2. Backstage applies resource → Kubernetes
3. Resource created immediately

**Use when:** You want direct, immediate resource creation.

**Pros:** Fast, simple
**Cons:** No review process

### GitOps Workflow (PR-Based)

**Template:** `steps/gitops.hbs`

**What it does:**
1. User fills form → Backstage
2. Backstage creates PR → catalog-orders repository
3. Team reviews PR → Merge
4. Flux sees PR → Deploys resource to cluster

**Use when:** You want review, approval, and audit trail.

**Pros:** Reviewed changes, git history, rollback capability
**Cons:** Slower (requires PR approval)

**Configuration required in** `app-config/ingestor.yaml`:
```yaml
ingestor:
  crossplane:
    xrds:
      gitops:
        owner: 'your-org'
        repo: 'catalog-orders'
        targetBranch: 'main'
```

## Resetting to Defaults

Made changes you want to undo? Reset to the npm package defaults:

```bash
# Backup your current templates (optional)
cp -r ingestor-templates ingestor-templates.backup

# Reinitialize from npm package
yarn ingestor:init --force

# Review what changed
git diff ingestor-templates/

# Option 1: Keep npm defaults
git add ingestor-templates/
git commit -m "chore: reset ingestor templates to npm defaults"

# Option 2: Restore your customizations
mv ingestor-templates.backup ingestor-templates
```

## Troubleshooting

### Templates Not Loading

**Problem:** Changed templates but don't see changes in Backstage

**Solution:** Restart Backstage (`yarn start`) - templates load at startup

### YAML Errors in Generated Templates

**Problem:** Backstage shows YAML parse errors

**Solution:** Check your template indentation - YAML is whitespace-sensitive

```handlebars
# Correct (indented properly):
    - title: My Field
      type: string

# Incorrect (no indentation):
- title: My Field
type: string
```

### Backstage Variables Not Working

**Problem:** See `${{ &quot;parameters.name&quot; }}` instead of `${{ "parameters.name" }}`

**Solution:** Use triple braces `{{{...}}}` for Backstage variables:

```handlebars
# Correct:
title: {{{backstageVar "\"Create \" + parameters.name"}}}

# Incorrect:
title: {{backstageVar "\"Create \" + parameters.name"}}
```

### GitOps Workflow Fails

**Problem:** Templates using GitOps workflow fail to generate

**Solution:** Check `app-config/ingestor.yaml` has GitOps configuration:

```yaml
ingestor:
  crossplane:
    xrds:
      gitops:
        owner: 'your-org'       # ← Required!
        repo: 'catalog-orders'  # ← Required!
        targetBranch: 'main'
```

## Getting Help

### Documentation

- **Template Examples**: See templates in this directory for working examples
- **App-Portal Docs**: `docs/crossplane-ingestor.md` for integration guide
- **Ingestor Package Docs**: [Template Customization Guide](https://github.com/open-service-portal/ingestor/blob/main/docs/template-customization.md)
- **Backstage Docs**: [Software Templates](https://backstage.io/docs/features/software-templates/)

### Debug Mode

Use the debug template to see all available data:

1. Edit an XRD to use debug template:
   ```yaml
   annotations:
     backstage.io/template: "debug"
   ```
2. Transform it: `yarn run ingestor transform xrd.yaml`
3. Review the output - shows all variables available

### Common Questions

**Q: Do I need to restart Backstage after every template change?**
A: Yes - templates load at application startup.

**Q: Can I have different templates for different XRDs?**
A: Yes! XRDs choose their templates via annotations.

**Q: What happens if I delete a template file?**
A: The ingestor falls back to `default.hbs` in that directory.

**Q: Can I create my own custom templates (not just edit defaults)?**
A: Yes! Create new `.hbs` files and reference them in XRD annotations.

**Q: Are these templates version controlled?**
A: Yes - they're in git and shared with your team.

## Best Practices

1. **Start small** - Make one change, test it, commit it
2. **Use git** - Track changes so you can roll back if needed
3. **Test with real XRDs** - Don't just edit blindly, test the generated templates
4. **Document your changes** - Add comments in templates explaining custom logic
5. **Share with team** - Template changes affect everyone, communicate changes

## Example Workflow

Here's a typical template customization workflow:

```bash
# 1. Edit templates
vim ingestor-templates/backstage/default.hbs

# 2. Restart Backstage to load changes
yarn start

# 3. Test in Backstage UI
# → Go to Create → Find XRD template → Check form

# 4. Iterate if needed
vim ingestor-templates/parameters/default.hbs
# Restart and test again...

# 5. Commit when satisfied
git add ingestor-templates/
git commit -m "feat: add organization branding to XRD templates"
git push origin feature/custom-templates

# 6. Create PR for team review
gh pr create --title "feat: customize XRD templates"
```

---

**Happy templating! 🎨**

Your customizations help make infrastructure provisioning easier and more intuitive for your team.
