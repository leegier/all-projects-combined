# API Integration — Reference Guide

The practitioner's guide to consuming REST APIs, handling OAuth, managing webhooks, implementing rate limiting,
and building robust integrations that don't break in production.

---

## TABLE OF CONTENTS
1. HTTP Client Patterns
2. Authentication Methods
3. OAuth 2.0 Implementation
4. Webhook Handling
5. Rate Limiting & Throttling
6. Error Handling & Retry Logic
7. Response Parsing & Validation
8. Pagination Patterns
9. API Client Architecture
10. Specific Platform Patterns
11. Testing API Integrations
12. Security Best Practices

---

## 1. HTTP CLIENT PATTERNS

### Requests Session Pattern (Python)
```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging

logger = logging.getLogger(__name__)

def create_http_session(
    retries: int = 3,
    backoff_factor: float = 0.5,
    status_forcelist: tuple = (500, 502, 503, 504),
    timeout: int = 30,
) -> requests.Session:
    """
    Create a requests Session with retry logic and connection pooling.
    Use ONE session per service, not per request.
    """
    session = requests.Session()
    
    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff_factor,  # Waits: 0.5s, 1s, 2s
        status_forcelist=status_forcelist,
        allowed_methods={"GET", "POST", "PUT", "PATCH", "DELETE"},
        raise_on_status=False,
    )
    
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=20,
    )
    
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    
    # Default headers
    session.headers.update({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'TenLifeCreatives/1.0',
    })
    
    return session


class APIClient:
    """Base HTTP client for REST API integrations."""
    
    BASE_URL: str = ''  # Override in subclass
    
    def __init__(self, api_key: str, timeout: int = 30):
        self._api_key = api_key
        self._timeout = timeout
        self._session = create_http_session()
        self._configure_auth()
    
    def _configure_auth(self):
        """Configure auth headers. Override in subclass."""
        self._session.headers['Authorization'] = f'Bearer {self._api_key}'
    
    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make an authenticated API request with full error handling."""
        url = f"{self.BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
        kwargs.setdefault('timeout', self._timeout)
        
        try:
            response = self._session.request(method, url, **kwargs)
            return self._handle_response(response)
        except requests.Timeout:
            raise APIError(f"Request to {url} timed out after {self._timeout}s")
        except requests.ConnectionError as e:
            raise APIError(f"Connection failed to {url}: {e}")
    
    def _handle_response(self, response: requests.Response) -> dict:
        """Parse response and raise domain-specific errors."""
        if response.status_code == 200 or response.status_code == 201:
            return response.json() if response.content else {}
        elif response.status_code == 204:
            return {}
        elif response.status_code == 401:
            raise AuthenticationError("API key invalid or expired")
        elif response.status_code == 403:
            raise PermissionError(f"Access denied: {response.text[:200]}")
        elif response.status_code == 404:
            raise NotFoundError(f"Resource not found: {response.url}")
        elif response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            raise RateLimitError(retry_after=retry_after)
        elif response.status_code >= 500:
            raise ServerError(f"Server error {response.status_code}: {response.text[:500]}")
        else:
            raise APIError(f"Unexpected status {response.status_code}: {response.text[:500]}")
    
    def get(self, endpoint: str, params: dict = None) -> dict:
        return self._request('GET', endpoint, params=params)
    
    def post(self, endpoint: str, data: dict = None) -> dict:
        return self._request('POST', endpoint, json=data)
    
    def patch(self, endpoint: str, data: dict = None) -> dict:
        return self._request('PATCH', endpoint, json=data)
    
    def delete(self, endpoint: str) -> dict:
        return self._request('DELETE', endpoint)
```

---

## 2. AUTHENTICATION METHODS

### API Key Patterns
```python
# Pattern 1: Bearer token in Authorization header (most common)
session.headers['Authorization'] = f'Bearer {api_key}'

# Pattern 2: API key in custom header
session.headers['X-API-Key'] = api_key

# Pattern 3: API key as query parameter (legacy, avoid if possible)
params = {'api_key': api_key, **other_params}

# Pattern 4: Basic Auth (username:password as api_key:secret)
import base64
credentials = base64.b64encode(f'{api_key}:{api_secret}'.encode()).decode()
session.headers['Authorization'] = f'Basic {credentials}'

# Pattern 5: Digest Auth (using requests built-in)
from requests.auth import HTTPDigestAuth
session.auth = HTTPDigestAuth(username, password)
```

### JWT Token Handling
```python
import jwt
from datetime import datetime, timezone, timedelta

def create_jwt_token(payload: dict, secret: str, expires_in: int = 3600) -> str:
    """Create a signed JWT token."""
    payload = {
        **payload,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, secret, algorithm='HS256')

def verify_jwt_token(token: str, secret: str) -> dict:
    """Decode and verify a JWT token. Raises on invalid/expired."""
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(f"Invalid token: {e}")
```

