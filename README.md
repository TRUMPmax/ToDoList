# 智能日程表Web应用

一个功能完整的任务管理系统，支持任务管理、数据分析、机器学习推荐和可视化展示。

## 功能特性

- ✅ 任务增删改查
- ✅ 任务优先级管理
- ✅ 拖拽排序
- ✅ 数据分析和可视化
- ✅ 专注时间预测和推荐
- ✅ 爬虫数据补充

## 安装和运行

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行应用：
```bash
python app.py
```

3. 访问应用：
打开浏览器访问 `http://localhost:5000`

## 项目结构

```
TODO/
├── app.py                 # Flask主应用
├── models.py             # 数据库模型
├── ml_model.py           # 机器学习模型
├── crawler.py            # 爬虫模块
├── static/               # 静态文件
│   ├── css/
│   ├── js/
│   └── images/
├── templates/            # HTML模板
│   └── index.html
└── database.db          # SQLite数据库（自动生成）
```

## 技术栈

- 后端：Flask, SQLAlchemy
- 前端：HTML5, CSS3, JavaScript, Chart.js, Sortable.js
- 数据库：SQLite
- 机器学习：scikit-learn
- 可视化：Chart.js

