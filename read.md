# 厚板生产全流程运行监控系统——第一天开发记录

## 一、项目基本信息

项目名称：基于工业基座大模型的厚板生产全流程运行监控系统

项目定位：面向软件著作权展示和项目答辩的工业智能监控系统 Demo，用于模拟钢铁厚板生产过程中的生产运行监控、设备状态分析、质量管理、异常报警、工业知识建模和大模型辅助决策。

当前阶段：第一天开发目标已完成。

项目最终目录：

```text
E:\Zwen-codex\SoftwareCopyright
```

项目采用纯前端方式实现，不包含后端、数据库和服务器。所有工业数据、模型分析结果和业务操作均为 JavaScript Mock 数据或浏览器内存模拟。

## 二、技术架构

- Vue 3.5
- Vite 6
- Vue Router 4
- Element Plus
- ECharts 5
- JavaScript
- Vue Composition API
- `<script setup>` 单文件组件
- `localStorage` 模拟登录状态与角色权限

项目入口：

```text
src/main.js
```

路由配置：

```text
src/router/index.js
```

主框架布局：

```text
src/layouts/MainLayout.vue
```

页面目录：

```text
src/views
```

Mock 数据目录：

```text
src/mock
```

## 三、项目目录结构

```text
SoftwareCopyright
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── read.md
├── dist
└── src
    ├── main.js
    ├── App.vue
    ├── auth.js
    ├── industrialAI.js
    ├── layouts
    │   └── MainLayout.vue
    ├── router
    │   └── index.js
    ├── styles
    │   └── index.css
    ├── components
    │   ├── PagePlaceholder.vue
    │   ├── charts
    │   │   └── BaseChart.vue
    │   ├── production
    │   │   └── ProcessNode.vue
    │   ├── equipment
    │   │   └── EquipmentCard.vue
    │   └── quality
    │       └── QualityMetricCard.vue
    ├── mock
    │   ├── dashboard.js
    │   ├── production.js
    │   ├── equipment.js
    │   ├── quality.js
    │   ├── alarm.js
    │   ├── knowledgeGraph.js
    │   └── chat.js
    └── views
        ├── Login.vue
        ├── Dashboard.vue
        ├── Production.vue
        ├── Equipment.vue
        ├── Quality.vue
        ├── Alarm.vue
        ├── Decision.vue
        ├── KnowledgeGraph.vue
        └── AIChat.vue
```

## 四、当天完成的主要工作

### 1. 创建项目基础框架

完成 Vue 3、Vite、Element Plus 和 Vue Router 项目骨架，建立登录页、主框架、左侧菜单、顶部标题栏、页面路由及角色权限。

登录页允许输入任意非空用户名和密码，并选择管理员、工程师或操作员角色。登录信息保存在浏览器 `localStorage` 中，仅用于 Demo 演示，不是真实身份认证。

### 2. 运行总览

文件：

```text
src/views/Dashboard.vue
src/mock/dashboard.js
src/components/charts/BaseChart.vue
```

已实现：

- 当前生产状态
- 今日产量
- 设备运行率
- 产品质量合格率
- 当前报警数量
- 板坯温度和轧制温度趋势
- 分时产量统计
- 设备健康雷达图
- 能源消耗分析
- 定时模拟数据波动
- 图表尺寸自适应

### 3. 生产监控

文件：

```text
src/views/Production.vue
src/mock/production.js
src/components/production/ProcessNode.vue
```

生产流程包括：

```text
炼钢与连铸
→ 板坯加热
→ 粗轧
→ 精轧
→ 控冷
→ 矫直
→ 质量检测
→ 入库
```

已实现节点状态、关键参数、工序进度、自动推进、暂停模拟、详情弹窗、参数确认和异常上报。

### 4. 设备管理

文件：

```text
src/views/Equipment.vue
src/mock/equipment.js
src/components/equipment/EquipmentCard.vue
```

模拟设备包括：

- 加热炉系统
- 粗轧机组
- 精轧机组
- 控冷系统
- 在线检测设备

已实现温度、压力、振动、运行时间、负载、健康评分、设备筛选、状态趋势、预警提示和模拟维护工单。

### 5. 质量管理

文件：

```text
src/views/Quality.vue
src/mock/quality.js
src/components/quality/QualityMetricCard.vue
```

已实现板厚偏差、板形质量、表面缺陷率、性能达标率、产品合格率、质量趋势、缺陷分布、批次筛选、质量详情、复检操作和报告导出演示。

### 6. 报警中心

文件：

```text
src/views/Alarm.vue
src/mock/alarm.js
```

已实现严重、警告、提示三级报警，以及待处理、处理中、已处理、已关闭四种状态。支持报警统计、趋势图、查询筛选、详情查看、负责人指派、处理完成和关闭操作。

### 7. 智能决策

文件：

```text
src/views/Decision.vue
src/industrialAI.js
```

已实现：