---

## 3. OAUTH 2.0 IMPLEMENTATION

### Authorization Code Flow
```python
import secrets
import hashlib
import base64
from urllib.parse import urlencode, urlparse, parse_qs

class OAuth2Client:
    """OAuth 2.0 Authorization Code flow with PKCE."""
    
    def __init__(self, client_id: str, client_secret: str, 
                 redirect_uri: str, authorization_url: str, token_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorization_url = authorization_url
        self.token_url = token_url
        self._session = create_http_session()
    
    def get_authorization_url(self, scopes: list, state: str = None) -> tuple:
        """Generate authorization URL and PKCE verifier."""
        # PKCE
        code_verifier = secrets.token_urlsafe(64)
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).rstrip(b'=').decode()
        
        state = state or secrets.token_urlsafe(16)
        
        params = {
            'client_id': self.client_id,
            'response_type': 'code',
            'redirect_uri': self.redirect_uri,
            'scope': ' '.join(scopes),
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
        }
        
        url = f"{self.authorization_url}?{urlencode(params)}"
        return url, code_verifier, state
    
    def exchange_code_for_token(self, code: str, code_verifier: str) -> dict:
        """Exchange authorization code for access + refresh tokens."""
        response = self._session.post(self.token_url, data={
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'redirect_uri': self.redirect_uri,
            'code_verifier': code_verifier,
        })
        
        if response.status_code != 200:
            raise AuthenticationError(f"Token exchange failed: {response.text}")
        
        return response.json()
    
    def refresh_access_token(self, refresh_token: str) -> dict:
        """Use refresh token to get a new access token."""
        response = self._session.post(self.token_url, data={
            'grant_type': 'refresh_token',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token,
        })
        
        if response.status_code == 401:
            raise AuthenticationError("Refresh token expired — user must re-authorize")
        
        return response.json()

### Token Storage & Refresh Pattern
class TokenManager:
    """Manages OAuth token lifecycle with automatic refresh."""
    
    def __init__(self, token_path: Path, oauth_client: OAuth2Client):
        self._path = token_path
        self._oauth = oauth_client
        self._tokens = self._load_tokens()
    
    def _load_tokens(self) -> dict:
        if self._path.exists():
            return json.loads(self._path.read_text())
        return {}
    
    def _save_tokens(self, tokens: dict) -> None:
        self._path.write_text(json.dumps(tokens, indent=2))
        self._tokens = tokens
    
    def get_valid_access_token(self) -> str:
        """Return a valid access token, refreshing if necessary."""
        if not self._tokens:
            raise AuthenticationError("No tokens stored — authorization required")
        
        expires_at = self._tokens.get('expires_at', 0)
        if time.time() >= expires_at - 60:  # Refresh 60s before expiry
            new_tokens = self._oauth.refresh_access_token(self._tokens['refresh_token'])
            new_tokens['expires_at'] = time.time() + new_tokens.get('expires_in', 3600)
            self._save_tokens({**self._tokens, **new_tokens})
        
        return self._tokens['access_token']
```

---

## 4. WEBHOOK HANDLING

### Webhook Receiver (Flask/FastAPI)
```python
from flask import Flask, request, jsonify, abort
import hmac
import hashlib
import json

app = Flask(__name__)

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook HMAC-SHA256 signature. ALWAYS do this."""
    expected = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Use hmac.compare_digest for timing-safe comparison
    return hmac.compare_digest(f'sha256={expected}', signature)

@app.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.get_data()  # Raw bytes
    signature = request.headers.get('Stripe-Signature', '')
    
    if not verify_webhook_signature(payload, signature, STRIPE_WEBHOOK_SECRET):
        abort(400, 'Invalid signature')
    
    event = json.loads(payload)
    event_type = event.get('type')
    
    # Route to handlers
    handlers = {
        'payment_intent.succeeded': handle_payment_succeeded,
        'customer.subscription.deleted': handle_subscription_cancelled,
        'invoice.payment_failed': handle_payment_failed,
    }
    
    handler = handlers.get(event_type)
    if handler:
        try:
            handler(event['data']['object'])
        except Exception as e:
            logger.error(f"Webhook handler error for {event_type}: {e}")
            # Return 200 anyway — don't let Stripe retry due to our handler errors
            # Log and handle asynchronously
    
    return jsonify({'received': True}), 200

def handle_payment_succeeded(payment_intent: dict) -> None:
    """Process successful payment."""
    amount = payment_intent['amount'] / 100  # Stripe stores in cents
    customer_id = payment_intent.get('customer')
    metadata = payment_intent.get('metadata', {})
    
    logger.info(f"Payment succeeded: ${amount:.2f} from customer {customer_id}")
    # Update database, send confirmation email, etc.
```

