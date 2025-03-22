// DOM Elements
const noteContainer = document.getElementById('notes-container');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const saveButton = document.getElementById('note-save');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const gridViewButton = document.getElementById('grid-view');
const listViewButton = document.getElementById('list-view');
const themeToggle = document.getElementById('theme-toggle');
const addChecklistButton = document.getElementById('add-checklist');
const addImageButton = document.getElementById('add-image');
const imageUpload = document.getElementById('image-upload');
const colorPicker = document.getElementById('color-picker');
const colors = document.querySelector('.colors');
const customColorInput = document.getElementById('custom-color-input');
const shareNoteBtn = document.getElementById('share-note-btn');
const navItems = document.querySelectorAll('nav li');
const mobileMenuButton = document.getElementById('mobile-menu');
const navElement = document.querySelector('nav');
const noteInputContainer = document.querySelector('.note-input');
const deleteAllBtn = document.getElementById('delete-all-btn');
const recoverAllBtn = document.getElementById('recover-all-btn');
const shareModal = document.getElementById('share-modal');
const closeShareModal = document.getElementById('close-share-modal');
const copyLinkBtn = document.getElementById('copy-link');
const exportNoteBtn = document.getElementById('export-note');
const emailNoteBtn = document.getElementById('email-note');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const autoSaveIndicator = document.getElementById('auto-save-indicator');

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// State Management
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let activeNote = null;
let currentFilter = 'notes';
let currentView = localStorage.getItem('view') || 'grid';
let currentColor = '#ffffff';
let notificationSystem;
let fileAttachmentSystem;
let isRefreshing = false;

// Undo/Redo and Auto-save state
let undoStack = [];
let redoStack = [];
let autoSaveTimeout = null;
let lastSavedState = null;
let isAutoSaving = false;

// Initialize App
async function initApp() {
    // Load saved theme
    if (localStorage.getItem('darkTheme') === 'true') {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Set initial view mode
    toggleView(currentView);
    
    // Initialize systems
    notificationSystem = new NotificationSystem();
    fileAttachmentSystem = new FileAttachmentSystem();
    
    // Setup all event listeners
    setupEventListeners();
    
    // Initialize mobile features
    setupMobileGestures();
    
    // Render initial notes
    renderNotes();
    
    // Initialize undo/redo buttons state
    updateUndoRedoButtonStates();
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation items
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const filter = e.target.textContent.trim().toLowerCase();
            filterNotes(filter);
        });
    });

    // View toggles
    gridViewButton.addEventListener('click', () => toggleView('grid'));
    listViewButton.addEventListener('click', () => toggleView('list'));

    // Search functionality
    searchInput.addEventListener('input', searchNotes);
    searchButton.addEventListener('click', searchNotes);

    // Note actions
    saveButton.addEventListener('click', saveNote);
    addChecklistButton.addEventListener('click', addChecklist);
    addImageButton.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', addImage);

    // Color picker
    setupColorPicker();

    // Share functionality
    if (shareNoteBtn) {
        shareNoteBtn.addEventListener('click', () => {
            if (activeNote) shareNote(activeNote.id);
        });
    }

    // Mobile menu
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
    }

    // Mass actions
    if (deleteAllBtn) deleteAllBtn.addEventListener('click', emptyTrash);
    if (recoverAllBtn) recoverAllBtn.addEventListener('click', recoverAllNotes);

    // Share modal
    if (closeShareModal) closeShareModal.addEventListener('click', closeShareModalFunc);
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', copyNoteLink);
    if (exportNoteBtn) exportNoteBtn.addEventListener('click', exportNoteAsText);
    if (emailNoteBtn) emailNoteBtn.addEventListener('click', emailNote);

    // PDF Export
    const exportPdfBtn = document.getElementById('export-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Undo/Redo
    undoBtn.addEventListener('click', performUndo);
    redoBtn.addEventListener('click', performRedo);

    // Auto-save
    noteTitle.addEventListener('input', startAutoSave);
    noteContent.addEventListener('input', startAutoSave);
}

// Setup Color Picker
function setupColorPicker() {
    colorPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        colors.classList.toggle('visible');
    });

    document.querySelectorAll('.color').forEach(color => {
        color.addEventListener('click', (e) => {
            const computedStyle = window.getComputedStyle(e.target);
            currentColor = computedStyle.backgroundColor;
            colors.classList.remove('visible');
            if (activeNote) {
                noteInputContainer.style.backgroundColor = currentColor;
            }
        });
    });

    customColorInput.addEventListener('input', (e) => {
        currentColor = e.target.value;
        if (activeNote) {
            noteInputContainer.style.backgroundColor = currentColor;
        }
    });

    customColorInput.addEventListener('change', () => {
        colors.classList.remove('visible');
    });

    // Hide color palette when clicking outside
    document.addEventListener('click', () => {
        colors.classList.remove('visible');
    });
}

