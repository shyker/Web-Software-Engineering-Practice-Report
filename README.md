# 学生成绩管理系统

当前阶段：Vue 前端 + Node Express 后端 + MySQL 数据初始化

## 已完成

- 检查基础环境
- 初始化 Vue 前端项目
- 搭建成绩总览页面
- 创建 MySQL 数据库与 scores 表
- 导入 50 条学生成绩数据
- 实现 Express API：查看 / 新增 / 修改成绩记录
- 前端页面接入真实 API 数据

## 启动方式

### 1. 安装依赖

```bash
cd /root/web-task
npm install --ignore-scripts
```

### 2. 导入数据库

```bash
mysql -uroot < /root/web-task/scores.sql
```

### 3. 启动后端（当前使用 8900 端口）

```bash
cd /root/web-task
PORT=8900 npm run server
```

### 4. 启动前端（当前使用 8899 端口）

```bash
cd /root/web-task
npm run dev -- --host 0.0.0.0 --port 8899
```

说明：前端请求地址已改成相对路径 `/api`。如果你是直接通过 `服务器IP:8900` 打开这个页面，它会请求同源的 `服务器IP:8900/api/...`。

## API

- `GET /api/health`
- `GET /api/student-no/next`
- `GET /api/scores`
- `GET /api/scores/:id`
- `POST /api/scores`
- `PUT /api/scores/:id`

## 后续计划

1. 继续美化成绩总览与学生管理面板
2. 增加删除、分页、统计分析
3. 改造成 Docker Compose + Nginx + MySQL 部署
