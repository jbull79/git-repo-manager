"""In-memory caching for repository scan results."""
import time
from typing import Dict, Optional, Any
from threading import Lock


class CacheManager:
    """Manages in-memory cache for repository data with TTL support."""
    
    def __init__(self, ttl_seconds: int = 600):
        """Initialize cache manager with TTL.
        
        Args:
            ttl_seconds: Time-to-live in seconds (default: 600 = 10 minutes)
        """
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """Retrieve cached data if valid.
        
        Args:
            key: Cache key (e.g., 'all' for all repos, or repo name)
            
        Returns:
            Cached data if valid, None otherwise
        """
        with self._lock:
            if key not in self._cache:
                self._stats["misses"] += 1
                return None
            
            entry = self._cache[key]
            if not self._is_entry_valid(entry):
                # Entry expired, remove it
                del self._cache[key]
                self._stats["misses"] += 1
                return None
            
            self._stats["hits"] += 1
            return entry["data"]
    
    def set(self, key: str, value: Any):
        """Store data in cache with current timestamp.
        
        Args:
            key: Cache key
            value: Data to cache
        """
        with self._lock:
            self._cache[key] = {
                "data": value,
                "timestamp": time.time()
            }
            self._stats["sets"] += 1
    
    def invalidate(self, key: str):
        """Remove specific cache entry.
        
        Args:
            key: Cache key to invalidate
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats["invalidations"] += 1
    
    def invalidate_all(self):
        """Clear all cache entries."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._stats["invalidations"] += count
    
    def is_valid(self, key: str) -> bool:
        """Check if cache entry is still valid (not expired).
        
        Args:
            key: Cache key to check
            
        Returns:
            True if entry exists and is valid, False otherwise
        """
        with self._lock:
            if key not in self._cache:
                return False
            return self._is_entry_valid(self._cache[key])
    
    def _is_entry_valid(self, entry: Dict) -> bool:
        """Check if cache entry is still within TTL.
        
        Args:
            entry: Cache entry dictionary
            
        Returns:
            True if entry is valid, False if expired
        """
        elapsed = time.time() - entry["timestamp"]
        return elapsed < self.ttl_seconds
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            total_requests = self._stats["hits"] + self._stats["misses"]
            hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0
            
            return {
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "sets": self._stats["sets"],
                "invalidations": self._stats["invalidations"],
                "hit_rate": round(hit_rate, 2),
                "entries": len(self._cache),
                "ttl_seconds": self.ttl_seconds
            }
    
    def update_ttl(self, ttl_seconds: int):
        """Update the TTL for future cache entries.
        
        Args:
            ttl_seconds: New TTL in seconds
        """
        with self._lock:
            self.ttl_seconds = ttl_seconds

