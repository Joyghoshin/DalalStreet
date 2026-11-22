import yfinance as yf
import random, math, time, threading
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

_cache: dict = {}
_last_gbm: dict = {}
_refresh_locks: dict = {}
_refresh_in_progress: set = set()
_rate_limit_cooldown_until: float = 0.0
_rate_limit_lock = threading.Lock()

CACHE_TTL_OPEN   = 60    # 1 min during market hours
CACHE_TTL_CLOSED = 1800  # 30 min when closed — drastically reduces requests

IST = timezone(timedelta(hours=5, minutes=30))


def _is_market_open() -> bool:
    now  = datetime.now(IST)
    mins = now.hour * 60 + now.minute
    return now.weekday() < 5 and (9 * 60 + 15) <= mins < (15 * 60 + 30)


def _safe_float(val, default=0.0) -> float:
    try:
        v = float(val)
        return v if v == v else default  # NaN check
    except Exception:
        return default


def _fetch_ticker_price(ticker_sym: str) -> tuple[float, float, float, float, float, int]:
    """
    Tries multiple yfinance endpoints in order:
    1. fast_info (fastest, single request)
    2. .info['regularMarketPrice'] (different endpoint)
    3. .history(period='2d') (last resort)
    """
    time.sleep(0.5)
    ticker = yf.Ticker(ticker_sym)

    # Method 1: fast_info
    try:
        fi    = ticker.fast_info
        price = _safe_float(fi.last_price)
        prev  = _safe_float(fi.previous_close)
        if price > 0.5 and prev > 0.5:
            open_ = _safe_float(fi.open, prev)
            high  = _safe_float(fi.day_high, price)
            low   = _safe_float(fi.day_low, price)
            vol   = int(_safe_float(fi.three_month_average_volume))
            return round(price,2), round(prev,2), round(open_,2), round(high,2), round(low,2), vol
    except Exception:
        pass

    # Method 2: .info dict (different Yahoo endpoint)
    time.sleep(1)
    try:
        info  = ticker.info
        price = _safe_float(info.get("regularMarketPrice") or info.get("currentPrice"))
        prev  = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
        if price > 0.5 and prev > 0.5:
            open_ = _safe_float(info.get("regularMarketOpen", prev))
            high  = _safe_float(info.get("dayHigh", price))
            low   = _safe_float(info.get("dayLow", price))
            vol   = int(_safe_float(info.get("volume") or info.get("averageVolume", 0)))
            return round(price,2), round(prev,2), round(open_,2), round(high,2), round(low,2), vol
    except Exception:
        pass

    # Method 3: history (last resort)
    time.sleep(2)
    try:
        hist = ticker.history(period="5d", auto_adjust=True)
        if not hist.empty:
            price = round(float(hist["Close"].iloc[-1]), 2)
            prev  = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price, 2)
            high  = round(float(hist["High"].iloc[-1]), 2)
            low   = round(float(hist["Low"].iloc[-1]), 2)
            open_ = round(float(hist["Open"].iloc[-1]), 2)
            vol   = int(float(hist["Volume"].iloc[-1]))
            if price > 0.5:
                return price, prev, open_, high, low, vol
    except Exception:
        pass

    raise ValueError(f"All methods failed for {ticker_sym}")


def _fetch_index_price(ticker_sym: str) -> tuple[float, float]:
    """Fetch index with 3 fallback methods."""
    time.sleep(0.5)
    ticker = yf.Ticker(ticker_sym)

    # Method 1: fast_info
    try:
        fi    = ticker.fast_info
        price = _safe_float(fi.last_price)
        prev  = _safe_float(fi.previous_close)
        if price > 1000:
            return round(price, 2), round(prev, 2)
    except Exception:
        pass

    # Method 2: .info
    time.sleep(1)
    try:
        info  = ticker.info
        price = _safe_float(info.get("regularMarketPrice") or info.get("previousClose"))
        prev  = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
        if price > 1000:
            return round(price, 2), round(prev, 2)
    except Exception:
        pass

    # Method 3: history
    time.sleep(2)
    try:
        hist = ticker.history(period="5d", auto_adjust=True)
        if not hist.empty:
            price = round(float(hist["Close"].iloc[-1]), 2)
            prev  = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price, 2)
            if price > 1000:
                return price, prev
    except Exception:
        pass

    raise ValueError(f"Index fetch failed: {ticker_sym}")


