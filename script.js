// Menunggu hingga seluruh konten halaman HTML dimuat sebelum menjalankan skrip
document.addEventListener('DOMContentLoaded', () => {

    // --- SELEKSI ELEMEN DOM ---
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDescInput = document.getElementById('task-desc');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskPriorityInput = document.getElementById('task-priority');
    const taskCategoryInput = document.getElementById('task-category');
    const taskList = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const modal = document.getElementById('task-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const modalTitle = document.getElementById('modal-title');
    const saveTaskBtn = document.getElementById('save-task-btn');
    
    // Kontrol Filter & Sort
    const searchInput = document.getElementById('search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterPriority = document.getElementById('filter-priority');
    const sortBy = document.getElementById('sort-by');
    const deleteCompletedBtn = document.getElementById('delete-completed-btn');

    // Footer & Empty State
    const activeTasksCount = document.getElementById('active-tasks-count');
    const completedTasksCount = document.getElementById('completed-tasks-count');
    const emptyState = document.getElementById('empty-state');
    
    // Toast Notification
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const undoBtn = document.getElementById('undo-btn');

    // --- STATE APLIKASI ---
    let tasks = getTasksFromStorage(); // "Single source of truth"
    let editTaskId = null; // Menyimpan ID tugas yang sedang diedit
    let deletedTask = null; // Menyimpan tugas yang baru dihapus untuk fitur undo
    let undoTimeout = null; // Timer untuk undo

    // --- FUNGSI LOCAL STORAGE ---
    function getTasksFromStorage() {
        const storedTasks = localStorage.getItem('todo_items_v1');
        return storedTasks ? JSON.parse(storedTasks) : [];
    }

    function saveTasksToStorage() {
        localStorage.setItem('todo_items_v1', JSON.stringify(tasks));
    }

    // --- FUNGSI RENDER UTAMA ---
    function renderTasks() {
        // Hapus daftar tugas yang ada
        taskList.innerHTML = '';
        
        // Dapatkan nilai filter dan sort saat ini
        const searchTerm = searchInput.value.toLowerCase();
        const statusFilter = filterStatus.value;
        const priorityFilter = filterPriority.value;
        const sortValue = sortBy.value;

        // 1. FILTERING
        let filteredTasks = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchTerm) || task.description.toLowerCase().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || (statusFilter === 'completed' && task.completed) || (statusFilter === 'active' && !task.completed);
            const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
            return matchesSearch && matchesStatus && matchesPriority;
        });

        // 2. SORTING
        const priorityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
        filteredTasks.sort((a, b) => {
            switch (sortValue) {
                case 'date-asc':
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'date-desc':
                    return new Date(b.dueDate) - new Date(a.dueDate);
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                case 'priority':
                    return priorityMap[b.priority] - priorityMap[a.priority];
                default:
                    return 0;
            }
        });

        // Tampilkan atau sembunyikan empty state
        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }

        // 3. RENDER setiap tugas ke DOM
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''} fade-in`;
            taskItem.setAttribute('data-id', task.id);

            taskItem.innerHTML = `
                <input type.checkbox class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-details">
                    <span class="task-title">${task.title}</span>
                    <div class="task-meta">
                        <span class="priority-badge ${task.priority}">${task.priority}</span>
                        <span>${task.category}</span>
                        ${task.dueDate ? `<span>🗓️ ${new Date(task.dueDate).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit-btn">✏️</button>
                    <button class="task-action-btn delete-btn">🗑️</button>
                </div>
            `;
            taskList.appendChild(taskItem);
        });

        updateFooterCounts();
    }

    // --- FUNGSI CRUD (Create, Read, Update, Delete) ---
    function addTask(taskData) {
        const newTask = {
            id: Date.now().toString(),
            ...taskData,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        tasks.push(newTask);
        saveTasksToStorage();
        renderTasks();
        showToast('Tugas berhasil ditambahkan!');
    }
    
    function editTask(taskId, updatedData) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData, updatedAt: new Date().toISOString() };
            saveTasksToStorage();
            renderTasks();
            showToast('Tugas berhasil diperbarui!');
        }
    }

    function deleteTask(taskId) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            // Simpan tugas yang akan dihapus untuk fitur undo
            deletedTask = tasks[taskIndex];
            tasks.splice(taskIndex, 1);
            saveTasksToStorage();

            const taskElement = taskList.querySelector(`[data-id='${taskId}']`);
            if (taskElement) {
                taskElement.classList.add('fade-out');
                taskElement.addEventListener('animationend', renderTasks, { once: true });
            } else {
                renderTasks();
            }

            showToast('Tugas dihapus', true);

            // Set timeout untuk undo
            clearTimeout(undoTimeout);
            undoTimeout = setTimeout(() => {
                deletedTask = null;
            }, 3000); // Batas waktu undo 3 detik
        }
    }

    function toggleComplete(taskId) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            tasks[taskIndex].completed = !tasks[taskIndex].completed;
            tasks[taskIndex].updatedAt = new Date().toISOString();
            saveTasksToStorage();
            renderTasks();
        }
    }

    function deleteCompletedTasks() {
        tasks = tasks.filter(task => !task.completed);
        saveTasksToStorage();
        renderTasks();
        showToast('Semua tugas yang selesai telah dihapus.');
    }

    function handleUndoDelete() {
        if (deletedTask) {
            tasks.push(deletedTask);
            deletedTask = null;
            clearTimeout(undoTimeout);
            saveTasksToStorage();
            renderTasks();
            toast.classList.remove('show');
        }
    }

    // --- FUNGSI UI & HELPERS ---
    function openModal(mode, task = null) {
        taskForm.reset();
        clearValidationErrors();
        if (mode === 'edit' && task) {
            modalTitle.textContent = 'Edit Tugas';
            saveTaskBtn.textContent = 'Simpan Perubahan';
            taskForm.dataset.formMode = 'edit';
            editTaskId = task.id;
            
            // Isi form dengan data yang ada
            taskTitleInput.value = task.title;
            taskDescInput.value = task.description;
            taskDueDateInput.value = task.dueDate;
            taskPriorityInput.value = task.priority;
            taskCategoryInput.value = task.category;
        } else {
            modalTitle.textContent = 'Tambah Tugas Baru';
            saveTaskBtn.textContent = 'Simpan Tugas';
            taskForm.dataset.formMode = 'add';
            editTaskId = null;
        }
        modal.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalOverlay.classList.add('hidden');
    }
    
    function handleFormSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        const taskData = {
            title: taskTitleInput.value.trim(),
            description: taskDescInput.value.trim(),
            dueDate: taskDueDateInput.value,
            priority: taskPriorityInput.value,
            category: taskCategoryInput.value,
        };

        if (taskForm.dataset.formMode === 'add') {
            addTask(taskData);
        } else {
            editTask(editTaskId, taskData);
        }

        closeModal();
    }

    function updateFooterCounts() {
        const activeCount = tasks.filter(t => !t.completed).length;
        const completedCount = tasks.length - activeCount;
        activeTasksCount.textContent = activeCount;
        completedTasksCount.textContent = completedCount;
    }

    function showToast(message, showUndo = false) {
        toastMessage.textContent = message;
        undoBtn.classList.toggle('hidden', !showUndo);
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Debounce function untuk mengurangi panggilan render pada saat search
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    const debouncedRender = debounce(renderTasks, 250);

    // Validasi Form
    function validateForm() {
        clearValidationErrors();
        let isValid = true;
        
        // Validasi Judul
        if (taskTitleInput.value.trim() === '') {
            showValidationError('title-error', 'Judul tidak boleh kosong.');
            isValid = false;
        }

        // Validasi Tanggal (tidak boleh di masa lalu untuk tugas baru)
        if (taskDueDateInput.value && taskForm.dataset.formMode === 'add') {
            const dueDate = new Date(taskDueDateInput.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set ke awal hari untuk perbandingan
            if (dueDate < today) {
                showValidationError('date-error', 'Tanggal tidak boleh di masa lalu.');
                isValid = false;
            }
        }
        return isValid;
    }

    function showValidationError(elementId, message) {
        document.getElementById(elementId).textContent = message;
    }
    
    function clearValidationErrors() {
        document.getElementById('title-error').textContent = '';
        document.getElementById('date-error').textContent = '';
    }

    // --- Inisialisasi Jam ---
    function updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('current-time');
        const dateEl = document.getElementById('current-date');
        timeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // --- EVENT LISTENERS ---
    function initializeApp() {
        // Form
        taskForm.addEventListener('submit', handleFormSubmit);
        
        // Modal
        addTaskBtn.addEventListener('click', () => openModal('add'));
        closeModalBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);

        // Kontrol
        searchInput.addEventListener('input', debouncedRender);
        filterStatus.addEventListener('change', renderTasks);
        filterPriority.addEventListener('change', renderTasks);
        sortBy.addEventListener('change', renderTasks);
        deleteCompletedBtn.addEventListener('click', deleteCompletedTasks);

        // Aksi pada Task List (Event Delegation)
        taskList.addEventListener('click', (e) => {
            const target = e.target;
            const taskItem = target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.dataset.id;
            
            if (target.classList.contains('task-checkbox')) {
                toggleComplete(taskId);
            } else if (target.classList.contains('edit-btn')) {
                const task = tasks.find(t => t.id === taskId);
                openModal('edit', task);
            } else if (target.classList.contains('delete-btn')) {
                deleteTask(taskId);
            }
        });

        // Toast
        undoBtn.addEventListener('click', handleUndoDelete);

        // Jam
        updateClock();
        setInterval(updateClock, 1000);

        // Render awal
        renderTasks();
    }

    // Jalankan Aplikasi
    initializeApp();
});