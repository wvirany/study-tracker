// Configuration
const currentYear = new Date().getFullYear();
const localStorageKey = `studyData_${currentYear}`;
const tokenKey = 'github_token';
const gistIdKey = `gist_id_${currentYear}`;

// State
let studyData = {};
let githubToken = localStorage.getItem(tokenKey);
let gistId = localStorage.getItem(gistIdKey);

// Initialize the app
function initializeApp() {
    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();
    
    // Load existing data
    loadData();
    
    // Set up form submission handler
    document.getElementById('studyForm').addEventListener('submit', handleFormSubmission);
    
    // Set up modal click handler
    window.onclick = function(event) {
        const modal = document.getElementById('settingsModal');
        if (event.target === modal) {
            closeSettingsModal();
        }
    }
}

function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const tokenInput = document.getElementById('tokenInput');
    
    // Pre-fill current token (partially hidden for security)
    if (githubToken) {
        tokenInput.value = githubToken;
        tokenInput.setAttribute('data-full-token', githubToken);
    } else {
        tokenInput.value = '';
        tokenInput.removeAttribute('data-full-token');
    }
    
    modal.style.display = 'block';
    
    // Focus on token input
    setTimeout(() => tokenInput.focus(), 100);
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveToken() {
    const tokenInput = document.getElementById('tokenInput');
    const newToken = tokenInput.value.trim();
    
    if (!newToken) {
        alert('Please enter a valid GitHub token');
        return;
    }
    
    // If it's the masked version, use the full token
    if (newToken.endsWith('...') && tokenInput.hasAttribute('data-full-token')) {
        githubToken = tokenInput.getAttribute('data-full-token');
    } else {
        githubToken = newToken;
    }
    
    localStorage.setItem(tokenKey, githubToken);
    localStorage.removeItem(gistIdKey); // Reset gist ID to find/create new one
    gistId = null;
    
    closeSettingsModal();
    loadDataFromGist(); // Reload with new token
}

function clearToken() {
    if (confirm('Clear your GitHub token? You\'ll only have local storage.')) {
        githubToken = null;
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(gistIdKey);
        gistId = null;
        updateSyncStatus('🔧 Token cleared - using local storage only');
        closeSettingsModal();
    }
}

function updateSyncStatus(message, type = 'synced') {
    const status = document.getElementById('syncStatus');
    status.textContent = message;
    status.className = `sync-status ${type}`;
}

async function loadDataFromGist() {
    if (!githubToken) {
        loadLocalData();
        return;
    }
    
    updateSyncStatus('Loading data from cloud...', 'syncing');
    
    try {
        // First, try to find existing gist
        if (!gistId) {
            const gistsResponse = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (gistsResponse.ok) {
                const gists = await gistsResponse.json();
                const studyGist = gists.find(g => 
                    g.files[`study-data-${currentYear}.json`] !== undefined
                );
                
                if (studyGist) {
                    gistId = studyGist.id;
                    localStorage.setItem(gistIdKey, gistId);
                }
            }
        }
        
        // Load data from existing gist
        if (gistId) {
            const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (gistResponse.ok) {
                const gist = await gistResponse.json();
                const file = gist.files[`study-data-${currentYear}.json`];
                if (file) {
                    const data = JSON.parse(file.content);
                    studyData = data.studyData || {};
                    updateSyncStatus('✅ Synced with cloud');
                }
            }
        } else {
            updateSyncStatus('Ready to create cloud backup on first entry');
        }
        
    } catch (error) {
        console.error('Error loading from gist:', error);
        updateSyncStatus('⚠️ Using local data (cloud sync failed)', 'error');
        loadLocalData();
    }
    
    updateHeatmap();
    updateStats();
}

function loadLocalData() {
    studyData = JSON.parse(localStorage.getItem(localStorageKey)) || {};
    updateSyncStatus('📱 Using local storage');
}

function loadData() {
    if (githubToken) {
        loadDataFromGist();
    } else {
        loadLocalData();
        updateHeatmap();
        updateStats();
    }
}

async function saveDataToGist() {
    if (!githubToken) {
        // Fallback to local storage
        localStorage.setItem(localStorageKey, JSON.stringify(studyData));
        updateSyncStatus('💾 Saved locally');
        return;
    }
    
    updateSyncStatus('☁️ Syncing to cloud...', 'syncing');
    
    const data = {
        year: currentYear,
        lastUpdated: new Date().toISOString(),
        studyData: studyData
    };
    
    const gistData = {
        description: `Study Hours Tracker - ${currentYear}`,
        public: false,
        files: {
            [`study-data-${currentYear}.json`]: {
                content: JSON.stringify(data, null, 2)
            }
        }
    };
    
    try {
        let response;
        
        if (gistId) {
            // Update existing gist
            response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });
        } else {
            // Create new gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });
        }
        
        if (response.ok) {
            const result = await response.json();
            if (!gistId) {
                gistId = result.id;
                localStorage.setItem(gistIdKey, gistId);
            }
            updateSyncStatus('✅ Synced with cloud');
            
            // Also save locally as backup
            localStorage.setItem(localStorageKey, JSON.stringify(studyData));
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Error saving to gist:', error);
        localStorage.setItem(localStorageKey, JSON.stringify(studyData));
        updateSyncStatus('⚠️ Saved locally (cloud sync failed)', 'error');
    }
}

