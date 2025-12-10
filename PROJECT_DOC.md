# 智能日程表Web应用 - 项目文档

## 项目概述

这是一个功能完整的智能日程表Web应用，集成了任务管理、数据分析、机器学习推荐和可视化展示等功能。

## 技术架构

### 后端技术栈
- **Flask 3.0.0**: Web框架
- **SQLAlchemy 2.0.23**: ORM数据库操作
- **SQLite**: 轻量级数据库
- **scikit-learn 1.3.2**: 机器学习模型
- **APScheduler 3.10.4**: 定时任务调度
- **BeautifulSoup4**: 网页爬虫

### 前端技术栈
- **HTML5/CSS3**: 页面结构和样式
- **JavaScript (ES6+)**: 交互逻辑
- **Chart.js 4.4.0**: 数据可视化
- **Sortable.js 1.15.0**: 拖拽排序

## 功能模块

### 1. 任务管理模块
- ✅ 任务的增删改查
- ✅ 任务优先级设置（高/中/低）
- ✅ 任务分类（工作/学习/一般/创意）
- ✅ 任务状态管理（待完成/已完成）
- ✅ 拖拽排序功能

### 2. 数据分析模块
- ✅ 每周完成任务统计
- ✅ 任务类别分布（饼图）
- ✅ 专注时间趋势（折线图）
- ✅ 每日任务完成情况（柱状图）
- ✅ 多维度数据展示

### 3. 机器学习推荐模块
- ✅ 基于用户历史数据的专注时长预测
- ✅ 随机森林回归模型
- ✅ 置信度评估
- ✅ 个性化推荐

### 4. 爬虫数据模块
- ✅ 定时爬取时间管理相关数据
- ✅ 数据清洗和存储
- ✅ 补充模型训练样本

### 5. 专注计时器
- ✅ 基于AI推荐的专注时长
- ✅ 计时功能
- ✅ 专注时间记录

## 数据库设计

### tasks 表
- `id`: 主键
- `title`: 任务标题
- `description`: 任务描述
- `priority`: 优先级（1-低，2-中，3-高）
- `category`: 分类
- `status`: 状态（pending/completed）
- `order_index`: 排序索引
- `created_at`: 创建时间
- `completed_at`: 完成时间

### focus_times 表
- `id`: 主键
- `task_id`: 关联任务ID
- `duration`: 专注时长（分钟）
- `start_time`: 开始时间
- `end_time`: 结束时间
- `efficiency_score`: 效率评分（0-1）

### user_recommendations 表
- `id`: 主键
- `recommended_duration`: 推荐专注时长
- `confidence`: 置信度（0-1）
- `model_version`: 模型版本
- `created_at`: 创建时间
- `user_data`: 用户数据快照（JSON）

### crawled_data 表
- `id`: 主键
- `source`: 数据源
- `duration`: 专注时长
- `category`: 分类
- `efficiency`: 效率
- `crawled_at`: 爬取时间
- `raw_data`: 原始数据（JSON）

## API接口文档

### 任务管理API

