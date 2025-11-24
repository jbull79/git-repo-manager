"""Git repository scanning and status detection."""
import os
from pathlib import Path
from typing import List, Dict, Optional
import git
from git import Repo, InvalidGitRepositoryError


class GitScanner:
    """Scans and analyzes git repositories."""
    
    def __init__(self, base_path: str = "/git"):
        """Initialize scanner with base path to scan."""
        self.base_path = Path(base_path)
    
    def find_repositories(self) -> List[str]:
        """Find all git repositories in the base path."""
        repos = []
        if not self.base_path.exists():
            return repos
        
        for item in self.base_path.iterdir():
            if item.is_dir() and (item / ".git").exists():
                repos.append(item.name)
        
        return sorted(repos)
    
    def get_repo_info(self, repo_name: str) -> Optional[Dict]:
        """Get detailed information about a repository."""
        repo_path = self.base_path / repo_name
        
        if not (repo_path / ".git").exists():
            return None
        
        try:
            repo = Repo(str(repo_path))
            
            # Get current branch
            try:
                current_branch = repo.active_branch.name
            except TypeError:
                # Detached HEAD state
                current_branch = repo.head.commit.hexsha[:7]
            
            # Get all branches
            local_branches = [branch.name for branch in repo.branches]
            remote_branches = []
            if repo.remotes:
                for remote in repo.remotes:
                    for branch in remote.refs:
                        remote_branches.append(f"{remote.name}/{branch.name.split('/')[-1]}")
            
            # Get remote URL
            remote_url = None
            if repo.remotes:
                try:
                    remote_url = repo.remotes.origin.url
                except:
                    remote_url = repo.remotes[0].url if repo.remotes else None
            
            # Get last commit info
            last_commit = None
            if repo.head.is_valid():
                commit = repo.head.commit
                last_commit = {
                    "hash": commit.hexsha[:7],
                    "message": commit.message.split('\n')[0],
                    "author": commit.author.name,
                    "date": commit.committed_datetime.isoformat()
                }
            
            # Check status (behind/ahead/up-to-date)
            status = self._get_repo_status(repo, current_branch)
            
            return {
                "name": repo_name,
                "path": str(repo_path),
                "current_branch": current_branch,
                "local_branches": local_branches,
                "remote_branches": remote_branches,
                "remote_url": remote_url,
                "last_commit": last_commit,
                "status": status,
                "is_dirty": repo.is_dirty(),
                "has_remote": len(repo.remotes) > 0
            }
        except InvalidGitRepositoryError:
            return None
        except Exception as e:
            return {
                "name": repo_name,
                "error": str(e)
            }
    
    def _get_repo_status(self, repo: Repo, branch_name: str) -> Dict:
        """Determine if repository is behind/ahead/up-to-date."""
        status = {
            "state": "unknown",
            "behind": 0,
            "ahead": 0,
            "diverged": False
        }
        
        try:
            if not repo.remotes:
                status["state"] = "no_remote"
                return status
            
            # Try to find remote tracking branch
            remote_name = "origin"
            main_branches = ["main", "master"]
            
            tracking_branch = None
            for main_branch in main_branches:
                try:
                    tracking_branch = repo.refs[f"{remote_name}/{main_branch}"]
                    break
                except (IndexError, AttributeError):
                    continue
            
            # If no main/master, try current branch
            if not tracking_branch:
                try:
                    tracking_branch = repo.refs[f"{remote_name}/{branch_name}"]
                except (IndexError, AttributeError):
                    status["state"] = "no_tracking"
                    return status
            
            # Compare commits
            local_commit = repo.head.commit
            remote_commit = tracking_branch.commit
            
            # Count commits ahead/behind
            commits_ahead = list(repo.iter_commits(f"{remote_commit.hexsha}..{local_commit.hexsha}"))
            commits_behind = list(repo.iter_commits(f"{local_commit.hexsha}..{remote_commit.hexsha}"))
            
            status["ahead"] = len(commits_ahead)
            status["behind"] = len(commits_behind)
            
            if status["behind"] > 0 and status["ahead"] > 0:
                status["state"] = "diverged"
                status["diverged"] = True
            elif status["behind"] > 0:
                status["state"] = "behind"
            elif status["ahead"] > 0:
                status["state"] = "ahead"
            else:
                status["state"] = "up_to_date"
                
        except Exception as e:
            status["state"] = "error"
            status["error"] = str(e)
        
        return status
    
    def get_commit_history(self, repo_name: str, limit: int = 20) -> List[Dict]:
        """Get commit history for a repository."""
        repo_path = self.base_path / repo_name
        
        if not (repo_path / ".git").exists():
            return []
        
        try:
            repo = Repo(str(repo_path))
            commits = []
            
            for commit in repo.iter_commits(max_count=limit):
                commits.append({
                    "hash": commit.hexsha[:7],
                    "full_hash": commit.hexsha,
                    "message": commit.message.split('\n')[0],
                    "author": commit.author.name,
                    "email": commit.author.email,
                    "date": commit.committed_datetime.isoformat(),
                    "stats": {
                        "total": commit.stats.total.get('lines', 0) if commit.stats.total else 0,
                        "insertions": commit.stats.total.get('insertions', 0) if commit.stats.total else 0,
                        "deletions": commit.stats.total.get('deletions', 0) if commit.stats.total else 0
                    } if hasattr(commit, 'stats') else {}
                })
            
            return commits
        except Exception as e:
            print(f"Error getting commit history for {repo_name}: {e}")
            return []
    
    def scan_all_repos(self) -> List[Dict]:
        """Scan all repositories and return their info."""
        repos = self.find_repositories()
        repo_info = []
        
        for repo_name in repos:
            info = self.get_repo_info(repo_name)
            if info:
                repo_info.append(info)
        
        return repo_info

