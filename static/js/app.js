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
    try {
        initializeDarkMode();
        initializeEventListeners();
        initDivergedStrategyModal();
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
    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Error initializing application: ' + error.message, 'error');
    }
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
    const modals = [
        'schedulesModal',
        'scheduleFormModal',
        'activityModal',
        'repoDetailsModal',
        'statsDashboard',
        'settingsModal',
        'groupsModal',
        'groupFormModal',
        'cacheDetailsModal'
    ];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    });
}

// Event listeners
function initializeEventListeners() {
    try {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadRepositories(true); // Force refresh bypasses cache
            });
        }
        
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
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
        }
        
        const pullAllBtn = document.getElementById('pullAllBtn');
        if (pullAllBtn) pullAllBtn.addEventListener('click', pullAllRepos);
        
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
        
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);
        
        const statsBtn = document.getElementById('statsBtn');
        if (statsBtn) statsBtn.addEventListener('click', toggleStatsDashboard);
        
        const closeStats = document.getElementById('closeStats');
        if (closeStats) closeStats.addEventListener('click', () => {
            const statsDashboard = document.getElementById('statsDashboard');
            if (statsDashboard) statsDashboard.classList.add('hidden');
        });
        
        const activityBtn = document.getElementById('activityBtn');
        if (activityBtn) activityBtn.addEventListener('click', openActivityModal);
        
        const groupsBtn = document.getElementById('groupsBtn');
        if (groupsBtn) groupsBtn.addEventListener('click', openGroupsModal);
        
        const closeGroupsModalBtn = document.getElementById('closeGroupsModal');
        if (closeGroupsModalBtn) {
            closeGroupsModalBtn.addEventListener('click', () => {
                closeGroupsModal();
            });
        }
        
        // Close groups modal when clicking backdrop
        const groupsModal = document.getElementById('groupsModal');
        if (groupsModal) {
            groupsModal.addEventListener('click', (e) => {
                if (e.target === groupsModal) {
                    closeGroupsModal();
                }
            });
        }
        
        const newGroupBtn = document.getElementById('newGroupBtn');
        if (newGroupBtn) newGroupBtn.addEventListener('click', openNewGroupForm);
        
        const closeGroupFormBtn = document.getElementById('closeGroupForm');
        if (closeGroupFormBtn) {
            closeGroupFormBtn.addEventListener('click', () => {
                closeGroupForm();
            });
        }
        
        const cancelGroupBtn = document.getElementById('cancelGroupBtn');
        if (cancelGroupBtn) {
            cancelGroupBtn.addEventListener('click', () => {
                closeGroupForm();
            });
        }
        
        // Close group form modal when clicking backdrop
        const groupFormModal = document.getElementById('groupFormModal');
        if (groupFormModal) {
            groupFormModal.addEventListener('click', (e) => {
                if (e.target === groupFormModal) {
                    closeGroupForm();
                }
            });
        }
        
        const groupForm = document.getElementById('groupForm');
        if (groupForm) groupForm.addEventListener('submit', handleGroupSubmit);
        
        const closeActivityModalBtn = document.getElementById('closeActivityModal');
        if (closeActivityModalBtn) {
            closeActivityModalBtn.addEventListener('click', () => {
                const activityModal = document.getElementById('activityModal');
                if (activityModal) activityModal.classList.add('hidden');
            });
        }
        
        // Close activity modal when clicking backdrop
        const activityModal = document.getElementById('activityModal');
        if (activityModal) {
            activityModal.addEventListener('click', (e) => {
                if (e.target === activityModal) {
                    activityModal.classList.add('hidden');
                }
            });
        }
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
        
        const closeSettingsModalBtn = document.getElementById('closeSettingsModal');
        if (closeSettingsModalBtn) {
            closeSettingsModalBtn.addEventListener('click', () => {
                const settingsModal = document.getElementById('settingsModal');
                if (settingsModal) settingsModal.classList.add('hidden');
            });
        }
        
        const closeCacheDetailsModalBtn = document.getElementById('closeCacheDetailsModal');
        if (closeCacheDetailsModalBtn) {
            closeCacheDetailsModalBtn.addEventListener('click', () => {
                closeCacheDetailsModal();
            });
        }
        
        // Close cache details modal when clicking backdrop
        const cacheDetailsModal = document.getElementById('cacheDetailsModal');
        if (cacheDetailsModal) {
            cacheDetailsModal.addEventListener('click', (e) => {
                if (e.target === cacheDetailsModal) {
                    closeCacheDetailsModal();
                }
            });
        }
        
        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        if (cancelSettingsBtn) {
            cancelSettingsBtn.addEventListener('click', () => {
                const settingsModal = document.getElementById('settingsModal');
                if (settingsModal) settingsModal.classList.add('hidden');
            });
        }
        
        // Close settings modal when clicking backdrop
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });
        }
        
        const resetSettingsBtn = document.getElementById('resetSettingsBtn');
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetSettings);
        
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) settingsForm.addEventListener('submit', handleSettingsSubmit);
        
        // Search and filter
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('input', applyFilters);
        
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) statusFilter.addEventListener('change', applyFilters);
        
        const groupFilter = document.getElementById('groupFilter');
        if (groupFilter) groupFilter.addEventListener('change', applyFilters);
        
        const tagFilter = document.getElementById('tagFilter');
        if (tagFilter) tagFilter.addEventListener('change', applyFilters);
        
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.addEventListener('change', applyFilters);
        
        // Bulk selection
        const bulkSelectToggle = document.getElementById('bulkSelectToggle');
        if (bulkSelectToggle) bulkSelectToggle.addEventListener('change', toggleBulkSelection);
        
        const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
        if (bulkUpdateBtn) bulkUpdateBtn.addEventListener('click', bulkUpdateSelected);
        
        const bulkGroupBtn = document.getElementById('bulkGroupBtn');
        if (bulkGroupBtn) bulkGroupBtn.addEventListener('click', bulkAddToGroup);
        
        const bulkTagBtn = document.getElementById('bulkTagBtn');
        if (bulkTagBtn) bulkTagBtn.addEventListener('click', bulkAddTag);
        
        // Schedule management
        const schedulesBtn = document.getElementById('schedulesBtn');
        if (schedulesBtn) schedulesBtn.addEventListener('click', openSchedulesModal);
        
        const closeSchedulesModalBtn = document.getElementById('closeSchedulesModal');
        if (closeSchedulesModalBtn) {
            closeSchedulesModalBtn.addEventListener('click', () => {
                closeSchedulesModal();
            });
        }
        
        // Close schedules modal when clicking backdrop
        const schedulesModal = document.getElementById('schedulesModal');
        if (schedulesModal) {
            schedulesModal.addEventListener('click', (e) => {
                if (e.target === schedulesModal) {
                    closeSchedulesModal();
                }
            });
        }
        
        const newScheduleBtn = document.getElementById('newScheduleBtn');
        if (newScheduleBtn) newScheduleBtn.addEventListener('click', openNewScheduleForm);
        
        const closeScheduleFormBtn = document.getElementById('closeScheduleForm');
        if (closeScheduleFormBtn) {
            closeScheduleFormBtn.addEventListener('click', () => {
                closeScheduleForm();
            });
        }
        
        const cancelScheduleFormBtn = document.getElementById('cancelScheduleForm');
        if (cancelScheduleFormBtn) {
            cancelScheduleFormBtn.addEventListener('click', () => {
                closeScheduleForm();
            });
        }
        
        // Close schedule form modal when clicking backdrop
        const scheduleFormModal = document.getElementById('scheduleFormModal');
        if (scheduleFormModal) {
            scheduleFormModal.addEventListener('click', (e) => {
                if (e.target === scheduleFormModal) {
                    closeScheduleForm();
                }
            });
        }
        
        const scheduleForm = document.getElementById('scheduleForm');
        if (scheduleForm) scheduleForm.addEventListener('submit', handleScheduleSubmit);
        
        const scheduleType = document.getElementById('scheduleType');
        if (scheduleType) scheduleType.addEventListener('change', handleScheduleTypeChange);
        
        // Schedule form tabs (only add if elements exist)
        const showReposBtn = document.getElementById('showReposBtn');
        const showGroupsBtn = document.getElementById('showGroupsBtn');
        if (showReposBtn && showGroupsBtn) {
            showReposBtn.addEventListener('click', () => {
                const repoCheckboxes = document.getElementById('repoCheckboxes');
                const groupCheckboxes = document.getElementById('groupCheckboxes');
                if (repoCheckboxes) repoCheckboxes.classList.remove('hidden');
                if (groupCheckboxes) groupCheckboxes.classList.add('hidden');
                showReposBtn.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
                showReposBtn.classList.add('bg-blue-600', 'text-white');
                showGroupsBtn.classList.remove('bg-blue-600', 'text-white');
                showGroupsBtn.classList.add('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
            });
            showGroupsBtn.addEventListener('click', async () => {
                const repoCheckboxes = document.getElementById('repoCheckboxes');
                const groupCheckboxes = document.getElementById('groupCheckboxes');
                if (groupCheckboxes) groupCheckboxes.classList.remove('hidden');
                if (repoCheckboxes) repoCheckboxes.classList.add('hidden');
                showGroupsBtn.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
                showGroupsBtn.classList.add('bg-blue-600', 'text-white');
                showReposBtn.classList.remove('bg-blue-600', 'text-white');
                showReposBtn.classList.add('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
                
                // Load groups (will use cached data if already preloaded)
                await loadGroupsForSchedule(false);
            });
        }
    } catch (error) {
        console.error('Error initializing event listeners:', error);
        showToast('Error initializing event listeners: ' + error.message, 'error');
    }
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

// Load all repositories (with batch loading support)
let batchLoadingEnabled = true;
let batchSize = 25; // Increased default for better performance with many repos
let totalRepos = 0;
let loadedRepos = [];
let isLoadingBatches = false;

async function loadRepositories(forceRefresh = false) {
    // Check if batch loading is enabled from settings
    const useBatchLoading = batchLoadingEnabled && !forceRefresh;
    
    if (useBatchLoading) {
        await loadRepositoriesBatched(forceRefresh);
    } else {
        await loadRepositoriesAll(forceRefresh);
    }
}

// Load all repositories at once (original method)
async function loadRepositoriesAll(forceRefresh = false) {
    showLoading(true);
    
    try {
        // Don't send filter parameters - we'll filter client-side using cached data
        const params = new URLSearchParams();
        if (forceRefresh) params.append('force_refresh', 'true');
        
        const response = await fetch(`${API_BASE}/repos?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Repos API response:', data); // Debug log
        
        if (data.success) {
            allReposData = data.repos || [];
            console.log(`Loaded ${allReposData.length} repositories`); // Debug log
            if (allReposData.length > 0) {
                console.log('First repo:', allReposData[0]); // Debug log
            }
            // Apply filters to the loaded data (will show all if no filters)
            applyFiltersToCachedData(allReposData);
        } else {
            console.error('Failed to load repos:', data.error);
            showToast('Failed to load repositories: ' + (data.error || 'Unknown error'), 'error');
            renderRepositories([]); // Show empty state
        }
    } catch (error) {
        console.error('Error loading repositories:', error);
        showToast('Error loading repositories: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Load repositories in batches with progressive rendering
async function loadRepositoriesBatched(forceRefresh = false) {
    if (isLoadingBatches) {
        console.log('Batch loading already in progress, skipping...');
        return;
    }
    
    isLoadingBatches = true;
    showLoading(true);
    loadedRepos = [];
    
    try {
        // First, get total count (fast)
        const listResponse = await fetch(`${API_BASE}/repos/list`);
        const listData = await listResponse.json();
        
        if (!listData.success) {
            throw new Error(listData.error || 'Failed to get repository list');
        }
        
        totalRepos = listData.total || 0;
        updateLoadingProgress(0, totalRepos);
        
        if (totalRepos === 0) {
            renderRepositories([]);
            updateRepoCount(0);
            return;
        }
        
        // Clear container and show initial state
        const container = document.getElementById('reposContainer');
        if (container) {
            container.innerHTML = '';
            container.classList.remove('hidden');
        }
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.add('hidden');
        
        // Load batches progressively - optimized for speed with concurrent loading
        let batchIndex = 0;
        let hasMore = true;
        const maxConcurrentBatches = 3; // Load multiple batches concurrently
        const completedBatches = new Map(); // Track completed batches by index
        
        while (hasMore || completedBatches.size > 0) {
            // Start new batches up to maxConcurrentBatches
            const activeBatches = [];
            while (hasMore && activeBatches.length < maxConcurrentBatches) {
                const currentBatchIndex = batchIndex;
                const params = new URLSearchParams();
                params.append('batch', currentBatchIndex);
                params.append('batch_size', batchSize);
                if (forceRefresh) params.append('force_refresh', 'true');
                
                const batchPromise = fetch(`${API_BASE}/repos/batch?${params.toString()}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (!data.success) {
                            throw new Error(data.error || 'Failed to load batch');
                        }
                        return { batchIndex: currentBatchIndex, data };
                    });
                
                activeBatches.push(batchPromise);
                batchIndex++;
            }
            
            // Wait for all active batches to complete
            if (activeBatches.length > 0) {
                const results = await Promise.all(activeBatches);
                
                // Process results in order
                results.sort((a, b) => a.batchIndex - b.batchIndex);
                
                for (const { batchIndex: idx, data } of results) {
                    hasMore = data.has_more || false;
                    
                    // Add new repos to our list
                    if (data.repos && data.repos.length > 0) {
                        loadedRepos.push(...data.repos);
                        
                        // Render progressively (append new cards)
                        renderRepositoriesProgressive(data.repos);
                        
                        // Update progress
                        updateLoadingProgress(data.loaded || loadedRepos.length, data.total || totalRepos);
                    }
                }
            }
        }
        
        // Store loaded repos in allReposData for filtering
        allReposData = loadedRepos;
        
        // Apply filters after all repos are loaded (using cached data)
        applyFiltersToCachedData(loadedRepos);
        
        // Update final count (will be updated by applyFiltersToCachedData with filtered count)
        
    } catch (error) {
        console.error('Error loading repositories in batches:', error);
        showToast('Error loading repositories: ' + error.message, 'error');
        renderRepositories([]);
    } finally {
        showLoading(false);
        isLoadingBatches = false;
        hideLoadingProgress();
    }
}