- 工业仿真数据输入
- 生产状态、设备参数和质量数据展示
- 工业知识本体调用演示
- 历史案例匹配演示
- 设备状态分析演示
- 决策方案生成演示
- 异常类型
- 风险等级
- 分析依据
- 建议措施
- 置信度
- 决策确认与人工复核

该模块不调用真实大模型，而是根据关键词匹配预定义规则，并使用延时模拟模型推理过程。

页面统一显示：

```text
工业基座大模型 · 模拟推理
```

### 8. 工业本体知识图谱

文件：

```text
src/views/KnowledgeGraph.vue
src/mock/knowledgeGraph.js
```

图谱使用 ECharts Graph 实现，包含六层工业本体：

- 产品层
- 工艺层
- 设备层
- 参数层
- 质量层
- 异常层

支持图谱缩放、拖动画布、拖动节点、搜索节点、层级筛选和节点属性查看。

所有关系边都具有明确的 `name`、`label` 和 `value` 字段。当前关系语义包括：

- 属于
- 包含
- 关联
- 影响
- 检测
- 产生异常

ECharts 边标签显式读取 `label`，缺失时统一显示“关联”，避免出现 `undefined`、`null` 或空关系文字。

### 9. 工业大模型助手

文件：

```text
src/views/AIChat.vue
src/mock/chat.js
src/industrialAI.js
```

固定演示问题：

- 分析当前生产状态
- 诊断设备异常
- 解释质量问题
- 优化轧制参数

回答格式：

```text
【分析对象】
【异常状态】
【原因分析】
【知识依据】
【优化建议】
```

页面统一显示：

```text
工业基座大模型 · 智能分析演示
```

当前使用前端规则模拟，没有接入真实模型 API。

## 五、菜单与角色权限

菜单顺序：

1. 运行总览
2. 生产监控
3. 设备管理
4. 质量管理
5. 报警中心
6. 智能决策
7. 工业本体知识图谱
8. 工业大模型助手

实际路由权限：

- 管理员：全部模块
- 工程师：运行总览、设备管理、质量管理、智能决策
- 操作员：运行总览、生产监控

权限只在前端通过路由元数据和 `localStorage` 模拟，不具备生产系统安全性。

## 六、演示模式说明

系统顶部已增加：

```text
DEMO · 工业仿真数据
```

容易造成真实工业接入误解的文案已经调整为：

- 工业仿真数据
- 模拟数据运行
- 智能分析演示
- 模拟批次
- 前端规则模拟，未接入真实模型 API

AI 助手欢迎语明确说明其依据是工业仿真数据、模拟设备状态、质量数据和工业本体知识。

## 七、真实功能与模拟功能

真实可运行的前端功能：

- 页面路由
- 登录状态保存
- 角色权限过滤
- 图表绘制
- 数据定时变化
- 表格搜索与筛选
- 弹窗交互
- 工序推进
- 报警状态操作
- 图谱拖动与节点点击
- 聊天消息发送
- 模拟决策确认

模拟展示内容：

- 生产数据
- 设备数据
- 质量数据
- 报警数据
- 能源数据
- 设备健康评分
- 维护工单
- 报告导出
- 知识图谱数据源
- 工业知识检索过程
- 历史案例匹配过程
- 智能决策结果
- 大模型回复

所有页面数据主要保存在组件内存或 `src/mock` 文件中。刷新页面后，部分操作状态会恢复到初始值。

## 八、最终检查结果

已执行全项目关键字检查：

```text
undefined
null
TODO
FIXME
```

检查结论：

- 用户界面没有直接显示 `undefined`
- 用户界面没有直接显示 `null`
- 没有遗留 `TODO`
- 没有遗留 `FIXME`
- 代码内部存在合法的 `null/undefined` 初始状态，不会直接渲染到界面
- 没有遗留 `PlateMind-Industry-7B` 虚构模型名称
- 没有“真实接入”“真实在线”“真实大模型”等误导性界面描述

## 九、运行方式

安装依赖：

```bash
cd E:\Zwen-codex\SoftwareCopyright
npm install
```

启动开发环境：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

预览构建结果：

```bash
npm run preview
```

## 十、构建状态

最终执行 `npm run build` 成功：

- 2,199 个模块转换完成
- 无 JavaScript 语法错误
- 无 Vue 模板编译错误
- 无模块引用错误
- `dist/index.html` 正常生成

构建中存在 ECharts、Element Plus 公共包体积提示和第三方依赖注释提示，不影响当前 Demo 运行。

## 十一、当天的重要约定

1. 不重新创建项目。
2. 不大规模重构页面。
3. 不引入 Pinia 等新状态管理。
4. 不接入真实后端、数据库或模型 API。
5. 所有数据保持前端 Mock 和工业仿真定位。
6. 保持深色工业风、科技蓝和数字孪生监控平台风格。
7. 不使用具体虚构模型名称。
8. 最终项目目录只保留英文名称 `SoftwareCopyright`。

---

记录日期：2026-08-10

当前结论：第一天开发目标已完成，系统可以进入软件著作权材料整理、项目答辩演示和后续联调阶段。
