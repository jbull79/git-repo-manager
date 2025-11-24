// Git Repository Manager - Frontend JavaScript

const API_BASE = '/api';
let autoRefreshInterval = null;
let autoRefreshEnabled = false;
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
let allReposData = [];
let selectedRepos = new Set();
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    initializeEventListeners();
    loadRepositories();
    loadStats();
    loadGroupsAndTags();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            loadRepositories();
        }
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
});

// Initialize dark mode
function initializeDarkMode() {
    if (isDarkMode) {
        document.getElementById('htmlRoot').classList.add('dark');
    }
    updateDarkModeToggle();
}

function updateDarkModeToggle() {
    const toggle = document.getElementById('darkModeToggle');
    if (isDarkMode) {
        toggle.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
    } else {
        toggle.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
    }
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    if (isDarkMode) {
        document.getElementById('htmlRoot').classList.add('dark');
    } else {
        document.getElementById('htmlRoot').classList.remove('dark');
    }
    updateDarkModeToggle();
}

function closeAllModals() {
    document.getElementById('schedulesModal').classList.add('hidden');
    document.getElementById('scheduleFormModal').classList.add('hidden');
    document.getElementById('activityModal').classList.add('hidden');
    document.getElementById('repoDetailsModal').classList.add('hidden');
    document.getElementById('statsDashboard').classList.add('hidden');
    document.getElementById('settingsModal').classList.add('hidden');
}