function handleFormSubmission(e) {
    e.preventDefault();
    
    const date = document.getElementById('date').value;
    const morning = parseFloat(document.getElementById('morning').value) || 0;
    const afternoon = parseFloat(document.getElementById('afternoon').value) || 0;
    
    // Get existing data for this date (if any)
    const existingData = studyData[date] || { morning: 0, afternoon: 0, total: 0 };
    
    // Only update the fields that have values > 0
    const newMorning = morning > 0 ? morning : existingData.morning;
    const newAfternoon = afternoon > 0 ? afternoon : existingData.afternoon;
    
    // Store the updated data
    studyData[date] = {
        morning: newMorning,
        afternoon: newAfternoon,
        total: newMorning + newAfternoon
    };
    
    // Save to cloud/local
    saveDataToGist();
    
    // Update the visualization
    updateHeatmap();
    updateStats();
    
    // Clear form (except date)
    document.getElementById('morning').value = '0';
    document.getElementById('afternoon').value = '0';
}

function clearDay() {
    const date = document.getElementById('date').value;
    if (!date) {
        alert('Please select a date first');
        return;
    }
    
    // Remove the entry completely or set to zeros
    delete studyData[date];
    
    // Save to cloud/local
    saveDataToGist();
    
    // Update the visualization
    updateHeatmap();
    updateStats();
    
    // Clear form inputs too
    document.getElementById('morning').value = '0';
    document.getElementById('afternoon').value = '0';
}

function updateStats() {
    const entries = Object.values(studyData);
    const totalHours = entries.reduce((sum, entry) => sum + entry.total, 0);
    const totalDays = entries.filter(entry => entry.total > 0).length;
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(2);
    document.getElementById('totalDays').textContent = totalDays;
}

function getDateString(date) {
    return date.toISOString().split('T')[0];
}

function getStudyLevel(hours) {
    if (hours === 0) return 0;
    if (hours <= 2) return 1;
    if (hours <= 4) return 2;
    if (hours <= 6) return 3;
    return 4;
}

function updateHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    const monthLabels = document.getElementById('monthLabels');
    const tooltip = document.getElementById('tooltip');
    
    // Clear existing grid
    grid.innerHTML = '';
    monthLabels.innerHTML = '';
    
    // Create year start date
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    
    // Find the first Sunday of the year (or before)
    const startDate = new Date(yearStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // Create month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let currentMonth = -1;
    
    for (let week = 0; week < 53; week++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (week * 7));
        
        if (weekStart.getMonth() !== currentMonth && weekStart.getFullYear() === currentYear) {
            currentMonth = weekStart.getMonth();
            const label = document.createElement('div');
            label.textContent = months[currentMonth];
            label.style.gridColumn = `${week + 1}`;
            monthLabels.appendChild(label);
        }
    }
    
    // Create day cells - fill column by column (week by week)
    for (let week = 0; week < 53; week++) {
        for (let day = 0; day < 7; day++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.style.gridColumn = week + 1;
            cell.style.gridRow = day + 1;
            
            // Only show data for current year
            if (cellDate.getFullYear() === currentYear) {
                const dateStr = getDateString(cellDate);
                const studyEntry = studyData[dateStr];
                const hours = studyEntry ? studyEntry.total : 0;
                const level = getStudyLevel(hours);
                
                if (level > 0) {
                    cell.classList.add(`level-${level}`);
                }
                
                // Add tooltip
                cell.addEventListener('mouseenter', function(e) {
                    const dateFormatted = cellDate.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    
                    let tooltipText = `${dateFormatted}: ${hours.toFixed(2)} hours`;
                    if (studyEntry) {
                        tooltipText += ` (${studyEntry.morning}h morning, ${studyEntry.afternoon}h afternoon)`;
                    }
                    
                    tooltip.textContent = tooltipText;
                    tooltip.style.display = 'block';
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY - 30 + 'px';
                });
                
                cell.addEventListener('mouseleave', function() {
                    tooltip.style.display = 'none';
                });
                
                cell.addEventListener('mousemove', function(e) {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY - 30 + 'px';
                });
            } else {
                cell.style.opacity = '0.3';
            }
            
            grid.appendChild(cell);
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);