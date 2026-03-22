"""Centralized application services (avoids scattered global reassignment)."""
import os
from typing import Optional

from app.settings import Settings
from app.cache import CacheManager
from app.fetch_rate_limiter import FetchRateLimiter
from app.git_scanner import GitScanner
from app.git_operations import GitOperations
from app.scheduler import ScheduleManager
from app.activity_log import ActivityLog
from app.repo_groups import RepoGroups

APP_VERSION = "1.0.4"

_services: Optional["AppServices"] = None


class AppServices:
    """Holds scanner, operations, scheduler, and shared config."""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.settings = Settings(config_file=f"{data_dir}/settings.json")

        configured_git = self.settings.get("git_path", os.getenv("GIT_PATH", "/git"))
        git_path = self._resolve_git_base_path(configured_git)
        host_git_path = os.getenv("HOST_GIT_PATH", self.settings.get("host_git_path", "~/git"))
        if host_git_path and host_git_path != self.settings.get("host_git_path"):
            self.settings.set("host_git_path", host_git_path)
        host_ssh_path = os.getenv("HOST_SSH_PATH", self.settings.get("host_ssh_path", "~/.ssh"))
        if host_ssh_path and host_ssh_path != self.settings.get("host_ssh_path"):
            self.settings.set("host_ssh_path", host_ssh_path)

        cache_ttl = self.settings.get("cache_ttl_seconds", 600)
        self.cache_manager = CacheManager(ttl_seconds=cache_ttl)

        fetch_max = self.settings.get(
            "fetch_max_per_minute",
            int(os.getenv("FETCH_MAX_PER_MINUTE") or "60")
        )
        self.fetch_rate_limiter = FetchRateLimiter(max_per_minute=fetch_max)

        self._current_git_path = git_path
        self.scanner = GitScanner(
            base_path=git_path,
            fetch_rate_limiter=self.fetch_rate_limiter,
        )
        self.activity_log = ActivityLog(log_file=f"{data_dir}/activity_log.json")
        self.operations = GitOperations(
            base_path=git_path,
            activity_log=self.activity_log,
            cache_manager=self.cache_manager,
        )
        self.schedule_manager = ScheduleManager(
            base_path=git_path,
            config_file=f"{data_dir}/schedules.json",
            activity_log=self.activity_log,
            cache_manager=self.cache_manager,
        )
        self.repo_groups = RepoGroups(config_file=f"{data_dir}/repo_groups.json")

    def _resolve_git_base_path(self, configured: str) -> str:
        """Use Docker path /git when mounted; fall back to host path when running locally.

        settings.json often keeps ``git_path`` as ``/git`` (container). On the host that
        path usually does not exist — use ``GIT_PATH`` or ``host_git_path`` (e.g. ~/git).
        """
        env_git = os.getenv("GIT_PATH")
        if env_git:
            p = os.path.expanduser(env_git.strip())
            if os.path.isdir(p):
                return os.path.abspath(p)
        p = os.path.expanduser((configured or "/git").strip())
        if os.path.isdir(p):
            return os.path.abspath(p)
        host = os.path.expanduser(self.settings.get("host_git_path", "~/git"))
        if os.path.isdir(host):
            return os.path.abspath(host)
        return os.path.abspath(p) if p else "/git"

    @property
    def git_path(self) -> str:
        return self._current_git_path

    def reconfigure_git_path(self, new_path: str) -> None:
        """Recreate scanner/operations/scheduler after git_path change."""
        self.schedule_manager.shutdown()
        self.cache_manager.invalidate_all()
        self._current_git_path = new_path
        self.scanner = GitScanner(
            base_path=new_path,
            fetch_rate_limiter=self.fetch_rate_limiter,
        )
        self.operations = GitOperations(
            base_path=new_path,
            activity_log=self.activity_log,
            cache_manager=self.cache_manager,
        )
        self.schedule_manager = ScheduleManager(
            base_path=new_path,
            config_file=f"{self.data_dir}/schedules.json",
            activity_log=self.activity_log,
            cache_manager=self.cache_manager,
        )

    def update_fetch_rate_from_settings(self) -> None:
        max_f = self.settings.get(
            "fetch_max_per_minute",
            int(os.getenv("FETCH_MAX_PER_MINUTE") or "60"),
        )
        self.fetch_rate_limiter.set_max_per_minute(max_f)


def init_services(data_dir: str) -> AppServices:
    """Initialize singleton services (call once at app startup)."""
    global _services
    _services = AppServices(data_dir=data_dir)
    return _services


def get_services() -> AppServices:
    if _services is None:
        raise RuntimeError("Services not initialized; call init_services() first")
    return _services
