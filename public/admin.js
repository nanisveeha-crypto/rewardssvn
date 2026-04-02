/**
 * SVNTEX Admin Portal - Logic
 */

// config is already initialized in app.js if included before
// but since we need auth, let's ensure it's here if app.js logic conflicts
// Actually, let's extract config to a separate file or just redefine here for clarity
const firebaseConfigAdmin = {
    apiKey: "AIzaSyCgFGUfCXvYc17Z7vIYI37TZrdZ4zFfY84",
    authDomain: "master-49709.firebaseapp.com",
    projectId: "master-49709",
    storageBucket: "master-49709.firebasestorage.app",
    messagingSenderId: "930783829312",
    appId: "1:930783829312:web:30118d333ecc807bc92ea5",
    measurementId: "G-082P5V0F6Y"
};

// Only initialize if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfigAdmin);
}

const auth = firebase.auth();
const db = firebase.firestore();

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const logoutBtn = document.getElementById('logout-btn');

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        showDashboard();
    } else {
        showLogin();
    }
});

// Login Handler
document.getElementById('admin-login-btn').onclick = async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Login failed: " + error.message);
    }
};

// Logout Handler
logoutBtn.onclick = () => auth.signOut();

function showLogin() {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    logoutBtn.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadResponses();
}

async function loadResponses() {
    const tableBody = document.getElementById('responses-table-body');
    tableBody.innerHTML = '<tr><td colspan="8">Loading data...</td></tr>';

    try {
        const snapshot = await db.collection('responses').orderBy('timestamp', 'desc').get();
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 
                        (data.webhook_received_at ? data.webhook_received_at.toDate().toLocaleString() : 'N/A');
            
            const isPaid = (data.financial_status === 'paid');
            const statusStyle = isPaid ? 'color: green; font-weight: bold;' : 'color: orange;';

            html += `
                <tr>
                    <td><strong>${data.order_name || data.order_id || 'N/A'}</strong></td>
                    <td>${data.customer_name || 'N/A'}</td>
                    <td>${data.email || 'N/A'}</td>
                    <td>${data.phone || 'N/A'}</td>
                    <td>${data.amount || 'N/A'}</td>
                    <td style="${statusStyle}">${data.financial_status || 'Pending'}</td>
                    <td>${data.answers?.exp || '-'} / 5</td>
                    <td style="font-size: 0.8rem; color: #666;">${date}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html || '<tr><td colspan="8">No responses found yet.</td></tr>';
    } catch (error) {
        console.error("Error loading responses:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="color: red;">Error: ${error.message}. <br>Make sure you have permission to view this data.</td></tr>`;
    }
}