// Event listeners
function initializeEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadRepositories(true); // Force refresh bypasses cache
    });
    
    document.getElementById('clearCacheBtn').addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE}/cache/clear`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                showToast('Cache cleared successfully', 'success');
                // Reload repositories after clearing cache
                loadRepositories(true);
            } else {
                showToast('Failed to clear cache: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showToast('Error clearing cache: ' + error.message, 'error');
        }
    });
    document.getElementById('pullAllBtn').addEventListener('click', pullAllRepos);
    document.getElementById('autoRefreshToggle').addEventListener('change', toggleAutoRefresh);
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    document.getElementById('statsBtn').addEventListener('click', toggleStatsDashboard);
    document.getElementById('closeStats').addEventListener('click', () => document.getElementById('statsDashboard').classList.add('hidden'));
    document.getElementById('activityBtn').addEventListener('click', openActivityModal);
    document.getElementById('closeActivityModal').addEventListener('click', () => document.getElementById('activityModal').classList.add('hidden'));
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('closeSettingsModal').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
    document.getElementById('cancelSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
    
    // Search and filter
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('groupFilter').addEventListener('change', applyFilters);
    document.getElementById('tagFilter').addEventListener('change', applyFilters);
    document.getElementById('sortSelect').addEventListener('change', applyFilters);
    
    // Bulk selection
    document.getElementById('bulkSelectToggle').addEventListener('change', toggleBulkSelection);
    document.getElementById('bulkUpdateBtn').addEventListener('click', bulkUpdateSelected);
    document.getElementById('bulkGroupBtn').addEventListener('click', bulkAddToGroup);
    document.getElementById('bulkTagBtn').addEventListener('click', bulkAddTag);
    
    // Schedule management
    document.getElementById('schedulesBtn').addEventListener('click', openSchedulesModal);
    document.getElementById('closeSchedulesModal').addEventListener('click', closeSchedulesModal);
    document.getElementById('newScheduleBtn').addEventListener('click', openNewScheduleForm);
    document.getElementById('closeScheduleForm').addEventListener('click', closeScheduleForm);
    document.getElementById('cancelScheduleForm').addEventListener('click', closeScheduleForm);
    document.getElementById('scheduleForm').addEventListener('submit', handleScheduleSubmit);
    document.getElementById('scheduleType').addEventListener('change', handleScheduleTypeChange);
}

// Toggle auto-refresh
function toggleAutoRefresh(event) {
    autoRefreshEnabled = event.target.checked;
    
    if (autoRefreshEnabled) {
        autoRefreshInterval = setInterval(loadRepositories, AUTO_REFRESH_INTERVAL);
        showToast('Auto-refresh enabled', 'info');
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        showToast('Auto-refresh disabled', 'info');
    }
}

// Load all repositories
async function loadRepositories() {
    showLoading(true);
    
    try {
        const search = document.getElementById('searchInput').value;
        const status = document.getElementById('statusFilter').value;
        const group = document.getElementById('groupFilter').value;
        const tag = document.getElementById('tagFilter').value;
        const sort = document.getElementById('sortSelect').value;
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (group) params.append('group', group);
        if (tag) params.append('tag', tag);
        if (sort) params.append('sort', sort);
        
        const response = await fetch(`${API_BASE}/repos?${params.toString()}`);
        const data = await response.json();
        
        if (data.success) {
            allReposData = data.repos;
            renderRepositories(data.repos);
            updateRepoCount(data.repos.length);
        } else {
            showToast('Failed to load repositories: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error loading repositories: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function applyFilters() {
    loadRepositories();
}

function updateRepoCount(count) {
    document.getElementById('repoCountBadge').textContent = count;
}

// Render repositories
function renderRepositories(repos) {
    const container = document.getElementById('reposContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (repos.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = repos.map(repo => createRepoCard(repo)).join('');
    
    // Attach event listeners
    repos.forEach(repo => {
        const updateBtn = document.getElementById(`updateBtn-${repo.name}`);
        if (updateBtn) {
            updateBtn.addEventListener('click', () => pullRepo(repo.name));
        }
        
        const branchToggle = document.getElementById(`branchToggle-${repo.name}`);
        if (branchToggle) {
            branchToggle.addEventListener('click', () => toggleBranchList(repo.name));
        }
        
        const checkbox = document.querySelector(`.bulk-checkbox[data-repo="${repo.name}"]`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedRepos.add(repo.name);
                } else {
                    selectedRepos.delete(repo.name);
                }
                updateBulkActions();
            });
        }
    });
}

// Create repository card HTML
function createRepoCard(repo) {
    if (repo.error) {
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 repo-card transition-colors">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-gray-800 dark:text-white">${escapeHtml(repo.name)}</h3>
                </div>
                <div class="text-red-600 dark:text-red-400 text-sm">Error: ${escapeHtml(repo.error)}</div>
            </div>
        `;
    }
    
    const status = repo.status || {};
    const statusBadge = getStatusBadge(status);
    const isDirty = repo.is_dirty ? '<span class="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">Uncommitted changes</span>' : '';
    
    // Check if repo needs update (behind or diverged)
    const needsUpdate = status.state === 'behind' || status.state === 'diverged';
    const updateClass = needsUpdate ? ' needs-update' : '';
    
    // Groups and tags
    const groups = (repo.groups || []).map(g => `<span class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded">${escapeHtml(g)}</span>`).join('');
    const tags = (repo.tags || []).map(t => `<span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs rounded">${escapeHtml(t)}</span>`).join('');
    
    const isSelected = selectedRepos.has(repo.name);
    const bulkCheckbox = document.getElementById('bulkSelectToggle')?.checked 
        ? `<input type="checkbox" class="bulk-checkbox w-4 h-4 text-blue-600 rounded" data-repo="${escapeHtml(repo.name)}" ${isSelected ? 'checked' : ''}>`
        : '';
    
    return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 repo-card${updateClass} transition-all border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    ${bulkCheckbox}
                    <div class="p-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg shadow-sm">
                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors" onclick="openRepoDetails('${escapeHtml(repo.name)}')" title="${escapeHtml(repo.name)}">${escapeHtml(repo.name)}</h3>
                </div>
                <div class="ml-2 flex-shrink-0">
                    ${statusBadge}
                </div>
            </div>
            
            <div class="space-y-3">
                <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">Branch:</span>
                    <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium rounded">${escapeHtml(repo.current_branch)}</span>
                    ${isDirty}
                </div>
                
                ${repo.remote_url ? `<div class="text-sm text-gray-600 dark:text-gray-400 truncate" title="${escapeHtml(repo.remote_url)}">
                    <span class="font-medium">Remote:</span> ${escapeHtml(repo.remote_url)}
                </div>` : '<div class="text-sm text-yellow-600 dark:text-yellow-400">No remote configured</div>'}
                
                ${groups ? `<div class="flex flex-wrap gap-1 mt-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">Groups:</span> ${groups}
                </div>` : ''}
                
                ${tags ? `<div class="flex flex-wrap gap-1 mt-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">Tags:</span> ${tags}
                </div>` : ''}
                
                ${repo.last_commit ? `
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    <div class="font-medium">Last commit:</div>
                    <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ${escapeHtml(repo.last_commit.message)}<br>
                        <span class="text-gray-400 dark:text-gray-500">${escapeHtml(repo.last_commit.author)} • ${formatDate(repo.last_commit.date)}</span>
                    </div>
                </div>
                ` : ''}
                
                ${(repo.local_branches && repo.local_branches.length > 0) || (repo.remote_branches && repo.remote_branches.length > 0) ? `
                <div class="border-t dark:border-gray-700 pt-3">
                    <button id="branchToggle-${repo.name}" class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                        Branches
                    </button>
                    <div id="branchList-${repo.name}" class="hidden mt-2 branch-list">
                        ${repo.local_branches && repo.local_branches.length > 0 ? `
                        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Local:</div>
                        <div class="flex flex-wrap gap-1 mb-2">
                            ${repo.local_branches.map(branch => `
                                <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">${escapeHtml(branch)}</span>
                            `).join('')}
                        </div>
                        ` : ''}
                        ${repo.remote_branches && repo.remote_branches.length > 0 ? `
                        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Remote:</div>
                        <div class="flex flex-wrap gap-1">
                            ${repo.remote_branches.map(branch => `
                                <span class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-xs rounded">${escapeHtml(branch)}</span>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button id="updateBtn-${repo.name}" class="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Update Repository
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Get status badge HTML
function getStatusBadge(status) {
    const state = status.state || 'unknown';
    const icons = {
        'behind': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg>',
        'ahead': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" transform="rotate(180 10 10)"></path></svg>',
        'up_to_date': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
        'diverged': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
        'no_remote': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path></svg>',
        'no_tracking': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg>',
        'error': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
        'unknown': '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-.171a3 3 0 01-1.658-1.658 1 1 0 111.414-1.414A1 1 0 009 8a1 1 0 001 1h.171a3 3 0 011.658 1.658z" clip-rule="evenodd"></path></svg>'
    };
    
    const badges = {
        'behind': '<span class="px-3 py-1.5 bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 text-orange-800 dark:text-orange-200 text-sm font-semibold rounded-full status-badge flex items-center gap-1.5 shadow-sm">' + icons.behind + 'Behind (' + (status.behind || 0) + ')</span>',
        'ahead': '<span class="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-800 dark:text-blue-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.ahead + 'Ahead (' + (status.ahead || 0) + ')</span>',
        'up_to_date': '<span class="px-3 py-1.5 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 text-green-800 dark:text-green-200 text-sm font-semibold rounded-full status-badge up-to-date flex items-center gap-1.5 shadow-sm">' + icons.up_to_date + 'Up to date</span>',
        'diverged': '<span class="px-3 py-1.5 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 text-red-800 dark:text-red-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.diverged + 'Diverged</span>',
        'no_remote': '<span class="px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.no_remote + 'No remote</span>',
        'no_tracking': '<span class="px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900 dark:to-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.no_tracking + 'No tracking</span>',
        'error': '<span class="px-3 py-1.5 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 text-red-800 dark:text-red-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.error + 'Error</span>',
        'unknown': '<span class="px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-sm">' + icons.unknown + 'Unknown</span>'
    };
    
    return badges[state] || badges['unknown'];
}

// Toggle branch list
function toggleBranchList(repoName) {
    const branchList = document.getElementById(`branchList-${repoName}`);
    const toggle = document.getElementById(`branchToggle-${repoName}`);
    
    if (branchList.classList.contains('hidden')) {
        branchList.classList.remove('hidden');
        toggle.querySelector('svg').style.transform = 'rotate(180deg)';
    } else {
        branchList.classList.add('hidden');
        toggle.querySelector('svg').style.transform = 'rotate(0deg)';
    }
}

// Pull single repository
async function pullRepo(repoName) {
    const btn = document.getElementById(`updateBtn-${repoName}`);
    const originalText = btn.innerHTML;
    
    btn.classList.add('btn-loading');
    btn.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Updating...';
    
    try {
        const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoName)}/pull`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully updated ${repoName}`, 'success');
            // Reload repositories after a short delay
            setTimeout(loadRepositories, 1000);
        } else {
            showToast(`Failed to update ${repoName}: ${data.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error updating ${repoName}: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('btn-loading');
        btn.innerHTML = originalText;
    }
}

// Pull all repositories
async function pullAllRepos() {
    const btn = document.getElementById('pullAllBtn');
    const originalText = btn.innerHTML;
    
    btn.classList.add('btn-loading');
    btn.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Updating All...';
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/repos/pull-all`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully updated ${data.succeeded} repository/repositories`, 'success');
        } else {
            showToast(`Updated ${data.succeeded} succeeded, ${data.failed} failed`, data.failed > 0 ? 'warning' : 'success');
        }
        
        // Show detailed results
        if (data.results) {
            data.results.forEach(result => {
                if (!result.success) {
                    showToast(`${result.repo}: ${result.error}`, 'error', 5000);
                }
            });
        }
        
        // Reload repositories after a short delay
        setTimeout(loadRepositories, 1000);
    } catch (error) {
        showToast(`Error updating repositories: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('btn-loading');
        btn.innerHTML = originalText;
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    if (show) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const colors = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    };
    
    toast.className = `${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg toast-enter flex items-center gap-3 min-w-[300px]`;
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="ml-auto text-white hover:text-gray-200" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

// Schedule Management Functions
let allRepos = [];
let currentEditingSchedule = null;

async function openSchedulesModal() {
    document.getElementById('schedulesModal').classList.remove('hidden');
    await loadSchedules();
}

function closeSchedulesModal() {
    document.getElementById('schedulesModal').classList.add('hidden');
}

async function loadSchedules() {
    try {
        const response = await fetch(`${API_BASE}/schedules`);
        const data = await response.json();
        
        if (data.success) {
            renderSchedules(data.schedules);
        } else {
            showToast('Failed to load schedules', 'error');
        }
    } catch (error) {
        showToast('Error loading schedules: ' + error.message, 'error');
    }
}

function renderSchedules(schedules) {
    const container = document.getElementById('schedulesList');
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <p class="text-gray-500 dark:text-gray-400">No schedules configured.</p>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "New Schedule" to create one.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = schedules.map(schedule => `
        <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md hover:shadow-lg transition-all">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">${escapeHtml(schedule.name)}</h3>
                </div>
                <div class="flex gap-2">
                    <label class="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <input type="checkbox" ${schedule.enabled ? 'checked' : ''} 
                               onchange="toggleSchedule('${schedule.id}', this.checked)"
                               class="w-4 h-4 text-blue-600 rounded">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
                    </label>
                    <button onclick="editSchedule('${schedule.id}')" class="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-sm hover:shadow transition-all">
                        Edit
                    </button>
                    <button onclick="deleteSchedule('${schedule.id}')" class="px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm font-medium shadow-sm hover:shadow transition-all">
                        Delete
                    </button>
                </div>
            </div>
            <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">Repositories:</span>
                    <span class="text-gray-600 dark:text-gray-400">${schedule.repos.join(', ')}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">Schedule:</span>
                    <span class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-medium">${formatScheduleType(schedule)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function formatScheduleType(schedule) {
    if (schedule.type === 'daily') {
        return `Daily at ${String(schedule.hour || 0).padStart(2, '0')}:${String(schedule.minute || 0).padStart(2, '0')}`;
    } else if (schedule.type === 'weekly') {
        const days = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
        return `Weekly on ${days[schedule.day_of_week || 'mon']} at ${String(schedule.hour || 0).padStart(2, '0')}:${String(schedule.minute || 0).padStart(2, '0')}`;
    } else if (schedule.type === 'custom') {
        return `Custom: ${schedule.cron || 'N/A'}`;
    }
    return schedule.type || 'Unknown';
}

async function toggleSchedule(scheduleId, enabled) {
    try {
        const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(`Schedule ${enabled ? 'enabled' : 'disabled'}`, 'success');
            await loadSchedules();
        } else {
            showToast('Failed to update schedule', 'error');
        }
    } catch (error) {
        showToast('Error updating schedule: ' + error.message, 'error');
    }
}

async function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Schedule deleted', 'success');
            await loadSchedules();
        } else {
            showToast('Failed to delete schedule', 'error');
        }
    } catch (error) {
        showToast('Error deleting schedule: ' + error.message, 'error');
    }
}

