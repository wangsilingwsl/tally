# 需求文档 — 归物 · Tally

## 简介

归物 · Tally 是一款面向个人用户的物品消费管理系统。用户可以系统化记录已购物品，追踪消费历史、物品现值与日均使用成本，同时获得保修到期提醒和消费趋势分析。现阶段优先完成 Web 端开发，用户必须注册登录后才能使用系统。登录后采用离线优先的数据存储策略（IndexedDB），联网后自动同步到云端。设计风格参考 Claude (Anthropic) 设计系统，以暖色调羊皮纸质感为基础。

## 术语表

- **Tally_System**：归物 · Tally 系统整体，包含前端界面与后端服务
- **Item_Manager**：物品管理模块，负责物品的增删改查操作
- **Cost_Calculator**：日均成本计算模块，负责根据购买价格和使用天数计算日均成本
- **Asset_Dashboard**：资产总览模块，负责展示总资产、整体日均成本和分组统计
- **Category_Engine**：分类与标签引擎，负责分类和标签的管理与筛选
- **Image_Manager**：图片管理模块，负责物品图片的上传、存储和展示
- **Reminder_Service**：提醒服务模块，负责保修到期和有效期的提醒通知
- **Analytics_Engine**：消费统计与分析引擎，负责趋势图表、占比分析和折旧计算
- **Export_Service**：数据导出服务，负责将物品数据导出为 Excel 或 PDF 格式
- **Storage_Layer**：数据存储层，负责本地 IndexedDB 存储与云端同步
- **User**：使用归物 · Tally 的个人用户
- **Item**：用户记录的一件物品，包含名称、品牌、型号、价格等属性
- **Daily_Cost**：日均成本，计算公式为购买价格除以已使用天数
- **Item_Status**：物品状态，取值为"使用中"、"闲置"、"已出售"、"已丢弃"之一

## 需求

### 需求 1：物品记录管理

**用户故事：** 作为用户，我想要记录我购买的物品的详细信息，以便系统化管理我的消费记录。

#### 验收标准

1. THE Item_Manager SHALL 提供物品创建表单，包含以下字段：名称（必填）、品牌、型号、购买日期（必填）、购买价格（必填，数值类型）、购买渠道、预估二手回收价格（数值类型）、物品状态（必填，默认值为"使用中"）
2. WHEN User 提交物品创建表单时，THE Item_Manager SHALL 校验所有必填字段均已填写且格式正确，校验通过后将 Item 持久化到 Storage_Layer
3. WHEN User 选择编辑一件已有 Item 时，THE Item_Manager SHALL 加载该 Item 的全部字段到编辑表单，并在提交后更新 Storage_Layer 中的对应记录
4. WHEN User 选择删除一件 Item 时，THE Item_Manager SHALL 弹出确认对话框，User 确认后将该 Item 标记为软删除（保留记录用于同步），同时隐藏其关联的图片和标签数据
5. THE Item_Manager SHALL 提供物品列表视图，支持按名称搜索、按分类筛选、按状态筛选
6. IF User 提交的购买价格或二手回收价格为负数或非数值，THEN THE Item_Manager SHALL 在对应字段下方显示具体的错误提示信息，且不提交表单
7. THE Item_Manager SHALL 支持物品状态在"使用中"、"闲置"、"已出售"、"已丢弃"四个值之间切换

### 需求 2：日均成本计算

**用户故事：** 作为用户，我想要看到每件物品的日均使用成本，以便评估物品的性价比。

#### 验收标准

1. THE Cost_Calculator SHALL 按照公式"日均成本 = 购买价格 ÷ 已使用天数"计算每件 Item 的日均成本，其中已使用天数 = 当前日期 - 购买日期
2. WHEN User 查看物品详情页时，THE Cost_Calculator SHALL 实时计算并显示该 Item 的当前日均成本，精确到小数点后两位
3. WHEN 一件 Item 的购买日期等于当前日期（已使用天数为 0）时，THE Cost_Calculator SHALL 将日均成本显示为购买价格本身，而非执行除零运算
4. THE Cost_Calculator SHALL 在物品列表视图中为每件 Item 显示其日均成本
5. WHEN User 修改 Item 的购买价格或购买日期时，THE Cost_Calculator SHALL 立即重新计算并更新该 Item 的日均成本显示

### 需求 3：资产总览

**用户故事：** 作为用户，我想要在一个仪表盘中看到我的资产概况，以便快速了解整体消费情况。

#### 验收标准

