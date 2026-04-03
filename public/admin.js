/**
 * SVNTEX Admin Portal - Professional Version
 */

const firebaseConfigAdmin = {
    apiKey: "AIzaSyCgFGUfCXvYc17Z7vIYI37TZrdZ4zFfY84",
    authDomain: "master-49709.firebaseapp.com",
    projectId: "master-49709",
    storageBucket: "master-49709.firebasestorage.app",
    messagingSenderId: "930783829312",
    appId: "1:930783829312:web:30118d333ecc807bc92ea5",
    measurementId: "G-082P5V0F6Y"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfigAdmin);
}

const auth = firebase.auth();
const db = firebase.firestore();

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');

// --- Auth State Observer ---
auth.onAuthStateChanged(user => {
    if (user) {
        showDashboard();
    } else {
        showLogin();
    }
});

// --- Login Handler ---
document.getElementById('admin-login-btn').onclick = async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const btn = document.getElementById('admin-login-btn');
    
    try {
        btn.disabled = true;
        btn.innerText = "Logging in...";
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Login failed: " + error.message);
        btn.disabled = false;
        btn.innerText = "Login to Dashboard";
    }
};

document.getElementById('logout-btn').onclick = () => auth.signOut();

function showLogin() {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'flex';
    initAdmin();
}

// --- Admin Initialization ---
async function initAdmin() {
    setupNavigation();
    await migrateQuestionsIfEmpty();
    loadDashboardStats();
    loadAdminQuestions();
    loadResponses();
}

// --- Navigation Controller ---
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.onclick = (e) => {
            const section = item.getAttribute('data-section');
            
            // UI Update
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            // View Swapping
            document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
            document.getElementById(`${section}-view`).style.display = 'block';
            
            // Refresh data if needed
            if (section === 'responses') loadResponses();
            if (section === 'questions') loadAdminQuestions();
            if (section === 'welcome') loadDashboardStats();
        };
    });
}

// --- 1. Dashboard Stats Logic ---
async function loadDashboardStats() {
    try {
        const snap = await db.collection('responses').get();
        const docs = snap.docs.map(d => d.data());
        
        const totalOrders = docs.length;
        const rewardsClaimed = docs.filter(d => d.answers).length;
        
        let totalRevenue = 0;
        docs.forEach(d => {
            const amt = parseFloat(d.amount) || 0;
            totalRevenue += amt;
        });

        document.getElementById('stat-total-orders').innerText = totalOrders;
        document.getElementById('stat-claimed').innerText = rewardsClaimed;
        document.getElementById('stat-revenue').innerText = `₹${totalRevenue.toLocaleString()}`;
    } catch (e) {
        console.error("Stats Error:", e);
    }
}

// --- 2. Question Management Logic ---
const qTypeSelect = document.getElementById('q-type');
const qOptionsContainer = document.getElementById('q-options-container');

qTypeSelect.onchange = () => {
    qOptionsContainer.style.display = qTypeSelect.value === 'mcq' ? 'block' : 'none';
};

document.getElementById('add-q-btn').onclick = async () => {
    const text = document.getElementById('q-text').value;
    const type = document.getElementById('q-type').value;
    const optionsRaw = document.getElementById('q-options').value;
    
    if (!text) return alert("Please enter question text.");
    
    const btn = document.getElementById('add-q-btn');
    btn.disabled = true;
    
    const newQ = {
        text: text,
        type: type,
        options: type === 'mcq' ? optionsRaw.split(',').map(o => o.trim()) : [],
        order: Date.now(),
        created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('questions').add(newQ);
        document.getElementById('q-text').value = '';
        document.getElementById('q-options').value = '';
        loadAdminQuestions();
    } catch (e) {
        alert("Error adding question: " + e.message);
    } finally {
        btn.disabled = false;
    }
};