// Toggle View (Grid/List)
function toggleView(view) {
    currentView = view;
    localStorage.setItem('view', view);

    // Update button states
    gridViewButton.classList.toggle('active', view === 'grid');
    listViewButton.classList.toggle('active', view === 'list');

    // Update container class
    noteContainer.className = `notes-container ${view}-view`;
}

// Save the current state before making changes (for undo/redo)
function saveCurrentState() {
    if (activeNote) {
        const currentState = {
            title: noteTitle.value,
            content: noteContent.innerHTML,
            color: currentColor
        };
        
        // Only push to undo stack if different from the last state
        const lastState = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
        if (!lastState || 
            lastState.title !== currentState.title || 
            lastState.content !== currentState.content ||
            lastState.color !== currentState.color) {
            
            undoStack.push(currentState);
            // Clear redo stack when making new changes
            redoStack = [];
            updateUndoRedoButtonStates();
        }
    }
}

// Update undo/redo button states
function updateUndoRedoButtonStates() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// Perform undo
function performUndo() {
    if (undoStack.length > 0) {
        // Save current state to redo stack
        const currentState = {
            title: noteTitle.value,
            content: noteContent.innerHTML,
            color: currentColor
        };
        redoStack.push(currentState);
        
        // Restore previous state
        const prevState = undoStack.pop();
        noteTitle.value = prevState.title;
        noteContent.innerHTML = prevState.content;
        currentColor = prevState.color;
        noteInputContainer.style.backgroundColor = currentColor;
        
        // Update UI
        updateUndoRedoButtonStates();
        
        // Trigger auto-save with the restored state
        startAutoSave();
    }
}

// Perform redo
function performRedo() {
    if (redoStack.length > 0) {
        // Save current state to undo stack
        const currentState = {
            title: noteTitle.value,
            content: noteContent.innerHTML,
            color: currentColor
        };
        undoStack.push(currentState);
        
        // Restore next state
        const nextState = redoStack.pop();
        noteTitle.value = nextState.title;
        noteContent.innerHTML = nextState.content;
        currentColor = nextState.color;
        noteInputContainer.style.backgroundColor = currentColor;
        
        // Update UI
        updateUndoRedoButtonStates();
        
        // Trigger auto-save with the restored state
        startAutoSave();
    }
}

// Start auto-save timer
function startAutoSave() {
    // Save the current state for undo/redo
    saveCurrentState();
    
    // Clear existing timeout if there is one
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    // Update the auto-save indicator
    autoSaveIndicator.className = 'saving';
    isAutoSaving = true;
    
    // Set a new timeout for saving
    autoSaveTimeout = setTimeout(() => {
        autoSave();
    }, 2000); // Auto-save after 2 seconds of inactivity
}

