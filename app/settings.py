"""Application settings management."""
import json
import os
from typing import Dict, Optional


class Settings:
    """Manages application settings."""
    
    def __init__(self, config_file: str = "/app/data/settings.json"):
        """Initialize settings manager."""
        self.config_file = config_file
        self.default_settings = {
            "git_path": "/git",  # Container path
            "host_git_path": os.getenv("HOST_GIT_PATH", "~/git"),  # Host path (from env or default)
            "host_ssh_path": os.getenv("HOST_SSH_PATH", "~/.ssh"),  # Host SSH keys path (from env or default)
            "auto_refresh_interval": 30,
            "max_activity_log_entries": 1000,
            "cache_ttl_seconds": 600,  # Cache TTL in seconds (default: 10 minutes)
            "theme": "light",
            "batch_size": 10,  # Number of repos to process per batch
            "parallel_workers": 5  # Number of parallel workers for batch processing
        }
        self.settings = self._load_settings()
    
    def _load_settings(self) -> Dict:
        """Load settings from config file."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    loaded = json.load(f)
                    # Merge with defaults to ensure all keys exist
                    settings = self.default_settings.copy()
                    settings.update(loaded)
                    return settings
            except Exception as e:
                print(f"Error loading settings: {e}")
                return self.default_settings.copy()
        return self.default_settings.copy()
    
    def _save_settings(self):
        """Save settings to config file."""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(self.settings, f, indent=2)
        except Exception as e:
            print(f"Error saving settings: {e}")
    
    def get(self, key: str, default=None):
        """Get a setting value."""
        return self.settings.get(key, default)
    
    def set(self, key: str, value):
        """Set a setting value."""
        self.settings[key] = value
        self._save_settings()
    
    def update(self, **kwargs):
        """Update multiple settings at once."""
        self.settings.update(kwargs)
        self._save_settings()
    
    def get_all(self) -> Dict:
        """Get all settings."""
        return self.settings.copy()
    
    def reset(self):
        """Reset settings to defaults."""
        self.settings = self.default_settings.copy()
        self._save_settings()

