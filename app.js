// --- 1. CONFIG ---
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

// --- 2. AUTH ---
async function handleLogin() {
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    const errorMsg = document.getElementById("loginError");

    try {
        const userCred = await auth.signInWithEmailAndPassword(email, pass);
        if (userCred.user.email === ADMIN_EMAIL) {
            document.getElementById("adminSection").style.display = "block";
        }
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        loadDataFromCloud();
    } catch (e) {
        errorMsg.style.display = "block";
        errorMsg.innerText = e.message;
    }
}

// --- 3. FETCH DATA ---
async function loadDataFromCloud() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";
    try {
        const snap = await db.collection("buildings").get();
        database = snap.docs.map(doc => ({ building: doc.id, ecs_list: doc.data().ecs_list || [] }));
        
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building))
                .forEach(item => bSelect.add(new Option(item.building, item.building)));
        
        statusLabel.innerText = "Cloud Active";
        statusLabel.style.background = "#d4edda";
    } catch (e) {
        statusLabel.innerText = "Error";
        statusLabel.style.background = "#f8d7da";
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
            <td style="font-weight:bold">${bValue}</td>
            <td>${ecs}</td>
            <td><select style="width:100%;"><option>1HAND_POS</option><option>2PREP_ALMT</option><option>3WELDING</option><option>4PUNCH</option></select></td>
            <td><button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button></td>
        `;
    });
}

// --- 5. SAVE REPORT (Popups included) ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.getElementById("mainSaveBtn");
    if (rows.length === 0) return alert("❌ Table is empty.");

    const reportData = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "⏳ SAVING...";
        btn.style.background = "#ffc107";

        const reportID = `${reportData[0].building}_${Date.now()}`;
        await db.collection("reports").doc(reportID).set({
            data: reportData,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ SUCCESS!\nData saved to cloud.");
        btn.style.background = "#28a745";
        btn.innerText = "✅ UPLOADED";
        
        setTimeout(() => {
            document.querySelector("#ecsTable tbody").innerHTML = "";
            btn.disabled = false;
            btn.innerText = "UPLOAD TO CLOUD";
            btn.style.background = "#007bff";
        }, 1500);
    } catch (e) {
        alert("⚠️ FAILED: " + e.message);
        btn.disabled = false;
        btn.innerText = "RETRY UPLOAD";
        btn.style.background = "#dc3545";
    }
}

// --- 6. ADMIN: CSV IMPORT ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) document.getElementById('uploadCsvBtn').style.display = 'block';
});

async function processCSV() {
    const btn = document.getElementById('uploadCsvBtn');
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            btn.innerText = "PROCESSING...";
            const rows = e.target.result.split('\n').filter(r => r.trim() !== '');
            const batch = db.batch();
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if (cols.length < 2) continue;
                const bName = cols[0].trim();
                const codes = cols[1].replace(/"/g, '').split(';').map(s => s.trim());
                batch.set(db.collection("buildings").doc(bName), { ecs_list: codes });
            }
            await batch.commit();
            alert("✅ Database Updated!");
            location.reload();
        } catch (err) { alert("❌ Error: " + err.message); }
    };
    reader.readAsText(file);
}

// --- 7. ADMIN: EXPORT ALL ---
async function exportAllReports() {
    try {
        const snap = await db.collection("reports").get();
        if (snap.empty) return alert("No reports found.");
        
        let csv = "Building,ECS,Status,User,Time\n";
        snap.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? r.timestamp.toDate().toLocaleString() : "";
            r.data.forEach(i => {
                csv += `"${i.building}","${i.ecs_code}","${i.status}","${r.user}","${time}"\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Master_Export.csv";
        link.click();
    } catch (e) { alert(e.message); }
}

// --- 8. ADMIN: WIPE ---
async function wipeAllBuildings() {
    if (!confirm("⚠️ DELETE ALL BUILDINGS?")) return;
    try {
        const snap = await db.collection("buildings").get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("Wiped.");
        location.reload();
    } catch (e) { alert(e.message); }
}
