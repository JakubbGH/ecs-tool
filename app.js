let database = [];
let loadedBuildings = new Set(); // Tracks buildings already in the table

// ... (keep your loadData function the same) ...

function loadBuildingToTable() {
    const bSelect = document.getElementById("buildingSelect");
    const bValue = bSelect.value;
    
    // 1. Check if building is already loaded
    if (loadedBuildings.has(bValue)) {
        alert(`Building ${bValue} is already in the table.`);
        return;
    }

    const match = database.find(d => d.building === bValue);
    const tbody = document.querySelector("#ecsTable tbody");

    if (!match || !match.ecs_list) {
        alert("No ECS data found for this building.");
        return;
    }

    // 2. Loop through and add rows
    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        // Add a class to the row so we can identify which building it belongs to
        row.classList.add(`bldg-${bValue}`); 
        
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
                <button class="del-btn" onclick="removeRow(this, '${bValue}')">DEL</button>
            </td>
        `;
    });

    // 3. Add to the tracking set
    loadedBuildings.add(bValue);
    console.log("Current loaded buildings:", Array.from(loadedBuildings));
}

// Custom remove function to handle the "tracking" logic
function removeRow(btn, bldgName) {
    const row = btn.parentElement.parentElement;
    row.remove();

    // Check if any rows for this building still exist
    const remainingRows = document.querySelectorAll(`.bldg-${bldgName}`);
    if (remainingRows.length === 0) {
        // If all rows for B101 are gone, allow it to be loaded again
        loadedBuildings.delete(bldgName);
    }
}
