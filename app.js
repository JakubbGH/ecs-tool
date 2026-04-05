// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDBkF2EJxgk4buiqUak-ZCLfKcPzpX7gsw",
    authDomain: "ecs-tool.firebaseapp.com",
    projectId: "ecs-tool",
    storageBucket: "ecs-tool.firebasestorage.app",
    messagingSenderId: "796028644982",
    appId: "1:796028644982:web:d6953c3ce305734d7a3957"
};

// Initialize Firebase Services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let database = []; // Local cache of the building list

// --- 2. LOGIN LOGIC ---
async function handleLogin() {
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    const errorMsg = document.getElementById("loginError");

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        
        // UI Switch
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        
        // Fetch building data from Cloud
        loadDataFromCloud();
    } catch (error) {
        errorMsg.style.display = "block";
        errorMsg.innerText = "Login Failed: " + error.message;
    }
}

// --- 3. FETCH BUILDINGS (From Firestore) ---
async function loadDataFromCloud() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";
    
    try {
        // CHANGED TO LOWERCASE: "buildings"
        const snapshot = await db.collection("buildings").get();
        
        if (snapshot.empty) {
            console.warn("No documents found in 'buildings' collection. Check your Firestore naming.");
            statusLabel.innerText = "DATABASE EMPTY";
            return;
        }

        database = [];
        snapshot.forEach(doc => {
            console.log("Fetched Building:", doc.id); // Check console to see if IDs appear
            database.push({
                building: doc.id,
                ecs_list: doc.data().ecs_list || []
            });
        });

        // Populate Dropdown
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building));
        
        database.forEach(item => {
            bSelect.add(new Option(item.building, item.building));
        });

        statusLabel.innerText = "Cloud Active: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
    } catch (error) {
        statusLabel.innerText = "SYNC ERROR";
        statusLabel.style.color = "red";
        console.error("Firestore Read Error:", error);
    }
}

// --- 4. TABLE LOGIC (Load Building) ---
function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value.trim();
    const tbody = document.querySelector("#ecsTable tbody");
    const existingRows = tbody.getElementsByTagName("tr");

    for (let i = 0; i < existingRows.length; i++) {
        if (existingRows[i].cells[0].innerText.trim() === bValue) {
            alert(`STOP: ${bValue} is already loaded.`);
            return;
        }
    }

    const match = database.find(d => d.building === bValue);
    if (!match) {
        alert("Building data not found in local cache.");
        return;
    }

    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight:bold;">${bValue}</td>
            <td>${ecs}</td>
            <td>
                <select style="width:100%; padding:8px;">
                    <option>1HAND_POS</option>
                    <option>2PREP_ALMT</option>
                    <option>3WELDING</option>
                    <option>4PUNCH</option>
                </select>
            </td>
            <td>
                <button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button>
            </td>
        `;
    });
}

// --- 5. SAVE TO CLOUD (Upload Report) ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.querySelector(".export-btn");

    if (rows.length === 0) {
        alert("Table is empty. Add a building first.");
        return;
    }

    const reportEntries = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.innerText = "UPLOADING...";
        btn.disabled = true;

        const firstBldg = reportEntries[0].building;
        const reportID = `${firstBldg}_${Date.now()}`;

        // CHANGED TO LOWERCASE: "reports"
        await db.collection("reports").doc(reportID).set({
            data: reportEntries,
            submittedBy: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Upload Successful!");
        btn.innerText = "UPLOAD TO CLOUD";
        btn.disabled = false;
        
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Cloud Save Failed: " + error.message);
        btn.innerText = "UPLOAD TO CLOUD";
        btn.disabled = false;
    }
}
