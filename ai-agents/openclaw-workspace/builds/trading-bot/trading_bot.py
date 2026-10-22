#!/usr/bin/env python3
"""
Wheel Strategy Trading Bot for Alpaca Paper Trading
====================================================
Implements the Wheel Strategy on TSLA and MSTR:
  1. Sell Cash-Secured Puts (CSP) until assigned
  2. Once assigned, sell Covered Calls (CC) until called away
  3. Repeat

Usage:
  python trading_bot.py                  # Dry run (default)
  python trading_bot.py --execute        # Live execution (paper trading)
  python trading_bot.py --once           # Single check then exit (for cron)
  python trading_bot.py --status         # Print status report only
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
from datetime import datetime, timedelta, date
from typing import Optional, Dict, List, Any
from pathlib import Path

# ─────────────────────────────────────────────
#  Load .env file if present
# ─────────────────────────────────────────────
def load_dotenv(env_file: str = ".env"):
    env_path = Path(env_file)
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# ─────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────
load_dotenv()

API_KEY    = os.environ.get("ALPACA_API_KEY", "")
API_SECRET = os.environ.get("ALPACA_API_SECRET", "")
BASE_URL   = os.environ.get("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
DATA_URL   = "https://data.alpaca.markets"

# Wheel strategy targets — stocks you'd happily own long-term
WATCH_LIST: Dict[str, Dict] = {
    "TSLA": {
        "max_contracts": 1,          # 1 contract = 100 shares
        "put_delta_target": 0.30,    # ~30 delta = slightly OTM
        "put_dte_target": 30,        # ~30 days to expiration
        "call_delta_target": 0.30,   # ~30 delta for covered calls
        "profit_take_pct": 0.50,     # Close at 50% profit
        "stop_loss_pct": 2.00,       # Roll at 200% of credit received
    },
    "MSTR": {
        "max_contracts": 1,
        "put_delta_target": 0.30,
        "put_dte_target": 30,
        "call_delta_target": 0.30,
        "profit_take_pct": 0.50,
        "stop_loss_pct": 2.00,
    },
}

CHECK_INTERVAL_HOURS = 6
LOG_FILE = "trades.log"

# ─────────────────────────────────────────────
#  Logging setup
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("wheel_bot")


# ─────────────────────────────────────────────
#  Alpaca REST Client
# ─────────────────────────────────────────────
class AlpacaClient:
    def __init__(self, api_key: str, api_secret: str, base_url: str, dry_run: bool = True):
        self.api_key    = api_key
        self.api_secret = api_secret
        self.base_url   = base_url.rstrip("/")
        self.dry_run    = dry_run
        self.headers    = {
            "APCA-API-KEY-ID":     api_key,
            "APCA-API-SECRET-KEY": api_secret,
            "Content-Type":        "application/json",
        }

    def _get(self, path: str, params: dict = None, base: str = None) -> Any:
        url = (base or self.base_url) + path
        r = requests.get(url, headers=self.headers, params=params, timeout=15)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, payload: dict) -> Any:
        url = self.base_url + path
        if self.dry_run:
            log.info(f"[DRY RUN] POST {path} | {json.dumps(payload)}")
            return {"dry_run": True, "payload": payload}
        r = requests.post(url, headers=self.headers, json=payload, timeout=15)
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str) -> Any:
        url = self.base_url + path
        if self.dry_run:
            log.info(f"[DRY RUN] DELETE {path}")
            return {"dry_run": True}
        r = requests.delete(url, headers=self.headers, timeout=15)
        r.raise_for_status()
        return r.json() if r.text else {}

    # ── Account ──────────────────────────────
    def get_account(self) -> dict:
        return self._get("/v2/account")

    def get_buying_power(self) -> float:
        acct = self.get_account()
        return float(acct.get("buying_power", 0))

    def get_cash(self) -> float:
        acct = self.get_account()
        return float(acct.get("cash", 0))

    # ── Positions ────────────────────────────
    def get_positions(self) -> List[dict]:
        return self._get("/v2/positions")

    def get_position(self, symbol: str) -> Optional[dict]:
        try:
            return self._get(f"/v2/positions/{symbol}")
        except requests.HTTPError as e:
            if e.response.status_code == 404:
                return None
            raise

    # ── Orders ───────────────────────────────
    def get_orders(self, status: str = "open") -> List[dict]:
        return self._get("/v2/orders", params={"status": status, "limit": 100})

    def place_order(self, symbol: str, qty: int, side: str, order_type: str,
                    limit_price: float = None, time_in_force: str = "day") -> dict:
        payload = {
            "symbol":        symbol,
            "qty":           str(qty),
            "side":          side,
            "type":          order_type,
            "time_in_force": time_in_force,
        }
        if limit_price is not None:
            payload["limit_price"] = str(round(limit_price, 2))
        return self._post("/v2/orders", payload)

    def cancel_order(self, order_id: str) -> dict:
        return self._delete(f"/v2/orders/{order_id}")

    # ── Options ──────────────────────────────
    def get_option_contracts(self, underlying: str, expiration_date_gte: str,
                              expiration_date_lte: str, option_type: str = "put",
                              limit: int = 100) -> List[dict]:
        """Fetch option contracts for an underlying symbol."""
        params = {
            "underlying_symbols": underlying,
            "expiration_date_gte": expiration_date_gte,
            "expiration_date_lte": expiration_date_lte,
            "type":   option_type,
            "limit":  limit,
        }
        try:
            data = self._get("/v2/options/contracts", params=params)
            return data.get("option_contracts", []) if isinstance(data, dict) else data
        except Exception as e:
            log.warning(f"Could not fetch option contracts for {underlying}: {e}")
            return []

    def get_option_snapshot(self, symbol: str) -> Optional[dict]:
        """Get latest quote/greeks for a single option contract."""
        try:
            data = self._get(f"/v1/options/snapshots/{symbol}", base=DATA_URL)
            return data.get("snapshots", {}).get(symbol)
        except Exception as e:
            log.warning(f"Could not fetch snapshot for {symbol}: {e}")
            return None

    # ── Market Data ──────────────────────────
    def get_latest_quote(self, symbol: str) -> Optional[float]:
        """Get latest trade price for a stock."""
        try:
            data = self._get(f"/v2/stocks/{symbol}/quotes/latest", base=DATA_URL)
            q = data.get("quote", {})
            # Use midpoint of bid/ask
            bid = float(q.get("bp", 0))
            ask = float(q.get("ap", 0))
            if bid and ask:
                return round((bid + ask) / 2, 2)
        except Exception as e:
            log.warning(f"Could not fetch quote for {symbol}: {e}")
        return None

    def is_market_open(self) -> bool:
        try:
            clock = self._get("/v2/clock")
            return clock.get("is_open", False)
        except Exception:
            return False

    def get_next_open(self) -> str:
        try:
            clock = self._get("/v2/clock")
            return clock.get("next_open", "unknown")
        except Exception:
            return "unknown"


# ─────────────────────────────────────────────
#  Wheel Strategy Logic
# ─────────────────────────────────────────────
class WheelBot:
    def __init__(self, client: AlpacaClient, dry_run: bool = True):
        self.client  = client
        self.dry_run = dry_run

    # ── Helpers ──────────────────────────────
    def _expiry_window(self, dte: int = 30, window: int = 7) -> tuple:
        """Return (gte, lte) date strings for expiration targeting."""
        today   = date.today()
        target  = today + timedelta(days=dte)
        low     = target - timedelta(days=window)
        high    = target + timedelta(days=window)
        return low.strftime("%Y-%m-%d"), high.strftime("%Y-%m-%d")

    def _find_best_put(self, symbol: str, current_price: float, config: dict) -> Optional[dict]:
        """
        Find the best put to sell: OTM strike near delta target.
        Simple heuristic: ~5-10% OTM strike with DTE ~30.
        """
        gte, lte = self._expiry_window(config["put_dte_target"])
        contracts = self.client.get_option_contracts(
            symbol, gte, lte, option_type="put"
        )
        if not contracts:
            log.info(f"  No put contracts found for {symbol} between {gte} and {lte}")
            return None

        # Target strike ~5-8% OTM
        target_strike = round(current_price * 0.93, 0)
        best = None
        best_diff = float("inf")
        for c in contracts:
            strike = float(c.get("strike_price", 0))
            diff   = abs(strike - target_strike)
            if diff < best_diff and strike < current_price:
                best_diff = diff
                best      = c
        return best

    def _find_best_call(self, symbol: str, avg_cost: float, config: dict) -> Optional[dict]:
        """
        Find best covered call to sell: OTM strike above cost basis.
        """
        gte, lte = self._expiry_window(config["put_dte_target"])
        contracts = self.client.get_option_contracts(
            symbol, gte, lte, option_type="call"
        )
        if not contracts:
            return None

        # Target strike ~5% above cost basis
        target_strike = round(avg_cost * 1.05, 0)
        best = None
        best_diff = float("inf")
        for c in contracts:
            strike = float(c.get("strike_price", 0))
            diff   = abs(strike - target_strike)
            if diff < best_diff and strike > avg_cost:
                best_diff = diff
                best      = c
        return best

    # ── Status Report ────────────────────────
    def print_status(self):
        log.info("=" * 60)
        log.info("  WHEEL BOT STATUS REPORT")
        log.info(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S CDT')}")
        log.info(f"  Mode: {'DRY RUN 🧪' if self.dry_run else 'LIVE 🔴'}")
        log.info("=" * 60)

        # Account summary
        try:
            acct = self.client.get_account()
            portfolio_value = float(acct.get("portfolio_value", 0))
            cash            = float(acct.get("cash", 0))
            buying_power    = float(acct.get("buying_power", 0))
            equity          = float(acct.get("equity", 0))
            last_equity     = float(acct.get("last_equity", equity))
            day_pl          = equity - last_equity
            day_pl_pct      = (day_pl / last_equity * 100) if last_equity else 0

            log.info(f"  Portfolio Value : ${portfolio_value:,.2f}")
            log.info(f"  Cash            : ${cash:,.2f}")
            log.info(f"  Buying Power    : ${buying_power:,.2f}")
            log.info(f"  Day P&L         : ${day_pl:+,.2f} ({day_pl_pct:+.2f}%)")
        except Exception as e:
            log.warning(f"  Could not fetch account: {e}")

        log.info("-" * 60)

        # Open positions
        try:
            positions = self.client.get_positions()
            if positions:
                log.info("  OPEN POSITIONS:")
                for p in positions:
                    sym    = p.get("symbol", "?")
                    qty    = p.get("qty", "?")
                    side   = p.get("side", "?")
                    entry  = float(p.get("avg_entry_price", 0))
                    cur    = float(p.get("current_price", 0) or 0)
                    pl     = float(p.get("unrealized_pl", 0) or 0)
                    pl_pct = float(p.get("unrealized_plpc", 0) or 0) * 100
                    log.info(f"    {sym:6} | {side:5} {qty:>4} | Entry ${entry:.2f} | "
                             f"Now ${cur:.2f} | P&L ${pl:+,.2f} ({pl_pct:+.1f}%)")
            else:
                log.info("  No open positions.")
        except Exception as e:
            log.warning(f"  Could not fetch positions: {e}")

        log.info("-" * 60)

        # Open orders
        try:
            orders = self.client.get_orders(status="open")
            if orders:
                log.info("  OPEN ORDERS:")
                for o in orders:
                    log.info(f"    {o.get('symbol')} | {o.get('side')} {o.get('qty')} | "
                             f"{o.get('type')} @ {o.get('limit_price', 'MKT')} | {o.get('status')}")
            else:
                log.info("  No open orders.")
        except Exception as e:
            log.warning(f"  Could not fetch orders: {e}")

        log.info("-" * 60)

        # Current prices
        log.info("  WATCH LIST:")
        for symbol in WATCH_LIST:
            price = self.client.get_latest_quote(symbol)
            if price:
                log.info(f"    {symbol:6} ${price:,.2f}")
            else:
                log.info(f"    {symbol:6} (price unavailable)")

        log.info("=" * 60)

    # ── Core Wheel Logic ─────────────────────
    def check_symbol(self, symbol: str, config: dict):
        log.info(f"\n── Checking {symbol} ──")

        current_price = self.client.get_latest_quote(symbol)
        if not current_price:
            log.warning(f"  Cannot get price for {symbol}, skipping.")
            return

        log.info(f"  Current price: ${current_price:,.2f}")

        position = self.client.get_position(symbol)

        # ── STATE: We own shares → sell covered call ──
        if position and int(position.get("qty", 0)) >= 100:
            qty       = int(position["qty"])
            avg_cost  = float(position["avg_entry_price"])
            pl        = float(position.get("unrealized_pl", 0))
            contracts = qty // 100

            log.info(f"  STOCK POSITION: {qty} shares @ ${avg_cost:.2f} avg cost | P&L ${pl:+,.2f}")

            # Check if we already have a covered call open
            open_orders = self.client.get_orders(status="open")
            has_call    = any(
                o.get("symbol", "").startswith(symbol) and o.get("side") == "sell"
                for o in open_orders
            )

            if has_call:
                log.info(f"  Already have covered call open for {symbol}. Monitoring.")
                return

            # Find best call to sell
            call = self._find_best_call(symbol, avg_cost, config)
            if not call:
                log.info(f"  No suitable covered call found for {symbol}.")
                return

            call_symbol = call.get("symbol")
            strike      = float(call.get("strike_price", 0))
            expiry      = call.get("expiration_date", "?")

            # Get snapshot for premium
            snapshot    = self.client.get_option_snapshot(call_symbol) if call_symbol else None
            premium     = None
            if snapshot:
                q = snapshot.get("latestQuote", {})
                bid = float(q.get("bp", 0))
                ask = float(q.get("ap", 0))
                if bid and ask:
                    premium = round((bid + ask) / 2, 2)

            log.info(f"  NEXT ACTION: Sell {contracts}x covered call {call_symbol}")
            log.info(f"    Strike ${strike:.2f} | Expiry {expiry} | Premium ~${premium or '?'}")

            if not self.dry_run and call_symbol and premium:
                result = self.client.place_order(
                    symbol=call_symbol,
                    qty=contracts,
                    side="sell",
                    order_type="limit",
                    limit_price=round(premium * 0.95, 2),  # slightly below mid
                    time_in_force="day",
                )
                log.info(f"  ✅ Covered call order placed: {result}")
            else:
                log.info(f"  [DRY RUN] Would sell {contracts}x {call_symbol} @ ~${premium or '?'}")

        # ── STATE: No position → sell cash-secured put ──
        else:
            if position:
                log.info(f"  Partial position ({position.get('qty')} shares), not enough for full contract.")

            cash         = self.client.get_cash()
            required_cash = current_price * 100 * config["max_contracts"]

            if cash < required_cash:
                log.info(f"  INSUFFICIENT CASH: Need ${required_cash:,.2f}, have ${cash:,.2f}")
                log.info(f"  NEXT ACTION: Wait for more cash or reduce position size.")
                return

            # Check if we already have a CSP open
            open_orders = self.client.get_orders(status="open")
            has_put     = any(
                o.get("symbol", "").startswith(symbol) and o.get("side") == "sell"
                for o in open_orders
            )

            if has_put:
                log.info(f"  Already have cash-secured put open for {symbol}. Monitoring.")
                return

            # Find best put to sell
            put = self._find_best_put(symbol, current_price, config)
            if not put:
                log.info(f"  No suitable put found for {symbol}.")
                return

            put_symbol = put.get("symbol")
            strike     = float(put.get("strike_price", 0))
            expiry     = put.get("expiration_date", "?")

            # Get premium estimate
            snapshot = self.client.get_option_snapshot(put_symbol) if put_symbol else None
            premium  = None
            if snapshot:
                q   = snapshot.get("latestQuote", {})
                bid = float(q.get("bp", 0))
                ask = float(q.get("ap", 0))
                if bid and ask:
                    premium = round((bid + ask) / 2, 2)

            annual_yield = None
            if premium and strike:
                annual_yield = round((premium / strike) * (365 / config["put_dte_target"]) * 100, 1)

            log.info(f"  NEXT ACTION: Sell {config['max_contracts']}x CSP {put_symbol}")
            log.info(f"    Strike ${strike:.2f} | Expiry {expiry} | "
                     f"Premium ~${premium or '?'} | ~{annual_yield or '?'}% annualized")

            if not self.dry_run and put_symbol and premium:
                result = self.client.place_order(
                    symbol=put_symbol,
                    qty=config["max_contracts"],
                    side="sell",
                    order_type="limit",
                    limit_price=round(premium * 0.95, 2),
                    time_in_force="day",
                )
                log.info(f"  ✅ CSP order placed: {result}")
            else:
                log.info(f"  [DRY RUN] Would sell {config['max_contracts']}x {put_symbol} "
                         f"@ ~${premium or '?'}")

    # ── Main Run Loop ────────────────────────
    def run_once(self):
        """Single market check cycle."""
        log.info(f"\n{'='*60}")
        log.info(f"  WHEEL BOT — Cycle Start {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        log.info(f"{'='*60}")

        if not self.client.is_market_open():
            next_open = self.client.get_next_open()
            log.info(f"  Market is CLOSED. Next open: {next_open}")
            log.info("  Running status report only...")
            self.print_status()
            return

        self.print_status()

        for symbol, config in WATCH_LIST.items():
            try:
                self.check_symbol(symbol, config)
            except Exception as e:
                log.error(f"  Error processing {symbol}: {e}")

        log.info(f"\n  Cycle complete. Next check in {CHECK_INTERVAL_HOURS}h.")

    def run_loop(self):
        """Run continuously every CHECK_INTERVAL_HOURS."""
        log.info("🚀 Wheel Bot starting continuous loop mode...")
        while True:
            try:
                self.run_once()
            except KeyboardInterrupt:
                log.info("  Interrupted by user. Exiting.")
                break
            except Exception as e:
                log.error(f"  Unexpected error in main loop: {e}")

            log.info(f"  Sleeping {CHECK_INTERVAL_HOURS} hours until next check...")
            time.sleep(CHECK_INTERVAL_HOURS * 3600)


# ─────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Wheel Strategy Bot — Alpaca Paper Trading")
    parser.add_argument("--execute",  action="store_true", help="Execute real orders (paper trading)")
    parser.add_argument("--once",     action="store_true", help="Run once then exit (for cron)")
    parser.add_argument("--status",   action="store_true", help="Print status report only")
    parser.add_argument("--loop",     action="store_true", help="Run in continuous loop (default)")
    args = parser.parse_args()

    dry_run = not args.execute

    if dry_run:
        log.info("🧪 DRY RUN MODE — No orders will be placed.")
        log.info("   Pass --execute to place real orders on paper account.\n")

    if not API_KEY or not API_SECRET:
        log.error("❌ Missing API credentials!")
        log.error("   Set ALPACA_API_KEY and ALPACA_API_SECRET in your .env file or environment.")
        sys.exit(1)

    client = AlpacaClient(API_KEY, API_SECRET, BASE_URL, dry_run=dry_run)
    bot    = WheelBot(client, dry_run=dry_run)

    # Verify connection
    try:
        acct = client.get_account()
        log.info(f"✅ Connected to Alpaca | Account: {acct.get('id', 'unknown')[:8]}... | "
                 f"Status: {acct.get('status', '?')}")
    except Exception as e:
        log.error(f"❌ Failed to connect to Alpaca: {e}")
        sys.exit(1)

    if args.status:
        bot.print_status()
    elif args.once:
        bot.run_once()
    else:
        bot.run_loop()


if __name__ == "__main__":
    main()
