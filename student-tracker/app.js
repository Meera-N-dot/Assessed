// The base URL of backend server
const API_URL = 'http://localhost:3001/api';

// --- UNIVERSAL CODE ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('studentList')) {
        runStudentListPage();
    } else if (document.getElementById('studentName')) {
        runStudentDetailPage();
    }
});

// --- PAGE 1: STUDENT LIST LOGIC ---
async function runStudentListPage() {
    const searchInput = document.getElementById('searchInput');
    const blockFilter = document.getElementById('blockFilter');
    
    // Fetch students from backend
    const allStudents = await fetch(`${API_URL}/students`).then(res => res.json());

    function renderStudents(studentArray) {
        const studentList = document.getElementById('studentList');
        studentList.innerHTML = ''; 

        if (studentArray.length === 0) {
            studentList.innerHTML = '<li>No students found.</li>';
            return;
        }

        studentArray.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="student.html?id=${student.id}">${student.name}</a>
                <span>Block ${student.block}</span>
            `;
            studentList.appendChild(li);
        });
    }

    function filterAndSearch() {
        let filteredStudents = [...allStudents];
        const searchTerm = searchInput.value.toLowerCase();
        const selectedBlock = blockFilter.value;

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(searchTerm));
        }
        if (selectedBlock !== 'all') {
            filteredStudents = filteredStudents.filter(s => s.block == selectedBlock);
        }
        renderStudents(filteredStudents);
    }

    searchInput.addEventListener('input', filterAndSearch);
    blockFilter.addEventListener('change', filterAndSearch);

    renderStudents(allStudents); // Initial display
}

// --- PAGE 2: STUDENT DETAIL LOGIC ---
async function runStudentDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    const courseId = '6600'; // Your Course ID

    if (!studentId) { console.error("No Student ID provided in URL"); return; }

    // --- 1. Fetch ALL data in parallel ---
    const [allStudents, maConfig] = await Promise.all([
        fetch(`${API_URL}/students`).then(res => res.json()),
        fetch(`${API_URL}/ma-config`).then(res => res.json())
    ]);

    const student = allStudents.find(s => s.id === studentId);
    if (!student) { console.error("Student not found"); return; }

    // --- 2. Populate Student Info ---
    document.getElementById('studentName').textContent = student.name;
    document.getElementById('studentBlock').textContent = `Block ${student.block}`;
    document.getElementById('googleDriveButton').href = student.googleDriveUrl;

    // --- 3. Render MA Statuses ---
    const maContainer = document.getElementById('ma-container');
    const maOptions = ['To be Graded', 'Graded', 'Need to Reassess'];
    maContainer.innerHTML = '';

    console.log('--- MA Config Map ---', maConfig);

    for (const maKey in student.ma_statuses) {
        const currentStatus = student.ma_statuses[maKey];
        
        // Create the new elements manually
        const maItem = document.createElement('div');
        maItem.className = 'ma-item';

        const maHeader = document.createElement('div');
        maHeader.className = 'ma-item-header';
        
        const label = document.createElement('label');
        label.textContent = maKey;

        // Build the dropdown select
        const select = document.createElement('select');
        select.dataset.maKey = maKey;
        let optionsHtml = '';
        maOptions.forEach(option => {
            const selected = (option === currentStatus) ? 'selected' : '';
            optionsHtml += `<option value="${option}" ${selected}>${option}</option>`;
        });
        select.innerHTML = optionsHtml;
        
        // Add the change listener
        select.addEventListener('change', async (event) => {
            const newStatus = event.target.value;
            await fetch(`${API_URL}/students/update-ma`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: student.id, maKey: maKey, newStatus: newStatus })
            });
        });

        // Create the container for the rubric
        const rubricContainer = document.createElement('div');
        rubricContainer.className = 'rubric-criteria-container';
        rubricContainer.id = `rubric-for-${maKey}`; 

        // Assemble the MA item
        maHeader.appendChild(label);
        maHeader.appendChild(select);
        maItem.appendChild(maHeader);
        maItem.appendChild(rubricContainer);
        maContainer.appendChild(maItem);

        // --- Fetch the specific rubric for this MA ---
        const assignmentId = maConfig[maKey]; 
        
        if (assignmentId && student.canvasUserId) {
            fetchAndRenderRubric(courseId, assignmentId, student.canvasUserId, rubricContainer);
        } else {
            rubricContainer.innerHTML = `<p class="rubric-placeholder">No Canvas rubric linked.</p>`;
        }
    }

    // --- 4. NEW: LOAD THE REPORT CARD ---
    if (student.canvasUserId) {
        // This calls the new function at the bottom of the file
        loadReportCard(courseId, student.canvasUserId);
    }
}
// --- HELPER FUNCTIONS ---

function renderCanvasRubric(masteryData, container) {
    if (!masteryData || Object.keys(masteryData).length === 0) {
        container.innerHTML = '<p class="rubric-placeholder">No learning mastery data found.</p>';
        return;
    }
    let html = '<ul>';
    for (const outcomeTitle in masteryData) {
        const score = masteryData[outcomeTitle];
        const scoreText = score !== null ? score : 'N/A';
        html += `
            <li class="rubric-item">
                <span class="rubric-score">${scoreText}</span>
                <span class="rubric-title">${outcomeTitle}</span>
            </li>`;
    }
    html += '</ul>';
    container.innerHTML = html;
}

async function fetchAndRenderRubric(courseId, assignmentId, userId, container) {
    container.innerHTML = `<p class="rubric-placeholder">Loading rubric...</p>`;
    try {
        const response = await fetch(`${API_URL}/canvas-rubric/${courseId}/${assignmentId}/${userId}`);
        if (!response.ok) throw new Error(`Server status ${response.status}`);

        const assessment = await response.json();
        if (!assessment || assessment.length === 0) {
            container.innerHTML = `<p class="rubric-placeholder">No submission data found.</p>`;
            return;
        }
        
        let html = '<ul>';
        assessment.forEach(criterion => {
            html += `
                <li class="criteria-item">
                    <span class="criteria-score">${criterion.points} / ${criterion.max_points}</span>
                    <span class="criteria-title">${criterion.description}</span>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error in fetchAndRenderRubric', error);
        container.innerHTML = `<p class="error">Error loading rubric.</p>`;
    }
}

// --- NEW FUNCTION: REPORT CARD LOADER ---
async function loadReportCard(courseId, studentId) {
    const tableBody = document.getElementById('report-card-body');
    
    // Safety check: Does the HTML table exist?
    if (!tableBody) {
        console.warn("Report Card table not found in HTML. Skipping.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/canvas-report-card/${courseId}/${studentId}`);
        const reportData = await response.json();

        if (!reportData || reportData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No mastery data found.</td></tr>';
            return;
        }

        let html = '';
        reportData.forEach(item => {
            // Logic: Green if Score >= Goal, Red if not
            const isMastered = item.student_score >= item.mastery_goal;
            const color = isMastered ? '#d4edda' : '#f8d7da'; 

            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${item.outcome_title}</td>
                    <td style="padding: 10px; font-weight: bold; background-color: ${color};">${item.student_score ?? '-'}</td>
                    <td style="padding: 10px;">${item.mastery_goal}</td>
                    <td style="padding: 10px;">${item.count}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error loading report card:", error);
        tableBody.innerHTML = '<tr><td colspan="4" style="color:red;">Error loading report card.</td></tr>';
    }
}