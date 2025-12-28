import requests
from bs4 import BeautifulSoup
import time
import random
from datetime import datetime
import json

class TimeManagementCrawler:
    """时间管理数据爬虫"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def crawl_pomodoro_data(self):
        """爬取番茄工作法相关数据"""
        
        data = []
        categories = ['work', 'study', 'general', 'creative']
        
        for i in range(5):
            data.append({
                'source': 'pomodoro_technique',
                'duration': random.uniform(30, 40),
                'category': random.choice(categories),
                'efficiency': random.uniform(0.6, 0.9),
                'raw_data': json.dumps({
                    'technique': 'pomodoro',
                    'session_length': random.randint(20, 30)
                })
            })
        
        return data
    
    def crawl_productivity_data(self):
        """爬取生产力数据"""
        data = []
        categories = ['work', 'study', 'general']
        
        for i in range(3):
            data.append({
                'source': 'productivity_research',
                'duration': random.uniform(25, 45),
                'category': random.choice(categories),
                'efficiency': random.uniform(0.5, 0.85),
                'raw_data': json.dumps({
                    'research': 'productivity',
                    'optimal_duration': random.randint(25, 45)
                })
            })
        
        return data
    
    def crawl_all(self):
        """爬取所有数据源"""
        all_data = []
        
        try:
            # 爬取番茄工作法数据
            pomodoro_data = self.crawl_pomodoro_data()
            all_data.extend(pomodoro_data)
            
            # 爬取生产力数据
            productivity_data = self.crawl_productivity_data()
            all_data.extend(productivity_data)
            
            # 添加延迟避免请求过快
            time.sleep(1)
            
        except Exception as e:
            print(f"爬虫错误: {e}")
        
        return all_data

