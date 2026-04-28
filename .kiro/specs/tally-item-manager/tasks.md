# 实施计划：归物 · Tally

## 概述

按照前后端分离架构，从项目基础设施搭建开始，依次实现后端核心 API、前端页面与组件、离线同步机制、高级功能（统计/导出/提醒），最后完成 Docker 部署配置。每个任务是一个可独立提交的工作单元，任务之间按依赖关系排列。

## 任务

- [x] 1. 项目初始化与基础设施搭建
  - [x] 1.1 初始化 monorepo 项目结构与基础配置
    - 创建 `tally/` 根目录，初始化 `package.json`（workspaces 配置）
    - 创建 `packages/web/` 前端项目：使用 Vite 6 + React 18 + TypeScript 初始化，安装 `dexie`、`zustand`、`react-router`、`recharts` 等依赖
    - 创建 `packages/server/` 后端项目：初始化 TypeScript 项目，安装 `fastify`、`prisma`、`jsonwebtoken`、`sharp`、`exceljs`、`pdfkit`、`node-cron`、`nodemailer` 等依赖
    - 创建根目录 `.gitignore` 文件，忽略 `node_modules/`、`dist/`、`.env`、`.DS_Store`、`uploads/`、`*.log` 等
    - 创建 `.env.example` 文件，列出所有环境变量模板
    - 初始化 Git 仓库，完成首次提交
    - _需求: 12.3_

  - [x] 1.2 配置前端全局样式与暖色调设计主题
    - 创建 `packages/web/src/styles/` 目录，定义 CSS 变量文件（主题色、字体、圆角、阴影等）
    - 页面背景色 `#f5f4ed`（羊皮纸色），卡片背景 `#faf9f5`（象牙白），品牌色 `#c96442`（赤陶色）
    - 标题字体 `Georgia`，正文字体 `system-ui`，所有中性色使用暖色调灰
    - 按钮圆角 8px+，卡片圆角 8px-16px，输入框圆角 12px
    - 使用环形阴影 `0px 0px 0px 1px` 替代传统投影
    - 定义响应式断点：桌面端 992px+、平板端 768px-991px、移动端 768px 以下
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 1.3 配置后端 Prisma Schema 与数据库迁移
    - 创建 `packages/server/prisma/schema.prisma`，定义 User、Item、Category、Tag、ItemTag、Image、Reminder 模型及枚举类型
    - 配置 `DATABASE_URL` 环境变量读取
    - 生成 Prisma Client 并执行首次数据库迁移
    - _需求: 9.1_

  - [x] 1.4 搭建 Fastify 服务入口与基础插件
    - 创建 `packages/server/src/index.ts`，初始化 Fastify 实例
    - 注册 CORS 插件、JSON Schema 校验、全局错误处理器（`setErrorHandler`）
    - 定义统一错误响应格式 `{ error, message, details }`
    - 配置 Prisma Client 实例注入
    - 添加健康检查路由 `GET /api/health`
    - _需求: 12.2_

