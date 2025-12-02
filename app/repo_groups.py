"""Repository grouping and tagging."""
import json
import os
from typing import List, Dict, Optional


class RepoGroups:
    """Manages repository groups and tags."""
    
    def __init__(self, config_file: str = "/app/repo_groups.json"):
        """Initialize repository groups manager."""
        self.config_file = config_file
        self.groups = self._load_groups()
    
    def _load_groups(self) -> Dict:
        """Load groups from config file."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception:
                return {"groups": {}, "tags": {}}
        return {"groups": {}, "tags": {}}
    
    def _save_groups(self):
        """Save groups to config file."""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            # Write to a temporary file first, then rename (atomic operation)
            temp_file = self.config_file + '.tmp'
            with open(temp_file, 'w') as f:
                json.dump(self.groups, f, indent=2)
            # Atomic rename
            os.replace(temp_file, self.config_file)
        except Exception as e:
            print(f"Error saving repo groups: {e}")
            raise
    
    def create_group(self, name: str, repos: List[str], color: Optional[str] = None) -> Dict:
        """Create a new repository group."""
        import time
        # Generate unique ID based on timestamp to avoid collisions
        group_id = f"group_{int(time.time() * 1000)}"
        group = {
            "id": group_id,
            "name": name,
            "repos": repos or [],
            "color": color or "#3B82F6"  # Default blue
        }
        
        if 'groups' not in self.groups:
            self.groups['groups'] = {}
        self.groups['groups'][group_id] = group
        self._save_groups()
        
        return group
    
    def update_group(self, group_id: str, **kwargs) -> Optional[Dict]:
        """Update a group."""
        if group_id not in self.groups.get('groups', {}):
            return None
        
        self.groups['groups'][group_id].update(kwargs)
        self._save_groups()
        return self.groups['groups'][group_id]
    
    def delete_group(self, group_id: str) -> bool:
        """Delete a group."""
        if group_id not in self.groups.get('groups', {}):
            return False
        
        del self.groups['groups'][group_id]
        self._save_groups()
        return True
    
    def get_groups(self) -> List[Dict]:
        """Get all groups."""
        return list(self.groups.get('groups', {}).values())
    
    def get_repo_groups(self, repo_name: str) -> List[str]:
        """Get groups that contain a repository."""
        groups = []
        for group in self.groups.get('groups', {}).values():
            if repo_name in group.get('repos', []):
                groups.append(group['name'])
        return groups
    
    def add_repo_to_group(self, group_id: str, repo_name: str) -> bool:
        """Add a repository to a group."""
        if group_id not in self.groups.get('groups', {}):
            return False
        
        group = self.groups['groups'][group_id]
        if 'repos' not in group:
            group['repos'] = []
        
        if repo_name not in group['repos']:
            group['repos'].append(repo_name)
            self._save_groups()
        
        return True
    
    def remove_repo_from_group(self, group_id: str, repo_name: str) -> bool:
        """Remove a repository from a group."""
        if group_id not in self.groups.get('groups', {}):
            return False
        
        group = self.groups['groups'][group_id]
        if repo_name in group.get('repos', []):
            group['repos'].remove(repo_name)
            self._save_groups()
        
        return True
    
    def add_tag(self, repo_name: str, tag: str):
        """Add a tag to a repository."""
        if 'tags' not in self.groups:
            self.groups['tags'] = {}
        if repo_name not in self.groups['tags']:
            self.groups['tags'][repo_name] = []
        if tag not in self.groups['tags'][repo_name]:
            self.groups['tags'][repo_name].append(tag)
            self._save_groups()
    
    def remove_tag(self, repo_name: str, tag: str):
        """Remove a tag from a repository."""
        if repo_name in self.groups.get('tags', {}):
            if tag in self.groups['tags'][repo_name]:
                self.groups['tags'][repo_name].remove(tag)
                self._save_groups()
    
    def get_tags(self, repo_name: str) -> List[str]:
        """Get tags for a repository."""
        return self.groups.get('tags', {}).get(repo_name, [])
    
    def get_all_tags(self) -> List[str]:
        """Get all unique tags."""
        all_tags = set()
        for tags in self.groups.get('tags', {}).values():
            all_tags.update(tags)
        return sorted(list(all_tags))
    
    def get_or_create_default_behind_group(self) -> str:
        """Get or create the default 'Behind' group for behind repos."""
        DEFAULT_GROUP_NAME = "Behind"
        DEFAULT_GROUP_COLOR = "#EF4444"  # Red color
        
        # Find existing group with this name
        for group_id, group in self.groups.get('groups', {}).items():
            if group.get('name') == DEFAULT_GROUP_NAME:
                return group_id
        
        # Create the group if it doesn't exist
        group = self.create_group(DEFAULT_GROUP_NAME, [], DEFAULT_GROUP_COLOR)
        return group['id']
    
    def get_or_create_default_diverged_group(self) -> str:
        """Get or create the default 'Diverged' group for diverged repos."""
        DEFAULT_GROUP_NAME = "Diverged"
        DEFAULT_GROUP_COLOR = "#F59E0B"  # Orange/amber color
        
        # Find existing group with this name
        for group_id, group in self.groups.get('groups', {}).items():
            if group.get('name') == DEFAULT_GROUP_NAME:
                return group_id
        
        # Create the group if it doesn't exist
        group = self.create_group(DEFAULT_GROUP_NAME, [], DEFAULT_GROUP_COLOR)
        return group['id']
    
    def sync_behind_repos_to_default_group(self, repos: List[Dict]):
        """Automatically sync repos with 'behind' status to the default 'Behind' group.
        
        This function ensures the 'Behind' group always contains exactly the repos
        that have 'behind' status. It adds repos that are behind and removes repos
        that are no longer behind.
        """
        group_id = self.get_or_create_default_behind_group()
        group = self.groups['groups'][group_id]
        
        # Get current repos in the group
        current_repos = set(group.get('repos', []))
        
        # Find all repos that are behind from the provided repos
        behind_repos = set()
        for repo in repos:
            status = repo.get('status', {})
            if status.get('state') == 'behind':
                behind_repos.add(repo['name'])
        
        # Add repos that are behind but not in the group
        repos_to_add = behind_repos - current_repos
        for repo_name in repos_to_add:
            if repo_name not in group['repos']:
                group['repos'].append(repo_name)
        
        # Remove repos that are no longer behind but are in the group
        # Only remove repos that we've checked (in the provided repos list)
        checked_repo_names = {repo['name'] for repo in repos}
        repos_to_remove = (current_repos & checked_repo_names) - behind_repos
        for repo_name in repos_to_remove:
            if repo_name in group['repos']:
                group['repos'].remove(repo_name)
        
        # Save if there were changes
        if repos_to_add or repos_to_remove:
            self._save_groups()
    
    def sync_diverged_repos_to_default_group(self, repos: List[Dict]):
        """Automatically sync repos with 'diverged' status to the default 'Diverged' group.
        
        This function ensures the 'Diverged' group always contains exactly the repos
        that have 'diverged' status. It adds repos that are diverged and removes repos
        that are no longer diverged.
        """
        group_id = self.get_or_create_default_diverged_group()
        group = self.groups['groups'][group_id]
        
        # Get current repos in the group
        current_repos = set(group.get('repos', []))
        
        # Find all repos that are diverged from the provided repos
        diverged_repos = set()
        for repo in repos:
            status = repo.get('status', {})
            if status.get('state') == 'diverged':
                diverged_repos.add(repo['name'])
        
        # Add repos that are diverged but not in the group
        repos_to_add = diverged_repos - current_repos
        for repo_name in repos_to_add:
            if repo_name not in group['repos']:
                group['repos'].append(repo_name)
        
        # Remove repos that are no longer diverged but are in the group
        # Only remove repos that we've checked (in the provided repos list)
        checked_repo_names = {repo['name'] for repo in repos}
        repos_to_remove = (current_repos & checked_repo_names) - diverged_repos
        for repo_name in repos_to_remove:
            if repo_name in group['repos']:
                group['repos'].remove(repo_name)
        
        # Save if there were changes
        if repos_to_add or repos_to_remove:
            self._save_groups()
    
    def get_group_repos(self, group_name: str) -> List[str]:
        """Get all repositories in a group by name."""
        for group in self.groups.get('groups', {}).values():
            if group.get('name') == group_name:
                return group.get('repos', [])
        return []

