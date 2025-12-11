from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Task(db.Model):
    """任务模型"""
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.Integer, default=1)  # 1-低, 2-中, 3-高
    tags = db.Column(db.String(500), default='')  # 自定义标签，多个标签用逗号分隔
    status = db.Column(db.String(20), default='pending')  # pending, completed
    order_index = db.Column(db.Integer, default=0)  # 用于排序
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'tags': self.tags,
            'status': self.status,
            'order_index': self.order_index,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class FocusTime(db.Model):
    """专注时间记录"""
    __tablename__ = 'focus_times'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    duration = db.Column(db.Float, nullable=False)  # 分钟
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    efficiency_score = db.Column(db.Float, default=0.0)  # 效率评分 0-1
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'duration': self.duration,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'efficiency_score': self.efficiency_score
        }

class UserRecommendation(db.Model):
    """用户推荐结果"""
    __tablename__ = 'user_recommendations'
    
    id = db.Column(db.Integer, primary_key=True)
    recommended_duration = db.Column(db.Float, nullable=False)  # 推荐专注时长（分钟）
    confidence = db.Column(db.Float, default=0.0)  # 置信度 0-1
    model_version = db.Column(db.String(50), default='v1.0')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_data = db.Column(db.Text)  # JSON格式存储用户数据快照
    
    def to_dict(self):
        return {
            'id': self.id,
            'recommended_duration': self.recommended_duration,
            'confidence': self.confidence,
            'model_version': self.model_version,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_data': json.loads(self.user_data) if self.user_data else None
        }

class CrawledData(db.Model):
    """爬虫数据"""
    __tablename__ = 'crawled_data'
    
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(200))
    duration = db.Column(db.Float)
    category = db.Column(db.String(50))
    efficiency = db.Column(db.Float)
    crawled_at = db.Column(db.DateTime, default=datetime.utcnow)
    raw_data = db.Column(db.Text)  # JSON格式原始数据
    
    def to_dict(self):
        return {
            'id': self.id,
            'source': self.source,
            'duration': self.duration,
            'category': self.category,
            'efficiency': self.efficiency,
            'crawled_at': self.crawled_at.isoformat() if self.crawled_at else None
        }

