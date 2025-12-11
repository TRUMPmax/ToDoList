// 全局变量
let tasks = [];
let sortable = null;
let focusTimer = null;
let timerInterval = null;
let timerStartTime = null;
let currentTimerTaskId = null;
let topTimerRunning = false;
let topTimerStartTimestamp = null;
let topTimerPausedDuration = 0;
let topTimerPauseStartTime = null;
let topTimerInterval = null;
let currentChartStyle = 'bar';
let chartInstances = {};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    try {
        loadTasks();
        // 延迟初始化排序，确保任务列表已渲染
        setTimeout(() => {
            initSortable();
        }, 100);
    } catch (error) {
        console.error('初始化错误:', error);
    }
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
    if (!tasksList) return;
    
    const statusFilterEl = document.getElementById('filterStatus');
    const priorityFilterEl = document.getElementById('filterPriority');
    const tagsFilterEl = document.getElementById('filterTags');
    
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';
    const priorityFilter = priorityFilterEl ? priorityFilterEl.value : 'all';
    
    // 过滤任务
    const tagsFilter = tagsFilterEl ? tagsFilterEl.value.trim().toLowerCase() : '';
    let filteredTasks = tasks.filter(task => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && task.priority != priorityFilter) return false;
        if (tagsFilter) {
            const taskTags = (task.tags || '').toLowerCase();
            const filterTags = tagsFilter.split(',').map(t => t.trim());
            const hasMatchingTag = filterTags.some(tag => taskTags.includes(tag));
            if (!hasMatchingTag) return false;
        }
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
                    ${task.tags ? task.tags.split(',').map(tag => `<span class="task-badge badge-tag">${escapeHtml(tag.trim())}</span>`).join('') : ''}
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
    try {
        renderTasks();
    } catch (error) {
        console.error('过滤任务时出错:', error);
        // 如果出错，至少尝试重新加载任务列表
        loadTasks();
    }
}

// 显示添加任务模态框
function showAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    const titleInput = document.getElementById('taskTitle');
    
    if (!modal) {
        alert('添加任务表单未找到，请刷新页面重试');
        return;
    }
    
    modal.style.display = 'block';
    if (titleInput) {
        titleInput.focus();
    }
}

// 关闭添加任务模态框
function closeAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    const form = document.getElementById('addTaskForm');
    
    if (modal) {
        modal.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

// 创建任务
async function createTask(event) {
    event.preventDefault();
    
    const titleEl = document.getElementById('taskTitle');
    const descriptionEl = document.getElementById('taskDescription');
    const priorityEl = document.getElementById('taskPriority');
    const tagsEl = document.getElementById('taskTags');
    
    if (!titleEl || !priorityEl) {
        alert('表单元素未找到，请刷新页面重试');
        return;
    }
    
    const taskData = {
        title: titleEl.value.trim(),
        description: descriptionEl ? descriptionEl.value.trim() : '',
        priority: parseInt(priorityEl.value) || 1,
        tags: tagsEl ? tagsEl.value.trim() : ''
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
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            closeAddTaskModal();
            loadTasks();
        } else {
            alert('创建失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('创建任务错误:', error);
        alert('创建任务时出错: ' + (error.message || '请检查网络连接或刷新页面重试'));
    }
}

// 编辑任务
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const editTaskIdEl = document.getElementById('editTaskId');
    const editTaskTitleEl = document.getElementById('editTaskTitle');
    const editTaskDescriptionEl = document.getElementById('editTaskDescription');
    const editTaskPriorityEl = document.getElementById('editTaskPriority');
    const editTaskTagsEl = document.getElementById('editTaskTags');
    const editTaskStatusEl = document.getElementById('editTaskStatus');
    const editTaskModalEl = document.getElementById('editTaskModal');
    
    if (!editTaskIdEl || !editTaskTitleEl || !editTaskPriorityEl || !editTaskStatusEl || !editTaskModalEl) {
        alert('编辑表单元素未找到，请刷新页面重试');
        return;
    }
    
    editTaskIdEl.value = task.id;
    editTaskTitleEl.value = task.title;
    if (editTaskDescriptionEl) editTaskDescriptionEl.value = task.description || '';
    editTaskPriorityEl.value = task.priority;
    if (editTaskTagsEl) editTaskTagsEl.value = task.tags || '';
    editTaskStatusEl.value = task.status;
    
    editTaskModalEl.style.display = 'block';
}

// 关闭编辑任务模态框
function closeEditTaskModal() {
    document.getElementById('editTaskModal').style.display = 'none';
}

// 更新任务
async function updateTask(event) {
    event.preventDefault();
    
    const editTaskIdEl = document.getElementById('editTaskId');
    const editTaskTitleEl = document.getElementById('editTaskTitle');
    const editTaskDescriptionEl = document.getElementById('editTaskDescription');
    const editTaskPriorityEl = document.getElementById('editTaskPriority');
    const editTaskTagsEl = document.getElementById('editTaskTags');
    const editTaskStatusEl = document.getElementById('editTaskStatus');
    
    if (!editTaskIdEl || !editTaskTitleEl || !editTaskPriorityEl || !editTaskStatusEl) {
        alert('表单元素未找到，请刷新页面重试');
        return;
    }
    
    const taskId = parseInt(editTaskIdEl.value);
    const taskData = {
        title: editTaskTitleEl.value.trim(),
        description: editTaskDescriptionEl ? editTaskDescriptionEl.value.trim() : '',
        priority: parseInt(editTaskPriorityEl.value) || 1,
        tags: editTaskTagsEl ? editTaskTagsEl.value.trim() : '',
        status: editTaskStatusEl.value
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
            document.getElementById('todayCompleted').textContent = data.today_completed || 0;
            document.getElementById('weeklyCompleted').textContent = data.completed_tasks;
            document.getElementById('totalFocusTime').textContent = Math.round(data.total_focus_time) + ' 分钟';
            document.getElementById('avgFocusTime').textContent = Math.round(data.avg_focus_time) + ' 分钟';
            
            // 绘制图表
            drawTasksChart(data.daily_stats);
            drawTagsChart(data.tasks_by_tags || {});
            drawFocusTimeChart(data.daily_stats);
            drawFocusDurationChart(data.focus_durations || []);
        } else {
            showError('加载数据失败: ' + result.error);
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
    }
}

// 绘制任务完成图表
function drawTasksChart(dailyStats) {
    const ctx = document.getElementById('tasksChart');
    if (chartInstances.tasksChart) {
        chartInstances.tasksChart.destroy();
    }
    
    const dates = Object.keys(dailyStats).sort();
    const tasks = dates.map(date => dailyStats[date].tasks);
    
    const chartType = currentChartStyle === 'area' ? 'line' : currentChartStyle;
    
    chartInstances.tasksChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: '完成任务数',
                data: tasks,
                backgroundColor: currentChartStyle === 'area' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                fill: currentChartStyle === 'area',
                tension: currentChartStyle === 'line' || currentChartStyle === 'area' ? 0.4 : 0
            }]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    enabled: true
                },
                legend: {
                    display: true
                }
            }
        }
    });
}

