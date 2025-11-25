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

