# 比赛计分系统 / Competition Scoring System

## 中文说明

### 项目简介
比赛计分系统是一个功能完整的Web应用程序，专门设计用于各类比赛活动的实时计分和排名管理。系统提供直观的界面，支持多选手同时计分、实时排名显示、快捷键操作和证书打印等功能。

### 主要功能
- **实时计分控制**：为每个选手提供独立的计分卡片，支持±1分和±5分的快速调整
- **实时排名显示**：自动计算并显示选手排名，前3名有特殊标识
- **快捷键系统**：可为每个选手设置自定义快捷键，快速调整分数
- **奖项打印**：支持生成荣誉证书和打印完整排名表
- **实时显示页面**：专为大屏幕设计的全屏显示模式
- **数据管理**：支持数据导入导出，所有数据保存在本地
- **响应式设计**：适配手机、平板和桌面设备

### 使用方法
1. **初始设置**：
   - 在"比赛设置"标签页中输入比赛名称和满分值
   - 在选手名单文本框中输入选手姓名（每行一个名字）
   - 点击"保存设置"按钮

2. **计分操作**：
   - 在"计分面板"标签页中为选手调整分数
   - 使用+1/+5和-1/-5按钮手动调整
   - 或设置快捷键后使用键盘快速操作

3. **查看排名**：
   - "排名榜"标签页显示完整排名
   - "实时显示"标签页适合大屏幕展示

4. **打印功能**：
   - 在"奖项打印"标签页中生成荣誉证书或打印排名表

### 技术特点
- 纯前端实现，无需服务器
- 使用localStorage保存数据
- 响应式设计，支持多设备
- 快捷键操作提高效率
- 专业证书模板设计

## English Description

### Project Introduction
The Competition Scoring System is a fully-featured web application specifically designed for real-time scoring and ranking management in various competition events. The system provides an intuitive interface, supporting simultaneous scoring for multiple contestants, real-time ranking display, shortcut key operations, and certificate printing.

### Key Features
- **Real-time Scoring Control**: Individual scoring cards for each contestant with quick ±1 and ±5 point adjustments
- **Real-time Ranking Display**: Automatic calculation and display of contestant rankings with special indicators for top 3
- **Shortcut System**: Customizable shortcut keys for each contestant to quickly adjust scores
- **Award Printing**: Generate honor certificates and print complete ranking tables
- **Live Display Page**: Full-screen display mode designed for large screens
- **Data Management**: Support for data import/export with all data stored locally
- **Responsive Design**: Compatible with mobile, tablet, and desktop devices

### How to Use
1. **Initial Setup**:
   - Enter competition name and maximum score in the "Settings" tab
   - Input contestant names in the contestant list text box (one name per line)
   - Click the "Save Settings" button

2. **Scoring Operations**:
   - Adjust scores for contestants in the "Scoring Panel" tab
   - Use +1/+5 and -1/-5 buttons for manual adjustments
   - Or use keyboard shortcuts after configuration

3. **View Rankings**:
   - "Rankings" tab displays complete rankings
   - "Live Display" tab is suitable for large screen presentation

4. **Printing Functions**:
   - Generate honor certificates or print ranking tables in the "Awards Printing" tab

### Technical Features
- Pure frontend implementation, no server required
- Data saved using localStorage
- Responsive design supporting multiple devices
- Shortcut key operations for improved efficiency
- Professionally designed certificate templates

---

### 注意事项 / Notes
- 所有数据保存在浏览器本地存储中，清除浏览器数据会导致数据丢失
- 建议定期使用"导出数据"功能备份比赛数据
- 打印功能需要浏览器支持打印对话框

- All data is saved in browser local storage; clearing browser data will result in data loss
- Regular backup of competition data using the "Export Data" function is recommended
- Printing function requires browser support for print dialog
