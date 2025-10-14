// The base URL of our backend server
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
    
    // Fetch all students from our backend
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

    // We still fetch all students, then find the one we need.
    // A more advanced backend might have an endpoint for a single student.
    const allStudents = await fetch(`${API_URL}/students`).then(res => res.json());
    const student = allStudents.find(s => s.id === studentId);

    if (!student) {
        document.querySelector('.container').innerHTML = '<h1>Student not found.</h1><a href="index.html">Back to list</a>';
        return;
    }

    document.getElementById('studentName').textContent = student.name;
    document.getElementById('studentBlock').textContent = `Block ${student.block}`;
    document.getElementById('googleDriveButton').href = student.googleDriveUrl;

    const maContainer = document.getElementById('ma-container');
    const maOptions = ['To be Graded', 'Graded', 'Need to Reassess'];
    maContainer.innerHTML = '';

    for (const maKey in student.ma_statuses) {
        const currentStatus = student.ma_statuses[maKey];
        const maItem = document.createElement('div');
        maItem.className = 'ma-item';
        
        let optionsHtml = '';
        maOptions.forEach(option => {
            const selected = (option === currentStatus) ? 'selected' : '';
            optionsHtml += `<option value="${option}" ${selected}>${option}</option>`;
        });

        maItem.innerHTML = `
            <label>${maKey}</label>
            <select data-ma-key="${maKey}">${optionsHtml}</select>
        `;
        maContainer.appendChild(maItem);
    }
    
    // Add event listener to all dropdowns to update the sheet
    maContainer.querySelectorAll('select').forEach(selectElement => {
        selectElement.addEventListener('change', async (event) => {
            const maKey = event.target.dataset.maKey;
            const newStatus = event.target.value;
            
            // Send the update to our backend
            await fetch(`${API_URL}/students/update-ma`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    maKey: maKey,
                    newStatus: newStatus
                })
            });
            // You could add a 'Saved!' confirmation message here
        });
    });

    // Draw the mock rubric chart (this part remains the same)
    const ctx = document.getElementById('rubricChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Collaboration', 'Critical Thinking', 'Communication', 'Problem Solving', 'Creativity'],
            datasets: [{
                label: 'Mastery Level (out of 4)',
                data: [1, 3, 2, 4, 3], 
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true, max: 4, ticks: { stepSize: 1 } } } }
    });
}