import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os
from datetime import datetime, timedelta

class FocusTimePredictor:
    """专注时间预测模型"""
    
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        self.scaler = StandardScaler()
        self.is_trained = True
        
    def prepare_features(self, user_data, crawled_data=None):
        """准备特征数据"""
        features = []
        
        # 用户历史数据特征
        if user_data:
            # 平均专注时长
            avg_duration = user_data.get('avg_duration', 25.0)
            # 任务完成率
            completion_rate = user_data.get('completion_rate', 0.5)
            # 平均效率评分
            avg_efficiency = user_data.get('avg_efficiency', 0.5)
            # 任务优先级分布
            high_priority_ratio = user_data.get('high_priority_ratio', 0.3)
            # 每周完成任务数
            weekly_completed = user_data.get('weekly_completed', 5)
            # 任务标签编码
            tag_encoded = user_data.get('tag_encoded', 0)
            
            features = [
                avg_duration,
                completion_rate,
                avg_efficiency,
                high_priority_ratio,
                weekly_completed,
                tag_encoded
            ]
        else:
            # 默认特征
            features = [25.0, 0.5, 0.5, 0.3, 5, 0]
        
        # 添加爬虫数据特征（如果可用）
        if crawled_data:
            features.append(crawled_data.get('avg_duration', 25.0))
            features.append(crawled_data.get('avg_efficiency', 0.5))
        else:
            features.extend([25.0, 0.5])
        
        return np.array(features).reshape(1, -1)
    
    def train(self, X, y):
        """训练模型"""
        if len(X) < 2:
            # 数据不足，使用默认模型
            self.is_trained = False
            return False
        
        try:
            X_scaled = self.scaler.fit_transform(X)
            self.model.fit(X_scaled, y)
            self.is_trained = True
            return True
        except Exception as e:
            print(f"训练模型时出错: {e}")
            self.is_trained = False
            return False
    
    def predict(self, user_data, crawled_data=None):
        """预测专注时长"""
        features = self.prepare_features(user_data, crawled_data)
        
        if not self.is_trained:
            # 使用简单规则作为后备
            avg_duration = user_data.get('avg_duration', 25.0) if user_data else 25.0
            confidence = 0.3
            return max(15.0, min(60.0, avg_duration * 1.1)), confidence
        
        try:
            features_scaled = self.scaler.transform(features)
            prediction = self.model.predict(features_scaled)[0]
            
            # 计算置信度（基于训练数据量）
            confidence = min(0.9, 0.3 + len(features) * 0.1)
            
            # 限制预测范围在15-60分钟
            prediction = max(15.0, min(60.0, prediction))
            
            return prediction, confidence
        except Exception as e:
            print(f"预测时出错: {e}")
            avg_duration = user_data.get('avg_duration', 25.0) if user_data else 25.0
            return max(15.0, min(60.0, avg_duration)), 0.3
    
    def save_model(self, filepath='ml_model.pkl'):
        """保存模型"""
        try:
            with open(filepath, 'wb') as f:
                pickle.dump({
                    'model': self.model,
                    'scaler': self.scaler,
                    'is_trained': self.is_trained
                }, f)
        except Exception as e:
            print(f"保存模型时出错: {e}")
    
    def load_model(self, filepath='ml_model.pkl'):
        """加载模型"""
        if not os.path.exists(filepath):
            return False
        
        try:
            with open(filepath, 'rb') as f:
                data = pickle.load(f)
                self.model = data['model']
                self.scaler = data['scaler']
                self.is_trained = data['is_trained']
            return True
        except Exception as e:
            print(f"加载模型时出错: {e}")
            return False