async function editSchedule(scheduleId) {
    try {
        const response = await fetch(`${API_BASE}/schedules`);
        const data = await response.json();
        
        if (data.success) {
            const schedule = data.schedules.find(s => s.id === scheduleId);
            if (schedule) {
                currentEditingSchedule = schedule;
                openScheduleForm(schedule);
            }
        }
    } catch (error) {
        showToast('Error loading schedule: ' + error.message, 'error');
    }
}

function openNewScheduleForm() {
    currentEditingSchedule = null;
    openScheduleForm();
}

function openScheduleForm(schedule = null) {
    document.getElementById('scheduleFormTitle').textContent = schedule ? 'Edit Schedule' : 'New Schedule';
    document.getElementById('scheduleFormModal').classList.remove('hidden');
    
    // Load repos for checkboxes
    loadReposForSchedule();
    
    if (schedule) {
        // Populate form with schedule data
        document.getElementById('scheduleName').value = schedule.name || '';
        document.getElementById('scheduleType').value = schedule.type || 'daily';
        handleScheduleTypeChange();
        
        if (schedule.type === 'daily') {
            document.getElementById('scheduleHour').value = schedule.hour || 0;
            document.getElementById('scheduleMinute').value = schedule.minute || 0;
        } else if (schedule.type === 'weekly') {
            document.getElementById('scheduleDayOfWeek').value = schedule.day_of_week || 'mon';
            document.getElementById('scheduleWeekHour').value = schedule.hour || 0;
            document.getElementById('scheduleWeekMinute').value = schedule.minute || 0;
        } else if (schedule.type === 'custom') {
            document.getElementById('scheduleCron').value = schedule.cron || '';
        }
    } else {
        // Reset form
        document.getElementById('scheduleForm').reset();
        handleScheduleTypeChange();
    }
}

