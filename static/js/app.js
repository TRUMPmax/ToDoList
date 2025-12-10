// 全局变量
let tasks = [];
let sortable = null;
let focusTimer = null;
let timerInterval = null;
let timerStartTime = null;
let currentTimerTaskId = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
    initSortable();
});

// 加载任务列表
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const result = await response.json();
        
        if (result.success) {
            tasks = result.data;
            renderTasks();
        } else {
            showError('加载任务失败: ' + result.error);
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
    }
}

// 渲染任务列表
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    const statusFilter = document.getElementById('filterStatus').value;
    const priorityFilter = document.getElementById('filterPriority').value;
    const categoryFilter = document.getElementById('filterCategory').value;
    
    // 过滤任务
    let filteredTasks = tasks.filter(task => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && task.priority != priorityFilter) return false;
        if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
        return true;
    });
    
    // 按order_index排序
    filteredTasks.sort((a, b) => a.order_index - b.order_index);
    
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无任务，点击"添加任务"开始吧！</p>';
        return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => `
        <div class="task-card priority-${getPriorityClass(task.priority)} ${task.status === 'completed' ? 'completed' : ''}" 
             data-task-id="${task.id}">
            <div class="task-info">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="task-badge badge-priority">${getPriorityText(task.priority)}</span>
                    <span class="task-badge badge-category">${getCategoryText(task.category)}</span>
                    <span>创建: ${formatDate(task.created_at)}</span>
                </div>
            </div>
            <div class="task-actions">
                ${task.status === 'pending' ? 
                    `<button class="btn btn-primary" onclick="completeTask(${task.id})">完成</button>` : 
                    `<button class="btn btn-secondary" onclick="uncompleteTask(${task.id})">恢复</button>`
                }
                <button class="btn btn-info" onclick="editTask(${task.id})">编辑</button>
                <button class="btn btn-danger" onclick="deleteTask(${task.id})">删除</button>
            </div>
        </div>
    `).join('');
    
    // 重新初始化排序
    initSortable();
}

// 初始化拖拽排序
function initSortable() {
    const tasksList = document.getElementById('tasksList');
    if (sortable) {
        sortable.destroy();
    }
    
    sortable = Sortable.create(tasksList, {
        animation: 150,
        handle: '.task-card',
        onEnd: function(evt) {
            const taskIds = Array.from(tasksList.children).map(el => 
                parseInt(el.getAttribute('data-task-id'))
            );
            reorderTasks(taskIds);
        }
    });
}

// 重新排序任务
async function reorderTasks(taskIds) {
    try {
        const response = await fetch('/api/tasks/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ task_ids: taskIds })
        });
        
        const result = await response.json();
        if (result.success) {
            loadTasks();
        } else {
            showError('排序失败: ' + result.error);
            loadTasks(); // 重新加载恢复原顺序
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
        loadTasks();
    }
}

// 过滤任务
function filterTasks() {
    renderTasks();
}

// 显示添加任务模态框
function showAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'block';
    document.getElementById('taskTitle').focus();
}

// 关闭添加任务模态框
function closeAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'none';
    document.getElementById('addTaskForm').reset();
}

// 创建任务
async function createTask(event) {
    event.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDescription').value.trim(),
        priority: parseInt(document.getElementById('taskPriority').value),
        category: document.getElementById('taskCategory').value
    };
    
    if (!taskData.title) {
        alert('任务标题不能为空');
        return;
    }
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        if (result.success) {
            closeAddTaskModal();
            loadTasks();
        } else {
            alert('创建失败: ' + result.error);
        }
    } catch (error) {
        alert('网络错误: ' + error.message);
    }
}

// 编辑任务
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskCategory').value = task.category;
    document.getElementById('editTaskStatus').value = task.status;
    
    document.getElementById('editTaskModal').style.display = 'block';
}

// 关闭编辑任务模态框
function closeEditTaskModal() {
    document.getElementById('editTaskModal').style.display = 'none';
}

// 更新任务
async function updateTask(event) {
    event.preventDefault();
    
    const taskId = parseInt(document.getElementById('editTaskId').value);
    const taskData = {
        title: document.getElementById('editTaskTitle').value.trim(),
        description: document.getElementById('editTaskDescription').value.trim(),
        priority: parseInt(document.getElementById('editTaskPriority').value),
        category: document.getElementById('editTaskCategory').value,
        status: document.getElementById('editTaskStatus').value
    };
    
    if (!taskData.title) {
        alert('任务标题不能为空');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        if (result.success) {
            closeEditTaskModal();
            loadTasks();
        } else {
            alert('更新失败: ' + result.error);
        }
    } catch (error) {
        alert('网络错误: ' + error.message);
    }
}

// 完成任务
async function completeTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'completed' })
        });
        
        const result = await response.json();
        if (result.success) {
            loadTasks();
        } else {
            alert('操作失败: ' + result.error);
        }
    } catch (error) {
        alert('网络错误: ' + error.message);
    }
}

// 恢复任务
async function uncompleteTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'pending' })
        });
        
        const result = await response.json();
        if (result.success) {
            loadTasks();
        } else {
            alert('操作失败: ' + result.error);
        }
    } catch (error) {
        alert('网络错误: ' + error.message);
    }
}

// 删除任务
async function deleteTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadTasks();
        } else {
            alert('删除失败: ' + result.error);
        }
    } catch (error) {
        alert('网络错误: ' + error.message);
    }
}

