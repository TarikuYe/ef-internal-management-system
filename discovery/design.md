# Department Discovery Template: Design Department

This discovery document gathers the operational workflows, technical parameters, and data structures required to build the **Design Department** module in the EF Enterprise Management Platform.

---

## 1. Daily Workflows
*   What are the core activities performed daily by design engineers?
*   How are task assignments allocated (e.g. by project manager, project code, or drawing discipline)?
*   How is work-in-progress drawing design tracked?

## 2. Drawing Lifecycle
Document the status transitions of drawings from creation to distribution:
1.  **Drafting:** Initial work by draftsperson/designer.
2.  **Internal Review:** Senior designer/architect validation.
3.  **Approved for Review:** Sent to head of department.
4.  **Client Review:** Sent externally for comments.
5.  **IFC (Issued for Construction):** Approved drawing distributed to site.

## 3. Revision Process
*   What is the numbering/lettering convention for revisions (e.g., Rev A, Rev 0, Rev 1)?
*   How are revision logs, clouds, and modifications tracked in the database?
*   How is legacy/superseded drawing control enforced?

## 4. Approval Chain
*   Identify roles in the design approval process (e.g., Designer, Chief Architect, Department Head, Client Engineer).
*   Is multi-signature validation required before drawing release?

## 5. Required Reports & Outputs
*   **Drawing Register:** A list of all project drawings and their latest revision statuses.
*   **Review Memo:** Standard format for comments returned by the client.
*   **Transmittal Sheet:** Official document tracking drawing distribution.

## 6. Software & Inputs Used
*   *Software:* AutoCAD, Revit, Civil 3D, ETABS, etc.
*   *Legacy Systems:* Specify if drawing registers are currently kept in Excel sheets or local network folders. Attach samples of those sheets.

## 7. Key Performance Indicators (KPIs)
*   **Drawing Delivery Variance:** Scheduled delivery date vs. actual IFC date.
*   **Review Turnaround Time:** Average days taken by client or internal staff to review a drawing.
*   **Revision Frequency:** Average number of revisions required per drawing package.

## 8. Dashboard Requirements
*   *Engineer View:* List of assigned drawings, upcoming submission deadlines, and returned reviews.
*   *Manager View:* Overall project drawing index, status summary (Pending, Approved, IFC), and workload allocation charts.