// 绘制标签分布图表
function drawTagsChart(tagsData) {
    const ctx = document.getElementById('tagsChart');
    if (chartInstances.tagsChart) {
        chartInstances.tagsChart.destroy();
    }
    
    const tags = Object.keys(tagsData);
    const counts = Object.values(tagsData);
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4BC0C0', '#FF6384'];
    
    if (tags.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    chartInstances.tagsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: tags,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, tags.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// 绘制专注时长分布图表
function drawFocusDurationChart(durations) {
    const ctx = document.getElementById('focusDurationChart');
    if (chartInstances.focusDurationChart) {
        chartInstances.focusDurationChart.destroy();
    }
    
    if (durations.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    // 将时长分组（0-15, 15-30, 30-45, 45-60, 60+）
    const bins = [0, 0, 0, 0, 0];
    const labels = ['0-15分钟', '15-30分钟', '30-45分钟', '45-60分钟', '60+分钟'];
    
    durations.forEach(d => {
        if (d < 15) bins[0]++;
        else if (d < 30) bins[1]++;
        else if (d < 45) bins[2]++;
        else if (d < 60) bins[3]++;
        else bins[4]++;
    });
    
    chartInstances.focusDurationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: bins,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// 绘制专注时间图表
function drawFocusTimeChart(dailyStats) {
    const ctx = document.getElementById('focusTimeChart');
    if (chartInstances.focusTimeChart) {
        chartInstances.focusTimeChart.destroy();
    }
    
    const dates = Object.keys(dailyStats).sort();
    const focusTimes = dates.map(date => dailyStats[date].focus_time);
    
    const chartType = currentChartStyle === 'bar' ? 'bar' : 'line';
    
    chartInstances.focusTimeChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: '专注时间（分钟）',
                data: focusTimes,
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: chartType === 'bar' ? 'rgba(76, 175, 80, 0.6)' : 'rgba(76, 175, 80, 0.1)',
                tension: chartType === 'line' ? 0.4 : 0,
                fill: chartType === 'line',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    enabled: true
                }
            }
        }
    });
}

// 切换图表风格
function changeChartStyle(style) {
    currentChartStyle = style;
    
    // 更新按钮状态
    document.querySelectorAll('.btn-chart-style').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-style') === style) {
            btn.classList.add('active');
        }
    });
    
    // 重新绘制图表
    if (document.getElementById('analyticsSection').style.display !== 'none') {
        loadAnalytics();
    }
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

