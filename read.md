# 厚板生产全流程运行监控系统——开发记录

> 整理日期：2026-08-12  
> 项目目录：`E:\Zwen-codex\SoftwareCopyright`  
> 项目性质：软件著作权展示 Demo  
> 数据说明：全部业务数据均为工业仿真数据或前端 Mock 数据，不代表真实工业接入、真实设备预测或真实大模型服务。

## 一、项目基本信息

项目名称：基于工业基座大模型的厚板生产全流程运行监控系统

技术栈：

- Vue 3
- Vite
- Vue Router
- Element Plus
- ECharts
- JavaScript 与 Composition API
- localStorage 持久化模拟数据

项目不使用后端、数据库、Pinia、TypeScript 或真实大模型 API，保持现有前端架构持续迭代。

## 二、今天的开发主线

今天围绕“生产、设备、质量、报警”四类工业业务继续完善系统，形成了以下业务关系：

```text
生产计划 → 生产批次 → 工艺参数 → 生产异常事件

设备状态 → 健康评价 → 故障预测 → 风险事件 → 维护工单 → 恢复模拟

生产批次 → 质量检测 → 质量评价 → 缺陷分析 → 质量追溯

多来源异常 → 统一报警事件 → 报警生命周期与处理记录
```

所有新增功能均沿用现有 Vue3 单页应用架构，以 JavaScript 模块作为业务层，以 localStorage 作为演示数据持久化方式。

## 三、设备健康与预测维护模块

### 1. 设备健康评价

新增 `src/equipmentHealth.js`，统一负责：

- 健康评分计算
- 健康等级判断
- 风险因素分析
- 故障概率模拟
- 模拟诊断结论生成

设备管理页面已拆分为模块化结构：

```text
设备管理
├── 设备总览        /equipment
├── 健康诊断        /equipment-health
├── 故障预测        /equipment-prediction
└── 维护管理        /maintenance
```

其中设备总览保留设备列表、分类筛选、运行状态、趋势和基础详情；健康诊断复用 `HealthDiagnosis.vue` 展示健康评分、等级、故障概率、风险因素和诊断建议。

### 2. 故障风险预测

故障预测页面复用 `equipmentHealth.js` 的健康评价方法，展示：

- 风险设备统计
- 设备故障风险列表
- 风险因素与预测依据
- 推荐检查措施
- 健康评分与故障概率模拟趋势

页面明确标注“故障预测演示 · 基于工业仿真数据”。

### 3. 设备风险事件

新增 `src/equipmentEvent.js`，负责设备风险事件的生成、查询和状态更新。

存储键：

```text
thick_plate_equipment_risk_events
```

事件可由健康评分过低、故障概率过高或用户在故障预测页面主动操作生成。同一设备、同一种异常只允许存在一条未关闭事件，避免重复创建。

### 4. 预测维护闭环

新增 `src/maintenance.js` 和维护管理页面。维护工单必须来源于设备风险事件，不进行随机创建。

存储键：

```text
thick_plate_maintenance_orders
```

工单状态流程：

```text
待确认 → 已安排 → 执行中 → 已完成
```

工单完成后仅展示工业仿真恢复效果，例如健康评分提高、故障概率下降、风险等级降低，不修改或声称接入真实设备数据。

## 四、生产计划、批次与过程监控

### 1. 生产计划与批次

新增 `src/productionPlan.js`，管理厚板生产计划、批次与进度。

存储键：

```text
thick_plate_production_plan
```

生产计划包含订单号、钢种、规格、计划数量、完成数量、客户、交付日期和状态；生产批次通过 `planId` 与计划关联，记录当前工序、生产进度、开始时间、操作人员和运行状态。

`Production.vue` 保留原八段生产流程，同时新增生产计划概览和批次详情：

```text
炼钢与连铸 → 板坯加热 → 粗轧 → 精轧 → 控冷 → 矫直 → 质量检测 → 入库
```

### 2. 工艺参数趋势分析

新增 `src/processParameter.js`，负责工艺参数模拟、历史趋势和状态分析。

存储键：

```text
thick_plate_process_parameters
```

支持的主要工序参数包括：