// Render repositories progressively (append to existing) - optimized for performance
function renderRepositoriesProgressive(newRepos) {
    const container = document.getElementById('reposContainer');
    if (!container) return;
    
    // Use DocumentFragment for batch DOM updates (much faster)
    const fragment = document.createDocumentFragment();
    const elementsToAttach = [];
    
    newRepos.forEach(repo => {
        try {
            const cardHtml = createRepoCard(repo);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            const cardElement = tempDiv.firstElementChild;
            if (cardElement) {
                fragment.appendChild(cardElement);
                elementsToAttach.push({ element: cardElement, repo: repo });
            }
        } catch (error) {
            console.error('Error creating card for repo:', repo.name, error);
        }
    });
    
    // Append all at once (single DOM operation)
    container.appendChild(fragment);
    
    // Attach event listeners after DOM update (batch operation)
    elementsToAttach.forEach(({ element, repo }) => {
        const updateBtn = element.querySelector(`#updateBtn-${CSS.escape(repo.name)}`);
        if (updateBtn) {
            updateBtn.addEventListener('click', () => pullRepo(repo.name));
        }
        
        const detailsToggle = element.querySelector(`#detailsToggle-${CSS.escape(repo.name)}`);
        if (detailsToggle) {
            detailsToggle.addEventListener('click', () => toggleDetails(repo.name));
            initializeDetailsToggle(repo.name);
        }
        
        const branchToggle = element.querySelector(`#branchToggle-${CSS.escape(repo.name)}`);
        if (branchToggle) {
            branchToggle.addEventListener('click', () => toggleBranchList(repo.name));
        }
        
        const checkbox = element.querySelector(`#repoCheckbox-${CSS.escape(repo.name)}, .bulk-checkbox[data-repo="${CSS.escape(repo.name)}"]`);
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

// This function is now replaced by applyFiltersToCachedData
// Keeping for backwards compatibility but redirecting to new function
function applyFiltersToLoadedRepos() {
    const reposToFilter = allReposData && allReposData.length > 0 ? allReposData : loadedRepos;
    if (reposToFilter && reposToFilter.length > 0) {
        applyFiltersToCachedData(reposToFilter);
    }
}

// Update loading progress indicator
function updateLoadingProgress(loaded, total) {
    const progressContainer = document.getElementById('loadingProgressContainer');
    const progressBar = document.getElementById('loadingProgressBar');
    const progressText = document.getElementById('loadingProgressText');
    
    if (progressContainer) {
        progressContainer.classList.remove('hidden');
    }
    
    if (progressBar && progressText) {
        const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Loading repositories... ${loaded} / ${total} (${percentage}%)`;
    }
}

function hideLoadingProgress() {
    const progressBar = document.getElementById('loadingProgressBar');
    const progressText = document.getElementById('loadingProgressText');
    const progressContainer = document.getElementById('loadingProgressContainer');
    
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = 'Loading complete!';
    
    // Hide progress after a short delay
    setTimeout(() => {
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        if (progressText) {
            progressText.textContent = 'Loading repositories...';
        }
    }, 500);
}

function applyFilters() {
    // Use cached data instead of making new API calls
    // Check if we have data loaded (either from batch or all-at-once loading)
    const reposToFilter = allReposData && allReposData.length > 0 ? allReposData : loadedRepos;
    
    if (reposToFilter && reposToFilter.length > 0) {
        // Filter using cached data
        applyFiltersToCachedData(reposToFilter);
    } else {
        // No cached data available, need to load first
        loadRepositories();
    }
}

// Apply filters to cached repository data
function applyFiltersToCachedData(repos) {
    const search = document.getElementById('searchInput')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';
    const group = document.getElementById('groupFilter')?.value || '';
    const tag = document.getElementById('tagFilter')?.value || '';
    const sort = document.getElementById('sortSelect')?.value || '';
    
    let filtered = [...repos];
    
    if (search) {
        filtered = filtered.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    if (status) {
        filtered = filtered.filter(r => r.status?.state === status);
    }
    
    if (group) {
        filtered = filtered.filter(r => r.groups?.includes(group));
    }
    
    if (tag) {
        filtered = filtered.filter(r => r.tags?.includes(tag));
    }
    
    // Sort
    if (sort === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'status') {
        filtered.sort((a, b) => (a.status?.state || '').localeCompare(b.status?.state || ''));
    } else if (sort === 'date') {
        filtered.sort((a, b) => {
            const dateA = a.last_commit?.date || '';
            const dateB = b.last_commit?.date || '';
            return dateB.localeCompare(dateA);
        });
    }
    
    // Re-render with filtered results
    renderRepositories(filtered);
    
    // Update count badge with filtered count
    const countBadge = document.getElementById('repoCountBadge');
    if (countBadge) {
        countBadge.textContent = filtered.length;
    }
}

function updateRepoCount(count) {
    document.getElementById('repoCountBadge').textContent = count;
}

// Render repositories
function renderRepositories(repos) {
    const container = document.getElementById('reposContainer');
    const emptyState = document.getElementById('emptyState');
    
    console.log('Rendering repositories:', repos.length, repos); // Debug log
    
    if (!container) {
        console.error('reposContainer element not found!');
        showToast('Error: Repository container not found', 'error');
        return;
    }
    
    if (!emptyState) {
        console.error('emptyState element not found!');
    }
    
    if (!repos || repos.length === 0) {
        console.log('No repositories to display, showing empty state');
        container.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    console.log('Rendering', repos.length, 'repository cards');
    container.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    try {
        container.innerHTML = repos.map(repo => {
            try {
                return createRepoCard(repo);
            } catch (error) {
                console.error('Error creating card for repo:', repo.name, error);
                return `<div class="bg-red-100 dark:bg-red-900 p-4 rounded">Error rendering ${repo.name || 'unknown'}</div>`;
            }
        }).join('');
        console.log('Repository cards rendered successfully');
    } catch (error) {
        console.error('Error rendering repositories:', error);
        showToast('Error rendering repositories: ' + error.message, 'error');
    }
    
    // Attach event listeners
    repos.forEach(repo => {
        const updateBtn = document.getElementById(`updateBtn-${repo.name}`);
        if (updateBtn) {
            updateBtn.addEventListener('click', () => pullRepo(repo.name));
        }
        
        const detailsToggle = document.getElementById(`detailsToggle-${repo.name}`);
        if (detailsToggle) {
            detailsToggle.addEventListener('click', () => toggleDetails(repo.name));
            initializeDetailsToggle(repo.name);
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
    const bulkSelectEnabled = document.getElementById('bulkSelectToggle')?.checked;
    const bulkCheckbox = bulkSelectEnabled
        ? `<input type="checkbox" id="bulkCheckbox-${escapeHtml(repo.name)}" class="bulk-checkbox w-4 h-4 text-blue-600 rounded" data-repo="${escapeHtml(repo.name)}" ${isSelected ? 'checked' : ''}>`
        : '';
    
    return `
        <div id="repoCard-${escapeHtml(repo.name)}" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 repo-card${updateClass} transition-all border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    ${bulkCheckbox}
                    <div class="p-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg shadow-sm">
                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-black dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors" onclick="openRepoDetails('${escapeHtml(repo.name)}')" title="${escapeHtml(repo.name)}">${escapeHtml(repo.name)}</h3>
                </div>
                <div class="ml-2 flex-shrink-0 flex items-center gap-2">
                    ${statusBadge}
                    <button id="detailsToggle-${repo.name}" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="Toggle details">
                        <svg class="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div id="repoDetails-${repo.name}" class="space-y-3">
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
            </div>
            
            ${(repo.local_branches && repo.local_branches.length > 0) || (repo.remote_branches && repo.remote_branches.length > 0) ? `
            <div class="border-t dark:border-gray-700 pt-3 mt-3">
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
            
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700 mt-3">
                <button id="updateBtn-${repo.name}" class="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Update Repository
                </button>
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
function toggleDetails(repoName) {
    const detailsSection = document.getElementById(`repoDetails-${repoName}`);
    const toggle = document.getElementById(`detailsToggle-${repoName}`);
    
    if (!detailsSection || !toggle) return;
    
    const svg = toggle.querySelector('svg');
    if (detailsSection.classList.contains('hidden')) {
        detailsSection.classList.remove('hidden');
        if (svg) svg.style.transform = 'rotate(180deg)';
    } else {
        detailsSection.classList.add('hidden');
        if (svg) svg.style.transform = 'rotate(0deg)';
    }
}

// Initialize details toggle state (expanded by default)
function initializeDetailsToggle(repoName) {
    const toggle = document.getElementById(`detailsToggle-${repoName}`);
    if (toggle) {
        const svg = toggle.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(180deg)'; // Point down when expanded
    }
}

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
async function pullRepo(repoName, pullStrategy = null) {
    // Check if repo is diverged and show strategy selector if no strategy provided
    if (!pullStrategy) {
        const repo = allReposData.find(r => r.name === repoName);
        if (repo && repo.status && repo.status.state === 'diverged') {
            // Show strategy selector modal
            return showDivergedStrategyModal(repoName);
        }
    }
    
    const btn = document.getElementById(`updateBtn-${repoName}`);
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.classList.add('btn-loading');
        btn.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Updating...';
        btn.disabled = true;
    }
    
    try {
        const requestBody = pullStrategy ? { pull_strategy: pullStrategy } : {};
        const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoName)}/pull`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully updated ${repoName}`, 'success');
            
            // Update only this specific repo in the UI if we have the updated data
            if (data.repo) {
                updateSingleRepo(data.repo);
            } else {
                // Fallback: fetch just this repo's status if not included in response
                await refreshSingleRepo(repoName);
            }
        } else {
            showToast(`Failed to update ${repoName}: ${data.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error updating ${repoName}: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.classList.remove('btn-loading');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Track current diverged repo being handled
let currentDivergedRepo = null;

// Show diverged strategy selection modal
function showDivergedStrategyModal(repoName) {
    const modal = document.getElementById('divergedStrategyModal');
    const repoNameElement = document.getElementById('divergedRepoName');
    
    if (repoNameElement) {
        repoNameElement.textContent = repoName;
    }
    
    // Reset to default strategy (merge)
    const mergeRadio = document.querySelector('input[name="divergedStrategy"][value="merge"]');
    if (mergeRadio) {
        mergeRadio.checked = true;
    }
    
    currentDivergedRepo = repoName;
    modal.classList.remove('hidden');
}

// Initialize diverged strategy modal event listeners (call once on page load)
function initDivergedStrategyModal() {
    const modal = document.getElementById('divergedStrategyModal');
    const confirmBtn = document.getElementById('confirmDivergedStrategy');
    const cancelBtn = document.getElementById('cancelDivergedStrategy');
    const closeBtn = document.getElementById('closeDivergedStrategyModal');
    
    const closeModal = () => {
        modal.classList.add('hidden');
        currentDivergedRepo = null;
    };
    
    const handleConfirm = () => {
        if (!currentDivergedRepo) return;
        
        const selectedStrategy = document.querySelector('input[name="divergedStrategy"]:checked')?.value || 'merge';
        closeModal();
        pullRepo(currentDivergedRepo, selectedStrategy);
    };
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleConfirm);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close on backdrop click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// Update a single repository card in the UI
function updateSingleRepo(repo) {
    // Find the existing repo in allReposData and update it
    const index = allReposData.findIndex(r => r.name === repo.name);
    if (index !== -1) {
        allReposData[index] = repo;
    } else {
        // If not found, add it
        allReposData.push(repo);
    }
    
    // Find the card element and replace it
    const cardId = `repoCard-${repo.name}`;
    const existingCard = document.getElementById(cardId);
    
    if (existingCard) {
        // Replace the card HTML
        const newCardHtml = createRepoCard(repo);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCardHtml;
        const newCard = tempDiv.firstElementChild;
        
        if (newCard) {
            existingCard.replaceWith(newCard);
            
            // Re-attach event listeners
            const updateBtn = document.getElementById(`updateBtn-${repo.name}`);
            if (updateBtn) {
                updateBtn.addEventListener('click', () => pullRepo(repo.name));
            }
            
            const detailsToggle = document.getElementById(`detailsToggle-${repo.name}`);
            if (detailsToggle) {
                detailsToggle.addEventListener('click', () => toggleDetails(repo.name));
            }
            
            const branchToggle = document.getElementById(`branchToggle-${repo.name}`);
            if (branchToggle) {
                branchToggle.addEventListener('click', () => toggleBranchList(repo.name));
            }
            
            const checkbox = document.getElementById(`repoCheckbox-${repo.name}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedRepos.add(repo.name);
                    } else {
                        selectedRepos.delete(repo.name);
                    }
                });
            }
            
            // Re-attach bulk checkbox if bulk selection is enabled
            const bulkCheckbox = document.getElementById(`bulkCheckbox-${repo.name}`);
            if (bulkCheckbox) {
                bulkCheckbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedRepos.add(repo.name);
                    } else {
                        selectedRepos.delete(repo.name);
                    }
                });
            }
        }
    } else {
        // Card doesn't exist, re-render all repos (shouldn't happen often)
        renderRepositories(allReposData);
    }
    
    // Update count badge
    const countBadge = document.getElementById('repoCountBadge');
    if (countBadge) {
        countBadge.textContent = allReposData.length;
    }
}

// Refresh a single repository's data from the server
async function refreshSingleRepo(repoName) {
    try {
        const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoName)}/status?force_refresh=true`);
        const data = await response.json();
        
        if (data.success && data.repo) {
            updateSingleRepo(data.repo);
        }
    } catch (error) {
        console.error(`Error refreshing repo ${repoName}:`, error);
        // Fallback to full reload if single refresh fails
        loadRepositories(true);
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
        
        // Reload repositories with force refresh to bypass cache and show updated status
        setTimeout(() => loadRepositories(true), 1000);
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
    // Force reload schedules when modal opens - add cache busting
    await loadSchedules(true);
}

function closeSchedulesModal() {
    document.getElementById('schedulesModal').classList.add('hidden');
}

async function loadSchedules(forceRefresh = false) {
    try {
        // Add cache busting parameter to ensure fresh data
        const url = forceRefresh 
            ? `${API_BASE}/schedules?t=${Date.now()}`
            : `${API_BASE}/schedules`;
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            console.log('Loaded schedules:', data.schedules); // Debug log
            renderSchedules(data.schedules || []);
        } else {
            console.error('Failed to load schedules:', data.error);
            showToast('Failed to load schedules: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error loading schedules:', error);
        showToast('Error loading schedules: ' + error.message, 'error');
    }
}

function renderSchedules(schedules) {
    const container = document.getElementById('schedulesList');
    
    // Ensure schedules is an array
    if (!Array.isArray(schedules)) {
        console.error('Schedules is not an array:', schedules);
        schedules = [];
    }
    
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
                    <span class="text-gray-600 dark:text-gray-400">${(schedule.repos || []).length > 0 ? schedule.repos.join(', ') : 'None'}</span>
                </div>
                ${(schedule.groups || []).length > 0 ? `
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">Groups:</span>
                    <div class="flex flex-wrap gap-1">
                        ${schedule.groups.map(g => `<span class="px-2 py-1 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded text-xs font-medium">${escapeHtml(g)}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
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
            // Force refresh after toggle
            await loadSchedules(true);
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
            // Force refresh after delete
            await loadSchedules(true);
        } else {
            console.error('Failed to delete schedule:', data.error);
            showToast('Failed to delete schedule: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting schedule:', error);
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
                await openScheduleForm(schedule);
            }
        }
    } catch (error) {
        showToast('Error loading schedule: ' + error.message, 'error');
    }
}

async function openNewScheduleForm() {
    currentEditingSchedule = null;
    await openScheduleForm();
}

async function openScheduleForm(schedule = null) {
    // Set currentEditingSchedule before doing anything else
    currentEditingSchedule = schedule;
    
    document.getElementById('scheduleFormTitle').textContent = schedule ? 'Edit Schedule' : 'New Schedule';
    document.getElementById('scheduleFormModal').classList.remove('hidden');
    
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
        
        // Load repos/groups after form is populated so checkboxes can be checked
        await loadReposForSchedule();
    } else {
        // Reset form
        document.getElementById('scheduleForm').reset();
        handleScheduleTypeChange();
        await loadReposForSchedule();
    }
}

function closeScheduleForm() {
    document.getElementById('scheduleFormModal').classList.add('hidden');
    currentEditingSchedule = null;
    // Clear cached groups data when form is closed to ensure fresh data on next open
    cachedGroupsData = null;
    groupsLoadingPromise = null;
}

// Track groups data and loading state
let cachedGroupsData = null;
let groupsLoadingPromise = null;

async function loadReposForSchedule() {
    try {
        // Load repos and preload groups in parallel (groups will be cached on backend)
        const reposResponse = await fetch(`${API_BASE}/repos`);
        const reposData = await reposResponse.json();
        
        // Get selected repos from current editing schedule
        const selectedRepos = currentEditingSchedule && currentEditingSchedule.repos ? currentEditingSchedule.repos : [];
        
        if (reposData.success && reposData.repos) {
            const container = document.getElementById('repoCheckboxes');
            if (container) {
                container.innerHTML = reposData.repos.map(repo => {
                    const isSelected = selectedRepos.includes(repo.name);
                    return `
                        <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                            <input type="checkbox" value="${escapeHtml(repo.name)}" 
                                   ${isSelected ? 'checked' : ''}
                                   class="schedule-repo-checkbox w-4 h-4 text-blue-600 rounded">
                            <span class="text-gray-700 dark:text-gray-300">${escapeHtml(repo.name)}</span>
                        </label>
                    `;
                }).join('');
            }
        }
        
        // Preload groups in the background (non-blocking)
        // This will use cached data if available, making it fast
        loadGroupsForSchedule(true); // true = preload mode (don't render yet)
    } catch (error) {
        console.error('Error loading repositories for schedule:', error);
        showToast('Error loading repositories: ' + error.message, 'error');
    }
}

async function loadGroupsForSchedule(preloadOnly = false) {
    // If groups are already cached, use them immediately
    if (cachedGroupsData) {
        if (!preloadOnly) {
            renderGroupsForSchedule(cachedGroupsData);
        }
        return;
    }
    
    // If groups are already loading, wait for that promise
    if (groupsLoadingPromise) {
        try {
            const groupsData = await groupsLoadingPromise;
            if (!preloadOnly) {
                renderGroupsForSchedule(groupsData);
            }
        } catch (error) {
            if (!preloadOnly) {
                showGroupsError();
            }
        }
        return;
    }
    
    // Start loading groups
    groupsLoadingPromise = (async () => {
        try {
            const container = document.getElementById('groupCheckboxes');
            if (!preloadOnly && container) {
                container.innerHTML = '<div class="text-center py-4 text-gray-500 dark:text-gray-400">Loading groups...</div>';
            }
            
            const groupsResponse = await fetch(`${API_BASE}/groups`);
            const groupsData = await groupsResponse.json();
            
            if (groupsData.success && groupsData.groups) {
                // Cache the groups data
                cachedGroupsData = groupsData.groups;
                
                if (!preloadOnly) {
                    renderGroupsForSchedule(groupsData.groups);
                }
                return groupsData.groups;
            } else {
                if (!preloadOnly) {
                    showGroupsError('No groups found');
                }
                return null;
            }
        } catch (error) {
            console.error('Error loading groups for schedule:', error);
            if (!preloadOnly) {
                showGroupsError('Error loading groups');
            }
            throw error;
        } finally {
            groupsLoadingPromise = null;
        }
    })();
    
    try {
        await groupsLoadingPromise;
    } catch (error) {
        // Error already handled in the promise
    }
}

function renderGroupsForSchedule(groups) {
    const container = document.getElementById('groupCheckboxes');
    if (!container) return;
    
    // Get selected groups from current editing schedule
    const selectedGroups = currentEditingSchedule && currentEditingSchedule.groups ? currentEditingSchedule.groups : [];
    
    if (groups && groups.length > 0) {
        container.innerHTML = groups.map(group => {
            const isSelected = selectedGroups.includes(group.name);
            return `
                <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                    <input type="checkbox" value="group:${escapeHtml(group.name)}" 
                           ${isSelected ? 'checked' : ''}
                           class="schedule-group-checkbox w-4 h-4 text-pink-600 rounded">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${group.color || '#3B82F6'}"></div>
                        <span class="text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(group.name)}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">(${(group.repos || []).length} repos)</span>
                    </div>
                </label>
            `;
        }).join('');
    } else {
        container.innerHTML = '<div class="text-center py-4 text-gray-500 dark:text-gray-400">No groups found</div>';
    }
}

function showGroupsError(message = 'Error loading groups') {
    const container = document.getElementById('groupCheckboxes');
    if (container) {
        container.innerHTML = `<div class="text-center py-4 text-red-500">${message}</div>`;
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
    const selectedGroups = Array.from(document.querySelectorAll('.schedule-group-checkbox:checked')).map(cb => cb.value.replace('group:', ''));
    
    if (!name || (selectedRepos.length === 0 && selectedGroups.length === 0)) {
        showToast('Please provide a name and select at least one repository or group', 'error');
        return;
    }
    
    const scheduleData = {
        name,
        repos: selectedRepos,
        groups: selectedGroups,  // Include groups separately
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
            // Reload schedules to update the list - force refresh
            await loadSchedules(true);
        } else {
            console.error('Failed to save schedule:', data.error);
            showToast('Failed to save schedule: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving schedule: ' + error.message, 'error');
    }
}


// Statistics Dashboard
async function loadStats() {
    const container = document.getElementById('statsContent');
    if (!container) {
        console.error('statsContent element not found!');
        return;
    }
    
    // Show loading state
    container.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading statistics...</div>';
    
    try {
        // Load both stats and cache stats with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let statsResponse, cacheResponse;
        try {
            [statsResponse, cacheResponse] = await Promise.all([
                fetch(`${API_BASE}/stats`, { signal: controller.signal }),
                fetch(`${API_BASE}/cache/stats`, { signal: controller.signal })
            ]);
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw fetchError;
        }
        
        if (!statsResponse.ok) {
            throw new Error(`HTTP error! status: ${statsResponse.status}`);
        }
        
        const statsData = await statsResponse.json();
        const cacheData = cacheResponse.ok ? await cacheResponse.json() : { success: false };
        
        console.log('Stats data:', statsData); // Debug log
        console.log('Cache data:', cacheData); // Debug log
        
        if (statsData.success) {
            renderStats(statsData.stats, cacheData.success ? cacheData.stats : null);
            
            // Show message if stats are from cache or if no cache available
            if (statsData.stats && statsData.stats.message) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center';
                messageDiv.innerHTML = `<p class="text-sm text-yellow-800 dark:text-yellow-200">${statsData.stats.message}</p>`;
                container.appendChild(messageDiv);
            }
        } else {
            console.error('Failed to load stats:', statsData.error);
            container.innerHTML = `<div class="text-center py-8 text-red-500 dark:text-red-400">Error loading statistics: ${statsData.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        const errorMessage = error.message || 'Failed to fetch statistics. Please check your connection and try again.';
        container.innerHTML = `<div class="text-center py-8 text-red-500 dark:text-red-400">
            <div class="mb-2">Error loading statistics</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">${errorMessage}</div>
        </div>`;
    }
}

function renderStats(stats, cacheStats) {
    const container = document.getElementById('statsContent');
    if (!container) {
        console.error('statsContent element not found!');
        return;
    }
    
    if (!stats) {
        console.error('No stats data provided');
        container.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No statistics available</div>';
        return;
    }
    
    const statusCounts = stats.status_counts || {};
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- Total Repositories -->
            <div class="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 dark:from-blue-600 dark:via-blue-700 dark:to-blue-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border border-blue-400/20 dark:border-blue-500/30 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 bg-white/20 dark:bg-white/10 rounded-xl backdrop-blur-sm">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="text-4xl font-extrabold text-white mb-2">${stats.total_repos || 0}</div>
                    <div class="text-sm font-semibold text-blue-100 uppercase tracking-wide">Total Repositories</div>
                </div>
            </div>
            
            <!-- Up to Date -->
            <div class="relative bg-gradient-to-br from-green-500 via-green-600 to-green-700 dark:from-green-600 dark:via-green-700 dark:to-green-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border border-green-400/20 dark:border-green-500/30 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 bg-white/20 dark:bg-white/10 rounded-xl backdrop-blur-sm">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="text-4xl font-extrabold text-white mb-2">${statusCounts.up_to_date || 0}</div>
                    <div class="text-sm font-semibold text-green-100 uppercase tracking-wide">Up to Date</div>
                </div>
            </div>
            
            <!-- Behind -->
            <div class="relative bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 dark:from-orange-600 dark:via-orange-700 dark:to-orange-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border border-orange-400/20 dark:border-orange-500/30 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 bg-white/20 dark:bg-white/10 rounded-xl backdrop-blur-sm">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="text-4xl font-extrabold text-white mb-2">${statusCounts.behind || 0}</div>
                    <div class="text-sm font-semibold text-orange-100 uppercase tracking-wide">Behind</div>
                </div>
            </div>
            
            <!-- Diverged -->
            <div class="relative bg-gradient-to-br from-red-500 via-red-600 to-red-700 dark:from-red-600 dark:via-red-700 dark:to-red-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border border-red-400/20 dark:border-red-500/30 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 bg-white/20 dark:bg-white/10 rounded-xl backdrop-blur-sm">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="text-4xl font-extrabold text-white mb-2">${statusCounts.diverged || 0}</div>
                    <div class="text-sm font-semibold text-red-100 uppercase tracking-wide">Diverged</div>
                </div>
            </div>
            
            ${cacheStats ? `
            <!-- Cache Statistics -->
            <div id="cacheStatsCard" class="relative bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 dark:from-purple-600 dark:via-purple-700 dark:to-purple-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border border-purple-400/20 dark:border-purple-500/30 overflow-hidden md:col-span-2 lg:col-span-1 cursor-pointer" onclick="openCacheDetailsModal()">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 bg-white/20 dark:bg-white/10 rounded-xl backdrop-blur-sm">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="text-4xl font-extrabold text-white mb-2">${cacheStats.hit_rate}%</div>
                    <div class="text-sm font-semibold text-purple-100 uppercase tracking-wide mb-4">Cache Hit Rate</div>
                    <div class="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
                        <div class="text-center">
                            <div class="text-lg font-bold text-white">${cacheStats.hits}</div>
                            <div class="text-xs text-purple-100 uppercase tracking-wide">Hits</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-bold text-white">${cacheStats.misses}</div>
                            <div class="text-xs text-purple-100 uppercase tracking-wide">Misses</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-bold text-white">${cacheStats.entries}</div>
                            <div class="text-xs text-purple-100 uppercase tracking-wide">Entries</div>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-white/20 text-center">
                        <div class="text-xs text-purple-200 italic">Click for details</div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function toggleStatsDashboard() {
    const dashboard = document.getElementById('statsDashboard');
    dashboard.classList.toggle('hidden');
    if (!dashboard.classList.contains('hidden')) {
        loadStats();
    }
}

// Cache Details Modal
async function openCacheDetailsModal() {
    const modal = document.getElementById('cacheDetailsModal');
    modal.classList.remove('hidden');
    await loadCacheDetails();
}

function closeCacheDetailsModal() {
    document.getElementById('cacheDetailsModal').classList.add('hidden');
}

async function loadCacheDetails() {
    try {
        const response = await fetch(`${API_BASE}/cache/stats`);
        const data = await response.json();
        
        if (data.success) {
            renderCacheDetails(data.stats);
        } else {
            showToast('Failed to load cache details: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error loading cache details: ' + error.message, 'error');
    }
}

function renderCacheDetails(cacheStats) {
    const container = document.getElementById('cacheDetailsContent');
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = cacheStats.hit_rate || 0;
    const missRate = totalRequests > 0 ? ((cacheStats.misses / totalRequests) * 100).toFixed(2) : 0;
    
    // Calculate TTL in minutes
    const ttlMinutes = Math.floor(cacheStats.ttl_seconds / 60);
    const ttlSeconds = cacheStats.ttl_seconds % 60;
    const ttlDisplay = ttlMinutes > 0 ? `${ttlMinutes}m ${ttlSeconds}s` : `${ttlSeconds}s`;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Overview Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-4 rounded-xl border border-green-200 dark:border-green-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-green-700 dark:text-green-300">Cache Hits</div>
                        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div class="text-3xl font-bold text-green-800 dark:text-green-100">${cacheStats.hits}</div>
                    <div class="text-xs text-green-600 dark:text-green-400 mt-1">${hitRate}% of requests</div>
                </div>
                
                <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 p-4 rounded-xl border border-orange-200 dark:border-orange-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-orange-700 dark:text-orange-300">Cache Misses</div>
                        <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div class="text-3xl font-bold text-orange-800 dark:text-orange-100">${cacheStats.misses}</div>
                    <div class="text-xs text-orange-600 dark:text-orange-400 mt-1">${missRate}% of requests</div>
                </div>
                
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-4 rounded-xl border border-blue-200 dark:border-blue-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-blue-700 dark:text-blue-300">Cache Entries</div>
                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                        </svg>
                    </div>
                    <div class="text-3xl font-bold text-blue-800 dark:text-blue-100">${cacheStats.entries}</div>
                    <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">Currently cached</div>
                </div>
            </div>
            
            <!-- Performance Metrics -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Performance Metrics</h3>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Hit Rate</span>
                            <span class="text-sm font-bold text-gray-900 dark:text-white">${hitRate}%</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                            <div class="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300" style="width: ${hitRate}%"></div>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Miss Rate</span>
                            <span class="text-sm font-bold text-gray-900 dark:text-white">${missRate}%</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                            <div class="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-300" style="width: ${missRate}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Cache Configuration -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Cache Configuration</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Time-to-Live (TTL)</div>
                        <div class="text-xl font-bold text-gray-800 dark:text-white">${ttlDisplay}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${cacheStats.ttl_seconds} seconds</div>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Requests</div>
                        <div class="text-xl font-bold text-gray-800 dark:text-white">${totalRequests}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Hits + Misses</div>
                    </div>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-3">
                <button onclick="clearCache()" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95">
                    <span class="flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Clear Cache
                    </span>
                </button>
                <button onclick="loadCacheDetails()" class="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95">
                    <span class="flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                    </span>
                </button>
            </div>
        </div>
    `;
}

async function clearCache() {
    try {
        const response = await fetch(`${API_BASE}/cache/clear`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Cache cleared successfully', 'success');
            await loadCacheDetails();
            // Also refresh stats if dashboard is open
            const dashboard = document.getElementById('statsDashboard');
            if (!dashboard.classList.contains('hidden')) {
                await loadStats();
            }
        } else {
            showToast('Failed to clear cache: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error clearing cache: ' + error.message, 'error');
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

// Repository details modal close handler
const closeRepoDetailsBtn = document.getElementById('closeRepoDetails');
if (closeRepoDetailsBtn) {
    closeRepoDetailsBtn.addEventListener('click', () => {
        const repoDetailsModal = document.getElementById('repoDetailsModal');
        if (repoDetailsModal) repoDetailsModal.classList.add('hidden');
    });
}

// Close repo details modal when clicking backdrop
const repoDetailsModal = document.getElementById('repoDetailsModal');
if (repoDetailsModal) {
    repoDetailsModal.addEventListener('click', (e) => {
        if (e.target === repoDetailsModal) {
            repoDetailsModal.classList.add('hidden');
        }
    });
}

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

async function bulkAddToGroup() {
    const repos = Array.from(selectedRepos);
    if (repos.length === 0) {
        showToast('Please select repositories first', 'error');
        return;
    }
    
    // Open groups modal and show bulk add option
    await openGroupsModal();
    // You can add a bulk add interface here, or just let users add to existing groups
    showToast(`Selected ${repos.length} repositories. Use Groups modal to add them to a group.`, 'info');
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

// Groups Management
let currentEditingGroup = null;
let allReposForGroups = [];

async function openGroupsModal() {
    document.getElementById('groupsModal').classList.remove('hidden');
    await loadGroups();
}

function closeGroupsModal() {
    document.getElementById('groupsModal').classList.add('hidden');
}

async function loadGroups() {
    try {
        const response = await fetch(`${API_BASE}/groups?t=${Date.now()}`, {
            cache: 'no-cache'
        });
        const data = await response.json();
        
        if (data.success) {
            renderGroups(data.groups || []);
        } else {
            showToast('Failed to load groups: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        showToast('Error loading groups: ' + error.message, 'error');
    }
}

function renderGroups(groups) {
    const container = document.getElementById('groupsList');
    
    if (!Array.isArray(groups)) {
        groups = [];
    }
    
    if (groups.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                </div>
                <p class="text-gray-500 dark:text-gray-400">No groups configured.</p>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "New Group" to create one.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = groups.map(group => `
        <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md hover:shadow-lg transition-all">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="p-2 rounded-lg" style="background-color: ${group.color || '#3B82F6'}">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">${escapeHtml(group.name)}</h3>
                </div>
                <div class="flex gap-2">
                    ${(group.repos || []).length > 0 ? `
                    <button onclick="updateGroupRepos('${group.id}')" class="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 text-sm font-medium shadow-sm hover:shadow transition-all">
                        Update All
                    </button>
                    ` : ''}
                    <button onclick="editGroup('${group.id}')" class="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-sm hover:shadow transition-all">
                        Edit
                    </button>
                    <button onclick="deleteGroup('${group.id}')" class="px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm font-medium shadow-sm hover:shadow transition-all">
                        Delete
                    </button>
                </div>
            </div>
            <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">Repositories:</span>
                    <span class="text-gray-600 dark:text-gray-400">${(group.repos || []).length} repository${(group.repos || []).length !== 1 ? 's' : ''}</span>
                </div>
                ${(group.repos || []).length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-2">
                    ${group.repos.map(repo => `
                        <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">${escapeHtml(repo)}</span>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function openNewGroupForm() {
    currentEditingGroup = null;
    openGroupForm();
}

function openGroupForm(group = null) {
    document.getElementById('groupFormTitle').textContent = group ? 'Edit Group' : 'New Group';
    document.getElementById('groupFormModal').classList.remove('hidden');
    
    // Load repos for checkboxes
    loadReposForGroup();
    
    if (group) {
        // Populate form with group data
        document.getElementById('groupName').value = group.name || '';
        document.getElementById('groupColor').value = group.color || '#3B82F6';
        currentEditingGroup = group;
    } else {
        // Reset form
        document.getElementById('groupForm').reset();
        document.getElementById('groupColor').value = '#3B82F6';
        currentEditingGroup = null;
    }
}

function closeGroupForm() {
    document.getElementById('groupFormModal').classList.add('hidden');
    currentEditingGroup = null;
}

async function loadReposForGroup() {
    try {
        const response = await fetch(`${API_BASE}/repos`);
        const data = await response.json();
        
        if (data.success) {
            allReposForGroups = data.repos;
            const container = document.getElementById('groupRepoCheckboxes');
            container.innerHTML = data.repos.map(repo => `
                <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                    <input type="checkbox" value="${escapeHtml(repo.name)}" 
                           ${currentEditingGroup && (currentEditingGroup.repos || []).includes(repo.name) ? 'checked' : ''}
                           class="group-repo-checkbox w-4 h-4 text-pink-600 rounded">
                    <span class="text-gray-700 dark:text-gray-300">${escapeHtml(repo.name)}</span>
                </label>
            `).join('');
        }
    } catch (error) {
        showToast('Error loading repositories', 'error');
    }
}

async function handleGroupSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('groupName').value;
    const color = document.getElementById('groupColor').value;
    const selectedRepos = Array.from(document.querySelectorAll('.group-repo-checkbox:checked')).map(cb => cb.value);
    
    if (!name) {
        showToast('Please provide a group name', 'error');
        return;
    }
    
    const groupData = {
        name,
        repos: selectedRepos,
        color
    };
    
    try {
        const url = currentEditingGroup 
            ? `${API_BASE}/groups/${currentEditingGroup.id}`
            : `${API_BASE}/groups`;
        const method = currentEditingGroup ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Group ${currentEditingGroup ? 'updated' : 'created'} successfully`, 'success');
            closeGroupForm();
            await loadGroups();
            await loadGroupsAndTags(); // Refresh filter dropdown
            await loadRepositories(); // Refresh repo list to show new groups
        } else {
            showToast('Failed to save group: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving group: ' + error.message, 'error');
    }
}

async function editGroup(groupId) {
    try {
        const response = await fetch(`${API_BASE}/groups`);
        const data = await response.json();
        
        if (data.success) {
            const group = data.groups.find(g => g.id === groupId);
            if (group) {
                currentEditingGroup = group;
                openGroupForm(group);
            }
        }
    } catch (error) {
        showToast('Error loading group: ' + error.message, 'error');
    }
}

async function deleteGroup(groupId) {
    if (!confirm('Are you sure you want to delete this group?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/groups/${groupId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Group deleted', 'success');
            await loadGroups();
            await loadGroupsAndTags(); // Refresh filter dropdown
            await loadRepositories(); // Refresh repo list
        } else {
            showToast('Failed to delete group: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error deleting group: ' + error.message, 'error');
    }
}

async function updateGroupRepos(groupId) {
    // Get group info to show name in confirmation
    let groupName = 'this group';
    try {
        const groupsResponse = await fetch(`${API_BASE}/groups`);
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
            const group = groupsData.groups.find(g => g.id === groupId);
            if (group) {
                groupName = group.name;
            }
        }
    } catch (e) {
        // Ignore error, just use default name
    }
    
    if (!confirm(`Update all repositories in "${groupName}"?`)) return;
    
    try {
        showToast('Updating repositories in group...', 'info');
        
        const response = await fetch(`${API_BASE}/groups/${groupId}/pull-all`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success || data.results) {
            const successCount = data.results.filter(r => r.success).length;
            const totalCount = data.results.length;
            
            if (successCount === totalCount) {
                showToast(`Successfully updated all ${totalCount} repository${totalCount !== 1 ? 's' : ''} in group`, 'success');
            } else {
                showToast(`Updated ${successCount} of ${totalCount} repositories in group`, 'warning');
            }
            
            // Update individual repos in the UI if we have updated repo data
            if (data.updated_repos && Array.isArray(data.updated_repos)) {
                for (const repo of data.updated_repos) {
                    updateSingleRepo(repo);
                }
            } else {
                // Fallback: refresh all repos if we don't have individual updates
                await loadRepositories(true);
            }
            
            // Refresh groups to update the "Behind" group if needed
            await loadGroups();
        } else {
            showToast('Failed to update group repositories: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error updating group repositories: ' + error.message, 'error');
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
            document.getElementById('settingsBatchSize').value = settings.batch_size || 25;
            document.getElementById('settingsParallelWorkers').value = settings.parallel_workers || 10;
            
            // Update batch loading settings
            batchSize = settings.batch_size || 25;
            batchLoadingEnabled = true; // Enable by default
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
    const batchSize = parseInt(document.getElementById('settingsBatchSize').value);
    const parallelWorkers = parseInt(document.getElementById('settingsParallelWorkers').value);
    
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
    
    if (batchSize < 5 || batchSize > 50) {
        showToast('Batch size must be between 5 and 50', 'error');
        return;
    }
    
    if (parallelWorkers < 1 || parallelWorkers > 20) {
        showToast('Parallel workers must be between 1 and 20', 'error');
        return;
    }
    
    // Update local batch size immediately
    batchSize = batchSize;
    
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
                cache_ttl_seconds: cacheTtl,
                batch_size: batchSize,
                parallel_workers: parallelWorkers
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