function closeScheduleForm() {
    document.getElementById('scheduleFormModal').classList.add('hidden');
    currentEditingSchedule = null;
}

async function loadReposForSchedule() {
    try {
        const response = await fetch(`${API_BASE}/repos`);
        const data = await response.json();
        
        if (data.success) {
            allRepos = data.repos;
            const container = document.getElementById('repoCheckboxes');
            container.innerHTML = data.repos.map(repo => `
                <label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" value="${escapeHtml(repo.name)}" 
                           ${currentEditingSchedule && currentEditingSchedule.repos.includes(repo.name) ? 'checked' : ''}
                           class="schedule-repo-checkbox w-4 h-4 text-blue-600 rounded">
                    <span>${escapeHtml(repo.name)}</span>
                </label>
            `).join('');
        }
    } catch (error) {
        showToast('Error loading repositories', 'error');
    }
}

function handleScheduleTypeChange() {
    const type = document.getElementById('scheduleType').value;
    document.getElementById('dailyOptions').classList.toggle('hidden', type !== 'daily');
    document.getElementById('weeklyOptions').classList.toggle('hidden', type !== 'weekly');
    document.getElementById('customOptions').classList.toggle('hidden', type !== 'custom');
}

async function handleScheduleSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('scheduleName').value;
    const type = document.getElementById('scheduleType').value;
    const selectedRepos = Array.from(document.querySelectorAll('.schedule-repo-checkbox:checked')).map(cb => cb.value);
    
    if (!name || selectedRepos.length === 0) {
        showToast('Please provide a name and select at least one repository', 'error');
        return;
    }
    
    const scheduleData = {
        name,
        repos: selectedRepos,
        type,
        value: null
    };
    
    if (type === 'daily') {
        scheduleData.hour = parseInt(document.getElementById('scheduleHour').value);
        scheduleData.minute = parseInt(document.getElementById('scheduleMinute').value);
    } else if (type === 'weekly') {
        scheduleData.day_of_week = document.getElementById('scheduleDayOfWeek').value;
        scheduleData.hour = parseInt(document.getElementById('scheduleWeekHour').value);
        scheduleData.minute = parseInt(document.getElementById('scheduleWeekMinute').value);
    } else if (type === 'custom') {
        scheduleData.cron = document.getElementById('scheduleCron').value;
        if (!scheduleData.cron) {
            showToast('Please provide a cron expression', 'error');
            return;
        }
    }
    
    try {
        const url = currentEditingSchedule 
            ? `${API_BASE}/schedules/${currentEditingSchedule.id}`
            : `${API_BASE}/schedules`;
        const method = currentEditingSchedule ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Schedule ${currentEditingSchedule ? 'updated' : 'created'} successfully`, 'success');
            closeScheduleForm();
            await loadSchedules();
        } else {
            showToast('Failed to save schedule: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving schedule: ' + error.message, 'error');
    }
}


// Statistics Dashboard
async function loadStats() {
    try {
        // Load both stats and cache stats
        const [statsResponse, cacheResponse] = await Promise.all([
            fetch(`${API_BASE}/stats`),
            fetch(`${API_BASE}/cache/stats`)
        ]);
        const statsData = await statsResponse.json();
        const cacheData = await cacheResponse.json();
        
        if (statsData.success) {
            renderStats(statsData.stats, cacheData.success ? cacheData.stats : null);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function renderStats(stats, cacheStats) {
    const container = document.getElementById('statsContent');
    const statusCounts = stats.status_counts || {};
    
    let cacheHtml = '';
    if (cacheStats) {
        cacheHtml = `
            <div class="stats-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 p-6 rounded-xl border border-purple-200 dark:border-purple-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                <div class="flex items-center justify-between mb-2">
                    <div class="p-2 bg-purple-500 rounded-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                        </svg>
                    </div>
                </div>
                <div class="text-3xl font-bold text-purple-800 dark:text-purple-100 mb-1">${cacheStats.hit_rate}%</div>
                <div class="text-sm font-medium text-purple-600 dark:text-purple-300">Cache Hit Rate</div>
                <div class="mt-4 space-y-1 text-xs text-purple-700 dark:text-purple-300">
                    <div class="flex justify-between">
                        <span>Hits:</span>
                        <span class="font-bold">${cacheStats.hits}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Misses:</span>
                        <span class="font-bold">${cacheStats.misses}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Entries:</span>
                        <span class="font-bold">${cacheStats.entries}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="stats-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-6 rounded-xl border border-blue-200 dark:border-blue-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div class="flex items-center justify-between mb-2">
                <div class="p-2 bg-blue-500 rounded-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                    </svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-blue-800 dark:text-blue-100 mb-1">${stats.total_repos || 0}</div>
            <div class="text-sm font-medium text-blue-600 dark:text-blue-300">Total Repositories</div>
        </div>
        <div class="stats-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-6 rounded-xl border border-green-200 dark:border-green-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div class="flex items-center justify-between mb-2">
                <div class="p-2 bg-green-500 rounded-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-green-800 dark:text-green-100 mb-1">${statusCounts.up_to_date || 0}</div>
            <div class="text-sm font-medium text-green-600 dark:text-green-300">Up to Date</div>
        </div>
        <div class="stats-card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 p-6 rounded-xl border border-orange-200 dark:border-orange-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div class="flex items-center justify-between mb-2">
                <div class="p-2 bg-orange-500 rounded-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-orange-800 dark:text-orange-100 mb-1">${statusCounts.behind || 0}</div>
            <div class="text-sm font-medium text-orange-600 dark:text-orange-300">Behind</div>
        </div>
        <div class="stats-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 p-6 rounded-xl border border-red-200 dark:border-red-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div class="flex items-center justify-between mb-2">
                <div class="p-2 bg-red-500 rounded-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-red-800 dark:text-red-100 mb-1">${statusCounts.diverged || 0}</div>
            <div class="text-sm font-medium text-red-600 dark:text-red-300">Diverged</div>
        </div>
        </div>
        ${cacheHtml}
    `;
}

function toggleStatsDashboard() {
    const dashboard = document.getElementById('statsDashboard');
    dashboard.classList.toggle('hidden');
    if (!dashboard.classList.contains('hidden')) {
        loadStats();
    }
}

// Activity Log
async function openActivityModal() {
    document.getElementById('activityModal').classList.remove('hidden');
    await loadActivityLog();
}

async function loadActivityLog() {
    try {
        const response = await fetch(`${API_BASE}/activity?limit=100`);
        const data = await response.json();
        
        if (data.success) {
            renderActivityLog(data.logs);
        }
    } catch (error) {
        showToast('Error loading activity log: ' + error.message, 'error');
    }
}

function renderActivityLog(logs) {
    const container = document.getElementById('activityLogContent');
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <p class="text-gray-500 dark:text-gray-400">No activity recorded yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const statusConfig = {
            'success': { bg: 'from-green-50 to-green-100', darkBg: 'dark:from-green-900 dark:to-green-800', text: 'text-green-800', darkText: 'dark:text-green-200', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            'error': { bg: 'from-red-50 to-red-100', darkBg: 'dark:from-red-900 dark:to-red-800', text: 'text-red-800', darkText: 'dark:text-red-200', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            'warning': { bg: 'from-yellow-50 to-yellow-100', darkBg: 'dark:from-yellow-900 dark:to-yellow-800', text: 'text-yellow-800', darkText: 'dark:text-yellow-200', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' }
        };
        const config = statusConfig[log.status] || statusConfig.warning;
        
        return `
            <div class="bg-gradient-to-r ${config.bg} ${config.darkBg} border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-all">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="p-1.5 bg-white dark:bg-gray-800 rounded">
                                <svg class="w-4 h-4 ${config.text} ${config.darkText}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${config.icon}"></path>
                                </svg>
                            </div>
                            <span class="px-2.5 py-1 bg-white dark:bg-gray-800 ${config.text} ${config.darkText} text-xs font-semibold rounded-full">${log.operation}</span>
                            <span class="font-semibold text-gray-800 dark:text-white truncate">${escapeHtml(log.repo)}</span>
                        </div>
                        ${log.message ? `<div class="text-sm text-gray-700 dark:text-gray-300 mt-1 ml-8">${escapeHtml(log.message)}</div>` : ''}
                    </div>
                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">${formatDate(log.timestamp)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Repository Details Modal
async function openRepoDetails(repoName) {
    document.getElementById('repoDetailsModal').classList.remove('hidden');
    document.getElementById('repoDetailsTitle').textContent = repoName;
    
    try {
        const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoName)}/status`);
        const data = await response.json();
        
        if (data.success) {
            renderRepoDetails(data.repo);
        } else {
            showToast('Failed to load repository details', 'error');
        }
    } catch (error) {
        showToast('Error loading repository details: ' + error.message, 'error');
    }
}

function renderRepoDetails(repo) {
    const container = document.getElementById('repoDetailsContent');
    const commits = (repo.commit_history || []).slice(0, 10);
    
    container.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div class="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide mb-1">Current Branch</div>
                    <div class="font-bold text-lg text-blue-800 dark:text-blue-100">${escapeHtml(repo.current_branch)}</div>
                </div>
                <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div class="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1">Status</div>
                    <div>${getStatusBadge(repo.status)}</div>
                </div>
            </div>
            
            ${repo.remote_url ? `
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">Remote URL</div>
                <div class="font-mono text-sm text-gray-800 dark:text-white break-all bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">${escapeHtml(repo.remote_url)}</div>
            </div>
            ` : ''}
            
            ${commits.length > 0 ? `
            <div>
                <div class="flex items-center gap-2 mb-4">
                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Commits</div>
                </div>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    ${commits.map(commit => `
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm bg-white dark:bg-gray-800 hover:shadow-md transition-all">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-mono text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">${escapeHtml(commit.hash)}</span>
                                <span class="font-semibold text-gray-800 dark:text-white flex-1">${escapeHtml(commit.message)}</span>
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 ml-0.5 flex items-center gap-2">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                                </svg>
                                ${escapeHtml(commit.author)} • ${formatDate(commit.date)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

document.getElementById('closeRepoDetails').addEventListener('click', () => {
    document.getElementById('repoDetailsModal').classList.add('hidden');
});

// Bulk Selection
function toggleBulkSelection(event) {
    const enabled = event.target.checked;
    document.getElementById('bulkActions').classList.toggle('hidden', !enabled);
    
    if (!enabled) {
        selectedRepos.clear();
        updateBulkActions();
        loadRepositories(); // Re-render to remove checkboxes
    } else {
        loadRepositories(); // Re-render to show checkboxes
    }
}

function updateBulkActions() {
    const count = selectedRepos.size;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('bulkUpdateBtn').disabled = count === 0;
    document.getElementById('bulkGroupBtn').disabled = count === 0;
    document.getElementById('bulkTagBtn').disabled = count === 0;
}

async function bulkUpdateSelected() {
    if (selectedRepos.size === 0) return;
    
    const repos = Array.from(selectedRepos);
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/repos/bulk-pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repos })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Updated ${data.succeeded}/${data.total} repositories`, 'success');
            selectedRepos.clear();
            document.getElementById('bulkSelectToggle').checked = false;
            toggleBulkSelection({ target: { checked: false } });
            loadRepositories();
        } else {
            showToast(`Updated ${data.succeeded} succeeded, ${data.failed} failed`, 'warning');
        }
    } catch (error) {
        showToast('Error updating repositories: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function bulkAddToGroup() {
    const groupName = prompt('Enter group name:');
    if (!groupName) return;
    
    const repos = Array.from(selectedRepos);
    // Implementation would call API to add repos to group
    showToast('Feature coming soon', 'info');
}

function bulkAddTag() {
    const tag = prompt('Enter tag name:');
    if (!tag) return;
    
    const repos = Array.from(selectedRepos);
    // Implementation would call API to add tag to repos
    showToast('Feature coming soon', 'info');
}

// Groups and Tags
async function loadGroupsAndTags() {
    try {
        const [groupsRes, tagsRes] = await Promise.all([
            fetch(`${API_BASE}/groups`),
            fetch(`${API_BASE}/tags`)
        ]);
        
        const groupsData = await groupsRes.json();
        const tagsData = await tagsRes.json();
        
        if (groupsData.success) {
            const groupSelect = document.getElementById('groupFilter');
            groupSelect.innerHTML = '<option value="">All Groups</option>' +
                groupsData.groups.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join('');
        }
        
        if (tagsData.success) {
            const tagSelect = document.getElementById('tagFilter');
            tagSelect.innerHTML = '<option value="">All Tags</option>' +
                tagsData.tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading groups/tags:', error);
    }
}

// Settings Management
async function openSettingsModal() {
    document.getElementById('settingsModal').classList.remove('hidden');
    await loadSettings();
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        const data = await response.json();
        
        if (data.success) {
            const settings = data.settings;
            document.getElementById('settingsHostGitPath').value = settings.host_git_path || '~/git';
            document.getElementById('currentHostGitPath').textContent = settings.host_git_path || '~/git';
            document.getElementById('settingsHostSshPath').value = settings.host_ssh_path || '~/.ssh';
            document.getElementById('currentHostSshPath').textContent = settings.host_ssh_path || '~/.ssh';
            // Also show environment variable if available
            if (settings.HOST_SSH_PATH && settings.HOST_SSH_PATH !== 'Not set') {
                document.getElementById('currentHostSshPath').textContent = settings.HOST_SSH_PATH;
            }
            document.getElementById('settingsGitPath').value = settings.git_path || '/git';
            document.getElementById('settingsAutoRefresh').value = settings.auto_refresh_interval || 30;
            document.getElementById('settingsMaxLogEntries').value = settings.max_activity_log_entries || 1000;
            document.getElementById('settingsCacheTtl').value = settings.cache_ttl_seconds || 600;
            document.getElementById('settingsCacheTtl').value = settings.cache_ttl_seconds || 600;
        } else {
            showToast('Failed to load settings', 'error');
        }
    } catch (error) {
        showToast('Error loading settings: ' + error.message, 'error');
    }
}

async function handleSettingsSubmit(event) {
    event.preventDefault();
    
    const hostGitPath = document.getElementById('settingsHostGitPath').value.trim();
    const hostSshPath = document.getElementById('settingsHostSshPath').value.trim();
    const gitPath = document.getElementById('settingsGitPath').value.trim();
    const autoRefresh = parseInt(document.getElementById('settingsAutoRefresh').value);
    const maxLogEntries = parseInt(document.getElementById('settingsMaxLogEntries').value);
    const cacheTtl = parseInt(document.getElementById('settingsCacheTtl').value);
    
    if (!hostGitPath) {
        showToast('Host git repository path is required', 'error');
        return;
    }
    
    if (!hostSshPath) {
        showToast('Host SSH keys path is required', 'error');
        return;
    }
    
    if (!gitPath) {
        showToast('Container git repository path is required', 'error');
        return;
    }
    
    if (autoRefresh < 10 || autoRefresh > 300) {
        showToast('Auto-refresh interval must be between 10 and 300 seconds', 'error');
        return;
    }
    
    if (maxLogEntries < 100 || maxLogEntries > 10000) {
        showToast('Max log entries must be between 100 and 10000', 'error');
        return;
    }
    
    if (cacheTtl < 30 || cacheTtl > 3600) {
        showToast('Cache TTL must be between 30 and 3600 seconds', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host_git_path: hostGitPath,
                host_ssh_path: hostSshPath,
                git_path: gitPath,
                auto_refresh_interval: autoRefresh,
                max_activity_log_entries: maxLogEntries,
                cache_ttl_seconds: cacheTtl
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const hostGitPathChanged = hostGitPath !== document.getElementById('currentHostGitPath').textContent;
            const hostSshPathChanged = hostSshPath !== document.getElementById('currentHostSshPath').textContent;
            
            if (hostGitPathChanged || hostSshPathChanged) {
                let message = 'Settings saved. IMPORTANT: ';
                if (hostGitPathChanged) {
                    message += 'Update HOST_GIT_PATH ';
                }
                if (hostSshPathChanged) {
                    if (hostGitPathChanged) message += 'and ';
                    message += 'Update HOST_SSH_PATH ';
                }
                message += 'in .env or docker-compose.yml and restart the container for the changes to take effect.';
                showToast(message, 'warning', 10000);
            } else {
                showToast('Settings saved successfully. Reloading repositories...', 'success');
            }
            
            document.getElementById('settingsModal').classList.add('hidden');
            
            // Reload repositories after a short delay
            setTimeout(() => {
                loadRepositories();
                if (!hostPathChanged) {
                    showToast('Settings applied.', 'info');
                }
            }, 1000);
        } else {
            showToast('Failed to save settings: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving settings: ' + error.message, 'error');
    }
}

async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/settings/reset`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Settings reset to defaults', 'success');
            await loadSettings();
        } else {
            showToast('Failed to reset settings', 'error');
        }
    } catch (error) {
        showToast('Error resetting settings: ' + error.message, 'error');
    }
}