- 板坯加热：炉温、加热时间
- 粗轧：轧制力、轧制速度
- 精轧：轧制压力、板厚
- 控冷：冷却速度、终冷温度
- 质量检测：厚度偏差、表面质量

趋势图展示历史曲线、正常范围、上下限和当前异常点。参数模块只负责状态判断，不直接生成报警，继续保持与 `industrialAlarmLink.js` 的职责分离。

### 3. 生产异常事件

新增 `src/productionEvent.js`，根据 `analyzeParameterStatus()` 的分析结果生成生产异常事件。

存储键：

```text
thick_plate_production_events
```

生成条件为参数状态“偏高”或“偏低”。相同批次、工序和参数在事件未关闭时不会重复创建；事件关闭后允许重新生成。

事件状态流程：

```text
待确认 → 处理中 → 已关闭
```

## 五、质量管理深化

### 1. 批次质量数据关联

新增 `src/qualityData.js`，使用 `batchId` 将生产批次与质量检测结果关联。

存储键：

```text
thick_plate_quality_data
```

质量检测指标包括：

- 厚度偏差
- 表面缺陷率
- 板形指标
- 屈服强度
- 抗拉强度

质量评分等级：

- 90～100：优秀
- 80～89：合格
- 65～79：关注
- 65 以下：异常

切换生产批次时，质量数据、评分、等级和异常指标同步变化；无对应数据时安全显示“暂无检测数据”。

### 2. 缺陷分析与质量追溯

新增组件：

- `src/components/quality/BatchQualityCard.vue`
- `src/components/quality/DefectAnalysis.vue`
- `src/components/quality/QualityTrace.vue`

缺陷分析覆盖厚度偏差、表面裂纹、氧化铁皮和板形异常，并给出基于工业规则的可能原因。

质量追溯链为：

```text
订单 → 生产批次 → 生产工序 → 关键参数 → 关联设备 → 质量结果
```

数据通过 `batchId` 和设备编号进行关联展示，不在组件内重复复制生产与设备数据。

## 六、报警中心现状分析

现有报警主要来源包括：

1. `industrialAlarmLink.js` 根据生产工序参数阈值或人工上报生成联动报警。
2. `productionEvent.js` 保存生产参数异常事件。
3. `equipmentEvent.js` 保存设备健康与故障预测产生的风险事件。
4. `maintenance.js` 保存由设备风险事件生成的维护工单。

原联动报警存储键为：

```text
plate-monitor-linked-alarms
```

分析发现，原系统虽然具备报警展示、确认、处理和关闭能力，但不同来源事件的数据结构与生命周期不统一，生产异常、设备风险和维护恢复之间还缺少统一的报警业务层。

工业报警完整闭环应接近：

```text
异常发现 → 报警产生 → 报警确认 → 原因分析 → 处理执行 → 恢复验证 → 报警关闭
```

因此本阶段决定先新增统一报警事件模块，不立即修改 `Alarm.vue` 或其他业务页面，以降低对现有功能的影响。

## 七、统一报警事件业务层

### 1. 新增文件

```text
src/alarmEvent.js
```

该模块只负责业务数据，不负责页面、图表或 UI 逻辑。

主要职责：

- 统一不同来源异常的数据结构
- 将来源数据适配为标准报警事件
- 管理报警生命周期
- 保存报警处理时间线和恢复验证信息
- 提供报警查询与过滤接口
- 兼容现有联动报警数据

### 2. 标准报警结构

统一字段包括：

```text
id
sourceType
sourceEventId
domain
batchId
equipmentId
equipmentName
processId
processName
parameterKey
parameterName
title
description
level
currentValue
threshold
unit
healthScore
failureProbability
status
owner
causeAnalysis
suggestions
relatedEventId
relatedOrderId
timeline
recovery
createTime
updateTime
```

来源类型 `sourceType` 支持：

- `production_alarm`
- `production_event`
- `equipment_event`
- `maintenance`

业务领域 `domain` 支持：

- `production`
- `equipment`
- `quality`

### 3. 报警状态机

标准状态流程：

```text
new → acknowledged → processing → recovery_pending → closed
```

额外终止状态：

```text
cancelled
```

状态转换由 `validateAlarmTransition()` 统一控制，页面不能直接修改状态。例如 `new → closed` 属于非法跳转，会被拒绝。恢复验证未提交前不能关闭报警。

