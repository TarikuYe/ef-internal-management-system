# Registrar Excel Export APIs - Technical Documentation

This directory contains dynamic Excel export API endpoints developed using Node.js and **ExcelJS** for the Contract Administration Department's Workspace. They generate professional, client-ready Excel sheets (`.xlsx`) with custom styling, data formatting, KPI summary blocks, and status-based alerts.

---

## 🔒 Security & Access Control
Access to all export routes is protected by an authorization guard:
* **Allowed Roles**: `admin`, `dgm`, `registrar`.
* **Allowed Department**: Any user with `department_id === 'contract'` (Contract Administration managers and employees).
* **HTTP Method**: `GET`
* **Response**: Returns a downloadable file stream with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` MIME type.

---

## 📂 Export Endpoints Reference

### 1. Guarantee Bonds Register
* **Route**: `/api/registrar/export-bonds`
* **Purpose**: Generates a comprehensive summary of contractor guarantee bonds (Advance Payment Bonds & Performance Bonds) grouped by contractor and project.
* **Layout Features**:
  * **Branding**: Navy blue theme header (`FF333399`) with solid thin borders.
  * **Pivoted Architecture**: Instead of displaying duplicate rows, it group-pivots Advance Payment Bonds (APB) and Performance Bonds (PB) side-by-side for each project and contractor pairing.
  * **Days Remaining Alerts**: Automatically color-codes bonds near expiry or already overdue:
    * 🔴 **Overdue**: Red highlight (`FFFF8080` text `FF993300`)
    * 🟡 **Expiring within 30 days**: Yellow highlight (`FFFFFF99` text `FF993300`)
    * 🟢 **On Track / Active**: Green highlight (`FFCCFFCC` text `FF008000`)
  * **Financial Totals**: Auto-sum calculation cells at the bottom for total APB and PB values.

### 2. Correspondence Register
* **Route**: `/api/registrar/export-correspondence`
* **Purpose**: Generates a log of all incoming and outgoing letters (NOCs, RFIs, variations, payments) and action tracking.
* **Layout Features**:
  * **KPI Summary Header**: Generates styled card-like blocks at the top of the worksheet displaying total letters, open tasks, closed letters, and overdue responses.
  * **Direction Badges**: Distinctly highlights letters as **Incoming** (Navy Blue text) and **Outgoing** (Amber text).
  * **Status Styling**:
    * 🔴 **Overdue**: Red background (`FFFEE2E2` text `FF991B1B`)
    * 🟡 **Open**: Amber background (`FFFEF3C7` text `FF92400E`)
    * 🟢 **Closed**: Green background (`FFF0FDF4` text `FF166534`)
  * **Metadata**: Includes Letter Reference No, Subject, Counterparty, Date Logged, Response Due Date, Response Sent Date, and Linked Cross-Reference references.

### 3. Extension of Time (EOT) Claims Log
* **Route**: `/api/registrar/export-eot`
* **Purpose**: Log of all EOT claims, revised completion dates, and approval metrics.
* **Layout Features**:
  * **Metrics Summary**: Summary blocks representing total EOT requests, total approved days, and pending claims.
  * **Alert Threshold Rules**: Highlights projects approaching revised completion dates or containing unresolved statuses.
  * **Color Palette**: Uses professional green, slate, and navy tones to represent claim numbers, reasons for extensions, and manager comments.

### 5. Daily Work Logs Ledger
* **Route**: `/api/registrar/export-work-logs`
* **Purpose**: Comprehensive ledger of all employee daily work logs, biometric punch times, computed working hours, task descriptions, progress completion rates, and manager approval decisions.
* **Layout Features**:
  * **Executive KPI Bar**: Card-like summary blocks at top displaying Total Logs, Total Hours Worked, Approved Count, Pending Count, and Returned/Rejected Count.
  * **Manager-Verified Hours Calculation**: Prioritizes manager-updated `actual_working_hour` and `hours_worked` values with dynamic Excel `=SUM(...)` formulas in the summary footer.
  * **Status Pills**: Soft green for Approved, soft yellow for Pending, soft red for Returned/Rejected.
  * **Summary Footer Block**: Bold double-underlined summary displaying calculated total operational hours worked and average completion percentage.

---

## 🎨 Visual Design System Standards
All exports follow consistent styling principles matching corporate identity:
1. **Typography**: Arial/Segoe UI fonts with clear visual hierarchy (Title sizes 16pt, headers 11pt bold, data rows 10pt regular).
2. **Alternating Row Striping**: Alternates between white and soft light blue/gray background fills to improve scanability.
3. **Auto-fit Column Widths**: Automatically loops through rows after generation to compute maximum character widths and sets padded column widths to prevent text clipping (`###` errors).
4. **Number Formatting**: 
   * **Currency**: `#,##0.00 "ETB"`
   * **Dates**: `YYYY-MM-DD`
   * **Percentages**: `0.0%`