// 加载数据分析
async function loadAnalytics() {
    const section = document.getElementById('analyticsSection');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    
    if (section.style.display === 'none') return;
    
    try {
        const response = await fetch('/api/analytics/weekly');
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            
            // 更新统计卡片
            document.getElementById('weeklyCompleted').textContent = data.completed_tasks;
            document.getElementById('totalFocusTime').textContent = Math.round(data.total_focus_time) + ' 分钟';
            document.getElementById('avgFocusTime').textContent = Math.round(data.avg_focus_time) + ' 分钟';
            
            // 绘制图表
            drawTasksChart(data.daily_stats);
            drawCategoryChart(data.tasks_by_category);
            drawFocusTimeChart(data.daily_stats);
        } else {
            showError('加载数据失败: ' + result.error);
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
    }
}

// 绘制任务完成图表
function drawTasksChart(dailyStats) {
    const ctx = document.getElementById('tasksChart').getContext('2d');
    const dates = Object.keys(dailyStats).sort();
    const tasks = dates.map(date => dailyStats[date].tasks);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: '完成任务数',
                data: tasks,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 绘制类别分布图表
function drawCategoryChart(categoryData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const categories = Object.keys(categoryData);
    const counts = Object.values(categoryData);
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories.map(c => getCategoryText(c)),
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, categories.length)
            }]
        },
        options: {
            responsive: true
        }
    });
}

// 绘制专注时间图表
function drawFocusTimeChart(dailyStats) {
    const ctx = document.getElementById('focusTimeChart').getContext('2d');
    const dates = Object.keys(dailyStats).sort();
    const focusTimes = dates.map(date => dailyStats[date].focus_time);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: '专注时间（分钟）',
                data: focusTimes,
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 加载AI推荐
async function loadRecommendation() {
    const section = document.getElementById('recommendationSection');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    
    if (section.style.display === 'none') return;
    
    try {
        const response = await fetch('/api/recommendation');
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('recommendedDuration').textContent = data.recommended_duration;
            document.getElementById('confidence').textContent = (data.confidence * 100).toFixed(0) + '%';
            
            // 显示推荐依据
            const infoList = document.getElementById('recommendationInfo');
            if (data.user_data) {
                infoList.innerHTML = `
                    <li>平均专注时长: ${data.user_data.avg_duration.toFixed(1)} 分钟</li>
                    <li>任务完成率: ${(data.user_data.completion_rate * 100).toFixed(0)}%</li>
                    <li>平均效率: ${(data.user_data.avg_efficiency * 100).toFixed(0)}%</li>
                    <li>高优先级任务比例: ${(data.user_data.high_priority_ratio * 100).toFixed(0)}%</li>
                `;
            } else {
                infoList.innerHTML = '<li>暂无足够的历史数据，使用默认推荐</li>';
            }
        } else {
            showError('加载推荐失败: ' + result.error);
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
    }
}

// 开始专注计时器
function startFocusTimer() {
    // 让用户选择任务
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) {
        alert('没有待完成的任务');
        return;
    }
    
    let taskOptions = '选择要专注的任务:\n';
    pendingTasks.forEach((task, index) => {
        taskOptions += `${index + 1}. ${task.title}\n`;
    });
    
    const choice = prompt(taskOptions + '\n请输入任务编号:');
    const taskIndex = parseInt(choice) - 1;
    
    if (taskIndex >= 0 && taskIndex < pendingTasks.length) {
        currentTimerTaskId = pendingTasks[taskIndex].id;
        document.getElementById('timerTaskTitle').textContent = pendingTasks[taskIndex].title;
        document.getElementById('focusTimerModal').style.display = 'block';
        
        // 获取推荐时长
        fetch('/api/recommendation')
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    const duration = result.data.recommended_duration;
                    setTimer(duration * 60); // 转换为秒
                } else {
                    setTimer(25 * 60); // 默认25分钟
                }
            })
            .catch(() => {
                setTimer(25 * 60);
            });
    }
}

// 设置计时器
function setTimer(seconds) {
    focusTimer = seconds;
    updateTimerDisplay();
}

// 更新计时器显示
function updateTimerDisplay() {
    const minutes = Math.floor(focusTimer / 60);
    const seconds = focusTimer % 60;
    document.getElementById('timerTime').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 切换计时器
function toggleTimer() {
    const btn = document.getElementById('timerStartBtn');
    
    if (timerInterval) {
        // 暂停
        clearInterval(timerInterval);
        timerInterval = null;
        btn.textContent = '继续';
    } else {
        // 开始/继续
        if (!timerStartTime) {
            timerStartTime = Date.now();
        }
        
        timerInterval = setInterval(() => {
            focusTimer--;
            updateTimerDisplay();
            
            if (focusTimer <= 0) {
                stopTimer();
                alert('专注时间到！');
            }
        }, 1000);
        
        btn.textContent = '暂停';
    }
}

// 停止计时器
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (timerStartTime && focusTimer < 25 * 60) {
        // 记录专注时间
        const duration = (25 * 60 - focusTimer) / 60; // 分钟
        recordFocusTime(duration);
    }
    
    timerStartTime = null;
    focusTimer = null;
    document.getElementById('focusTimerModal').style.display = 'none';
    document.getElementById('timerStartBtn').textContent = '开始';
}

// 记录专注时间
async function recordFocusTime(duration) {
    try {
        await fetch('/api/focus-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task_id: currentTimerTaskId,
                duration: duration,
                efficiency_score: 0.7 // 可以根据实际情况调整
            })
        });
    } catch (error) {
        console.error('记录专注时间失败:', error);
    }
}

// 工具函数
function getPriorityClass(priority) {
    const classes = { 1: 'low', 2: 'medium', 3: 'high' };
    return classes[priority] || 'low';
}

function getPriorityText(priority) {
    const texts = { 1: '低优先级', 2: '中优先级', 3: '高优先级' };
    return texts[priority] || '低优先级';
}

function getCategoryText(category) {
    const texts = {
        'work': '工作',
        'study': '学习',
        'general': '一般',
        'creative': '创意'
    };
    return texts[category] || category;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    alert(message);
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