### Webhook Queue Pattern (Reliable Processing)
```python
import queue
import threading
from dataclasses import dataclass

@dataclass
class WebhookEvent:
    event_type: str
    payload: dict
    received_at: float
    
webhook_queue = queue.Queue(maxsize=1000)

def enqueue_webhook(event_type: str, payload: dict):
    """Non-blocking webhook enqueue. Process async."""
    try:
        webhook_queue.put_nowait(WebhookEvent(event_type, payload, time.time()))
    except queue.Full:
        logger.error(f"Webhook queue full — dropping {event_type}")

def process_webhook_queue():
    """Background worker that drains the webhook queue."""
    while True:
        try:
            event = webhook_queue.get(timeout=1)
            process_webhook_event(event)
            webhook_queue.task_done()
        except queue.Empty:
            continue
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")

# Start background worker
worker = threading.Thread(target=process_webhook_queue, daemon=True)
worker.start()
```

---

## 5. RATE LIMITING & THROTTLING

### Token Bucket Rate Limiter
```python
import threading
import time

class RateLimiter:
    """Token bucket rate limiter for API calls."""
    
    def __init__(self, calls_per_second: float):
        self.calls_per_second = calls_per_second
        self.min_interval = 1.0 / calls_per_second
        self._last_call = 0
        self._lock = threading.Lock()
    
    def acquire(self) -> None:
        """Block until a call is permitted."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()
    
    def __call__(self, func):
        """Use as decorator to rate-limit a function."""
        from functools import wraps
        @wraps(func)
        def wrapper(*args, **kwargs):
            self.acquire()
            return func(*args, **kwargs)
        return wrapper

# Platform-specific limits:
GUMROAD_LIMITER = RateLimiter(calls_per_second=2)   # 2 req/sec
AIRTABLE_LIMITER = RateLimiter(calls_per_second=5)   # 5 req/sec max
OPENAI_LIMITER = RateLimiter(calls_per_second=1)     # Conservative

@GUMROAD_LIMITER
def fetch_gumroad_products(client):
    return client.get('/products')
```

### Handling 429 Responses
```python
def call_with_backoff(
    func,
    *args,
    max_retries: int = 5,
    **kwargs
) -> any:
    """Call function with automatic 429 handling and exponential backoff."""
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            wait_time = getattr(e, 'retry_after', 60)
            # Add jitter to prevent thundering herd
            jitter = random.uniform(0, wait_time * 0.1)
            actual_wait = wait_time + jitter
            logger.warning(f"Rate limited. Waiting {actual_wait:.1f}s (attempt {attempt+1}/{max_retries})")
            time.sleep(actual_wait)
    raise RuntimeError("Exhausted all retry attempts")
```

---

## 6. ERROR HANDLING & RETRY LOGIC

### Comprehensive Exception Hierarchy
```python
class APIError(Exception):
    """Base API error."""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code

class AuthenticationError(APIError):
    """401 — invalid or expired credentials."""
    pass

class RateLimitError(APIError):
    """429 — rate limit exceeded."""
    def __init__(self, retry_after: int = 60):
        super().__init__(f"Rate limit hit. Retry after {retry_after}s", 429)
        self.retry_after = retry_after

class NotFoundError(APIError):
    """404 — resource does not exist."""
    pass

class ServerError(APIError):
    """5xx — server-side error, usually retryable."""
    pass

class ValidationError(APIError):
    """422 — request was invalid (not retryable)."""
    pass
```

---

## 7. PAGINATION PATTERNS

### Cursor-Based Pagination
```python
def fetch_all_pages(
    client: APIClient,
    endpoint: str,
    params: dict = None,
    page_size: int = 100,
    max_pages: int = None,
) -> list:
    """Fetch all pages of a paginated API endpoint."""
    all_items = []
    page_params = {**(params or {}), 'per_page': page_size}
    page_count = 0
    
    while True:
        response = client.get(endpoint, params=page_params)
        
        # Handle different pagination styles
        if isinstance(response, dict):
            items = response.get('data') or response.get('items') or response.get('results') or []
            cursor = response.get('next_cursor') or response.get('next_page_token')
            has_more = response.get('has_more', False) or bool(cursor)
        elif isinstance(response, list):
            items = response
            has_more = len(items) == page_size  # Assume more if full page returned
            cursor = None
        else:
            break
        
        all_items.extend(items)
        page_count += 1
        
        if not has_more or not items:
            break
        if max_pages and page_count >= max_pages:
            logger.warning(f"Hit max_pages limit ({max_pages}). {len(all_items)} items collected.")
            break
        
        # Update cursor for next page
        if cursor:
            page_params['cursor'] = cursor
        else:
            # Offset-based pagination
            page_params['page'] = page_params.get('page', 1) + 1
    
    return all_items
```

