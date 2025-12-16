"""Activity log for tracking repository operations."""
import json
import os
from datetime import datetime
from typing import List, Dict, Optional


class ActivityLog:
    """Manages activity logging for repository operations."""
    
    def __init__(self, log_file: str = "/app/activity_log.json", max_entries: int = 1000):
        """Initialize activity log."""
        self.log_file = log_file
        self.max_entries = max_entries
        self._ensure_log_file()
    
    def _ensure_log_file(self):
        """Ensure log file exists."""
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                json.dump([], f)
    
    def _load_logs(self) -> List[Dict]:
        """Load logs from file."""
        try:
            with open(self.log_file, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    
    def _save_logs(self, logs: List[Dict]):
        """Save logs to file."""
        try:
            # Keep only the most recent entries
            if len(logs) > self.max_entries:
                logs = logs[-self.max_entries:]
            
            with open(self.log_file, 'w') as f:
                json.dump(logs, f, indent=2)
        except Exception as e:
            print(f"Error saving activity log: {e}")
    
    def log_operation(self, operation: str, repo: str, status: str, 
                     message: Optional[str] = None, details: Optional[Dict] = None):
        """Log an operation."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "operation": operation,  # 'pull', 'pull_all', 'schedule_pull'
            "repo": repo,
            "status": status,  # 'success', 'error', 'warning', 'debug'
            "message": message,
            "details": details or {}
        }
        
        logs = self._load_logs()
        logs.append(log_entry)
        self._save_logs(logs)
        
        return log_entry
    
    def log_debug(self, message: str, repo: Optional[str] = None, details: Optional[Dict] = None):
        """Log a debug message."""
        return self.log_operation(
            operation='debug',
            repo=repo or 'system',
            status='debug',
            message=message,
            details=details
        )
    
    def get_logs(self, limit: int = 100, repo: Optional[str] = None, 
                 operation: Optional[str] = None, status: Optional[str] = None,
                 include_debug: bool = True) -> List[Dict]:
        """Get activity logs with optional filtering."""
        logs = self._load_logs()
        
        # Filter by repo if specified
        if repo:
            logs = [log for log in logs if log.get('repo') == repo]
        
        # Filter by operation if specified
        if operation:
            logs = [log for log in logs if log.get('operation') == operation]
        
        # Filter by status if specified
        if status:
            logs = [log for log in logs if log.get('status') == status]
        
        # Filter out debug logs if include_debug is False
        if not include_debug:
            logs = [log for log in logs if log.get('status') != 'debug']
        
        # Sort by timestamp (newest first) and limit
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return logs[:limit]
    
    def get_repo_history(self, repo: str, limit: int = 50) -> List[Dict]:
        """Get history for a specific repository."""
        return self.get_logs(limit=limit, repo=repo)
    
    def get_stats(self) -> Dict:
        """Get statistics from activity logs."""
        logs = self._load_logs()
        
        total_operations = len(logs)
        successful = len([log for log in logs if log.get('status') == 'success'])
        failed = len([log for log in logs if log.get('status') == 'error'])
        
        # Count by operation type
        operation_counts = {}
        for log in logs:
            op = log.get('operation', 'unknown')
            operation_counts[op] = operation_counts.get(op, 0) + 1
        
        # Count by repository
        repo_counts = {}
        for log in logs:
            repo = log.get('repo', 'unknown')
            repo_counts[repo] = repo_counts.get(repo, 0) + 1
        
        debug_count = len([log for log in logs if log.get('status') == 'debug'])
        
        return {
            "total_operations": total_operations,
            "successful": successful,
            "failed": failed,
            "debug": debug_count,
            "success_rate": (successful / total_operations * 100) if total_operations > 0 else 0,
            "operation_counts": operation_counts,
            "repo_counts": repo_counts,
            "last_activity": logs[-1].get('timestamp') if logs else None
        }

