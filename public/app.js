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
    const email = urlParams.get('email');

    const qaContainer = document.getElementById('qa-form');
    const loader = document.getElementById('loader');

    if (!orderId || !email) {
        loader.innerHTML = "<span style='color: red;'>Error: Invalid Reward Link. Please check your order confirmation.</span>";
        return;
    }

    // Load Questions
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
    const orderName = urlParams.get('order_name') || '';
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

        // Save to Firestore with merge: true to avoid losing Webhook data (Phone/Amount)
        await db.collection('responses').doc(`${orderId}_${email.replace(/@/g, '_')}`).set({
            order_id: orderId,
            order_name: orderName,
            email: email,
            phone: phone,
            amount: amount,
            answers: answers,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Show Success
        document.getElementById('qa-form').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
    } catch (error) {
        console.error("Error saving response:", error);
        alert("Something went wrong. Please try again.");
        document.getElementById('submit-btn').disabled = false;
    }
}
