# Template Systems — Reference Guide

Jinja2, parameterized generation, variable systems, dynamic content, configuration templates,
email templates, and document generation. Build once, use everywhere.

---

## TABLE OF CONTENTS
1. Jinja2 Template Engine
2. Email Template Patterns
3. Document Template Systems
4. Configuration Templates
5. Code Generation Templates
6. Template Organization
7. Template Testing
8. Variable Systems

---

## 1. JINJA2 TEMPLATE ENGINE

### Core Syntax
```jinja2
{# This is a comment — not rendered #}

{# Variable substitution #}
Hello, {{ user.name }}!
Price: ${{ product.price | round(2) }}

{# Conditionals #}
{% if order.total > 100 %}
  You qualify for free shipping!
{% elif order.total > 50 %}
  Add ${{ 100 - order.total }} more for free shipping.
{% else %}
  Shipping: ${{ shipping_cost }}
{% endif %}

{# Loops #}
{% for product in products %}
  {{ loop.index }}. {{ product.title }} — ${{ product.price }}
{% else %}
  No products found.
{% endfor %}

{# Filters #}
{{ text | upper }}                          {# UPPERCASE #}
{{ text | lower }}                          {# lowercase #}
{{ text | title }}                          {# Title Case #}
{{ text | truncate(100) }}                  {# Truncate to 100 chars #}
{{ price | round(2) }}                      {# Round to 2 decimals #}
{{ date | strftime('%B %d, %Y') }}          {# Date formatting #}
{{ items | join(', ') }}                    {# Join list #}
{{ items | length }}                        {# Count #}
{{ value | default('N/A') }}                {# Default if None/undefined #}
{{ html_content | safe }}                   {# Don't escape HTML #}

{# Template inheritance — blocks override parent #}
{% extends "base_email.html" %}
{% block title %}Order Confirmation{% endblock %}
{% block body %}
  Your order #{{ order.id }} has been confirmed.
{% endblock %}

{# Macros — reusable template functions #}
{% macro product_card(product) %}
  <div class="product">
    <h3>{{ product.title }}</h3>
    <p>${{ product.price }}</p>
  </div>
{% endmacro %}

{{ product_card(featured_product) }}
```

### Jinja2 Python Setup
```python
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

def create_template_env(template_dir: Path) -> Environment:
    """Create a configured Jinja2 environment."""
    env = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(['html', 'xml']),  # Auto-escape in HTML templates
        trim_blocks=True,           # Remove newline after block tags
        lstrip_blocks=True,         # Remove leading whitespace before block tags
        undefined=StrictUndefined,  # Raise error on undefined variables (catch typos)
    )
    
    # Register custom filters
    env.filters['currency'] = lambda v: f"${v:,.2f}"
    env.filters['date_short'] = lambda v: v.strftime('%m/%d/%Y') if v else 'N/A'
    env.filters['pluralize'] = lambda n, singular, plural: singular if n == 1 else plural
    
    return env

def render_template(env: Environment, template_name: str, context: dict) -> str:
    """Render a template with context variables."""
    template = env.get_template(template_name)
    return template.render(**context)

# Usage:
env = create_template_env(Path('templates/'))
html = render_template(env, 'email/order_confirmation.html', {
    'customer_name': 'John',
    'order_id': 'ord_abc123',
    'products': [...],
    'total': 47.00,
})
```

### String Templates (Simple Substitution)
```python
from string import Template

# Python built-in Template (simpler than Jinja2, no logic)
tmpl = Template("""
Hello $name,

Your order ($order_id) for $$${amount:.2f} has been received.
Expected delivery: $delivery_date
""")

message = tmpl.substitute(
    name='Joshua',
    order_id='ORD-001',
    amount=47.00,
    delivery_date='January 20'
)

# Safe substitute — doesn't raise on missing variables
message = tmpl.safe_substitute(name='Joshua')  # Missing vars left as $var
```

### F-String Templates (Dynamic Strings)
```python
# For simple, single-use templates — use f-strings
def format_revenue_summary(metrics: dict) -> str:
    return f"""
📊 Daily Revenue Summary — {metrics['date']}

Total Revenue: ${metrics['total_revenue']:,.2f}
Transactions: {metrics['transaction_count']}
AOV: ${metrics['avg_order_value']:.2f}
New Customers: {metrics['new_customers']}

Top Product: {metrics['top_product']} (${metrics['top_revenue']:.2f})

{'🚀 ABOVE target!' if metrics['total_revenue'] >= metrics['daily_target'] else '⚠️ Below target'}
""".strip()
```

---

## 2. EMAIL TEMPLATE PATTERNS

