# 📚 Study Hours Tracker

A clean, GitHub-style study hours tracker with cloud sync. Track your daily study sessions and visualize your progress.


## Usage

1. **Open `index.html`** in your browser
2. **Select a date** and enter study hours for morning/afternoon sessions
3. **Click "Add Entry"** to save (preserves existing sessions)
4. **Optional**: Set up GitHub token in ⚙️ Settings for cloud sync


### Cloud Sync Setup

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens?scopes=gist) with `gist` permissions
2. Save your token in `token.txt` (already in `.gitignore`)
3. Enter token in Settings modal for automatic cloud backup


## Import Data

To import existing data, paste this in browser console:

```javascript
// Replace with your data in the format:
const importData = { 
    "2025-01-01": { morning: 2, afternoon: 1.5, total: 3.5 } 
};

Object.assign(studyData, importData);

saveDataToGist();
updateHeatmap();
updateStats();
```