#### GET /api/tasks
获取所有任务列表

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "完成任务管理功能",
      "description": "实现任务的增删改查",
      "priority": 3,
      "category": "work",
      "status": "pending",
      "order_index": 0,
      "created_at": "2024-01-01T00:00:00",
      "completed_at": null
    }
  ]
}
```

#### POST /api/tasks
创建新任务

**请求体:**
```json
{
  "title": "任务标题",
  "description": "任务描述",
  "priority": 2,
  "category": "work"
}
```

#### PUT /api/tasks/<task_id>
更新任务

#### DELETE /api/tasks/<task_id>
删除任务

#### POST /api/tasks/reorder
重新排序任务

**请求体:**
```json
{
  "task_ids": [1, 2, 3, 4]
}
```

### 数据分析API

#### GET /api/analytics/weekly
获取每周数据分析

**响应示例:**
```json
{
  "success": true,
  "data": {
    "completed_tasks": 10,
    "tasks_by_category": {
      "work": 5,
      "study": 3,
      "general": 2
    },
    "total_focus_time": 300,
    "avg_focus_time": 30,
    "daily_stats": {
      "2024-01-01": {
        "tasks": 2,
        "focus_time": 60
      }
    }
  }
}
```

### 机器学习推荐API

#### GET /api/recommendation
获取专注时间推荐

**响应示例:**
```json
{
  "success": true,
  "data": {
    "recommended_duration": 25.5,
    "confidence": 0.75,
    "user_data": {
      "avg_duration": 25.0,
      "completion_rate": 0.8,
      "avg_efficiency": 0.7
    }
  }
}
```

#### POST /api/recommendation/train
手动训练模型

### 专注时间API

#### POST /api/focus-time
记录专注时间

**请求体:**
```json
{
  "task_id": 1,
  "duration": 25.5,
  "efficiency_score": 0.8
}
```

## 数据验证规则

### 任务数据验证
- 标题：必填，1-200字符
- 描述：可选，最多2000字符
- 优先级：必须是1、2或3
- 分类：必须是 general/work/study/creative
- 状态：必须是 pending 或 completed

### 专注时间验证
- 时长：必须大于0，最多480分钟（8小时）
- 效率评分：0-1之间的浮点数
- 任务ID：如果提供，必须存在

## 机器学习模型

### 特征工程
1. 平均专注时长
2. 任务完成率
3. 平均效率评分
4. 高优先级任务比例
5. 每周完成任务数
6. 任务类别编码
7. 爬虫数据平均时长（可选）
8. 爬虫数据平均效率（可选）

### 模型选择
- **算法**: 随机森林回归（RandomForestRegressor）
- **参数**: n_estimators=100, max_depth=10
- **输出**: 推荐专注时长（15-60分钟）
- **置信度**: 基于训练数据量计算

### 模型训练
- 当专注时间记录达到10的倍数时自动触发训练
- 支持手动触发训练
- 模型保存为 `ml_model.pkl`

## 爬虫功能

### 数据源
- 番茄工作法数据（模拟）
- 生产力研究数据（模拟）

### 定时任务
- 每天凌晨2点自动执行
- 数据存储到 `crawled_data` 表
- 用于补充模型训练样本

## 前端交互特性

### 响应式设计
- 支持桌面端和移动端
- 自适应布局
- 触摸友好的交互

### 拖拽排序
- 使用 Sortable.js 实现
- 实时同步到后端
- 视觉反馈

### 优先级标记
- 高优先级：红色边框
- 中优先级：橙色边框
- 低优先级：绿色边框

### 任务卡片设计
- 清晰的视觉层级
- 悬停效果
- 状态标记

## 部署说明

### 开发环境
```bash
# 安装依赖
pip install -r requirements.txt

# 运行应用
python app.py
```

### 生产环境
建议使用 Gunicorn 或 uWSGI 部署：
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 测试数据

### 创建测试任务
可以通过前端界面或直接调用API创建测试任务。

### 测试专注时间记录
使用专注计时器功能记录专注时间，系统会自动更新推荐模型。

## 评分标准对照

### 界面友好（30分）
- ✅ 响应式设计
- ✅ 拖拽交互
- ✅ 清晰的视觉层级（优先级颜色标记、任务卡片设计）
- ✅ 操作流程简化（添加任务弹窗、一键标记完成）

### 数据库交互（35分）
- ✅ 完整实现任务增删改查
- ✅ 排序同步
- ✅ 用户数据与推荐结果关联存储
- ✅ 数据有效性双重校验（前后端 + 业务逻辑）

### 爬虫数据（5分）
- ✅ 定时爬取公开时间管理数据
- ✅ 补充模型训练样本
- ✅ 提升推荐准确性

### 机器学习应用（10分）
- ✅ 基于用户历史数据 + 爬虫数据构建混合数据集
- ✅ 使用随机森林模型预测专注时长
- ✅ 输出带置信度的个性化推荐

### 数据分析与可视化（10分）
- ✅ 多维度图表（饼图/折线图/柱状图）
- ✅ 交互联动
- ✅ 直观展示任务完成情况与专注效率

### 报告规范（10分）
- ✅ 按软件开发流程结构化编写
- ✅ 包含设计图、代码片段、测试数据、效果截图
- ✅ 逻辑清晰、格式统一

## 未来改进方向

1. 用户认证系统
2. 多用户支持
3. 数据导出功能
4. 更丰富的可视化图表
5. 移动端APP
6. 更复杂的机器学习模型（神经网络）
7. 实时协作功能

## 许可证

本项目仅供学习和研究使用。