1. THE Asset_Dashboard SHALL 展示总资产金额，计算方式为所有 Item 的购买价格之和
2. THE Asset_Dashboard SHALL 展示整体日均成本，计算方式为所有 Item 各自日均成本之和（即 Σ(每件 Item 的购买价格 ÷ 该 Item 的已使用天数)）
3. THE Asset_Dashboard SHALL 按 Item_Status 分组展示物品数量，分组包括"使用中"、"闲置"、"已出售"、"已丢弃"
4. WHEN User 新增、编辑或删除 Item 时，THE Asset_Dashboard SHALL 在操作完成后自动更新所有统计数据
5. THE Asset_Dashboard SHALL 展示总资产估值，计算方式为所有 Item 的预估二手回收价格之和

### 需求 4：分类与标签

**用户故事：** 作为用户，我想要给物品设置分类和标签，以便灵活地组织和筛选我的物品。

#### 验收标准

1. THE Category_Engine SHALL 支持 User 创建自定义分类，每个分类包含名称（必填，同一用户下唯一）
2. THE Category_Engine SHALL 支持 User 为每件 Item 指定一个分类
3. THE Category_Engine SHALL 支持 User 为每件 Item 添加多个标签（标签在同一用户下唯一）
4. WHEN User 在物品列表中选择某个分类或标签进行筛选时，THE Category_Engine SHALL 仅展示匹配该分类或标签的 Item 列表
5. WHEN User 删除一个分类时，THE Category_Engine SHALL 弹出确认对话框，确认后将该分类下所有 Item 的分类字段设为"未分类"
6. IF User 创建分类时输入的名称与已有分类重复，THEN THE Category_Engine SHALL 显示"分类名称已存在"的错误提示，且不创建该分类
7. THE Category_Engine SHALL 支持 User 编辑已有分类的名称和删除已有标签

### 需求 5：图片管理

**用户故事：** 作为用户，我想要为每件物品上传图片（实物照、发票、保修卡等），以便留存物品的视觉记录。

#### 验收标准

1. THE Image_Manager SHALL 支持 User 为每件 Item 上传一张或多张图片
2. THE Image_Manager SHALL 支持 JPEG、PNG、WebP 格式的图片上传，单张图片大小上限为 5MB
3. WHEN User 上传图片时，THE Image_Manager SHALL 生成缩略图用于列表展示，并保留原图用于详情查看
4. WHEN User 选择删除某张图片时，THE Image_Manager SHALL 弹出确认对话框，确认后从 Storage_Layer 中移除该图片
5. IF User 上传的文件格式不在支持范围内或文件大小超过 5MB，THEN THE Image_Manager SHALL 显示具体的错误提示信息，说明支持的格式和大小限制
6. THE Image_Manager SHALL 在物品详情页以画廊形式展示该 Item 的所有图片，支持点击放大查看

### 需求 6：保修与过期提醒

**用户故事：** 作为用户，我想要记录物品的保修期限并在到期前收到提醒，以便及时处理保修事宜。

#### 验收标准

1. THE Item_Manager SHALL 支持 User 为每件 Item 填写保修到期日期或有效期到期日期
2. WHEN 某件 Item 的保修到期日期距当前日期不足 30 天时，THE Reminder_Service SHALL 生成一条站内提醒通知（前端本地扫描生成，离线时也能工作）
3. WHEN 某件 Item 的保修到期日期距当前日期不足 7 天时，THE Reminder_Service SHALL 生成一条高优先级站内提醒通知（前端本地扫描生成，离线时也能工作）
4. WHERE User 已配置邮件通知功能，THE Reminder_Service SHALL 通过后端定时任务发送邮件通知到 User 配置的邮箱地址
5. THE Reminder_Service SHALL 在资产总览页面展示即将到期的 Item 列表，按到期日期升序排列
6. WHEN User 查看提醒通知时，THE Reminder_Service SHALL 将该通知标记为已读
7. IF 某件 Item 的保修已过期，THEN THE Reminder_Service SHALL 在该 Item 详情页显示"保修已过期"状态标识

### 需求 7：消费统计与预算分析

**用户故事：** 作为用户，我想要查看消费趋势和分类占比分析，以便了解我的消费习惯并做出更合理的购买决策。

#### 验收标准

1. THE Analytics_Engine SHALL 按月、季、年三个时间维度展示消费金额趋势折线图
2. THE Analytics_Engine SHALL 按分类展示各品类消费金额占比饼图
3. THE Analytics_Engine SHALL 计算并展示总资产估值，计算方式为所有 Item 的预估二手回收价格之和
4. THE Analytics_Engine SHALL 计算并展示折旧分析，包括每件 Item 的购入价与当前估值的差额及贬值率（贬值率 = (购入价 - 当前估值) ÷ 购入价 × 100%）
5. WHEN User 选择不同的时间范围时，THE Analytics_Engine SHALL 重新计算并更新所有图表数据
6. IF 某件 Item 未填写预估二手回收价格，THEN THE Analytics_Engine SHALL 在折旧分析中将该 Item 标记为"估值待填写"，不纳入总资产估值计算

### 需求 8：数据导出