// Perform auto-save
function autoSave() {
    if (!activeNote) {
        // If not editing an existing note, don't auto-save
        autoSaveIndicator.className = '';
        isAutoSaving = false;
        return;
    }
    
    const title = noteTitle.value.trim();
    const content = noteContent.innerHTML.trim();
    
    if (!content && !title) {
        autoSaveIndicator.className = '';
        isAutoSaving = false;
        return;
    }
    
    try {
        // Process the content to save the checklist state
        const contentContainer = document.createElement('div');
        contentContainer.innerHTML = content;
        
        // Mark checked items with a class for persistence
        contentContainer.querySelectorAll('.checklist-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                item.classList.add('checked');
            } else {
                item.classList.remove('checked');
            }
        });
        
        const processedContent = contentContainer.innerHTML;
        
        // Make sure the color is in a valid format
        const noteColor = currentColor || '#ffffff';
        
        // Check if note has a checklist to auto-add to reminders
        const hasChecklist = contentContainer.querySelector('.checklist') !== null;
        
        // Always set isReminder to true if the note has a checklist
        const isReminder = hasChecklist;
        
        const newNote = {
            id: activeNote.id,
            title: title,
            content: processedContent,
            color: noteColor,
            timestamp: new Date().toLocaleString(),
            pinned: activeNote.pinned,
            shared: activeNote.shared,
            trashed: activeNote.trashed,
            isReminder: isReminder,
            shareLink: activeNote.shareLink,
            lastAutoSaved: new Date().toISOString()
        };
        
        const index = notes.findIndex(note => note.id === activeNote.id);
        if (index !== -1) {
            notes[index] = newNote;
            activeNote = newNote;
            saveToLocalStorage();
            
            // Update UI to show saved status
            autoSaveIndicator.className = 'saved';
            
            // Show timestamp briefly
            autoSaveIndicator.dataset.timestamp = `Last saved: ${formatTime(new Date())}`;
            
            // Reset indicator after a delay
            setTimeout(() => {
                if (!isAutoSaving) {
                    autoSaveIndicator.className = '';
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Auto-save failed:', error);
        autoSaveIndicator.className = 'failed';
    } finally {
        isAutoSaving = false;
    }
}

// Format time for display
function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffMin < 1) {
        return 'just now';
    } else if (diffMin === 1) {
        return '1 minute ago';
    } else if (diffMin < 60) {
        return `${diffMin} minutes ago`;
    } else {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Save Note - now also clears undo/redo stacks
function saveNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.innerHTML.trim();
    
    if (!content && !title) return;
    
    // Process the content to save the checklist state
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = content;
    
    // Mark checked items with a class for persistence
    contentContainer.querySelectorAll('.checklist-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    });
    
    const processedContent = contentContainer.innerHTML;
    
    // Make sure the color is in a valid format
    const noteColor = currentColor || '#ffffff';
    
    // Check if note has a checklist to auto-add to reminders
    const hasChecklist = contentContainer.querySelector('.checklist') !== null;
    
    // Always set isReminder to true if the note has a checklist
    const isReminder = hasChecklist;
    
    const newNote = {
        id: activeNote ? activeNote.id : Date.now(),
        title: title,
        content: processedContent,
        color: noteColor,
        timestamp: new Date().toLocaleString(),
        pinned: activeNote ? activeNote.pinned : false,
        shared: activeNote ? activeNote.shared : false,
        trashed: activeNote ? activeNote.trashed : false,
        isReminder: isReminder,
        shareLink: activeNote && activeNote.shareLink ? activeNote.shareLink : null,
        lastAutoSaved: new Date().toISOString()
    };
    
    if (activeNote) {
        const index = notes.findIndex(note => note.id === activeNote.id);
        if (index !== -1) {
            notes[index] = newNote;
        }
    } else {
        notes.unshift(newNote);
    }
    
    saveToLocalStorage();
    resetNoteForm();
    renderNotes();
    
    // Clear undo/redo stacks after a manual save
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtonStates();
    
    // Update auto-save indicator
    autoSaveIndicator.className = 'saved';
    setTimeout(() => {
        autoSaveIndicator.className = '';
    }, 3000);
}

// Reset Note Form - now also resets undo/redo
function resetNoteForm() {
    noteTitle.value = '';
    noteContent.innerHTML = '';
    activeNote = null;
    currentColor = '#ffffff';
    noteInputContainer.style.backgroundColor = '';
    noteInputContainer.classList.remove('editing');
    
    // Remove reminder indicator if present
    noteInputContainer.classList.remove('has-reminder');
    
    // Reset undo/redo stacks
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtonStates();
    
    // Clear auto-save indicator
    autoSaveIndicator.className = '';
    delete autoSaveIndicator.dataset.timestamp;
}

// Render Notes
function renderNotes() {
    noteContainer.innerHTML = '';
    
    // Filter notes based on current filter
    let filteredNotes = filterNotesByCategory(currentFilter);
    
    // If no notes, show a message
    if (filteredNotes.length === 0) {
        const message = currentFilter === 'trash' ? 'Trash is empty.' : 'No notes here yet.';
        noteContainer.innerHTML = `<div class="no-notes">${message}</div>`;
        return;
    }
    
    // Create note elements
    filteredNotes.forEach(note => {
        const noteElement = createNoteElement(note);
        noteContainer.appendChild(noteElement);
    });
    
    // Ensure the container has the correct view class
    noteContainer.className = 'notes-container ' + (currentView === 'grid' ? 'grid-view' : 'list-view');
}

// Create Note Element
function createNoteElement(note) {
    // Clone template
    const template = document.getElementById('note-template');
    const noteElement = document.importNode(template.content, true).querySelector('.note');
    
    // Set note data
    noteElement.dataset.id = note.id;
    noteElement.querySelector('.note-title').textContent = note.title || 'Untitled';
    noteElement.querySelector('.note-body').innerHTML = note.content || '';
    noteElement.querySelector('.timestamp').textContent = note.timestamp;
    
    // Set note color - ensure it's a valid color value
    const noteColor = note.color || '#ffffff';
    noteElement.style.backgroundColor = noteColor;
    
    // Set pinned status
    if (note.pinned) {
        noteElement.classList.add('pinned');
        const pinIcon = noteElement.querySelector('.pin-note i');
        if (pinIcon) {
            pinIcon.classList.add('active');
        }
    }
    
    // Set reminder status if needed
    if (note.isReminder) {
        noteElement.classList.add('has-reminder');
        const reminderIcon = document.createElement('i');
        reminderIcon.className = 'fas fa-clock reminder-badge';
        reminderIcon.title = 'Reminder';
        noteElement.querySelector('.note-title').prepend(reminderIcon);
    }
    
    // Set shared status if needed
    if (note.shared) {
        noteElement.classList.add('shared');
        const shareIcon = document.createElement('i');
        shareIcon.className = 'fas fa-share-alt share-badge';
        shareIcon.title = 'Shared Note';
        noteElement.querySelector('.note-title').prepend(shareIcon);
    }
    
    // Set up actions
    noteElement.querySelector('.pin-note').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double-click edit
        togglePin(note.id);
    });
    
    noteElement.querySelector('.share-note').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double-click edit
        shareNote(note.id);
    });
    
    const deleteBtn = noteElement.querySelector('.delete-note');
    if (currentFilter === 'trash') {
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Delete permanently';
    } else {
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Move to trash';
    }
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double-click edit
        deleteNote(note.id);
    });
    
    // Double click to edit
    noteElement.addEventListener('dblclick', () => editNote(note.id));
    
    // Restore checklist functionality for displayed notes
    noteElement.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        // Check if the parent has the 'checked' class and update checkbox accordingly
        if (checkbox.parentElement.classList.contains('checked')) {
            checkbox.checked = true;
        }
        
        // Make checkboxes in view mode functional but not saveable without editing
        checkbox.addEventListener('change', function(e) {
            const listItem = this.parentElement;
            if (this.checked) {
                listItem.classList.add('checked');
            } else {
                listItem.classList.remove('checked');
            }
        });
    });
    
    // Make span elements in checklists non-editable in view mode
    noteElement.querySelectorAll('.checklist-item span').forEach(span => {
        span.contentEditable = false;
    });
    
    return noteElement;
}

