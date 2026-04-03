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

// Global Refresh Button Listener
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
    refreshBtn.onclick = () => loadResponses();
}

async function loadResponses() {
    const tableBody = document.getElementById('responses-table-body');
    tableBody.innerHTML = '<tr><td colspan="9">Loading data...</td></tr>';

    try {
        // --- FIX: Remove orderBy('timestamp') because it hides orders missing that field! ---
        const snapshot = await db.collection('responses').get();
        
        // --- NEW: Order-based Merging Logic ---
        const mergedData = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = (data.order_id || doc.id).toString();
            if (!orderId) return;
            
            if (!mergedData[orderId]) {
                mergedData[orderId] = data;
            } else {
                const existing = mergedData[orderId];
                
                // Prioritize SVN names/Real Names over tokens/IDs
                if (data.order_name && data.order_name.startsWith('SVN')) existing.order_name = data.order_name;
                if (data.order_number) existing.order_number = data.order_number;
                if (data.customer_name && data.customer_name !== 'Customer' && data.customer_name !== 'N/A') existing.customer_name = data.customer_name;
                
                // Prioritize real data over N/A or empty
                if (data.email && data.email !== '') existing.email = data.email;
                if (data.phone && data.phone !== 'N/A' && data.phone !== '') existing.phone = data.phone;
                if (data.amount && data.amount !== 'N/A' && data.amount !== '') existing.amount = data.amount;
                if (data.financial_status && data.financial_status === 'paid') existing.financial_status = 'paid';
                if (data.answers) {
                    existing.answers = data.answers;
                    if (data.timestamp) existing.timestamp = data.timestamp;
                }
            }
        });
        
        let html = '';
        const dataArray = Object.values(mergedData);
        
        // Sort by timestamp desc (Robustly handle Firestore Timestamps, Dates or Numbers)
        const sorted = dataArray.sort((a, b) => {
            const getTimestamp = (obj) => {
                const fields = ['timestamp', 'last_updated_at', 'webhook_received_at'];
                for (const f of fields) {
                    if (obj[f]) {
                        if (obj[f].seconds) return obj[f].seconds; // Firestore TS
                        if (obj[f] instanceof Date) return obj[f].getTime() / 1000; // JS Date
                        if (typeof obj[f] === 'number') return obj[f] / 1000; // Raw Epoch
                    }
                }
                return 0; // Fallback
            };

            const timeA = getTimestamp(a);
            const timeB = getTimestamp(b);
            return timeB - timeA;
        });

        sorted.forEach(data => {
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 
                        (data.webhook_received_at ? data.webhook_received_at.toDate().toLocaleString() : 'N/A');
            
            // svn id (e.g. SVN10429)
            let svnId = data.order_name || 'N/A';
            // order number (e.g. 10429) - fallback to last part of SVN ID if missing
            let orderNumber = data.order_number || (svnId.startsWith('SVN') ? svnId.replace('SVN', '') : 'N/A');
            
            const rawStatus = (data.financial_status || 'Pending').toLowerCase();
            let statusLabel = 'Pending';
            let statusClass = 'status-badge status-pending';

            if (rawStatus === 'paid') {
                statusLabel = 'Paid';
                statusClass = 'status-badge status-paid';
            } else if (rawStatus === 'refunded') {
                statusLabel = 'Refunded';
                statusClass = 'status-badge status-refunded';
            } else if (rawStatus === 'voided') {
                statusLabel = 'Voided';
                statusClass = 'status-badge status-voided';
            }

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
                    <td><span class="${statusClass}">${statusLabel}</span></td>
                    <td>${data.answers?.exp || '-'} / 5</td>
                    <td style="font-size: 0.8rem; color: #666;">${date}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html || '<tr><td colspan="9">No responses found yet.</td></tr>';

        // Update Total Count UI (Moved to end for accuracy)
        const totalCountSpan = document.getElementById('total-count');
        if (totalCountSpan) totalCountSpan.innerText = `Total Orders: ${dataArray.length}`;

    } catch (error) {
        console.error("Error loading responses:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="color: red;">Error: ${error.message}. <br>Make sure you have permission to view this data.</td></tr>`;
    }
}
