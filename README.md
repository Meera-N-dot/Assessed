Functionality/Technical Documentation:
- Full-stack web application that integrates Google Sheets and Canvas LMS into a single, unified interface. It allows the user to view student rosters, track grading states (e.g., "To be Graded," "Reassess"), and view live mastery data without switching tabs.
- Uses Node.js, HTML, JavaScript, CSS, and the backend uses the Express framework to create a REST API.
- Uses a proxy to view Google Sheets, which acts as a database, including names, IDs, drive links, status, and allows users to both change status from the website and view it in Sheets, and vice versa.
- Connects to  Canvas API to retrieve learning data ( mastery scores for specific learning standards), it fetches the raw scores and the descriptive titles, then displays these on the main page.
  
Improvements/Bug Fixes:
- Add security features (sign-in/authentication + customization to specific canvas pages)
- More automation, automation with student-ids, canvas codes/urls
- Updates rubric scores directly to Canvas rather than just reading and displaying them from the Outcomes page
