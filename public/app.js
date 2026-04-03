/**
 * SVNTEX Q&A Reward System - Front-end Logic
 */

// Replace this with your actual Firebase config from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCgFGUfCXvYc17Z7vIYI37TZrdZ4zFfY84",
    authDomain: "master-49709.firebaseapp.com",
    projectId: "master-49709",
    storageBucket: "master-49709.firebasestorage.app",
    messagingSenderId: "930783829312",
    appId: "1:930783829312:web:30118d333ecc807bc92ea5",
    measurementId: "G-082P5V0F6Y"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.db = firebase.firestore();
window.analytics = (typeof firebase.analytics === 'function') ? firebase.analytics() : null;

// Questions Data (Could be fetched from Firestore 'questions' collection)
const QUESTIONS = [
    { id: "exp", text: "How would you rate your overall shopping experience?", type: "rating" },
    { id: "ref", text: "How did you discover SVNTEX?", type: "mcq", options: ["Social Media", "Friend/Family", "Advertisement", "Search Engine", "Other"] },
    { id: "prod", text: "Which product are you most looking forward to using?", type: "text" },
    { id: "rec", text: "Would you recommend us to others?", type: "binary" }
];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const email = urlParams.get('email') || '';

    const qaContainer = document.getElementById('qa-form');
    const loader = document.getElementById('loader');

    if (!orderId) {
        loader.innerHTML = "<span style='color: red;'>Error: Invalid Reward Link. Please check your order reference.</span>";
        return;
    }

    // Prepare Document ID (Now using just the unique Shopify Order ID)
    const docId = orderId.trim();
    const docRef = db.collection('responses').doc(docId);

    // Load Questions or Show Duplicate Message
    try {
        const doc = await docRef.get();
        if (doc.exists && doc.data().answers) {
            const prevData = doc.data();
            const submitTime = prevData.timestamp ? prevData.timestamp.toDate().toLocaleString() : 'Recently';
            const svnId = prevData.order_name || 'Your Order';

            loader.style.display = 'none';
            qaContainer.innerHTML = `
                <div style="text-align:center; padding: 40px; background: rgba(255,255,255,0.1); border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
                    <h2 style="color: #fff;">🎁 Reward Already Claimed!</h2>
                    <p style="color: #fff; margin-bottom: 20px;">You completed this Q&A on: <br><strong>${submitTime}</strong></p>
                    <p style="color: #fff; opacity:0.8; font-size: 0.9rem;">Order: ${svnId}</p>
                    <div style="margin-top: 20px; font-size: 0.8rem; color: #aaa;">Reference ID: ${docId}</div>
                    <button onclick="window.location.reload()" class="option-btn" style="width: auto; margin-top: 20px; padding: 10px 20px;">Check Again</button>
                </div>
            `;
            qaContainer.style.display = 'block';
            return;
        }
    } catch (e) {
        console.error("Duplicate check failed:", e);
    }

    loader.style.display = 'none';
    qaContainer.style.display = 'block';

    renderQuestions(qaContainer);
});

function renderQuestions(container) {
    let html = '';
    QUESTIONS.forEach(q => {
        html += `<div class="qa-item">
            <label>${q.text}</label>`;
        if (q.type === 'rating') {
            html += `<div class="options-grid">
                ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="option-btn" data-id="${q.id}" data-val="${n}">${n}</button>`).join('')}
            </div>`;
        } else if (q.type === 'mcq') {
            html += `<select class="qa-input" data-id="${q.id}">
                <option value="">Select an option</option>
                ${q.options.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>`;
        } else if (q.type === 'text') {
            html += `<input type="text" class="qa-input" data-id="${q.id}" placeholder="Type your answer...">`;
        } else if (q.type === 'binary') {
            html += `<div class="options-grid" style="grid-template-columns: 1fr 1fr;">
                <button type="button" class="option-btn" data-id="${q.id}" data-val="Yes">Yes</button>
                <button type="button" class="option-btn" data-id="${q.id}" data-val="No">No</button>
            </div>`;
        }
        html += `</div>`;
    });
    html += `<button id="submit-btn" class="submit-btn">Claim My Reward</button>`;
    container.innerHTML = html;

    // Handle Option Clicks
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            document.querySelectorAll(`.option-btn[data-id="${id}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
    });

    // Handle Submit
    document.getElementById('submit-btn').onclick = submitForm;
}

async function submitForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const email = urlParams.get('email');
    const phone = urlParams.get('phone') || '';
    const amount = urlParams.get('amount') || '';
    
    const answers = {};
    let allAnswered = true;

    QUESTIONS.forEach(q => {
        if (q.type === 'rating' || q.type === 'binary') {
            const selected = document.querySelector(`.option-btn[data-id="${q.id}"].selected`);
            if (selected) answers[q.id] = selected.getAttribute('data-val');
            else allAnswered = false;
        } else {
            const val = document.querySelector(`.qa-input[data-id="${q.id}"]`).value;
            if (val) answers[q.id] = val;
            else allAnswered = false;
        }
    });

    if (!allAnswered) {
        alert("Please answer all questions to claim your reward.");
        return;
    }

    try {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerText = "Saving...";

        const cleanOrderId = orderId.trim();
        
        // Prepare the update object
        const updateData = {
            order_id: cleanOrderId,
            answers: answers,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            last_updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        // ONLY add email, phone, and amount if they are not empty.
        // This prevents overwriting the valid data from the Shopify Webhook!
        const cleanEmail = (email || '').toLowerCase().trim();
        if (cleanEmail) updateData.email = cleanEmail;
        if (phone && phone.trim() !== '') updateData.phone = phone.trim();
        if (amount && amount.trim() !== '') updateData.amount = amount.trim();

        // Save to Firestore using order_id as the unique key.
        await db.collection('responses').doc(cleanOrderId).set(updateData, { merge: true });

        // Show Success
        document.getElementById('qa-form').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
    } catch (error) {
        console.error("Error saving response:", error);
        alert("Error: " + error.message); // Show the real error to the user
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('submit-btn').innerText = "Claim My Reward";
    }
}