def _gbm(symbol: str, exchange: str) -> dict:
    base  = _last_gbm.get(symbol, random.uniform(500, 3000))
    shock = math.exp(
        (0.0001 - 0.5 * 0.02**2) / 252 +
        0.02 * math.sqrt(1 / 252) * random.gauss(0, 1)
    )
    price = round(base * shock, 2)
    _last_gbm[symbol] = price
    chg   = round(price - base, 2)
    return {
        "symbol": symbol, "exchange": exchange,
        "price":  price,  "open":  round(base * 0.998, 2),
        "high":   round(price * 1.005, 2),
        "low":    round(price * 0.995, 2),
        "volume": random.randint(100_000, 5_000_000),
        "change": chg,
        "changePct": round((chg / base) * 100, 2) if base else 0,
        "timestamp": datetime.now().isoformat(),
        "source": "simulated",
    }


NSE_OVERRIDES = {
    "TATAMOTORS": "TMPV.NS",
    "TMPV": "TMPV.NS",
    "TMCV": "TMCV.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "KOTAKBANK":  "KOTAKBANK.NS",
    "HDFCBANK":   "HDFCBANK.NS",
    "WIPRO":      "WIPRO.NS",
    "SBIN":       "SBIN.NS",
    "ITC":        "ITC.NS",
    "INFY":       "INFY.NS",
    "TCS":        "TCS.NS",
    "RELIANCE":   "RELIANCE.NS",
    "LTIM":       "LTIM.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "BAJAJHFL":   "BAJAJHFL.NS",
    "HCLTECH":    "HCLTECH.NS",
    "ADANIENT":   "ADANIENT.NS",
    "AXISBANK":   "AXISBANK.NS",
    "ICICIBANK":  "ICICIBANK.NS",
    "HINDUNILVR": "HINDUNILVR.NS",
    "MARUTI":     "MARUTI.NS",
    "SUNPHARMA":  "SUNPHARMA.NS",
    "TITAN":      "TITAN.NS",
    "NESTLEIND":  "NESTLEIND.NS",
    "ONGC":       "ONGC.NS",
    "POWERGRID":  "POWERGRID.NS",
    "TECHM":      "TECHM.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS",
    "JSWSTEEL":   "JSWSTEEL.NS",
    "TATASTEEL":  "TATASTEEL.NS",
    "COALINDIA":  "COALINDIA.NS",
}

BSE_FALLBACKS = {
    "LTIM":       "540005.BO",
    "ADANIENT":   "512599.BO",
    "BAJAJHFL":   "508246.BO",
}


def _resolve_ticker(symbol: str, exchange: str) -> str:
    return NSE_OVERRIDES.get(
        symbol, f"{symbol}{'.NS' if exchange == 'NSE' else '.BO'}"
    )


def _get_ttl() -> int:
    return CACHE_TTL_OPEN if _is_market_open() else CACHE_TTL_CLOSED


def _is_rate_limited() -> bool:
    with _rate_limit_lock:
        return time.time() < _rate_limit_cooldown_until


def _set_rate_limit_cooldown(seconds: float = 60.0) -> None:
    with _rate_limit_lock:
        global _rate_limit_cooldown_until
        _rate_limit_cooldown_until = time.time() + seconds


def _get_refresh_lock(key: str) -> threading.Lock:
    with _rate_limit_lock:
        if key not in _refresh_locks:
            _refresh_locks[key] = threading.Lock()
        return _refresh_locks[key]