### HTML Email Base Template
```html
{# templates/email/base.html #}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}Ten Life Creatives{% endblock %}</title>
  <style>
    /* Inline styles required for email clients */
    body { margin: 0; padding: 0; font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; }
    .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #eee; margin-bottom: 24px; }
    .footer { text-align: center; padding-top: 24px; font-size: 12px; color: #999; }
    .btn { display: inline-block; background: #2563EB; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
    h1 { color: #111; font-size: 24px; margin: 0 0 8px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .highlight { background: #f0f7ff; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="{{ logo_url }}" alt="Ten Life Creatives" width="120">
      </div>
      {% block content %}{% endblock %}
      <div class="footer">
        <p>Ten Life Creatives | Parker, CO<br>
        <a href="{{ unsubscribe_url }}">Unsubscribe</a></p>
      </div>
    </div>
  </div>
</body>
</html>
```

### Order Confirmation Template
```html
{# templates/email/order_confirmation.html #}
{% extends "email/base.html" %}

{% block title %}Your Order is Confirmed — {{ product_title }}{% endblock %}

{% block content %}
<h1>You're in! 🎉</h1>
<p>Hi {{ customer_name | default('there') }},</p>
<p>Your purchase of <strong>{{ product_title }}</strong> is confirmed. Here's what you need:</p>

<div class="highlight">
  <strong>Order #{{ order_id }}</strong><br>
  {{ product_title }}<br>
  Amount: ${{ amount | round(2) }}
</div>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{ download_url }}" class="btn">Download Your Product →</a>
</p>

<p>Your download link is valid for 30 days and can be used up to 5 times.</p>

{% if has_bonus %}
<p>🎁 <strong>Bonus included:</strong> {{ bonus_description }}</p>
{% endif %}

<p>Questions? Reply to this email and a human will respond within 24 hours.</p>
<p>Thanks for supporting an independent creator,<br>Joshua @ Ten Life Creatives</p>
{% endblock %}
```

---

## 3. DOCUMENT TEMPLATE SYSTEMS

### Parameterized Markdown Template
```python
from pathlib import Path

class DocumentTemplate:
    """
    A parameterized document template using Python string formatting.
    Supports nested templates and conditional sections.
    """
    
    TEMPLATE = """
# {title}

**Prepared for:** {client_name}  
**Date:** {date}  
**Valid until:** {expiry_date}  

---

## Our Proposal

{proposal_body}

## Investment

| Service | Price |
|---------|-------|
{service_rows}
| **Total** | **{total}** |

## Next Steps

{next_steps}

---
*{company_name} | {contact_email}*
"""
    
    @classmethod
    def render(cls, variables: dict) -> str:
        """Render template with variables. Raises KeyError on missing vars."""
        # Build service rows
        rows = '\n'.join(
            f"| {s['name']} | ${s['price']:.0f}/mo |"
            for s in variables.get('services', [])
        )
        
        return cls.TEMPLATE.format(
            **variables,
            service_rows=rows,
        )
```

---

## 4. CONFIGURATION TEMPLATES

### Environment Config Template
```python
CONFIG_TEMPLATE = {
    # Core settings
    "app_name": "{APP_NAME}",
    "environment": "{ENVIRONMENT}",
    "log_level": "{LOG_LEVEL}",
    
    # Database
    "database": {
        "type": "{DB_TYPE}",
        "path": "{DB_PATH}",
    },
    
    # API Keys (loaded from env at runtime, not stored in config)
    "integrations": {
        "stripe": {"enabled": True},
        "gumroad": {"enabled": True},
        "sendgrid": {"enabled": True},
    },
}

def generate_config(env_overrides: dict = None) -> dict:
    """Generate config by substituting environment variables."""
    import copy
    config = copy.deepcopy(CONFIG_TEMPLATE)
    
    substitutions = {
        'APP_NAME': os.getenv('APP_NAME', 'MyApp'),
        'ENVIRONMENT': os.getenv('ENVIRONMENT', 'development'),
        'LOG_LEVEL': os.getenv('LOG_LEVEL', 'INFO'),
        'DB_TYPE': os.getenv('DB_TYPE', 'sqlite'),
        'DB_PATH': os.getenv('DB_PATH', 'data/app.db'),
        **(env_overrides or {}),
    }
    
    return _substitute_dict(config, substitutions)

def _substitute_dict(obj, substitutions: dict):
    """Recursively substitute {KEY} placeholders in a nested dict."""
    if isinstance(obj, str):
        for key, value in substitutions.items():
            obj = obj.replace(f'{{{key}}}', str(value))
        return obj
    elif isinstance(obj, dict):
        return {k: _substitute_dict(v, substitutions) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_substitute_dict(item, substitutions) for item in obj]
    return obj
```

