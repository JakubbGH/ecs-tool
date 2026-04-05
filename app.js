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

// FORCES PERSISTENT LOGIN
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// --- 2. AUTH LISTENER (Prevents random logouts) ---
auth.onAuthStateChanged((user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const mainApp = document.getElementById("mainApp");
    const adminSection = document.getElementById("adminSection");

    if (user) {
        loginOverlay.style.display = "none";
        mainApp.style.display = "block";
        if (user.email === ADMIN_EMAIL) adminSection.style.display = "block";
        loadDataFromCloud();
    } else {
        loginOverlay.style.display = "flex";
        mainApp.style.display = "none";
    }
});

async function handleLogin() {
    const email = document.getElementById("emailInput").value.trim();
    const pass = document.getElementById("passInput").value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        const err = document.getElementById("loginError");
        err.style.display = "block";
        err.innerText = e.message;
    }
}

// --- 3. DATA CORE ---
async function loadDataFromCloud() {
    const status = document.getElementById("syncStatus");
    status.innerText = "Syncing...";
    try {
        const snap = await db.collection("buildings").get();
        database = snap.docs.map(doc => ({ building: doc.id, ecs_list: doc.data().ecs_list || [] }));
        
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building))
                .forEach(item => bSelect.add(new Option(item.building, item.building)));
        
        status.innerText = "Cloud Active";
        status.style.background = "#d4edda";
    } catch (e) { status.innerText = "Offline"; }
}

function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    const tbody = document.querySelector("#ecsTable tbody");
    if (!bValue || bValue === "Loading...") return;

    const existing = Array.from(tbody.rows).some(row => row.cells[0].innerText === bValue);
    if (existing) return alert(`Building ${bValue} is already loaded.`);

    const match = database.find(d => d.building === bValue);
    if (match) {
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
}

// --- 4. CLOUD SYNC ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.getElementById("mainSaveBtn");
    if (rows.length === 0) return alert("Table is empty.");

    const reportData = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "⏳ SAVING...";
        const reportID = `${reportData[0].building}_${Date.now()}`;
        await db.collection("reports").doc(reportID).set({
            data: reportData,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ Success!");
        document.querySelector("#ecsTable tbody").innerHTML = "";
    } catch (e) { alert("Error: " + e.message); }
    btn.disabled = false;
    btn.innerText = "UPLOAD TO CLOUD";
}

// --- 5. ADMIN TOOLS (NO RELOADS) ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) document.getElementById('uploadCsvBtn').style.display = 'block';
});

async function processCSV() {
    const btn = document.getElementById('uploadCsvBtn');
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = e.target.result.split('\n').filter(r => r.trim() !== '');
            const batch = db.batch();
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if (cols.length < 2) continue;
                const codes = cols[1].replace(/"/g, '').split(';').map(s => s.trim());
                batch.set(db.collection("buildings").doc(cols[0].trim()), { ecs_list: codes });
            }
            await batch.commit();
            alert("✅ Database Updated!");
            loadDataFromCloud(); // Live UI refresh
            btn.style.display = 'none';
        } catch (err) { alert(err.message); }
    };
    reader.readAsText(file);
}

async function exportAllReports() {
    try {
        const snap = await db.collection("reports").get();
        
        if (snap.empty) {
            return alert("No reports found in the cloud.");
        }

        let csv = "Building,ECS Code,Status,Tech User,Timestamp\n";
        
        snap.forEach(doc => {
            const report = doc.data();
            const time = report.timestamp ? report.timestamp.toDate().toLocaleString() : "N/A";
            const user = report.user || "Unknown User";

            // SAFETY CHECK: Only loop if 'data' exists and is an array
            if (report.data && Array.isArray(report.data)) {
                report.data.forEach(item => {
                    // Use quotes to prevent commas in names from breaking the CSV
                    csv += `"${item.building || "N/A"}","${item.ecs_code || "N/A"}","${item.status || "N/A"}","${user}","${time}"\n`;
                });
            } else {
                console.warn(`Skipping report ${doc.id}: 'data' field is missing or invalid.`);
            }
        });

        // Create the download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Master_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert("✅ Export successful! Check your downloads folder.");

    } catch (e) { 
        console.error("Full Export Error:", e);
        alert("❌ Export failed: " + e.message); 
    }
}

async function wipeAllBuildings() {
    if (!confirm("Wipe all buildings?")) return;
    try {
        const snap = await db.collection("buildings").get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("Wiped.");
        database = [];
        document.getElementById("buildingSelect").innerHTML = "<option>Empty</option>";
    } catch (e) { alert(e.message); }
}