**用户故事：** 作为用户，我想要将物品数据导出为 Excel 或 PDF 文件，以便备份或分享。

#### 验收标准

1. THE Export_Service SHALL 支持将物品数据导出为 Excel 格式（.xlsx），包含所有物品字段，支持按分类、状态、标签、日期范围筛选导出
2. THE Export_Service SHALL 支持将物品数据导出为 PDF 格式，以格式化清单报告形式呈现，支持按分类、状态、标签、日期范围筛选导出
3. WHEN User 触发导出操作时，THE Export_Service SHALL 在导出完成后自动下载生成的文件到 User 的本地设备
4. THE Export_Service SHALL 在导出的 Excel 文件中包含以下列：名称、品牌、型号、购买日期、购买价格、购买渠道、二手回收价、物品状态、分类、标签、日均成本、保修到期日期
5. IF 当前无任何 Item 数据，THEN THE Export_Service SHALL 显示"暂无数据可导出"的提示信息，不生成空文件

### 需求 9：数据存储与同步

**用户故事：** 作为用户，我想要在离线状态下正常使用系统，并在联网后自动同步数据，以便在不同设备上访问我的数据。

#### 验收标准

1. THE Storage_Layer SHALL 使用 IndexedDB 作为本地持久化存储，所有物品数据优先写入本地
2. THE Storage_Layer SHALL 在无网络连接时支持 User 正常执行物品的增删改查操作
3. WHEN 网络连接恢复时，THE Storage_Layer SHALL 自动将本地未同步的数据变更同步到云端服务器
4. WHEN User 完成注册并登录后，THE Storage_Layer SHALL 自动开始本地数据与云端数据的双向同步
5. IF 本地数据与云端数据发生冲突，THEN THE Storage_Layer SHALL 以最后修改时间较新的记录为准进行合并
6. THE Storage_Layer SHALL 在每次同步完成后记录同步时间戳，供 User 在设置页面查看最近同步时间

### 需求 10：用户认证

**用户故事：** 作为用户，我想要注册和登录账号，以便启用云端同步功能并保护我的数据安全。

#### 验收标准

1. THE Tally_System SHALL 支持 User 使用邮箱和密码进行注册，注册时校验邮箱格式和密码强度（至少 8 位，包含字母和数字）
2. THE Tally_System SHALL 支持 User 使用邮箱和密码进行登录
3. WHILE User 未登录时，THE Tally_System SHALL 仅展示登录和注册页面，禁止访问其他功能页面
4. WHEN User 登录成功后，THE Tally_System SHALL 自动触发 Storage_Layer 的数据同步流程
5. IF User 输入的邮箱格式不正确或密码不满足强度要求，THEN THE Tally_System SHALL 在对应字段下方显示具体的校验错误信息
6. THE Tally_System SHALL 支持 User 退出登录，退出后本地数据保留但停止云端同步

### 需求 11：界面设计与响应式布局

**用户故事：** 作为用户，我想要一个美观、温暖且易用的界面，以便获得舒适的使用体验。

#### 验收标准

1. THE Tally_System SHALL 采用暖色调设计风格，页面背景使用羊皮纸色（#f5f4ed），卡片背景使用象牙白（#faf9f5）
2. THE Tally_System SHALL 使用 Georgia 作为标题字体（衬线体），system-ui 作为正文和界面字体（无衬线体）
3. THE Tally_System SHALL 使用赤陶色（#c96442）作为主要操作按钮的品牌色
4. THE Tally_System SHALL 所有中性色使用暖色调灰（带黄棕底色），不使用冷色调蓝灰
5. THE Tally_System SHALL 在桌面端（992px 以上）展示完整的多列布局，在平板端（768px-991px）展示两列布局，在移动端（768px 以下）展示单列堆叠布局
6. THE Tally_System SHALL 所有按钮使用 8px 以上的圆角，卡片使用 8px-16px 圆角，输入框使用 12px 圆角
7. THE Tally_System SHALL 使用环形阴影（0px 0px 0px 1px）替代传统投影来表达交互元素的层级

### 需求 12：部署与运维

**用户故事：** 作为开发者，我想要便捷的启动和部署方式，以便快速搭建开发环境和生产环境。

#### 验收标准

1. THE Tally_System SHALL 提供 Docker Compose 配置文件，支持一键启动前端和后端服务
2. THE Tally_System SHALL 提供本地开发启动脚本，支持前后端分别启动和联合启动
3. THE Tally_System SHALL 在项目根目录提供 .gitignore 文件，忽略 node_modules、dist、.env、.DS_Store 等常见非必要文件
4. WHEN 使用 Docker 部署时，THE Tally_System SHALL 通过环境变量配置数据库连接、服务端口等运行参数
5. THE Tally_System SHALL 提供启动和部署说明文档，包含本地开发、Docker 部署两种方式的操作步骤