### 4. 核心接口

`alarmEvent.js` 提供：

- `createAlarmEvent()`：适配来源数据、去重并保存标准报警
- `getAlarmEvents()`：查询全部报警，支持按状态、设备和来源过滤
- `getAlarmEventById()`：根据编号获取报警
- `validateAlarmTransition()`：校验状态转换
- `acknowledgeAlarm()`：确认报警并记录操作人和时间
- `startAlarmProcessing()`：进入处理状态
- `appendAlarmAction()`：追加处理动作与结果
- `submitRecoveryVerification()`：提交恢复验证
- `closeAlarmEvent()`：通过恢复验证后关闭报警
- `normalizeLegacyAlarm()`：转换旧联动报警
- `fromProductionAlarm()`：适配生产联动报警
- `fromProductionEvent()`：适配生产异常事件
- `fromEquipmentEvent()`：适配设备风险事件
- `fromMaintenanceOrder()`：适配维护工单恢复信息

### 5. 持久化与兼容

统一报警使用新的 localStorage 键：

```text
thick_plate_alarm_events
```

原有键 `plate-monitor-linked-alarms` 未删除、未覆盖，保证旧报警数据与已有页面功能继续可用。

旧字段映射包括：

```text
device           → equipmentName
time             → createTime
triggerParameter → parameterName
value            → currentValue 与 unit
batchNo          → batchId
```

报警去重依据为 `sourceType + sourceEventId`，相同来源事件不会重复创建统一报警。

### 6. 时间线记录

报警确认、开始处理、处理动作、恢复验证和关闭都会写入 `timeline`。示例：

```javascript
{
  action: 'acknowledge',
  operator: '张工',
  time: '2026-08-12 10:00:00'
}
```

处理动作还可记录操作内容和结果，为后续报警中心闭环展示提供数据基础。

## 八、本阶段测试结果

已使用隔离的内存 localStorage 对 `alarmEvent.js` 进行业务测试：

- 生产联动报警转换成功
- 生产异常事件转换成功
- 设备风险事件转换成功
- 维护工单转换成功
- 重复来源事件能够阻止重复报警
- 非法状态跳转 `new → closed` 能够被拒绝
- 完整状态流程能够正常执行
- timeline 操作记录正常
- 按设备、来源和状态过滤正常
- localStorage 保存与读取正常

执行 `npm run build` 构建成功：

- 2,237 个模块完成转换
- 无 JavaScript 编译错误
- 无 Vue 模板编译错误
- 无模块引用错误
- 仅存在原有的包体积提示，不影响运行

## 九、本次实际修改范围

最新统一报警事件阶段仅新增：

```text
src/alarmEvent.js
```

未修改：

- `src/views/Alarm.vue`
- `src/views/Production.vue`
- `src/views/Equipment.vue`
- `src/views/Maintenance.vue`
- `src/industrialAlarmLink.js`

因此当前已有页面和报警联动逻辑不受影响。统一报警模块目前作为独立业务层存在，等待下一阶段再接入报警中心页面。

## 十、当前项目约束

后续继续遵守以下约定：

1. 不重新创建项目，不大规模重构现有页面。
2. 保持 Vue3、Vite、Element Plus、Vue Router 和 ECharts 架构。
3. 不引入后端、数据库、Pinia 或 TypeScript。
4. 所有业务数据继续使用 JavaScript Mock 和 localStorage。
5. 不将模拟功能描述为真实工业接入、真实设备预测或真实大模型。
6. 保持“DEMO / 工业仿真数据 / 智能分析演示”等标识。
7. 项目最终只保留英文目录名 `SoftwareCopyright`。

## 十一、下一阶段建议

下一阶段可在保持现有页面布局的前提下，将 `Alarm.vue` 逐步接入 `alarmEvent.js`：

1. 先以只读方式同时展示旧报警与统一报警。
2. 再将确认、处理、恢复验证、关闭操作迁移到统一状态机接口。
3. 最后建立维护完成结果向报警恢复验证的反馈关系。

迁移过程中应继续保留旧存储键和兼容适配器，避免一次性替换导致现有生产报警联动失效。