// Toggle Pin
function togglePin(id) {
    const index = notes.findIndex(note => note.id === id);
    if (index !== -1) {
        notes[index].pinned = !notes[index].pinned;
        saveToLocalStorage();
        renderNotes();
    }
}

// Delete Note
function deleteNote(id) {
    const index = notes.findIndex(note => note.id === id);
    if (index !== -1) {
        if (currentFilter === 'trash') {
            notes.splice(index, 1);
        } else {
            notes[index].trashed = true;
        }
        saveToLocalStorage();
        renderNotes();
    }
}

// Edit Note - now also resets undo/redo stacks for the new note
function editNote(id) {
    const note = notes.find(note => note.id === id);
    if (note) {
        activeNote = note;
        noteTitle.value = note.title;
        noteContent.innerHTML = note.content;
        
        // Ensure we have a valid color
        currentColor = note.color || '#ffffff';
        
        // Show the current note color
        noteInputContainer.style.backgroundColor = currentColor;
        
        // Show editing indicator
        noteInputContainer.classList.add('editing');
        
        // Scroll to the note input area
        document.querySelector('.create-note').scrollIntoView({ behavior: 'smooth' });
        
        // Setup checklist listeners for existing checklist items
        setupChecklistItemListeners();
        
        // Make sure checkboxes in the editor reflect their correct state
        noteContent.querySelectorAll('.checklist-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (item.classList.contains('checked') && checkbox) {
                checkbox.checked = true;
            } else if (checkbox) {
                checkbox.checked = false;
            }
        });
        
        // Reset undo/redo stacks for the new note
        undoStack = [];
        redoStack = [];
        updateUndoRedoButtonStates();
        
        // Show last auto-saved timestamp if available
        if (note.lastAutoSaved) {
            const lastSavedDate = new Date(note.lastAutoSaved);
            autoSaveIndicator.className = 'saved';
            autoSaveIndicator.dataset.timestamp = `Last edited: ${formatTime(lastSavedDate)}`;
            
            setTimeout(() => {
                autoSaveIndicator.className = '';
            }, 3000);
        }
    }
}

// Toggle Theme
function toggleTheme() {
    const isDarkTheme = document.body.classList.toggle('dark-theme');
    themeToggle.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('darkTheme', isDarkTheme);
}