def _refresh_quote_background(symbol: str, exchange: str, ticker_sym: str) -> None:
    lock = _get_refresh_lock(f"quote:{symbol}")
    if not lock.acquire(blocking=False):
        return
    try:
        if f"quote:{symbol}" in _refresh_in_progress:
            return
        _refresh_in_progress.add(f"quote:{symbol}")

        if _is_rate_limited():
            return

        try:
            price, prev, open_, high, low, vol = _fetch_ticker_price(ticker_sym)

            if price < 0.5 or price > 1_000_000:
                raise ValueError(f"Suspicious price {price}")

            chg     = round(price - prev, 2)
            chg_pct = round((chg / prev) * 100, 2) if prev else 0

            result = {
                "symbol": symbol, "exchange": exchange,
                "price":  price,  "open":  open_,
                "high":   high,   "low":   low,
                "volume": vol,    "change": chg,
                "changePct": chg_pct,
                "timestamp": datetime.now().isoformat(),
                "source": "live",
            }
            _cache[symbol] = {**result, "_ts": time.time()}
        except Exception as e:
            err_str = str(e).lower()
            if "rate limit" in err_str or "429" in err_str or "too many requests" in err_str:
                _set_rate_limit_cooldown(60.0)
            print(f"[price bg] {ticker_sym}: {e}")
    finally:
        _refresh_in_progress.discard(f"quote:{symbol}")
        lock.release()


def _refresh_index_background(symbol: str) -> None:
    lock = _get_refresh_lock(f"index:{symbol}")
    if not lock.acquire(blocking=False):
        return
    try:
        if f"index:{symbol}" in _refresh_in_progress:
            return
        _refresh_in_progress.add(f"index:{symbol}")

        if _is_rate_limited():
            return

        try:
            price, prev = _fetch_index_price(symbol)
            chg = round(price - prev, 2)
            result = {
                "symbol":    symbol,
                "price":     price,
                "change":    chg,
                "changePct": round((chg / prev) * 100, 2) if prev else 0,
                "timestamp": datetime.now().isoformat(),
                "source": "live",
            }
            _cache[f"_idx_{symbol}"] = {**result, "_ts": time.time()}
        except Exception as e:
            err_str = str(e).lower()
            if "rate limit" in err_str or "429" in err_str or "too many requests" in err_str:
                _set_rate_limit_cooldown(60.0)
            print(f"[index bg] {symbol}: {e}")
    finally:
        _refresh_in_progress.discard(f"index:{symbol}")
        lock.release()


def get_live_price(symbol: str, exchange: str = "NSE") -> dict:
    ttl    = _get_ttl()
    cached = _cache.get(symbol)
    now    = time.time()

    if cached and (now - cached["_ts"]) < ttl:
        result = {k: v for k, v in cached.items() if k != "_ts"}
        result["source"] = result.get("source", "live")
        return result

    ticker_sym = _resolve_ticker(symbol, exchange)

    if cached and (now - cached["_ts"]) >= ttl:
        stale_result = {k: v for k, v in cached.items() if k != "_ts"}
        stale_result["source"] = "stale"
        threading.Thread(
            target=_refresh_quote_background,
            args=(symbol, exchange, ticker_sym),
            daemon=True
        ).start()
        return stale_result

    if _is_rate_limited():
        if cached:
            stale_result = {k: v for k, v in cached.items() if k != "_ts"}
            stale_result["source"] = "stale"
            return stale_result
        return _gbm(symbol, exchange)

    try:
        price, prev, open_, high, low, vol = _fetch_ticker_price(ticker_sym)

        if price < 0.5 or price > 1_000_000:
            raise ValueError(f"Suspicious price {price}")

        chg     = round(price - prev, 2)
        chg_pct = round((chg / prev) * 100, 2) if prev else 0

        result = {
            "symbol": symbol, "exchange": exchange,
            "price":  price,  "open":  open_,
            "high":   high,   "low":   low,
            "volume": vol,    "change": chg,
            "changePct": chg_pct,
            "timestamp": datetime.now().isoformat(),
            "source": "live",
        }
        _cache[symbol] = {**result, "_ts": time.time()}
        return result

    except Exception as e:
        err_str = str(e).lower()
        if "rate limit" in err_str or "429" in err_str or "too many requests" in err_str:
            _set_rate_limit_cooldown(60.0)
        print(f"[price] {ticker_sym}: {e} — GBM fallback")
        if symbol in _cache:
            stale_result = {k: v for k, v in _cache[symbol].items() if k != "_ts"}
            stale_result["source"] = "stale"
            return stale_result
        return _gbm(symbol, exchange)


