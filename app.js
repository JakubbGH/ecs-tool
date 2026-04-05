// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDBkF2EJxgk4buiqUak-ZCLfKcPzpX7gsw",
    authDomain: "ecs-tool.firebaseapp.com",
    projectId: "ecs-tool",
    storageBucket: "ecs-tool.firebasestorage.app",
    messagingSenderId: "796028644982",
    appId: "1:796028644982:web:d6953c3ce305734d7a3957"
};

const ADMIN_EMAIL = "admin@ecs-tool.com"; // Update this to your email

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let database = [];

// --- 2. AUTHENTICATION ---
async function handleLogin() {
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    const errorMsg = document.getElementById("loginError");

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        // Show Admin controls if email matches
        if (user.email === ADMIN_EMAIL) {
            document.getElementById("adminSection").style.display = "block";
        }

        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        loadDataFromCloud();
    } catch (error) {
        errorMsg.style.display = "block";
        errorMsg.innerText = "Login Error: " + error.message;
    }
}

// --- 3. FETCH BUILDINGS (Lower-case collection) ---
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
        bSelect.innerHTML = database.length ? "" : "<option>No buildings found</option>";
        
        database.sort((a, b) => a.building.localeCompare(b.building));
        database.forEach(item => {
            bSelect.add(new Option(item.building, item.building));
        });

        statusLabel.innerText = "Cloud Active";
        statusLabel.style.background = "#d4edda";
        statusLabel.style.color = "#155724";
    } catch (error) {
        statusLabel.innerText = "Connection Error";
        statusLabel.style.background = "#f8d7da";
        statusLabel.style.color = "#721c24";
    }
}

// --- 4. TABLE LOGIC ---
function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    if (!bValue) return;

    const tbody = document.querySelector("#ecsTable tbody");
    
    // Prevent duplicate buildings in the table
    const existing = Array.from(tbody.rows).some(row => row.cells[0].innerText === bValue);
    if (existing) return alert(`Building ${bValue} is already in the list.`);

    const match = database.find(d => d.building === bValue);
    if (!match) return;

    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight:bold">${bValue}</td>
            <td>${ecs}</td>
            <td>
                <select style="width:100%; padding:5px;">
                    <option>1HAND_POS</option>
                    <option>2PREP_ALMT</option>
                    <option>3WELDING</option>
                    <option>4PUNCH</option>
                </select>
            </td>
            <td><button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button></td>
        `;
    });
}

// --- 5. UPLOAD REPORT (Success/Failure Popups) ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.getElementById("mainSaveBtn");

    if (rows.length === 0) return alert("❌ Table is empty. Load a building first.");

    const reportEntries = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "⏳ UPLOADING...";
        btn.style.background = "#ffc107";

        const reportID = `${reportEntries[0].building}_${Date.now()}`;
        await db.collection("reports").doc(reportID).set({
            data: reportEntries,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        btn.style.background = "#28a745";
        btn.innerText = "✅ UPLOAD SUCCESS";
        alert(`🎉 Success! Report for ${reportEntries[0].building} saved.`);
        
        setTimeout(() => {
            document.querySelector("#ecsTable tbody").innerHTML = "";
            btn.disabled = false;
            btn.innerText = "UPLOAD TO CLOUD";
            btn.style.background = "#007bff";
        }, 2000);

    } catch (error) {
        btn.disabled = false;
        btn.innerText = "❌ FAILED - TRY AGAIN";
        btn.style.background = "#dc3545";
        alert("⚠️ Cloud Save Error: " + error.message);
    }
}

// --- 6. ADMIN: PROCESS CSV ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        document.getElementById('uploadCsvBtn').style.display = 'block';
    }
});

async function processCSV() {
    const btn = document.getElementById('uploadCsvBtn');
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            btn.disabled = true;
            btn.innerText = "⏳ PROCESSING...";
            
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
            alert("✅ Database Synchronized Successfully!");
            location.reload();
        } catch (error) {
            alert("❌ CSV Error: " + error.message);
            btn.disabled = false;
            btn.innerText = "RETRY PUSH";
        }
    };
    reader.readAsText(file);
}