// Search Notes
function searchNotes() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        renderNotes();
        return;
    }
    
    const filteredNotes = notes.filter(note => {
        return (
            (note.title && note.title.toLowerCase().includes(query)) ||
            (note.content && stripHTML(note.content).toLowerCase().includes(query))
        );
    });
    
    renderSearchResults(filteredNotes);
}

// Strip HTML for search
function stripHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

// Render Search Results
function renderSearchResults(results) {
    noteContainer.innerHTML = '';
    
    if (results.length === 0) {
        noteContainer.innerHTML = '<div class="no-notes">No matching notes found.</div>';
        return;
    }
    
    results.forEach(note => {
        const noteElement = createNoteElement(note);
        noteContainer.appendChild(noteElement);
    });
}

// Add Checklist
function addChecklist() {
    const checklist = `
        <ul class="checklist">
            <li class="checklist-item">
                <input type="checkbox" id="item-${Date.now()}">
                <span contenteditable="true">New checklist item</span>
            </li>
        </ul>
    `;
    
    noteContent.innerHTML += checklist;
    noteContent.focus();
    
    // Make the last span editable and focused
    const newItem = noteContent.querySelector('.checklist-item:last-child span');
    newItem.focus();
    
    // Select all text in the span
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(newItem);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Add event listener for checkbox functionality
    setupChecklistItemListeners();
    
    // If we're editing an existing note, mark it as a reminder since it now has a checklist
    if (activeNote) {
        activeNote.isReminder = true;
    }
    
    // Show a visual indicator that the note will be moved to Reminders
    noteInputContainer.classList.add('has-reminder');
    
    // Maybe show a small notification
    const notification = document.createElement('div');
    notification.className = 'temporary-notification';
    notification.textContent = 'This note will be saved in Reminders';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'var(--primary-color)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '20px';
    notification.style.boxShadow = 'var(--shadow)';
    notification.style.zIndex = '1000';
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// Setup checklist item listeners
function setupChecklistItemListeners() {
    // Handle checkbox click
    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        if (!checkbox.hasListener) {
            checkbox.addEventListener('change', function() {
                const listItem = this.parentElement;
                if (this.checked) {
                    listItem.classList.add('checked');
                } else {
                    listItem.classList.remove('checked');
                }
            });
            checkbox.hasListener = true;
        }
    });
    
    // Add ability to add more checklist items when pressing Enter
    document.querySelectorAll('.checklist-item span').forEach(span => {
        if (!span.hasListener) {
            span.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const listItem = this.parentElement;
                    const checklist = listItem.parentElement;
                    const newItemId = 'item-' + Date.now();
                    
                    const newItem = document.createElement('li');
                    newItem.className = 'checklist-item';
                    newItem.innerHTML = `
                        <input type="checkbox" id="${newItemId}">
                        <span contenteditable="true"></span>
                    `;
                    
                    checklist.insertBefore(newItem, listItem.nextSibling);
                    const newSpan = newItem.querySelector('span');
                    newSpan.focus();
                    
                    // Setup listeners for new item
                    setupChecklistItemListeners();
                }
            });
            span.hasListener = true;
        }
    });
}

// Add Image
function addImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageUrl = e.target.result;
            const imageElement = document.createElement('img');
            imageElement.src = imageUrl;
            imageElement.classList.add('note-image');
            noteContent.appendChild(imageElement);
        };
        reader.readAsDataURL(file);
    }
}

// Filter Notes
function filterNotes(filter) {
    currentFilter = filter;
    
    // Update nav active class
    navItems.forEach(item => {
        const itemFilter = item.textContent.trim().toLowerCase();
        if (itemFilter === filter) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Set data-view attribute on body to control mass action buttons visibility
    document.body.setAttribute('data-view', filter);
    
    // Clear any active search
    searchInput.value = '';
    
    renderNotes();
}

// Toggle Mobile Menu
function toggleMobileMenu() {
    navElement.classList.toggle('open');
    
    // Create or toggle menu overlay
    let menuOverlay = document.querySelector('.menu-overlay');
    
    if (!menuOverlay) {
        menuOverlay = document.createElement('div');
        menuOverlay.className = 'menu-overlay';
        document.body.appendChild(menuOverlay);
        
        // Close menu when clicking overlay
        menuOverlay.addEventListener('click', () => {
            navElement.classList.remove('open');
            menuOverlay.classList.remove('visible');
        });
    }
    
    menuOverlay.classList.toggle('visible');
    
    // Also close menu when a nav item is clicked on mobile
    if (window.innerWidth <= 768) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navElement.classList.remove('open');
                menuOverlay.classList.remove('visible');
            });
        });
    }
}