---

## 5. TEMPLATE ORGANIZATION

### Directory Structure
```
templates/
├── email/
│   ├── base.html                  # Base layout
│   ├── order_confirmation.html    # Extends base
│   ├── welcome.html               # Extends base
│   └── weekly_report.html
├── documents/
│   ├── proposal.md                # Markdown template
│   ├── invoice.md
│   └── sop.md
├── reports/
│   ├── revenue_summary.html
│   └── product_report.html
└── social/
    ├── product_launch.txt
    ├── weekly_thread.txt
    └── testimonial_post.txt
```

### Template Registry Pattern
```python
class TemplateRegistry:
    """Central registry for all templates with metadata."""
    
    TEMPLATES = {
        'order_confirmation': {
            'path': 'email/order_confirmation.html',
            'required_vars': ['customer_name', 'product_title', 'order_id', 'download_url'],
            'optional_vars': ['has_bonus', 'bonus_description'],
            'type': 'email_html',
        },
        'revenue_report': {
            'path': 'reports/revenue_summary.html',
            'required_vars': ['period', 'metrics'],
            'type': 'report_html',
        },
    }
    
    def __init__(self, template_dir: Path):
        self._env = create_template_env(template_dir)
    
    def render(self, template_name: str, context: dict) -> str:
        """Render named template, validating required variables."""
        if template_name not in self.TEMPLATES:
            raise ValueError(f"Unknown template: {template_name}")
        
        tmpl_config = self.TEMPLATES[template_name]
        
        # Validate required variables
        missing = [v for v in tmpl_config['required_vars'] if v not in context]
        if missing:
            raise ValueError(f"Template '{template_name}' missing required vars: {missing}")
        
        return render_template(self._env, tmpl_config['path'], context)
```

---

## 6. TEMPLATE TESTING

```python
import pytest

class TestEmailTemplates:
    """Test that email templates render correctly with valid data."""
    
    @pytest.fixture
    def registry(self, tmp_path):
        # Copy templates to temp dir for isolation
        shutil.copytree('templates', tmp_path / 'templates')
        return TemplateRegistry(tmp_path / 'templates')
    
    def test_order_confirmation_renders(self, registry):
        html = registry.render('order_confirmation', {
            'customer_name': 'Test User',
            'product_title': 'Test Product',
            'order_id': 'ORD-001',
            'download_url': 'https://example.com/download/xxx',
            'amount': 47.00,
        })
        assert 'Test User' in html
        assert 'ORD-001' in html
        assert 'https://example.com/download/xxx' in html
        assert 'Download Your Product' in html
    
    def test_missing_required_var_raises(self, registry):
        with pytest.raises(ValueError, match="missing required vars"):
            registry.render('order_confirmation', {
                'customer_name': 'Test',
                # Missing: product_title, order_id, download_url
            })
    
    def test_template_no_unfilled_placeholders(self, registry):
        html = registry.render('order_confirmation', {...})  # Full context
        # Check no unfilled template variables remain
        import re
        unfilled = re.findall(r'\{\{.*?\}\}', html)
        assert not unfilled, f"Unfilled placeholders found: {unfilled}"
```

---

## 7. VARIABLE SYSTEMS

### Variable Resolution Hierarchy
```python
class VariableContext:
    """
    Multi-level variable context with precedence:
    1. Explicit overrides (highest)
    2. Runtime computed values
    3. Product/entity-specific variables
    4. Global defaults (lowest)
    """
    
    GLOBAL_DEFAULTS = {
        'company_name': 'Ten Life Creatives',
        'support_email': 'hello@tenlifecreatives.com',
        'website_url': 'https://tenlifecreatives.com',
        'logo_url': 'https://tenlifecreatives.com/logo.png',
    }
    
    def __init__(self, entity_vars: dict = None, overrides: dict = None):
        self._layers = [
            self.GLOBAL_DEFAULTS,
            entity_vars or {},
            self._compute_runtime_vars(),
            overrides or {},
        ]
    
    def _compute_runtime_vars(self) -> dict:
        from datetime import datetime
        now = datetime.now()
        return {
            'current_date': now.strftime('%B %d, %Y'),
            'current_year': now.year,
            'current_month': now.strftime('%B'),
        }
    
    def resolve(self) -> dict:
        """Merge all layers, later layers win."""
        result = {}
        for layer in self._layers:
            result.update(layer)
        return result
    
    def get(self, key: str, default=None):
        resolved = self.resolve()
        return resolved.get(key, default)
```