def get_index(symbol: str) -> dict:
    ttl    = _get_ttl()
    cache_key = f"_idx_{symbol}"
    cached = _cache.get(cache_key)
    now    = time.time()

    if cached and (now - cached["_ts"]) < ttl:
        result = {k: v for k, v in cached.items() if k != "_ts"}
        result["source"] = result.get("source", "live")
        return result

    if cached and (now - cached["_ts"]) >= ttl:
        stale_result = {k: v for k, v in cached.items() if k != "_ts"}
        stale_result["source"] = "stale"
        threading.Thread(
            target=_refresh_index_background,
            args=(symbol,),
            daemon=True
        ).start()
        return stale_result

    if _is_rate_limited():
        if cached:
            stale_result = {k: v for k, v in cached.items() if k != "_ts"}
            stale_result["source"] = "stale"
            return stale_result
        return {"symbol": symbol, "price": 0, "change": 0, "changePct": 0,
                "timestamp": datetime.now().isoformat(), "source": "simulated"}

    try:
        price, prev = _fetch_index_price(symbol)
        chg = round(price - prev, 2)
        result = {
            "symbol":    symbol,
            "price":     price,
            "change":    chg,
            "changePct": round((chg / prev) * 100, 2) if prev else 0,
            "timestamp": datetime.now().isoformat(),
            "source": "live",
        }
        _cache[cache_key] = {**result, "_ts": time.time()}
        return result

    except Exception as e:
        err_str = str(e).lower()
        if "rate limit" in err_str or "429" in err_str or "too many requests" in err_str:
            _set_rate_limit_cooldown(60.0)
        print(f"[index] {symbol}: {e}")
        if cache_key in _cache:
            stale_result = {k: v for k, v in _cache[cache_key].items() if k != "_ts"}
            stale_result["source"] = "stale"
            return stale_result
        return {"symbol": symbol, "price": 0, "change": 0, "changePct": 0,
                "timestamp": datetime.now().isoformat(), "source": "simulated"}


def fetch_indices_parallel(index_map: Dict[str, str]) -> List[dict]:
    results: Dict[str, dict] = {}

    def fetch_one(name: str, ticker: str) -> tuple[str, dict]:
        try:
            data = get_index(ticker)
            data["name"] = name
            return name, data
        except Exception as e:
            print(f"[index parallel] {name} ({ticker}): {e}")
            return name, {"name": name, "symbol": ticker, "price": 0, "change": 0,
                          "changePct": 0, "timestamp": datetime.now().isoformat(), "source": "simulated"}

    with ThreadPoolExecutor(max_workers=min(len(index_map), 5)) as executor:
        futures = {executor.submit(fetch_one, name, ticker): name for name, ticker in index_map.items()}
        for future in as_completed(futures):
            name, data = future.result()
            results[name] = data

    return [results[name] for name in index_map.keys()]


def warm_cache(symbols: List[str], indices: Dict[str, str]) -> None:
    def _warm():
        for sym in symbols:
            try:
                get_live_price(sym)
            except Exception:
                pass
        try:
            fetch_indices_parallel(indices)
        except Exception:
            pass

    threading.Thread(target=_warm, daemon=True).start()
