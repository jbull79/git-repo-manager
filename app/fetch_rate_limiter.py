"""Thread-safe token bucket to pace git fetch() calls without skipping network updates.

Every status check still performs a full fetch once a slot is available, so remote
comparison stays accurate; only the *timing* of concurrent fetches is limited.
"""
import threading
import time
from typing import Optional


class FetchRateLimiter:
    """Token bucket: at most `max_per_minute` fetch acquisitions per rolling minute."""

    def __init__(self, max_per_minute: int = 60):
        self._lock = threading.Lock()
        self._max_per_minute = max(1, int(max_per_minute))
        self._tokens = float(self._max_per_minute)
        self._last_refill = time.monotonic()

    def set_max_per_minute(self, max_per_minute: int) -> None:
        """Update limit (e.g. after settings change)."""
        with self._lock:
            self._max_per_minute = max(1, int(max_per_minute))
            # Cap tokens to new max
            self._tokens = min(self._tokens, float(self._max_per_minute))

    def get_max_per_minute(self) -> int:
        with self._lock:
            return self._max_per_minute

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._last_refill = now
        # Refill rate: max_per_minute tokens per 60 seconds
        rate = self._max_per_minute / 60.0
        self._tokens = min(float(self._max_per_minute), self._tokens + elapsed * rate)

    def acquire(self, timeout: Optional[float] = None) -> bool:
        """Block until a fetch slot is available (or timeout). Returns False if timed out."""
        deadline = None if timeout is None else (time.monotonic() + timeout)
        while True:
            with self._lock:
                self._refill()
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return True
                # Need to wait; estimate sleep until next token
                rate = self._max_per_minute / 60.0
                wait = (1.0 - self._tokens) / rate if rate > 0 else 0.1
                wait = max(0.01, min(wait, 1.0))

            if deadline is not None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                wait = min(wait, remaining)

            time.sleep(wait)