// Filter Notes By Category
function filterNotesByCategory(filter) {
    let filteredNotes = [...notes];
    
    switch (filter) {
        case 'notes':
            // Only show notes without checkboxes that aren't in trash
            filteredNotes = notes.filter(note => !note.isReminder && !note.trashed && !note.shared);
            break;
        case 'reminders':
            // Show reminder notes that aren't in trash
            filteredNotes = notes.filter(note => note.isReminder && !note.trashed);
            break;
        case 'shared':
            // Show shared notes that aren't in trash, regardless of reminder status
            filteredNotes = notes.filter(note => note.shared && !note.trashed);
            break;
        case 'trash':
            // Show all trashed notes
            filteredNotes = notes.filter(note => note.trashed);
            break;
        default:
            // Fallback to notes view
            filteredNotes = notes.filter(note => !note.isReminder && !note.trashed && !note.shared);
    }
    
    // Sort pinned notes first, then by timestamp (newest first)
    return filteredNotes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Sort by timestamp if pinned status is the same
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
}

// Save to Local Storage
function saveToLocalStorage() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

// Empty Trash (delete all notes in trash permanently)
function emptyTrash() {
    if (confirm('Are you sure you want to permanently delete all notes in the trash? This action cannot be undone.')) {
        notes = notes.filter(note => !note.trashed);
        saveToLocalStorage();
        renderNotes();
    }
}

// Recover All Notes from Trash
function recoverAllNotes() {
    const trashedNotes = notes.filter(note => note.trashed);
    
    if (trashedNotes.length === 0) {
        alert('No notes to recover.');
        return;
    }
    
    // Restore all trashed notes
    notes.forEach(note => {
        if (note.trashed) {
            note.trashed = false;
        }
    });
    
    saveToLocalStorage();
    renderNotes();
}

// Share Note
function shareNote(id) {
    const note = notes.find(note => note.id === id);
    if (note) {
        // Generate a share link if one doesn't exist
        if (!note.shareLink) {
            note.shareLink = generateShareLink(note);
            note.shared = true;
            saveToLocalStorage();
        }
        
        // Store the active note for sharing operations
        window.noteToShare = note;
        
        // Open share modal
        shareModal.style.display = 'flex';
    }
}

// Close Share Modal
function closeShareModalFunc() {
    shareModal.style.display = 'none';
    window.noteToShare = null;
}

