# 比賽計分系統 / Competition Scoring System

## 中文說明（繁體）

### 項目簡介
比賽計分系統是一個功能完整的網頁應用程式，專門設計用於各類比賽活動的即時計分和排名管理。系統提供直觀的介面，支援多選手同時計分、即時排名顯示、快捷鍵操作和證書列印等功能。

### 主要功能
- **即時計分控制**：為每個選手提供獨立的計分卡片，支援±1分和±5分的快速調整
- **即時排名顯示**：自動計算並顯示選手排名，前3名有特殊標識
- **快捷鍵系統**：可為每個選手設定自訂快捷鍵，快速調整分數
- **獎項列印**：支援生成榮譽證書和列印完整排名表
- **即時顯示頁面**：專為大螢幕設計的全螢幕顯示模式
- **資料管理**：支援資料匯入匯出，所有資料儲存在本機
- **響應式設計**：適配手機、平板和桌面設備

### 使用方法
1. **初始設定**：
   - 在"比賽設定"標籤頁中輸入比賽名稱和滿分值
   - 在選手名單文字方塊中輸入選手姓名（每行一個名字）
   - 點擊"儲存設定"按鈕

2. **計分操作**：
   - 在"計分面板"標籤頁中為選手調整分數
   - 使用+1/+5和-1/-5按鈕手動調整
   - 或設定快捷鍵後使用鍵盤快速操作

3. **查看排名**：
   - "排名榜"標籤頁顯示完整排名
   - "即時顯示"標籤頁適合大螢幕展示

4. **列印功能**：
   - 在"獎項列印"標籤頁中生成榮譽證書或列印排名表

### 技術特點
- 純前端實現，無需伺服器
- 使用localStorage儲存資料
- 響應式設計，支援多設備
- 快捷鍵操作提高效率
- 專業證書模板設計

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

### 注意事項 / Notes
- 所有資料儲存在瀏覽器本機儲存中，清除瀏覽器資料會導致資料遺失
- 建議定期使用"匯出資料"功能備份比賽資料
- 列印功能需要瀏覽器支援列印對話方塊

- All data is saved in browser local storage; clearing browser data will result in data loss
- Regular backup of competition data using the "Export Data" function is recommended
- Printing function requires browser support for print dialog

### 版本資訊 / Version Info
- 版本：1.0
- 最後更新：2025年10月
- 適用瀏覽器：Chrome、Firefox、Safari、Edge等現代瀏覽器

- Version: 1.0
- Last Updated: October 2025
- Compatible Browsers: Chrome, Firefox, Safari, Edge and other modern browsers
