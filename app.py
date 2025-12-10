from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from models import db, Task, FocusTime, UserRecommendation, CrawledData
from ml_model import FocusTimePredictor
from crawler import TimeManagementCrawler
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import json
import os
import numpy as np

app = Flask(__name__)
CORS(app)

# 配置数据库
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# 初始化模型和爬虫
ml_predictor = FocusTimePredictor()
crawler = TimeManagementCrawler()

# 定时任务：每天爬取数据
scheduler = BackgroundScheduler()
scheduler.start()

def scheduled_crawl():
    """定时爬取任务"""
    with app.app_context():
        try:
            data = crawler.crawl_all()
            for item in data:
                crawled = CrawledData(
                    source=item['source'],
                    duration=item['duration'],
                    category=item['category'],
                    efficiency=item['efficiency'],
                    raw_data=item['raw_data']
                )
                db.session.add(crawled)
            db.session.commit()
            print(f"爬取完成，获得 {len(data)} 条数据")
        except Exception as e:
            print(f"定时爬取错误: {e}")

# 每天凌晨2点执行爬取
scheduler.add_job(scheduled_crawl, 'cron', hour=2, minute=0)

# ============ 任务管理API ============

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """获取所有任务"""
    try:
        tasks = Task.query.order_by(Task.order_index.asc()).all()
        return jsonify({
            'success': True,
            'data': [task.to_dict() for task in tasks]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """创建任务"""
    try:
        if not request.json:
            return jsonify({'success': False, 'error': '请求数据不能为空'}), 400
        
        data = request.json
        
        # 数据验证
        title = data.get('title', '').strip()
        if not title:
            return jsonify({'success': False, 'error': '任务标题不能为空'}), 400
        if len(title) > 200:
            return jsonify({'success': False, 'error': '任务标题不能超过200个字符'}), 400
        
        priority = data.get('priority', 1)
        if priority not in [1, 2, 3]:
            return jsonify({'success': False, 'error': '优先级必须是1、2或3'}), 400
        
        category = data.get('category', 'general')
        valid_categories = ['general', 'work', 'study', 'creative']
        if category not in valid_categories:
            return jsonify({'success': False, 'error': f'分类必须是: {", ".join(valid_categories)}'}), 400
        
        description = data.get('description', '').strip()
        if len(description) > 2000:
            return jsonify({'success': False, 'error': '任务描述不能超过2000个字符'}), 400
        
        # 获取当前最大order_index
        max_order = db.session.query(db.func.max(Task.order_index)).scalar() or 0
        
        task = Task(
            title=title,
            description=description,
            priority=priority,
            category=category,
            order_index=max_order + 1
        )
        
        db.session.add(task)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': task.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """更新任务"""
    try:
        task = Task.query.get_or_404(task_id)
        
        if not request.json:
            return jsonify({'success': False, 'error': '请求数据不能为空'}), 400
        
        data = request.json
        
        # 更新字段并验证
        if 'title' in data:
            title = data['title'].strip() if isinstance(data['title'], str) else ''
            if not title:
                return jsonify({'success': False, 'error': '任务标题不能为空'}), 400
            if len(title) > 200:
                return jsonify({'success': False, 'error': '任务标题不能超过200个字符'}), 400
            task.title = title
        
        if 'description' in data:
            description = data['description'].strip() if isinstance(data['description'], str) else ''
            if len(description) > 2000:
                return jsonify({'success': False, 'error': '任务描述不能超过2000个字符'}), 400
            task.description = description
        
        if 'priority' in data:
            priority = data['priority']
            if priority not in [1, 2, 3]:
                return jsonify({'success': False, 'error': '优先级必须是1、2或3'}), 400
            task.priority = priority
        
        if 'category' in data:
            category = data['category']
            valid_categories = ['general', 'work', 'study', 'creative']
            if category not in valid_categories:
                return jsonify({'success': False, 'error': f'分类必须是: {", ".join(valid_categories)}'}), 400
            task.category = category
        
        if 'status' in data:
            status = data['status']
            if status not in ['pending', 'completed']:
                return jsonify({'success': False, 'error': '状态必须是pending或completed'}), 400
            task.status = status
            if status == 'completed' and not task.completed_at:
                task.completed_at = datetime.utcnow()
            elif status == 'pending':
                task.completed_at = None
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': task.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """删除任务"""
    try:
        task = Task.query.get_or_404(task_id)
        db.session.delete(task)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/reorder', methods=['POST'])
def reorder_tasks():
    """重新排序任务"""
    try:
        if not request.json:
            return jsonify({'success': False, 'error': '请求数据不能为空'}), 400
        
        data = request.json
        task_ids = data.get('task_ids', [])
        
        if not task_ids or not isinstance(task_ids, list):
            return jsonify({'success': False, 'error': '任务ID列表不能为空且必须是数组'}), 400
        
        # 验证所有任务ID都是整数
        try:
            task_ids = [int(tid) for tid in task_ids]
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': '任务ID必须是整数'}), 400
        
        # 更新每个任务的order_index
        updated_count = 0
        for index, task_id in enumerate(task_ids):
            task = Task.query.get(task_id)
            if task:
                task.order_index = index
                updated_count += 1
        
        if updated_count == 0:
            return jsonify({'success': False, 'error': '没有找到有效的任务'}), 404
        
        db.session.commit()
        
        return jsonify({'success': True, 'updated': updated_count})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ 专注时间API ============

@app.route('/api/focus-time', methods=['POST'])
def record_focus_time():
    """记录专注时间"""
    try:
        if not request.json:
            return jsonify({'success': False, 'error': '请求数据不能为空'}), 400
        
        data = request.json
        
        duration = data.get('duration')
        if not duration or not isinstance(duration, (int, float)) or duration <= 0:
            return jsonify({'success': False, 'error': '专注时长必须大于0'}), 400
        if duration > 480:  # 最多8小时
            return jsonify({'success': False, 'error': '专注时长不能超过480分钟'}), 400
        
        task_id = data.get('task_id')
        if task_id:
            # 验证任务是否存在
            task = Task.query.get(task_id)
            if not task:
                return jsonify({'success': False, 'error': '任务不存在'}), 404
        
        efficiency_score = data.get('efficiency_score', 0.5)
        if not isinstance(efficiency_score, (int, float)) or efficiency_score < 0 or efficiency_score > 1:
            efficiency_score = 0.5
        
        focus_time = FocusTime(
            task_id=task_id,
            duration=duration,
            efficiency_score=efficiency_score
        )
        
        if data.get('end_time'):
            try:
                focus_time.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            except:
                focus_time.end_time = datetime.utcnow()
        
        db.session.add(focus_time)
        db.session.commit()
        
        # 记录后更新推荐模型
        update_recommendation()
        
        return jsonify({
            'success': True,
            'data': focus_time.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ 数据分析API ============

@app.route('/api/analytics/weekly', methods=['GET'])
def get_weekly_analytics():
    """获取每周数据分析"""
    try:
        # 获取最近7天的数据
        week_ago = datetime.utcnow() - timedelta(days=7)
        
        # 完成任务数
        completed_tasks = Task.query.filter(
            Task.status == 'completed',
            Task.completed_at >= week_ago
        ).count()
        
        # 按类别统计
        tasks_by_category = db.session.query(
            Task.category,
            db.func.count(Task.id)
        ).filter(
            Task.completed_at >= week_ago,
            Task.status == 'completed'
        ).group_by(Task.category).all()
        
        category_data = {cat: count for cat, count in tasks_by_category}
        
        # 专注时间统计
        focus_times = FocusTime.query.filter(
            FocusTime.start_time >= week_ago
        ).all()
        
        total_focus_time = sum(ft.duration for ft in focus_times)
        avg_focus_time = total_focus_time / len(focus_times) if focus_times else 0
        
        # 按日期统计
        daily_stats = {}
        for i in range(7):
            date = (datetime.utcnow() - timedelta(days=i)).date()
            day_tasks = Task.query.filter(
                Task.status == 'completed',
                db.func.date(Task.completed_at) == date
            ).count()
            day_focus = FocusTime.query.filter(
                db.func.date(FocusTime.start_time) == date
            ).all()
            day_focus_time = sum(ft.duration for ft in day_focus)
            
            daily_stats[date.isoformat()] = {
                'tasks': day_tasks,
                'focus_time': day_focus_time
            }
        
        return jsonify({
            'success': True,
            'data': {
                'completed_tasks': completed_tasks,
                'tasks_by_category': category_data,
                'total_focus_time': total_focus_time,
                'avg_focus_time': avg_focus_time,
                'daily_stats': daily_stats
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ 机器学习推荐API ============

def get_user_data():
    """获取用户数据用于模型训练和预测"""
    try:
        # 获取最近30天的数据
        month_ago = datetime.utcnow() - timedelta(days=30)
        
        # 专注时间数据
        focus_times = FocusTime.query.filter(
            FocusTime.start_time >= month_ago
        ).all()
        
        if not focus_times:
            return None
        
        durations = [ft.duration for ft in focus_times]
        efficiencies = [ft.efficiency_score for ft in focus_times]
        
        # 任务数据
        tasks = Task.query.filter(
            Task.created_at >= month_ago
        ).all()
        
        completed_tasks = [t for t in tasks if t.status == 'completed']
        high_priority_tasks = [t for t in tasks if t.priority == 3]
        
        # 计算特征
        avg_duration = sum(durations) / len(durations) if durations else 25.0
        avg_efficiency = sum(efficiencies) / len(efficiencies) if efficiencies else 0.5
        completion_rate = len(completed_tasks) / len(tasks) if tasks else 0.5
        high_priority_ratio = len(high_priority_tasks) / len(tasks) if tasks else 0.3
        
        # 每周完成任务数（估算）
        weekly_completed = len(completed_tasks) / 4.0
        
        # 任务类别编码（简化）
        categories = {}
        for task in tasks:
            cat = task.category
            categories[cat] = categories.get(cat, 0) + 1
        main_category = max(categories.items(), key=lambda x: x[1])[0] if categories else 'general'
        category_encoded = hash(main_category) % 10  # 简单编码
        
        return {
            'avg_duration': avg_duration,
            'avg_efficiency': avg_efficiency,
            'completion_rate': completion_rate,
            'high_priority_ratio': high_priority_ratio,
            'weekly_completed': weekly_completed,
            'category_encoded': category_encoded
        }
    except Exception as e:
        print(f"获取用户数据错误: {e}")
        return None

def get_crawled_data_stats():
    """获取爬虫数据统计"""
    try:
        crawled_data = CrawledData.query.all()
        if not crawled_data:
            return None
        
        durations = [cd.duration for cd in crawled_data]
        efficiencies = [cd.efficiency for cd in crawled_data]
        
        return {
            'avg_duration': sum(durations) / len(durations),
            'avg_efficiency': sum(efficiencies) / len(efficiencies)
        }
    except Exception as e:
        print(f"获取爬虫数据错误: {e}")
        return None

def train_model():
    """训练模型"""
    try:
        # 获取用户数据
        user_data_list = []
        focus_times = FocusTime.query.all()
        
        if len(focus_times) < 5:
            return False  # 数据不足
        
        # 准备训练数据
        X = []
        y = []
        
        for i in range(len(focus_times) - 1):
            # 使用历史数据作为特征
            past_times = focus_times[:i+1]
            durations = [ft.duration for ft in past_times]
            efficiencies = [ft.efficiency_score for ft in past_times]
            
            # 获取任务数据
            tasks = Task.query.filter(
                Task.created_at <= focus_times[i+1].start_time
            ).all()
            
            completed = [t for t in tasks if t.status == 'completed']
            high_priority = [t for t in tasks if t.priority == 3]
            
            # 计算每周完成任务数
            if tasks and len(tasks) > 0:
                days_diff = (focus_times[i+1].start_time - tasks[0].created_at).days
                weekly_completed = len(completed) / max(1, days_diff / 7) if days_diff > 0 else len(completed)
            else:
                weekly_completed = 5
            
            features = [
                sum(durations) / len(durations) if durations else 25.0,
                len(completed) / len(tasks) if tasks else 0.5,
                sum(efficiencies) / len(efficiencies) if efficiencies else 0.5,
                len(high_priority) / len(tasks) if tasks else 0.3,
                weekly_completed,
                0  # category_encoded简化
            ]
            
            # 添加爬虫数据特征
            crawled_stats = get_crawled_data_stats()
            if crawled_stats:
                features.extend([crawled_stats['avg_duration'], crawled_stats['avg_efficiency']])
            else:
                features.extend([25.0, 0.5])
            
            X.append(features)
            y.append(focus_times[i+1].duration)
        
        if len(X) >= 2:
            X = np.array(X)
            y = np.array(y)
            ml_predictor.train(X, y)
            ml_predictor.save_model()
            return True
        
        return False
    except Exception as e:
        print(f"训练模型错误: {e}")
        return False

def update_recommendation():
    """更新推荐"""
    try:
        # 定期训练模型（每10条新记录）
        focus_count = FocusTime.query.count()
        if focus_count > 0 and focus_count % 10 == 0:
            train_model()
        
        # 获取用户数据
        user_data = get_user_data()
        crawled_stats = get_crawled_data_stats()
        
        # 预测
        recommended_duration, confidence = ml_predictor.predict(user_data, crawled_stats)
        
        # 保存推荐结果
        recommendation = UserRecommendation(
            recommended_duration=recommended_duration,
            confidence=confidence,
            user_data=json.dumps(user_data) if user_data else None
        )
        
        db.session.add(recommendation)
        db.session.commit()
        
        return recommendation
    except Exception as e:
        print(f"更新推荐错误: {e}")
        return None

@app.route('/api/recommendation', methods=['GET'])
def get_recommendation():
    """获取专注时间推荐"""
    try:
        user_data = get_user_data()
        crawled_stats = get_crawled_data_stats()
        
        # 预测
        recommended_duration, confidence = ml_predictor.predict(user_data, crawled_stats)
        
        # 获取最新推荐记录
        latest = UserRecommendation.query.order_by(
            UserRecommendation.created_at.desc()
        ).first()
        
        return jsonify({
            'success': True,
            'data': {
                'recommended_duration': round(recommended_duration, 1),
                'confidence': round(confidence, 2),
                'user_data': user_data,
                'latest_recommendation': latest.to_dict() if latest else None
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/recommendation/train', methods=['POST'])
def train_recommendation_model():
    """手动训练模型"""
    try:
        success = train_model()
        return jsonify({
            'success': success,
            'message': '模型训练完成' if success else '数据不足，无法训练'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # 尝试加载已保存的模型
        ml_predictor.load_model()
        # 初始化时执行一次爬取
        try:
            scheduled_crawl()
        except:
            pass
    
    app.run(debug=True, host='0.0.0.0', port=5000)