// 顶部计时器功能
function startTopTimer() {
    if (topTimerRunning) return;
    
    // 如果是继续计时，需要从暂停的时间点继续
    if (topTimerPausedDuration > 0) {
        // 已经有暂停的时间，继续计时
        resumeTopTimer();
        return;
    }
    
    // 全新开始
    topTimerStartTimestamp = Date.now();
    topTimerRunning = true;
    topTimerPausedDuration = 0;
    topTimerPauseStartTime = null;
    
    document.getElementById('topTimerStartBtn').style.display = 'none';
    document.getElementById('topTimerStopBtn').style.display = 'inline-block';
    document.getElementById('topTimerPauseBtn').style.display = 'inline-block';
    document.getElementById('topTimerPauseBtn').textContent = '暂停';
    
    // 清除可能存在的旧计时器
    if (topTimerInterval) {
        clearInterval(topTimerInterval);
    }
    
    // 启动新的计时器
    topTimerInterval = setInterval(() => {
        if (topTimerRunning && topTimerStartTimestamp) {
            const elapsed = (Date.now() - topTimerStartTimestamp) / 1000 + topTimerPausedDuration;
            updateTopTimerDisplay(elapsed);
        }
    }, 100);
}

function resumeTopTimer() {
    if (topTimerRunning) return;
    
    // 继续计时：从新的时间戳开始，但显示时要加上已累计的时间
    topTimerStartTimestamp = Date.now();
    topTimerRunning = true;
    topTimerPauseStartTime = null;
    
    document.getElementById('topTimerPauseBtn').textContent = '暂停';
    
    // 清除可能存在的旧计时器
    if (topTimerInterval) {
        clearInterval(topTimerInterval);
    }
    
    // 重新启动计时器，显示时加上已累计的暂停时间
    topTimerInterval = setInterval(() => {
        if (topTimerRunning && topTimerStartTimestamp) {
            const currentElapsed = (Date.now() - topTimerStartTimestamp) / 1000;
            const totalElapsed = currentElapsed + topTimerPausedDuration;
            updateTopTimerDisplay(totalElapsed);
        }
    }, 100);
}

function pauseTopTimer() {
    if (!topTimerRunning) {
        // 如果已经暂停，则继续
        resumeTopTimer();
        return;
    }
    
    // 暂停时：累计当前已运行的时间到总时间中
    if (topTimerStartTimestamp) {
        const currentElapsed = (Date.now() - topTimerStartTimestamp) / 1000;
        topTimerPausedDuration += currentElapsed; // 累加到总时间
        topTimerStartTimestamp = null; // 清除开始时间
        
        // 更新显示为累计的总时间（暂停时显示固定值）
        updateTopTimerDisplay(topTimerPausedDuration);
    }
    
    // 停止计时器（重要：清除setInterval，这样时间就不会继续走）
    if (topTimerInterval) {
        clearInterval(topTimerInterval);
        topTimerInterval = null;
    }
    
    topTimerRunning = false;
    topTimerPauseStartTime = Date.now();
    
    document.getElementById('topTimerPauseBtn').textContent = '继续';
}

function stopTopTimer() {
    // 计算总时间
    let totalSeconds = topTimerPausedDuration;
    
    if (topTimerRunning && topTimerStartTimestamp) {
        // 如果正在运行，加上当前运行的时间
        const currentElapsed = (Date.now() - topTimerStartTimestamp) / 1000;
        totalSeconds = topTimerPausedDuration + currentElapsed;
    }
    
    const duration = totalSeconds / 60; // 转换为分钟
    
    // 停止计时器
    if (topTimerInterval) {
        clearInterval(topTimerInterval);
        topTimerInterval = null;
    }
    
    // 记录专注时间
    if (duration > 0.1) { // 至少记录0.1分钟
        recordFocusTimeFromTopTimer(duration);
    }
    
    // 重置所有状态
    topTimerRunning = false;
    topTimerStartTimestamp = null;
    topTimerPausedDuration = 0;
    topTimerPauseStartTime = null;
    
    document.getElementById('topTimerDisplay').textContent = '00:00:00';
    document.getElementById('topTimerStartBtn').style.display = 'inline-block';
    document.getElementById('topTimerStopBtn').style.display = 'none';
    document.getElementById('topTimerPauseBtn').style.display = 'none';
    document.getElementById('topTimerPauseBtn').textContent = '暂停';
}

function updateTopTimerDisplay(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    document.getElementById('topTimerDisplay').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function recordFocusTimeFromTopTimer(duration) {
    try {
        const endTime = new Date().toISOString();
        const startTime = new Date(Date.now() - duration * 60 * 1000).toISOString();
        
        await fetch('/api/focus-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                duration: duration,
                start_time: startTime,
                end_time: endTime,
                efficiency_score: 0.7
            })
        });
        
        // 刷新任务列表
        loadTasks();
    } catch (error) {
        console.error('记录专注时间失败:', error);
    }
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

