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
    
    def pull_repo(self, repo_name: str, pull_strategy: str = "merge") -> Dict:
        """Pull updates for a specific repository.
        
        Args:
            repo_name: Name of the repository to pull
            pull_strategy: Strategy to use when branches have diverged:
                - "merge": Create a merge commit (default, safest)
                - "rebase": Rebase local commits on top of remote (cleaner history)
                - "reset": Reset to match remote exactly (discards local changes, best for automated systems)
        """
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
            
            # Check if branches have diverged
            is_diverged = False
            try:
                remote_branch = f"origin/{current_branch}"
                if remote_branch in repo.refs:
                    local_commit = repo.head.commit
                    remote_commit = repo.refs[remote_branch].commit
                    
                    # Check if branches have diverged (both ahead and behind)
                    commits_ahead = list(repo.iter_commits(f"{remote_commit.hexsha}..{local_commit.hexsha}"))
                    commits_behind = list(repo.iter_commits(f"{local_commit.hexsha}..{remote_commit.hexsha}"))
                    
                    is_diverged = len(commits_ahead) > 0 and len(commits_behind) > 0
            except Exception:
                # If we can't determine divergence, proceed with normal pull
                pass
            
            # Handle diverged branches based on strategy
            if is_diverged and pull_strategy == "reset":
                try:
                    # Reset to match remote exactly (discards local changes)
                    repo.head.reset(f"origin/{current_branch}", index=True, working_tree=True)
                    result = {
                        "success": True,
                        "message": f"Successfully reset {repo_name} to match remote (local changes discarded)",
                        "updates": 0,
                        "branch": current_branch,
                        "strategy": "reset",
                        "diverged": True
                    }
                    # Invalidate cache
                    if self.cache_manager:
                        self.cache_manager.invalidate(repo_name)
                    # Log activity
                    if self.activity_log:
                        self.activity_log.log_operation(
                            'pull', repo_name, 'success',
                            result["message"],
                            {"updates": result["updates"], "branch": current_branch, "strategy": "reset", "diverged": True}
                        )
                    return result
                except GitCommandError as e:
                    error_msg = f"Reset failed: {str(e)}"
                    if self.activity_log:
                        self.activity_log.log_operation('pull', repo_name, 'error', error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "diverged": True
                    }
            
            # Try pull with specified strategy
            try:
                if pull_strategy == "rebase":
                    # Rebase strategy
                    pull_info = origin.pull(current_branch, rebase=True)
                else:
                    # Default merge strategy
                    pull_info = origin.pull(current_branch)
                
                result = {
                    "success": True,
                    "message": f"Successfully pulled {repo_name}",
                    "updates": len(pull_info) if pull_info else 0,
                    "branch": current_branch,
                    "strategy": pull_strategy
                }
                if is_diverged:
                    result["diverged"] = True
                    result["message"] += f" (branches had diverged, used {pull_strategy} strategy)"
                
                # Invalidate cache for this repo only (not 'all' cache to preserve other repos)
                if self.cache_manager:
                    self.cache_manager.invalidate(repo_name)
                # Log activity
                if self.activity_log:
                    self.activity_log.log_operation(
                        'pull', repo_name, 'success',
                        result["message"],
                        {"updates": result["updates"], "branch": current_branch, "strategy": pull_strategy}
                    )
                return result
            except GitCommandError as e:
                error_msg = str(e)
                # Check if it's a merge conflict
                if "CONFLICT" in error_msg.upper() or "conflict" in error_msg.lower():
                    error_msg = f"Merge conflict detected in {repo_name}. Branches have diverged and changes conflict. " \
                               f"Manual resolution required. Consider using 'reset' strategy to discard local changes " \
                               f"if they're not important."
                
                if self.activity_log:
                    self.activity_log.log_operation('pull', repo_name, 'error', error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "diverged": is_diverged,
                    "conflict": "CONFLICT" in error_msg.upper() or "conflict" in error_msg.lower()
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
    
    def pull_all_repos(self, repo_names: list, pull_strategy: str = "merge") -> Dict:
        """Pull updates for all repositories.
        
        Args:
            repo_names: List of repository names to pull
            pull_strategy: Strategy to use when branches have diverged (see pull_repo for details)
        """
        results = {
            "success": True,
            "total": len(repo_names),
            "succeeded": 0,
            "failed": 0,
            "results": []
        }
        
        for repo_name in repo_names:
            result = self.pull_repo(repo_name, pull_strategy=pull_strategy)
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

