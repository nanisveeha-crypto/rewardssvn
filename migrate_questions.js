const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const DEFAULT_QUESTIONS = [
    { id: "exp", text: "How would you rate your overall shopping experience?", type: "rating", order: 1 },
    { id: "ref", text: "How did you discover SVNTEX?", type: "mcq", options: ["Social Media", "Friend/Family", "Advertisement", "Search Engine", "Other"], order: 2 },
    { id: "prod", text: "Which product are you most looking forward to using?", type: "text", order: 3 },
    { id: "rec", text: "Would you recommend us to others?", type: "binary", order: 4 }
];

async function migrateDefaultQuestions() {
  const questCol = db.collection('questions');
  
  for (const q of DEFAULT_QUESTIONS) {
    await questCol.doc(q.id).set(q);
    console.log(`Migrated question: ${q.id}`);
  }
}

migrateDefaultQuestions().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