---

## 8. SPECIFIC PLATFORM PATTERNS

### Airtable API
```python
class AirtableClient(APIClient):
    BASE_URL = 'https://api.airtable.com/v0'
    RATE_LIMITER = RateLimiter(calls_per_second=5)
    
    def __init__(self, api_key: str, base_id: str):
        super().__init__(api_key)
        self.base_id = base_id
    
    @RATE_LIMITER
    def list_records(self, table_name: str, filter_formula: str = None) -> list:
        """Fetch all records from an Airtable table with auto-pagination."""
        params = {'maxRecords': 100}
        if filter_formula:
            params['filterByFormula'] = filter_formula
        
        all_records = []
        offset = None
        
        while True:
            if offset:
                params['offset'] = offset
            response = self.get(f"/{self.base_id}/{table_name}", params=params)
            all_records.extend(response.get('records', []))
            offset = response.get('offset')
            if not offset:
                break
        
        return all_records
    
    @RATE_LIMITER  
    def create_record(self, table_name: str, fields: dict) -> dict:
        return self.post(f"/{self.base_id}/{table_name}", data={'fields': fields})
    
    @RATE_LIMITER
    def update_record(self, table_name: str, record_id: str, fields: dict) -> dict:
        return self.patch(f"/{self.base_id}/{table_name}/{record_id}", data={'fields': fields})
    
    def bulk_create_records(self, table_name: str, records: list) -> list:
        """Create up to 10 records at once (Airtable batch limit)."""
        results = []
        for chunk in chunked(records, 10):
            response = self.post(f"/{self.base_id}/{table_name}", data={
                'records': [{'fields': r} for r in chunk]
            })
            results.extend(response.get('records', []))
            time.sleep(0.2)  # Respect rate limits
        return results
```

### Stripe API
```python
import stripe

class StripeService:
    def __init__(self, api_key: str):
        stripe.api_key = api_key
    
    def create_payment_link(self, price_id: str, quantity: int = 1) -> str:
        """Create a Stripe payment link for a product."""
        link = stripe.PaymentLink.create(
            line_items=[{'price': price_id, 'quantity': quantity}],
            after_completion={'type': 'redirect', 'redirect': {'url': 'https://example.com/thanks'}},
        )
        return link.url
    
    def get_recent_charges(self, limit: int = 100) -> list:
        """Fetch recent successful charges."""
        charges = stripe.Charge.list(limit=limit)
        return [c for c in charges.auto_paging_iter() if c.status == 'succeeded']
    
    def create_customer(self, email: str, name: str, metadata: dict = None) -> str:
        """Create a Stripe customer. Returns customer ID."""
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata=metadata or {},
        )
        return customer.id
```

---

## 9. TESTING API INTEGRATIONS

### Mocking External APIs
```python
import pytest
import responses  # pip install responses
import json

@responses.activate
def test_api_client_get_success():
    """Test API client with mocked HTTP response."""
    responses.add(
        responses.GET,
        'https://api.example.com/v1/products',
        json={'data': [{'id': '1', 'name': 'Test Product'}]},
        status=200,
    )
    
    client = APIClient(api_key='test-key')
    result = client.get('/products')
    
    assert len(result['data']) == 1
    assert result['data'][0]['name'] == 'Test Product'

@responses.activate
def test_api_client_handles_rate_limit():
    """Test that 429 triggers proper retry behavior."""
    responses.add(responses.GET, 'https://api.example.com/v1/data',
                  status=429, headers={'Retry-After': '5'})
    
    client = APIClient(api_key='test-key')
    with pytest.raises(RateLimitError) as exc_info:
        client.get('/data')
    assert exc_info.value.retry_after == 5
```

---

## 10. SECURITY BEST PRACTICES

```
NEVER hardcode credentials in code
NEVER log authorization headers or tokens
NEVER store tokens in plain text without encryption
ALWAYS use HTTPS endpoints
ALWAYS verify webhook signatures before processing
ALWAYS validate API responses before using data
ALWAYS set request timeouts
ALWAYS use environment variables for secrets
ALWAYS rotate API keys that may have been exposed
PREFER short-lived tokens over long-lived ones
PREFER OAuth over API keys for user-facing integrations
```

### Environment Variable Template
```bash
# .env.example — commit this
# Copy to .env and fill in values — never commit .env

API_KEY=your_api_key_here
API_SECRET=your_api_secret_here
WEBHOOK_SECRET=your_webhook_secret_here
REDIRECT_URI=https://yourapp.com/oauth/callback

# Never use production credentials in tests — use test keys
STRIPE_TEST_KEY=sk_test_...
SENDGRID_API_KEY=SG...
AIRTABLE_API_KEY=pat...
```
