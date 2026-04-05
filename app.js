// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDBkF2EJxgk4buiqUak-ZCLfKcPzpX7gsw",
    authDomain: "ecs-tool.firebaseapp.com",
    projectId: "ecs-tool",
    storageBucket: "ecs-tool.firebasestorage.app",
    messagingSenderId: "796028644982",
    appId: "1:796028644982:web:d6953c3ce305734d7a3957"
};

const ADMIN_EMAIL = "admin@ecs-tool.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let database = [];

// --- 2. LOGIN & AUTH CHECK ---
async function handleLogin() {
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    const errorMsg = document.getElementById("loginError");

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        // Safety Feature: Show Admin Section ONLY for your email
        if (user.email === ADMIN_EMAIL) {
            document.getElementById("adminSection").style.display = "block";
        }

        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        loadDataFromCloud();
    } catch (error) {
        errorMsg.style.display = "block";
        errorMsg.innerText = error.message;
    }
}

// --- 3. FETCH BUILDINGS ---
async function loadDataFromCloud() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";
    try {
        const snapshot = await db.collection("buildings").get();
        database = [];
        snapshot.forEach(doc => {
            database.push({ building: doc.id, ecs_list: doc.data().ecs_list || [] });
        });
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building));
        database.forEach(item => bSelect.add(new Option(item.building, item.building)));
        statusLabel.innerText = "Cloud Active: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
    } catch (error) {
        statusLabel.innerText = "SYNC ERROR";
        console.error(error);
    }
}

// --- 4. TABLE LOGIC ---
function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    const tbody = document.querySelector("#ecsTable tbody");
    const match = database.find(d => d.building === bValue);
    if (!match) return;

    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${bValue}</td><td>${ecs}</td>
            <td><select><option>1HAND_POS</option><option>2PREP_ALMT</option><option>3WELDING</option><option>4PUNCH</option></select></td>
            <td><button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button></td>
        `;
    });
}

// --- 5. SAVE REPORT ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    if (rows.length === 0) return alert("Table is empty");
    const btn = document.querySelector(".export-btn");
    const reportData = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "UPLOADING...";
        const reportID = `${reportData[0].building}_${Date.now()}`;
        await db.collection("reports").doc(reportID).set({
            data: reportData,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Saved to Cloud!");
        btn.disabled = false;
        btn.innerText = "UPLOAD TO CLOUD";
    } catch (e) { alert(e.message); btn.disabled = false; }
}

// --- 6. ADMIN CSV UPLOAD ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) document.getElementById('uploadCsvBtn').style.display = 'block';
});

async function processCSV() {
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const rows = e.target.result.split('\n').filter(r => r.trim() !== '');
        const batch = db.batch();
        // Skip header, loop rows
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length < 2) continue;
            const bName = cols[0].trim();
            const codes = cols[1].replace(/"/g, '').split(';').map(s => s.trim());
            batch.set(db.collection("buildings").doc(bName), { ecs_list: codes });
        }
        await batch.commit();
        alert("Database Updated!");
        location.reload();
    };
    reader.readAsText(file);
}
