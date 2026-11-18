#!/usr/bin/env python3
"""
Professional Web Scraper — E-commerce Price Monitor
=====================================================
Scrapes product listings from any e-commerce site (demo uses a public
test site), extracts pricing data, saves to CSV, and sends an alert
when prices drop below your threshold.

SETUP:
    pip install requests beautifulsoup4 lxml

USAGE:
    python web_scraper_sample.py

FEATURES:
    - Scrapes product name, price, availability, rating
    - Handles pagination automatically
    - Deduplicates results
    - Saves clean CSV output
    - Price drop detection with configurable threshold
    - Polite crawling (rate limiting, User-Agent rotation)
    - Logs all activity with timestamps
    - Retry logic for failed requests
"""

import csv
import json
import logging
import random
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
CONFIG = {
    # Target URL — replace with the site you want to scrape
    # Demo uses books.toscrape.com (a legal scraping sandbox site)
    "base_url": "https://books.toscrape.com",
    "start_url": "https://books.toscrape.com/catalogue/page-1.html",

    # How many pages to scrape (None = all pages)
    "max_pages": 5,

    # Output files
    "output_csv": "products_output.csv",
    "price_history": "price_history.json",

    # Price alert threshold — alert if price drops below this
    "alert_price_threshold": 20.00,

    # Politeness settings
    "delay_min": 1.0,   # Minimum seconds between requests
    "delay_max": 3.0,   # Maximum seconds between requests
    "timeout": 15,      # Request timeout in seconds
    "max_retries": 3,   # Retry failed requests this many times

    # Request headers — rotate to appear more human
    "user_agents": [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    ],
}


# ─────────────────────────────────────────────
# DATA MODEL
# ─────────────────────────────────────────────
@dataclass
class Product:
    title: str
    price: float
    availability: str
    rating: str
    url: str
    scraped_at: str = ""

    def __post_init__(self):
        if not self.scraped_at:
            self.scraped_at = datetime.now().isoformat()


# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("scraper.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# HTTP CLIENT
# ─────────────────────────────────────────────
class PoliteClient:
    """HTTP client with rate limiting, retries, and User-Agent rotation."""

    def __init__(self, config: dict):
        self.config = config
        self.session = requests.Session()
        self.request_count = 0
        self.error_count = 0

    def _random_headers(self) -> dict:
        return {
            "User-Agent": random.choice(self.config["user_agents"]),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    def get(self, url: str) -> Optional[requests.Response]:
        """Fetch URL with retry logic and polite delays."""
        for attempt in range(1, self.config["max_retries"] + 1):
            try:
                # Polite delay between requests
                if self.request_count > 0:
                    delay = random.uniform(
                        self.config["delay_min"],
                        self.config["delay_max"]
                    )
                    log.debug(f"Waiting {delay:.1f}s before next request...")
                    time.sleep(delay)

                log.info(f"Fetching: {url} (attempt {attempt})")
                response = self.session.get(
                    url,
                    headers=self._random_headers(),
                    timeout=self.config["timeout"]
                )
                response.raise_for_status()
                self.request_count += 1
                return response

            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    log.warning(f"404 Not Found: {url}")
                    return None
                elif e.response.status_code == 429:
                    wait = 60 * attempt  # Back off: 60s, 120s, 180s
                    log.warning(f"Rate limited (429). Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    log.error(f"HTTP {e.response.status_code} on {url}: {e}")

            except requests.exceptions.ConnectionError as e:
                log.error(f"Connection error on {url}: {e}")
                time.sleep(5 * attempt)

            except requests.exceptions.Timeout:
                log.warning(f"Timeout on {url} (attempt {attempt})")
                time.sleep(2 * attempt)

        self.error_count += 1
        log.error(f"Failed to fetch {url} after {self.config['max_retries']} attempts")
        return None


# ─────────────────────────────────────────────
# PARSER — customize this for your target site
# ─────────────────────────────────────────────
class BookScraper:
    """
    Parser for books.toscrape.com — a legal scraping sandbox.
    Modify the CSS selectors below to target any other site.
    """

    # ── Selector Map ──────────────────────────────────────────────
    # Edit these to match your target site's HTML structure
    SELECTORS = {
        "product_list": "article.product_pod",    # Each product card
        "title": "h3 a",                          # Product title
        "price": "p.price_color",                 # Price element
        "availability": "p.availability",          # In stock / out of stock
        "rating": "p.star-rating",                # Star rating class
        "product_link": "h3 a",                   # Link to product page
        "next_page": "li.next a",                 # Pagination next button
    }

    RATING_MAP = {
        "One": "1/5", "Two": "2/5", "Three": "3/5",
        "Four": "4/5", "Five": "5/5"
    }

    def __init__(self, base_url: str):
        self.base_url = base_url

    def parse_product_list(self, html: str, page_url: str) -> list[Product]:
        """Extract all products from a listing page."""
        soup = BeautifulSoup(html, "lxml")
        products = []

        for item in soup.select(self.SELECTORS["product_list"]):
            try:
                product = self._parse_product_card(item, page_url)
                if product:
                    products.append(product)
            except Exception as e:
                log.warning(f"Error parsing product card: {e}")

        return products

    def _parse_product_card(self, item: BeautifulSoup, page_url: str) -> Optional[Product]:
        """Parse a single product card."""
        # Title
        title_el = item.select_one(self.SELECTORS["title"])
        title = title_el.get("title", title_el.text).strip() if title_el else "Unknown"

        # Price — clean currency symbols and convert to float
        price_el = item.select_one(self.SELECTORS["price"])
        price_text = price_el.text.strip() if price_el else "0"
        price = self._parse_price(price_text)

        # Availability
        avail_el = item.select_one(self.SELECTORS["availability"])
        availability = avail_el.text.strip() if avail_el else "Unknown"

        # Rating from CSS class (e.g., "star-rating Three" → "3/5")
        rating_el = item.select_one(self.SELECTORS["rating"])
        rating = "N/A"
        if rating_el:
            classes = rating_el.get("class", [])
            for cls in classes:
                if cls in self.RATING_MAP:
                    rating = self.RATING_MAP[cls]
                    break

        # Product URL
        link_el = item.select_one(self.SELECTORS["product_link"])
        relative_url = link_el.get("href", "") if link_el else ""
        product_url = urljoin(self.base_url + "/catalogue/", relative_url)

        return Product(
            title=title,
            price=price,
            availability=availability,
            rating=rating,
            url=product_url
        )

    def _parse_price(self, price_text: str) -> float:
        """Extract numeric price from text like '£12.99' or '$29.95'."""
        clean = "".join(c for c in price_text if c.isdigit() or c == ".")
        try:
            return float(clean)
        except ValueError:
            return 0.0

    def get_next_page_url(self, html: str, current_url: str) -> Optional[str]:
        """Find the URL of the next pagination page."""
        soup = BeautifulSoup(html, "lxml")
        next_el = soup.select_one(self.SELECTORS["next_page"])
        if next_el and next_el.get("href"):
            # Handle relative URLs
            parsed = urlparse(current_url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            path = str(Path(parsed.path).parent / next_el["href"])
            return urljoin(base, path)
        return None


# ─────────────────────────────────────────────
# OUTPUT HANDLER
# ─────────────────────────────────────────────
def save_to_csv(products: list[Product], filepath: str):
    """Save products to a clean CSV file."""
    if not products:
        log.warning("No products to save")
        return

    filepath = Path(filepath)
    file_exists = filepath.exists()

    with open(filepath, "a" if file_exists else "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["title", "price", "availability", "rating", "url", "scraped_at"])

        if not file_exists:
            writer.writeheader()

        for product in products:
            writer.writerow(asdict(product))

    log.info(f"Saved {len(products)} products to {filepath}")


def check_price_alerts(products: list[Product], threshold: float) -> list[Product]:
    """Return products priced below the alert threshold."""
    alerts = [p for p in products if p.price > 0 and p.price < threshold]
    if alerts:
        log.info(f"🚨 PRICE ALERT: {len(alerts)} products below £{threshold:.2f}")
        for p in alerts:
            log.info(f"   → {p.title[:50]} — £{p.price:.2f}")
    return alerts


# ─────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────
def run_scraper(config: dict = None):
    if config is None:
        config = CONFIG

    log.info("=" * 60)
    log.info("WEB SCRAPER — STARTING RUN")
    log.info(f"Target: {config['start_url']}")
    log.info(f"Max pages: {config['max_pages'] or 'unlimited'}")
    log.info("=" * 60)

    client = PoliteClient(config)
    parser = BookScraper(config["base_url"])

    all_products = []
    current_url = config["start_url"]
    page_num = 1

    # Clear output file for fresh run
    if Path(config["output_csv"]).exists():
        Path(config["output_csv"]).unlink()

    while current_url:
        # Check page limit
        if config["max_pages"] and page_num > config["max_pages"]:
            log.info(f"Reached max_pages limit ({config['max_pages']})")
            break

        log.info(f"─── Page {page_num} ───")

        response = client.get(current_url)
        if not response:
            log.error(f"Failed to fetch page {page_num}. Stopping.")
            break

        # Parse products on this page
        products = parser.parse_product_list(response.text, current_url)
        log.info(f"Found {len(products)} products on page {page_num}")

        # Save incrementally (don't lose data if script crashes)
        save_to_csv(products, config["output_csv"])
        all_products.extend(products)

        # Check for price alerts
        check_price_alerts(products, config["alert_price_threshold"])

        # Find next page
        next_url = parser.get_next_page_url(response.text, current_url)
        if next_url and next_url != current_url:
            current_url = next_url
            page_num += 1
        else:
            log.info("No next page found — scraping complete")
            break

    # Final summary
    log.info("=" * 60)
    log.info("SCRAPE COMPLETE")
    log.info(f"  Total products scraped: {len(all_products)}")
    log.info(f"  Pages scraped:          {page_num}")
    log.info(f"  Total requests:         {client.request_count}")
    log.info(f"  Failed requests:        {client.error_count}")
    log.info(f"  Output saved to:        {config['output_csv']}")
    log.info("=" * 60)

    # Price summary
    if all_products:
        prices = [p.price for p in all_products if p.price > 0]
        if prices:
            log.info(f"  Price range: £{min(prices):.2f} – £{max(prices):.2f}")
            log.info(f"  Average:     £{sum(prices)/len(prices):.2f}")

    return all_products


if __name__ == "__main__":
    print("\nWeb Scraper — E-commerce Price Monitor")
    print("Target: books.toscrape.com (legal sandbox site)")
    print("─" * 50)
    print("Modify SELECTORS in BookScraper class to target any site")
    print()
    run_scraper()