async function loadAdminQuestions() {
    const container = document.getElementById('questions-list-container');
    container.innerHTML = '<div class="loader">Loading questions...</div>';
    
    try {
        const snap = await db.collection('questions').orderBy('order', 'asc').get();
        let html = '<h3>Current Questions</h3>';
        
        if (snap.empty) {
            html += '<p style="color:#888;">No questions found. Add one above.</p>';
        }

        snap.forEach(doc => {
            const q = doc.data();
            html += `
                <div class="question-list-item">
                    <div>
                        <strong style="display:block;">${q.text}</strong>
                        <small style="color:#666;">Type: ${q.type.toUpperCase()} ${q.options?.length ? `(${q.options.join(', ')})` : ''}</small>
                    </div>
                    <button onclick="deleteQuestion('${doc.id}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-weight:bold;">Delete</button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p style="color:red;">Error: ${e.message}</p>`;
    }
}

window.deleteQuestion = async (id) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    await db.collection('questions').doc(id).delete();
    loadAdminQuestions();
};

// --- 3. Responses Management Logic ---
async function loadResponses() {
    const tableBody = document.getElementById('responses-table-body');
    tableBody.innerHTML = '<tr><td colspan="9">Loading responses...</td></tr>';

    try {
        const snapshot = await db.collection('responses').get();
        const mergedData = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = (data.order_id || doc.id).toString();
            if (!orderId) return;
            
            if (!mergedData[orderId]) {
                mergedData[orderId] = data;
            } else {
                const existing = mergedData[orderId];
                if (data.order_name && data.order_name.startsWith('SVN')) existing.order_name = data.order_name;
                if (data.order_number) existing.order_number = data.order_number;
                if (data.customer_name && data.customer_name !== 'Customer') existing.customer_name = data.customer_name;
                if (data.email) existing.email = data.email;
                if (data.phone) existing.phone = data.phone;
                if (data.amount) existing.amount = data.amount;
                if (data.financial_status === 'paid') existing.financial_status = 'paid';
                if (data.answers) {
                    existing.answers = data.answers;
                    if (data.timestamp) existing.timestamp = data.timestamp;
                }
            }
        });
        
        const sorted = Object.values(mergedData).sort((a, b) => {
            const timeA = (a.timestamp?.seconds || a.last_updated_at?.seconds || a.webhook_received_at?.seconds || 0);
            const timeB = (b.timestamp?.seconds || b.last_updated_at?.seconds || b.webhook_received_at?.seconds || 0);
            return timeB - timeA;
        });

        let html = '';
        sorted.forEach(data => {
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 
                        (data.webhook_received_at ? data.webhook_received_at.toDate().toLocaleString() : 'N/A');
            
            const svnId = data.order_name || 'N/A';
            const orderNumber = data.order_number || (svnId.startsWith('SVN') ? svnId.replace('SVN', '') : 'N/A');
            const status = (data.financial_status || 'Pending').toLowerCase();
            const statusClass = status === 'paid' ? 'status-paid' : 'status-pending';

            html += `
                <tr>
                    <td>
                        <strong style="color: #1a73e8;">${svnId}</strong>
                        <div style="font-size: 0.65rem; color: #aaa; margin-top: 2px;">ID: ${data.order_id || 'N/A'}</div>
                    </td>
                    <td><span style="font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${orderNumber}</span></td>
                    <td>${data.customer_name || 'N/A'}</td>
                    <td>${data.email || 'N/A'}</td>
                    <td>${data.phone || 'N/A'}</td>
                    <td>${data.amount || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${status.toUpperCase()}</span></td>
                    <td>${data.answers ? 'Viewed' : '-'}</td>
                    <td style="font-size: 0.8rem; color: #666;">${date}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html || '<tr><td colspan="9">No records found.</td></tr>';
    } catch (error) {
        console.error("Table Error:", error);
        tableBody.innerHTML = `<tr><td colspan="9" style="color:red;">Error: ${error.message}</td></tr>`;
    }
}

document.getElementById('refresh-btn').onclick = loadResponses;

// --- Automatic Question Migration ---
async function migrateQuestionsIfEmpty() {
    const snap = await db.collection('questions').limit(1).get();
    if (!snap.empty) return; // Already setup

    console.log("Initializing default questions...");
    const defaults = [
        { text: "How would you rate your overall shopping experience?", type: "rating", order: 1 },
        { text: "How did you discover SVNTEX?", type: "mcq", options: ["Social Media", "Friend/Family", "Advertisement", "Search Engine", "Other"], order: 2 },
        { text: "Which product are you most looking forward to using?", type: "text", order: 3 },
        { text: "Would you recommend us to others?", type: "binary", order: 4 }
    ];

    for (const q of defaults) {
        await db.collection('questions').add({
            ...q,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}