// Generate a share link (this is a basic implementation)
function generateShareLink(note) {
    // In a real app, this would generate a real shareable URL
    // For this example, we'll create a pseudo-link using the note ID
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?note=${note.id}&share=${Date.now()}`;
}

// Copy Note Link
function copyNoteLink() {
    const note = window.noteToShare;
    if (note && note.shareLink) {
        navigator.clipboard.writeText(note.shareLink)
            .then(() => {
                alert('Link copied to clipboard!');
                closeShareModalFunc();
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                alert('Failed to copy link.');
            });
    }
}

// Export Note as Text
function exportNoteAsText() {
    const note = window.noteToShare;
    if (note) {
        // Create a text version of the note
        const container = document.createElement('div');
        container.innerHTML = note.content;
        
        const textContent = `${note.title}\n\n${stripHTML(note.content)}\n\nCreated: ${note.timestamp}`;
        
        // Create a download link
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent));
        element.setAttribute('download', `${note.title.replace(/[^a-z0-9]/gi, '_')}.txt`);
        
        element.style.display = 'none';
        document.body.appendChild(element);
        
        element.click();
        
        document.body.removeChild(element);
        closeShareModalFunc();
    }
}

// Email Note
function emailNote() {
    const note = window.noteToShare;
    if (note) {
        // Create email with note content
        const subject = encodeURIComponent(`Note: ${note.title}`);
        const container = document.createElement('div');
        container.innerHTML = note.content;
        
        const body = encodeURIComponent(`${note.title}\n\n${stripHTML(note.content)}\n\nShared from NatePad`);
        
        // Open default email client
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        closeShareModalFunc();
    }
}

// Update any references to archived in the code
// Check if we need to migrate existing data that might have archived flag
function migrateArchiveToShared() {
    let migrationNeeded = false;
    
    notes.forEach(note => {
        if (note.hasOwnProperty('archived') && note.archived) {
            note.shared = true;
            delete note.archived;
            migrationNeeded = true;
        } else if (note.hasOwnProperty('archived')) {
            delete note.archived;
            migrationNeeded = true;
        }
    });
    
    if (migrationNeeded) {
        saveToLocalStorage();
    }
}

// PDF Export functionality
async function exportToPDF() {
    const note = window.noteToShare;
    if (!note) return;

    try {
        const { PDFDocument, rgb } = PDFLib;
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const { width, height } = page.getSize();
        
        // Add title
        page.drawText(note.title, {
            x: 50,
            y: height - 50,
            size: 20,
            color: rgb(0, 0, 0)
        });

        // Convert HTML content to plain text for PDF
        const container = document.createElement('div');
        container.innerHTML = note.content;
        const textContent = stripHTML(note.content);

        // Add content with word wrap
        const fontSize = 12;
        const lineHeight = fontSize * 1.5;
        const maxWidth = width - 100;
        let currentY = height - 100;

        const words = textContent.split(' ');
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine + word + ' ';
            const textWidth = (testLine.length * fontSize * 0.6); // Approximate width

            if (textWidth > maxWidth) {
                page.drawText(currentLine, {
                    x: 50,
                    y: currentY,
                    size: fontSize,
                    color: rgb(0, 0, 0)
                });
                currentY -= lineHeight;
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        }

        // Draw remaining text
        if (currentLine) {
            page.drawText(currentLine, {
                x: 50,
                y: currentY,
                size: fontSize,
                color: rgb(0, 0, 0)
            });
        }

        // Add timestamp
        page.drawText(`Created: ${note.timestamp}`, {
            x: 50,
            y: 50,
            size: 10,
            color: rgb(0.5, 0.5, 0.5)
        });

        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        link.click();

        URL.revokeObjectURL(url);
        closeShareModalFunc();
    } catch (error) {
        console.error('PDF export failed:', error);
        showToast('Failed to export PDF', 'error');
    }
}

// Mobile Gesture Support
function setupMobileGestures() {
    const notesContainer = document.getElementById('notes-container');
    const hammer = new Hammer(notesContainer);

    // Enable swipe recognition
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });

    hammer.on('swipeleft swiperight', function(ev) {
        const noteElement = ev.target.closest('.note');
        if (!noteElement) return;

        const noteId = parseInt(noteElement.dataset.id);
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        if (ev.type === 'swipeleft') {
            // Swipe left to delete
            noteElement.classList.add('swiping-left');
            setTimeout(() => deleteNote(noteId), 300);
        } else if (ev.type === 'swiperight') {
            // Swipe right to share
            noteElement.classList.add('swiping-right');
            setTimeout(() => shareNote(noteId), 300);
        }
    });

    // Pull to refresh setup
    setupPullToRefresh();
}

// Pull to Refresh
function setupPullToRefresh() {
    const main = document.querySelector('main');
    const indicator = document.getElementById('pull-to-refresh-indicator');
    let startY = 0;

    main.addEventListener('touchstart', (e) => {
        if (main.scrollTop === 0) {
            startY = e.touches[0].pageY;
        }
    });

    main.addEventListener('touchmove', (e) => {
        if (isRefreshing) return;

        if (main.scrollTop === 0) {
            const pullDistance = e.touches[0].pageY - startY;
            if (pullDistance > 0 && pullDistance < 200) {
                indicator.classList.add('visible');
                indicator.classList.add('pulling');
                e.preventDefault();
            }
        }
    });

    main.addEventListener('touchend', (e) => {
        if (isRefreshing) return;

        const pullDistance = e.changedTouches[0].pageY - startY;
        if (pullDistance > 100) {
            refreshNotes();
        } else {
            indicator.classList.remove('visible');
            indicator.classList.remove('pulling');
        }
    });
}

// Refresh Notes
async function refreshNotes() {
    const indicator = document.getElementById('pull-to-refresh-indicator');
    indicator.classList.add('refreshing');
    isRefreshing = true;

    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Refresh notes from localStorage
    notes = JSON.parse(localStorage.getItem('notes')) || [];
    renderNotes();

    // Reset pull-to-refresh state
    indicator.classList.remove('refreshing');
    indicator.classList.remove('visible');
    indicator.classList.remove('pulling');
    isRefreshing = false;

    showToast('Notes refreshed', 'success');
}

// Notification System
class NotificationSystem {
    constructor() {
        this.notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        this.notificationList = document.getElementById('notification-list');
        this.badge = document.getElementById('notification-badge');
        this.setupEventListeners();
        this.updateBadge();
    }

    setupEventListeners() {
        // Notification toggle button
        document.getElementById('notifications-toggle').addEventListener('click', () => {
            document.getElementById('notification-modal').style.display = 'flex';
            this.markAllAsRead();
        });

        // Close notification modal
        document.getElementById('close-notification-modal').addEventListener('click', () => {
            document.getElementById('notification-modal').style.display = 'none';
        });

        // Clear all notifications
        document.getElementById('clear-all-notifications').addEventListener('click', () => {
            this.clearAll();
        });
    }

    addNotification(title, message, type = 'info') {
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            timestamp: new Date().toISOString(),
            read: false
        };

        this.notifications.unshift(notification);
        this.saveNotifications();
        this.updateBadge();
        this.renderNotifications();
        this.showToast(title, type);
    }

    renderNotifications() {
        this.notificationList.innerHTML = '';
        
        if (this.notifications.length === 0) {
            this.notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
            return;
        }

        this.notifications.forEach(notification => {
            const template = document.getElementById('notification-template');
            const element = document.importNode(template.content, true).querySelector('.notification-item');
            
            element.querySelector('.notification-title').textContent = notification.title;
            element.querySelector('.notification-message').textContent = notification.message;
            element.querySelector('.notification-time').textContent = this.formatTime(new Date(notification.timestamp));
            
            if (!notification.read) {
                element.classList.add('unread');
            }

            element.querySelector('.dismiss-notification').addEventListener('click', () => {
                this.removeNotification(notification.id);
            });

            this.notificationList.appendChild(element);
        });
    }

    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.saveNotifications();
        this.updateBadge();
        this.renderNotifications();
    }

    clearAll() {
        this.notifications = [];
        this.saveNotifications();
        this.updateBadge();
        this.renderNotifications();
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.updateBadge();
        this.renderNotifications();
    }

    updateBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        this.badge.textContent = unreadCount || '';
    }

    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
}

// File Attachment System
class FileAttachmentSystem {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addFileBtn = document.getElementById('add-file');
        const fileUpload = document.getElementById('file-upload');
        const filePreviewModal = document.getElementById('file-preview-modal');
        const closeFilePreview = document.getElementById('close-file-preview');

        addFileBtn.addEventListener('click', () => fileUpload.click());
        fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        closeFilePreview.addEventListener('click', () => {
            filePreviewModal.style.display = 'none';
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Create file attachment element
            const attachment = this.createFileAttachment(file);
            noteContent.appendChild(attachment);

            // Show success message
            showToast(`File "${file.name}" attached`, 'success');
        } catch (error) {
            console.error('File attachment failed:', error);
            showToast('Failed to attach file', 'error');
        }
    }

    createFileAttachment(file) {
        const attachment = document.createElement('div');
        attachment.className = 'file-attachment';
        
        const icon = this.getFileIcon(file.type);
        const size = this.formatFileSize(file.size);

        attachment.innerHTML = `
            <i class="file-icon ${icon}"></i>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${size}</div>
            </div>
            <div class="file-actions">
                <button class="file-preview-btn" title="Preview"><i class="fas fa-eye"></i></button>
                <button class="file-delete-btn" title="Remove"><i class="fas fa-trash"></i></button>
            </div>
        `;

        // Setup preview and delete handlers
        attachment.querySelector('.file-preview-btn').addEventListener('click', () => {
            this.previewFile(file);
        });

        attachment.querySelector('.file-delete-btn').addEventListener('click', () => {
            attachment.remove();
            showToast(`File "${file.name}" removed`, 'info');
        });

        return attachment;
    }

    getFileIcon(mimeType) {
        const icons = {
            'application/pdf': 'fas fa-file-pdf',
            'image': 'fas fa-file-image',
            'text': 'fas fa-file-alt',
            'application/msword': 'fas fa-file-word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word',
            'application/vnd.ms-excel': 'fas fa-file-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel',
            'application/vnd.ms-powerpoint': 'fas fa-file-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint',
            'application/zip': 'fas fa-file-archive'
        };

        for (const [type, icon] of Object.entries(icons)) {
            if (mimeType.includes(type)) return icon;
        }

        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    async previewFile(file) {
        const previewContainer = document.getElementById('file-preview-container');
        const modal = document.getElementById('file-preview-modal');

        previewContainer.innerHTML = '';

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            previewContainer.appendChild(img);
        } else if (file.type === 'application/pdf') {
            const iframe = document.createElement('iframe');
            iframe.className = 'pdf-preview';
            iframe.src = URL.createObjectURL(file);
            previewContainer.appendChild(iframe);
        } else {
            previewContainer.innerHTML = `
                <div class="file-info-fallback">
                    <i class="${this.getFileIcon(file.type)}"></i>
                    <p>${file.name}</p>
                    <p>${this.formatFileSize(file.size)}</p>
                    <p>Preview not available</p>
                </div>
            `;
        }

        modal.style.display = 'flex';
    }
}

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    }[type];

    toast.innerHTML = `
        <i class="toast-icon ${icon}"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Initialize App when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);