"""Git operations (pull, etc.)"""
from pathlib import Path
from typing import Dict, Optional
import os
import git
from git import Repo, InvalidGitRepositoryError, GitCommandError


class GitOperations:
    """Handle git operations like pull."""
    
    def __init__(self, base_path: str = "/git", activity_log=None, cache_manager=None):
        """Initialize with base path."""
        self.base_path = Path(base_path)
        self.activity_log = activity_log
        self.cache_manager = cache_manager
        # Configure git to use SSH with proper settings
        self._configure_git_ssh()
    
    def _configure_git_ssh(self):
        """Configure git to use SSH properly."""
        # Set GIT_SSH_COMMAND to use SSH with strict host key checking disabled for first connection
        # This helps with containerized environments
        ssh_command = "ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/home/appuser/.ssh/known_hosts"
        os.environ.setdefault('GIT_SSH_COMMAND', ssh_command)
    
    def pull_repo(self, repo_name: str) -> Dict:
        """Pull updates for a specific repository."""
        repo_path = self.base_path / repo_name
        
        if not (repo_path / ".git").exists():
            return {
                "success": False,
                "error": f"Repository {repo_name} not found"
            }
        
        try:
            repo = Repo(str(repo_path))
            
            if not repo.remotes:
                return {
                    "success": False,
                    "error": "No remote configured"
                }
            
            # Get current branch
            try:
                current_branch = repo.active_branch.name
            except TypeError:
                return {
                    "success": False,
                    "error": "Repository is in detached HEAD state"
                }
            
            # Fetch first
            try:
                origin = repo.remotes.origin
                origin.fetch()
            except GitCommandError as e:
                return {
                    "success": False,
                    "error": f"Fetch failed: {str(e)}"
                }
            
            # Pull
            try:
                pull_info = origin.pull(current_branch)
                result = {
                    "success": True,
                    "message": f"Successfully pulled {repo_name}",
                    "updates": len(pull_info) if pull_info else 0,
                    "branch": current_branch
                }
                # Invalidate cache for this repo only (not 'all' cache to preserve other repos)
                if self.cache_manager:
                    self.cache_manager.invalidate(repo_name)
                # Log activity
                if self.activity_log:
                    self.activity_log.log_operation(
                        'pull', repo_name, 'success',
                        result["message"],
                        {"updates": result["updates"], "branch": current_branch}
                    )
                return result
            except GitCommandError as e:
                error_msg = f"Pull failed: {str(e)}"
                if self.activity_log:
                    self.activity_log.log_operation('pull', repo_name, 'error', error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except InvalidGitRepositoryError:
            error_msg = f"Invalid git repository: {repo_name}"
            if self.activity_log:
                self.activity_log.log_operation('pull', repo_name, 'error', error_msg)
            return {
                "success": False,
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            if self.activity_log:
                self.activity_log.log_operation('pull', repo_name, 'error', error_msg)
            return {
                "success": False,
                "error": error_msg
            }
    
    def pull_all_repos(self, repo_names: list) -> Dict:
        """Pull updates for all repositories."""
        results = {
            "success": True,
            "total": len(repo_names),
            "succeeded": 0,
            "failed": 0,
            "results": []
        }
        
        for repo_name in repo_names:
            result = self.pull_repo(repo_name)
            result["repo"] = repo_name
            results["results"].append(result)
            
            if result["success"]:
                results["succeeded"] += 1
            else:
                results["failed"] += 1
                results["success"] = False
        
        # Invalidate entire cache after bulk pull
        if self.cache_manager:
            self.cache_manager.invalidate_all()
        
        # Log bulk operation
        if self.activity_log:
            status = 'success' if results["failed"] == 0 else 'warning'
            self.activity_log.log_operation(
                'pull_all', 'all', status,
                f"Pulled {results['succeeded']}/{results['total']} repositories",
                results
            )
        
        return results

