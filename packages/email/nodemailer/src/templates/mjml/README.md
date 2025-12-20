# MJML Email Templates

## Overview

This directory contains **MJML source templates** that compile to Handlebars `.hbs` files.

**Maintain templates here** → **Compiled to `../default/`** → **Used by HandlebarsTemplateEngine**

## Structure

```
mjml/
├── master.mjml          # Master template with global styles & layout
├── content/              # Content-only templates (injected into master)
│   ├── verification.mjml
│   ├── password-reset.mjml
│   ├── welcome.mjml
│   └── ...
├── build-templates.js    # Build script (MJML → .hbs)
└── README.md            # This file
```

## How It Works

1. **Master Template** (`master.mjml`)
   - Contains global styles in `<mj-attributes>` and `<mj-style>`
   - Defines layout structure (header, footer, content slot)
   - Uses Handlebars conditionals for optional sections

2. **Content Templates** (`content/*.mjml`)
   - **Content only** - no styling, just structure
   - Uses CSS classes from master (e.g., `css-class="text-small"`)
   - Injected into master via `{{> content}}` placeholder

3. **Build Process**
   ```bash
   yarn build-templates
   ```
   - Merges master + content
   - Compiles MJML → HTML
   - Adds frontmatter (subject)
   - Outputs to `../default/*.html.hbs`

## Global Styles (in master.mjml)

### CSS Classes Available

**Text Colors:**
- `text-primary` - Main text (#111827)
- `text-secondary` - Secondary text (#374151)
- `text-muted` - Muted text (#6b7280)
- `text-small` - Small text (#9ca3af)
- `text-success` - Success green (#166534)
- `text-danger` - Error red (#dc2626)
- `text-info` - Info blue (#0c4a6e)

**Backgrounds:**
- `bg-success` - Success background (#f0fdf4)
- `bg-danger` - Error background (#fef2f2)
- `bg-info` - Info background (#f0f9ff)
- `bg-muted` - Muted background (#f9fafb)

**Typography:**
- `heading` - 18px, bold, primary color
- `heading-large` - 20px, bold, primary color
- `font-bold` - Font weight 600
- `font-semibold` - Font weight 500

**Components:**
- `code-block` - Large code display (32px, monospace)
- `alert-box` - Alert container
- `alert-success` - Green alert
- `alert-danger` - Red alert
- `alert-info` - Blue alert

### Default Attributes (via mj-attributes)

All components inherit:
- **Font:** Inter, system fonts
- **Text:** 16px, line-height 24px, color #374151
- **Buttons:** 16px, bold, rounded, blue background
- **Sections:** White background, 24px horizontal padding

## Example: Adding a New Template

1. **Create content template** (`content/my-template.mjml`):
   ```mjml
   <!-- My Template Content -->
   <mj-text>
     Hello! This is my new template.
   </mj-text>

   <mj-text css-class="text-small text-muted">
     Optional footer text.
   </mj-text>
   ```

2. **Add to build script** (`build-templates.js`):
   ```javascript
   const SUBJECTS = {
     // ... existing
     'my-template': 'My Template - {{appName}}',
   };
   ```

3. **Build:**
   ```bash
   yarn build-templates
   ```

4. **Result:** `../default/my-template.html.hbs` ready to use!

## Customizing Styles

**To change colors globally:**
Edit `master.mjml` → `<mj-style>` section

**To change font sizes:**
Edit `master.mjml` → `<mj-attributes>` → `<mj-text>`

**To change button style:**
Edit `master.mjml` → `<mj-attributes>` → `<mj-button>`

**No need to edit individual content templates!**

## Best Practices

1. **Use CSS classes** - Don't inline styles in content templates
2. **Keep content simple** - Just structure, no styling
3. **Use conditionals** - `{{#if variable}}` for optional content
4. **Test after changes** - Run `yarn build-templates` and check output
5. **One master, many content** - All styling in master.mjml

## Build Integration

Templates are automatically built during package build:
```bash
yarn build  # Runs: build-templates → tsc → copy-templates
```

Or build templates only:
```bash
yarn build-templates
```