- [x] 2. 用户认证模块
  - [x] 2.1 实现后端认证 API（注册/登录/登出/获取用户信息）
    - 创建 `packages/server/src/routes/auth.ts`，实现 `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
    - 创建 `packages/server/src/schemas/auth.ts`，定义注册和登录的 JSON Schema 校验规则
    - 注册接口：校验邮箱格式、密码强度（至少 8 位，包含字母和数字），密码使用 bcrypt 哈希存储
    - 登录接口：验证邮箱密码，签发 JWT Token（包含 userId、email）
    - 创建 `packages/server/src/plugins/auth.ts`，实现 JWT 认证装饰器，用于保护需认证的路由
    - _需求: 10.1, 10.2, 10.3, 10.5, 10.6_

  - [ ]* 2.2 编写用户注册校验属性测试
    - **Property 9: 用户注册校验的完备性**
    - 使用 `fast-check` 生成任意邮箱和密码字符串，验证校验函数对合法/非法输入的判定正确性
    - **验证需求: 10.1, 10.5**

  - [x] 2.3 实现前端登录与注册页面
    - 创建 `packages/web/src/pages/Login.tsx` 和 `packages/web/src/pages/Register.tsx`
    - 实现表单校验：邮箱格式、密码强度（至少 8 位，包含字母和数字），校验失败在字段下方显示错误提示
    - 创建 `packages/web/src/stores/authStore.ts`（Zustand），管理登录状态和 JWT Token
    - 登录成功后存储 Token 到 localStorage，跳转到首页
    - _需求: 10.1, 10.2, 10.5_

  - [x] 2.4 实现前端路由守卫与布局框架
    - 创建 `packages/web/src/App.tsx`，配置 React Router 路由表
    - 实现 `ProtectedRoute` 组件：未登录用户访问需认证页面时重定向到 `/login`
    - 创建 `packages/web/src/components/Layout.tsx`，包含 `Navbar`（顶部导航栏，含 Logo、导航链接、提醒铃铛、用户菜单）
    - 实现退出登录功能：清除 Token，停止同步，跳转到登录页
    - 实现响应式布局：桌面端多列、平板端两列、移动端单列堆叠
    - _需求: 10.3, 10.6, 11.5_

- [x] 3. 检查点 - 认证模块验证
  - 确保认证相关所有测试通过，前后端联调正常，用户可以注册、登录、退出。如有问题请提出。

- [x] 4. 物品管理核心模块
  - [x] 4.1 实现后端物品 CRUD API
    - 创建 `packages/server/src/routes/items.ts`，实现 `GET /api/items`（分页、搜索、筛选）、`GET /api/items/:id`、`POST /api/items`、`PUT /api/items/:id`、`DELETE /api/items/:id`
    - 创建 `packages/server/src/schemas/items.ts`，定义物品创建/更新的 JSON Schema 校验
    - 删除接口实现软删除（设置 `isDeleted = true`）
    - 列表接口支持查询参数：`page`、`limit`、`search`、`categoryId`、`status`、`tag`
    - 所有接口按 `userId` 隔离数据
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 4.2 编写物品数据校验属性测试
    - **Property 1: 物品数据校验的完备性**
    - 使用 `fast-check` 生成任意物品数据对象，验证校验函数对必填字段缺失、价格为负数/非数值等情况的判定正确性
    - **验证需求: 1.2, 1.6**

  - [x] 4.3 实现前端 Dexie.js 本地数据库定义
    - 创建 `packages/web/src/db/index.ts`，定义 Dexie 数据库实例和表结构（items、categories、images、reminders）
    - 定义 `LocalItem`、`LocalCategory`、`LocalImage`、`LocalReminder` 类型接口
    - 配置索引：items 按 `name`、`status`、`categoryId`、`updatedAt`、`syncStatus`、`*tags` 索引
    - _需求: 9.1_

  - [x] 4.4 实现前端物品表单页面（新增/编辑）
    - 创建 `packages/web/src/pages/ItemForm.tsx`，包含所有字段：名称（必填）、品牌、型号、购买日期（必填）、购买价格（必填）、购买渠道、预估二手回收价格、物品状态（必填，默认"使用中"）、保修到期日期、有效期到期日期、备注
    - 实现表单校验：必填字段检查、价格非负数值校验，校验失败在字段下方显示错误提示
    - 提交时写入 IndexedDB（`syncStatus = 'pending'`），编辑模式加载已有数据
    - 创建 `packages/web/src/utils/validation.ts`，提取物品校验纯函数
    - _需求: 1.1, 1.2, 1.3, 1.6, 6.1_

  - [x] 4.5 实现前端物品列表页面
    - 创建 `packages/web/src/pages/ItemList.tsx`，使用 Dexie `liveQuery` 响应式查询 IndexedDB
    - 创建 `packages/web/src/components/ItemCard.tsx`，展示缩略图、名称、日均成本、状态徽章
    - 创建 `packages/web/src/components/StatusBadge.tsx`，物品状态标签组件
    - 实现搜索（按名称）、按分类筛选、按状态筛选功能
    - 创建 `packages/web/src/utils/filter.ts`，提取筛选纯函数
    - _需求: 1.5, 1.7, 2.4_

  - [ ]* 4.6 编写物品筛选结果属性测试
    - **Property 2: 物品筛选结果的正确性**
    - 使用 `fast-check` 生成任意物品列表和筛选条件组合，验证筛选结果的完备性和正确性
    - **验证需求: 1.5, 4.4**

  - [x] 4.7 实现前端物品详情页面
    - 创建 `packages/web/src/pages/ItemDetail.tsx`，展示物品全部信息
    - 实现删除功能：弹出 `ConfirmDialog` 确认对话框，确认后软删除（`isDeleted = true`）
    - 创建 `packages/web/src/components/ConfirmDialog.tsx`，通用确认对话框组件
    - 展示保修状态标识（保修中 / 即将到期 / 已过期）
    - _需求: 1.4, 6.7_

- [x] 5. 日均成本计算模块
  - [x] 5.1 实现日均成本计算工具函数
    - 创建 `packages/web/src/utils/dailyCost.ts`，实现日均成本计算纯函数
    - 已使用天数 > 0 时：日均成本 = 购买价格 ÷ 已使用天数，精确到小数点后两位
    - 已使用天数 = 0 时（购买日期等于当前日期）：日均成本 = 购买价格本身
    - 在 `ItemCard`、`ItemDetail`、`ItemList` 中集成日均成本显示
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 编写日均成本计算属性测试
    - **Property 3: 日均成本计算的正确性**
    - 使用 `fast-check` 生成任意有效购买价格和购买日期，验证日均成本计算的正确性（含除零边界）
    - **验证需求: 2.1, 2.3**

- [x] 6. 检查点 - 物品管理核心验证
  - 确保物品 CRUD、日均成本计算、列表筛选等核心功能正常工作，所有测试通过。如有问题请提出。

- [x] 7. 分类与标签模块
  - [x] 7.1 实现后端分类 CRUD API
    - 创建 `packages/server/src/routes/categories.ts`，实现 `GET /api/categories`、`POST /api/categories`、`PUT /api/categories/:id`、`DELETE /api/categories/:id`
    - 创建分类时校验同一用户下名称唯一，重复返回 409
    - 删除分类时将该分类下所有物品的 `categoryId` 设为 `null`（对应前端显示"未分类"）
    - _需求: 4.1, 4.5, 4.6, 4.7_

  - [x] 7.2 实现前端分类选择器与标签输入组件
    - 创建 `packages/web/src/components/CategoryPicker.tsx`，支持选择已有分类和新建分类
    - 创建 `packages/web/src/components/TagInput.tsx`，支持标签输入、自动补全、新建标签
    - 将分类选择器和标签输入集成到 `ItemForm` 物品表单中
    - 在 `ItemList` 中集成分类和标签筛选功能
    - 实现分类管理功能：编辑分类名称、删除分类（含确认对话框）、删除标签
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 8. 图片管理模块
  - [x] 8.1 实现后端图片上传与处理 API
    - 创建 `packages/server/src/routes/images.ts`，实现 `POST /api/items/:itemId/images`（multipart 上传）、`DELETE /api/images/:id`、`GET /api/images/:id/thumbnail`、`GET /api/images/:id/original`
    - 使用 `sharp` 处理上传图片：生成 300px 宽缩略图，保存原图和缩略图到 `uploads/` 目录
    - 校验文件格式（JPEG、PNG、WebP）和大小（上限 5MB）
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 实现前端图片上传与画廊组件
    - 创建 `packages/web/src/components/ImageUploader.tsx`，支持拖拽上传、预览、格式和大小校验
    - 前端使用 `browser-image-compression` 压缩原图（最大 1920px 宽），生成 300px 宽缩略图
    - 图片以 Blob 形式存入 IndexedDB（原图 + 缩略图）
    - 创建 `packages/web/src/components/ImageGallery.tsx`，缩略图列表展示 + 点击放大查看原图
    - 将图片上传集成到 `ItemForm`，画廊展示集成到 `ItemDetail`
    - 格式/大小不合规时显示错误提示
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9. 资产总览仪表盘
  - [x] 9.1 实现资产总览页面
    - 创建 `packages/web/src/pages/Dashboard.tsx`，展示以下统计数据：
    - 总资产金额（所有物品购买价格之和）
    - 整体日均成本（所有物品各自日均成本之和）
    - 总资产估值（所有已填写二手回收价格的物品的回收价格之和）
    - 按物品状态分组展示数量（使用中/闲置/已出售/已丢弃）
    - 即将到期的保修物品列表（按到期日期升序）
    - 创建 `packages/web/src/utils/statistics.ts`，提取资产统计计算纯函数
    - 数据变更后自动更新统计（基于 Dexie liveQuery）
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 6.5_

  - [ ]* 9.2 编写资产统计不变量属性测试
    - **Property 4: 资产统计不变量**
    - 使用 `fast-check` 生成任意物品列表，验证总资产、整体日均成本、状态分组数量、总资产估值的计算正确性
    - **验证需求: 3.1, 3.2, 3.3, 3.5, 7.3, 7.6**

- [x] 10. 检查点 - 分类/图片/仪表盘验证
  - 确保分类标签管理、图片上传画廊、资产总览仪表盘功能正常，所有测试通过。如有问题请提出。

- [x] 11. 保修与过期提醒模块
  - [x] 11.1 实现前端本地提醒扫描引擎
    - 创建 `packages/web/src/utils/reminder.ts`，实现保修提醒优先级判定纯函数
    - 每次打开应用时扫描 IndexedDB 中所有物品的 `warrantyDate` 和 `expiryDate`
    - 距到期 30 天内生成 NORMAL 优先级提醒，距到期 7 天内生成 HIGH 优先级提醒
    - 按 `itemId + type` 去重，避免重复生成提醒
    - 提醒数据存入 IndexedDB 的 reminders 表
    - _需求: 6.2, 6.3_

  - [ ]* 11.2 编写保修提醒优先级属性测试
    - **Property 5: 保修提醒优先级判定**
    - 使用 `fast-check` 生成任意保修到期日期和当前日期，验证提醒优先级判定的正确性
    - **验证需求: 6.2, 6.3, 6.7**

  - [x] 11.3 实现提醒通知铃铛与提醒列表
    - 创建 `packages/web/src/components/ReminderBell.tsx`，导航栏铃铛图标显示未读提醒数量
    - 点击铃铛展开提醒列表，支持标记单条已读和全部已读
    - 在物品详情页显示保修状态标识（保修中 / 即将到期 / 已过期）
    - _需求: 6.5, 6.6, 6.7_

  - [x] 11.4 实现后端提醒 API 与邮件定时任务
    - 创建 `packages/server/src/routes/reminders.ts`，实现 `GET /api/reminders`、`PUT /api/reminders/:id/read`、`PUT /api/reminders/read-all`
    - 创建 `packages/server/src/services/reminderCron.ts`，使用 `node-cron` 每天凌晨 2:00 扫描即将到期物品
    - 对已开启邮件通知的用户，使用 `nodemailer` 发送提醒邮件，记录 `emailSent` 状态避免重复
    - _需求: 6.4, 6.6_

- [x] 12. 消费统计与分析模块
  - [x] 12.1 实现后端统计分析 API
    - 创建 `packages/server/src/routes/analytics.ts`，实现：
    - `GET /api/analytics/trend`：按月/季/年返回消费金额趋势数据
    - `GET /api/analytics/category-ratio`：按分类返回消费金额占比数据
    - `GET /api/analytics/depreciation`：返回每件物品的折旧分析（购入价、当前估值、差额、贬值率）
    - `GET /api/analytics/summary`：返回资产总览摘要数据
    - 未填写二手回收价格的物品在折旧分析中标记为"估值待填写"
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 12.2 实现前端消费统计页面
    - 创建 `packages/web/src/pages/Analytics.tsx`，包含：
    - 消费金额趋势折线图（使用 Recharts，支持月/季/年切换）
    - 分类消费占比饼图（使用 Recharts）
    - 折旧分析列表（购入价、当前估值、贬值率）
    - 总资产估值展示
    - 支持时间范围选择，切换后重新计算更新图表
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 12.3 编写分类消费占比属性测试
    - **Property 6: 分类消费占比之和恒等**
    - 使用 `fast-check` 生成任意非空物品列表，验证按分类计算的消费金额占比之和等于 100%（允许浮点精度误差 ±0.01%）
    - **验证需求: 7.2**

  - [ ]* 12.4 编写折旧率计算属性测试
    - **Property 7: 折旧率计算的正确性**
    - 使用 `fast-check` 生成任意有效购入价格和当前估值，验证贬值率计算结果在 0%-100% 之间且公式正确
    - **验证需求: 7.4**

- [x] 13. 检查点 - 提醒与统计模块验证
  - 确保保修提醒、消费统计图表、折旧分析等功能正常工作，所有测试通过。如有问题请提出。

- [x] 14. 数据导出模块
  - [x] 14.1 实现后端 Excel 和 PDF 导出 API
    - 创建 `packages/server/src/routes/export.ts`，实现 `POST /api/export/excel` 和 `POST /api/export/pdf`
    - Excel 导出：使用 `ExcelJS` 生成 .xlsx 文件，包含列：名称、品牌、型号、购买日期、购买价格、购买渠道、二手回收价、物品状态、分类、标签、日均成本、保修到期日期
    - PDF 导出：使用 `PDFKit` 生成格式化清单报告，支持中文字体渲染
    - 支持按分类、状态、标签、日期范围筛选导出
    - 无数据时返回提示信息，不生成空文件
    - 响应头设置 `Content-Disposition: attachment`，返回文件流
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 14.2 实现前端导出功能入口
    - 在物品列表页面添加导出按钮，支持选择 Excel 或 PDF 格式
    - 实现筛选条件传递（分类、状态、标签、日期范围）
    - 接收后端返回的 Blob 数据，触发浏览器下载
    - 无数据时显示"暂无数据可导出"提示
    - _需求: 8.1, 8.2, 8.3, 8.5_

- [x] 15. 数据同步模块
  - [x] 15.1 实现后端同步 API
    - 创建 `packages/server/src/routes/sync.ts`，实现 `POST /api/sync/push` 和 `POST /api/sync/pull`
    - Push 接口：接收客户端变更列表，按 `updatedAt` 时间戳做 Last-Write-Wins 冲突解决，写入数据库
    - Pull 接口：根据 `lastSyncAt` 查询云端变更记录，返回变更列表和同步时间戳
    - 支持 items、categories 表的同步，处理标签格式转换（前端数组 ↔ 后端关联表）
    - _需求: 9.3, 9.4, 9.5, 9.6_

  - [ ]* 15.2 编写同步冲突解决属性测试
    - **Property 8: 同步冲突解决的确定性（Last-Write-Wins）**
    - 使用 `fast-check` 生成任意本地记录和云端记录的冲突对，验证合并结果始终选择 `updatedAt` 较新的记录，相同时优先选择云端记录
    - **验证需求: 9.5**

  - [x] 15.3 实现前端同步引擎
    - 创建 `packages/web/src/db/sync.ts`，实现同步引擎核心逻辑
    - 同步触发时机：登录成功后全量同步、网络恢复时增量同步、每 5 分钟自动增量同步
    - 查询 IndexedDB 中 `syncStatus = 'pending'` 的记录，推送到云端
    - 拉取云端变更，合并到本地 IndexedDB，更新 `syncStatus = 'synced'`
    - 在导航栏显示网络状态指示（在线/离线）
    - 在设置页面展示最近同步时间
    - _需求: 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 15.4 实现前端设置页面
    - 创建 `packages/web/src/pages/Settings.tsx`，包含：
    - 同步状态展示（最近同步时间、手动同步按钮）
    - 邮件通知配置（提醒邮箱地址、开启/关闭邮件通知）
    - 账户信息展示
    - _需求: 9.6, 6.4_

- [x] 16. 检查点 - 导出与同步模块验证
  - 确保数据导出（Excel/PDF）、离线同步机制正常工作，所有测试通过。如有问题请提出。

- [x] 17. Docker 部署配置
  - [x] 17.1 创建前端 Dockerfile 与 Nginx 配置
    - 创建 `packages/web/Dockerfile`，采用多阶段构建：Node 镜像构建静态资源 → Nginx 镜像提供服务
    - 创建 Nginx 配置文件：SPA 路由回退（所有路径返回 index.html）、`/api` 路径反向代理到后端服务
    - _需求: 12.1_

  - [x] 17.2 创建后端 Dockerfile
    - 创建 `packages/server/Dockerfile`，安装依赖、生成 Prisma Client、编译 TypeScript、启动服务
    - 配置 `uploads/` 目录挂载点
    - _需求: 12.1_

  - [x] 17.3 创建 Docker Compose 编排文件
    - 创建根目录 `docker-compose.yml`，编排 web、server、db 三个服务
    - PostgreSQL 配置健康检查，server 依赖 db 健康后启动
    - 通过环境变量配置数据库连接、JWT 密钥、SMTP 参数、服务端口
    - 配置 `pgdata` 和 `uploads` 持久化卷
    - _需求: 12.1, 12.4_

  - [x] 17.4 创建本地开发启动脚本与部署说明
    - 在根目录 `package.json` 中添加开发脚本：`dev:web`、`dev:server`、`dev` (联合启动)
    - 创建 `doc/deploy.md` 部署说明文档，包含本地开发和 Docker 部署两种方式的操作步骤
    - _需求: 12.2, 12.5_

- [x] 18. 最终检查点 - 全功能验证
  - 确保所有模块功能正常，Docker 部署可用，所有测试通过。如有问题请提出。

## 说明

- 标记 `*` 的子任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了对应的需求编号，确保需求可追溯
- 检查点任务用于阶段性验证，确保增量开发的稳定性
- 属性测试验证设计文档中定义的正确性属性，单元测试验证具体场景和边界情况
- 现阶段仅完成 Web 端开发，移动端后续迭代
- 每完成一个任务执行 `git add` + `git commit`，提交信息格式：`类型(模块): 简要描述`
