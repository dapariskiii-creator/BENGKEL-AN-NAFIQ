// ========================================
// MEKANIK.JS - AN-NAFIQ BENGKEL
// ========================================

const API_URL = "api/mechanics";

let mechanics = [];
let currentMode = "add";

// ========================================
// ELEMENT
// ========================================

const mechanicModal = document.getElementById("mechanicModal");
const mechanicForm = document.getElementById("mechanicForm");

const mechanicId = document.getElementById("mechanicId");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const specializationInput = document.getElementById("specialization");
const statusInput = document.getElementById("status");
const addressInput = document.getElementById("address");
const notesInput = document.getElementById("notes");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const mechanicsTableBody = document.getElementById("mechanicsTableBody");

const totalMechanics = document.getElementById("totalMechanics");
const activeMechanics = document.getElementById("activeMechanics");
const inactiveMechanics = document.getElementById("inactiveMechanics");


// ========================================
// LOAD DATA
// ========================================

async function loadMechanics() {
    try {
        mechanicsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Memuat data mekanik...
                </td>
            </tr>
        `;

        const response = await fetch(API_URL);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Gagal mengambil data");
        }

        mechanics = Array.isArray(data) ? data : [];

        renderMechanics();
        updateStats();

    } catch (error) {
        console.error("LOAD MECHANICS ERROR:", error);

        mechanicsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ❌ Gagal mengambil data mekanik
                </td>
            </tr>
        `;
    }
}


// ========================================
// RENDER TABLE
// ========================================

function renderMechanics() {

    const keyword = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const selectedStatus = statusFilter
        ? statusFilter.value
        : "ALL";

    const filtered = mechanics.filter(mechanic => {

        const name = (mechanic.name || "").toLowerCase();
        const phone = (mechanic.phone || "").toLowerCase();
        const specialization = (mechanic.specialization || "").toLowerCase();

        const matchesSearch =
            name.includes(keyword) ||
            phone.includes(keyword) ||
            specialization.includes(keyword);

        const matchesStatus =
            selectedStatus === "ALL" ||
            mechanic.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        mechanicsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Belum ada data mekanik
                </td>
            </tr>
        `;
        return;
    }

    mechanicsTableBody.innerHTML = filtered.map((mechanic, index) => {

        const status = mechanic.status || "ACTIVE";

        const statusClass =
            status === "ACTIVE"
                ? "status-active"
                : "status-inactive";

        const statusText =
            status === "ACTIVE"
                ? "AKTIF"
                : "NONAKTIF";

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>${escapeHtml(mechanic.name)}</strong>
                </td>

                <td>
                    ${escapeHtml(mechanic.phone || "-")}
                </td>

                <td>
                    ${escapeHtml(mechanic.specialization || "-")}
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            class="btn-action btn-detail"
                            onclick="viewMechanic('${mechanic.id}')"
                            title="Detail">
                            👁️
                        </button>

                        <button
                            class="btn-action btn-edit"
                            onclick="editMechanic('${mechanic.id}')"
                            title="Edit">
                            ✏️
                        </button>

                        <button
                            class="btn-action btn-delete"
                            onclick="deleteMechanic('${mechanic.id}')"
                            title="Hapus">
                            🗑️
                        </button>

                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


// ========================================
// UPDATE STATISTICS
// ========================================

function updateStats() {

    const total = mechanics.length;

    const active = mechanics.filter(
        mechanic => mechanic.status === "ACTIVE"
    ).length;

    const inactive = mechanics.filter(
        mechanic => mechanic.status === "INACTIVE"
    ).length;

    if (totalMechanics) {
        totalMechanics.textContent = total;
    }

    if (activeMechanics) {
        activeMechanics.textContent = active;
    }

    if (inactiveMechanics) {
        inactiveMechanics.textContent = inactive;
    }
}


// ========================================
// OPEN ADD MODAL
// ========================================

function openAddMechanic() {

    currentMode = "add";

    mechanicForm.reset();

    mechanicId.value = "";

    statusInput.value = "ACTIVE";

    setFormDisabled(false);

    const modalTitle = document.getElementById("modalTitle");

    if (modalTitle) {
        modalTitle.textContent = "Tambah Mekanik";
    }

    const submitButton = mechanicForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.style.display = "inline-flex";
        submitButton.textContent = "Simpan Mekanik";
    }

    mechanicModal.classList.add("show");

    nameInput.focus();
}


// ========================================
// OPEN EDIT MODAL
// ========================================

function editMechanic(id) {

    const mechanic = mechanics.find(
        item => String(item.id) === String(id)
    );

    if (!mechanic) {
        alert("Data mekanik tidak ditemukan.");
        return;
    }

    currentMode = "edit";

    fillForm(mechanic);

    setFormDisabled(false);

    const modalTitle = document.getElementById("modalTitle");

    if (modalTitle) {
        modalTitle.textContent = "Edit Mekanik";
    }

    const submitButton = mechanicForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.style.display = "inline-flex";
        submitButton.textContent = "Simpan Perubahan";
    }

    mechanicModal.classList.add("show");
}


// ========================================
// DETAIL MEKANIK
// ========================================

function viewMechanic(id) {

    const mechanic = mechanics.find(
        item => String(item.id) === String(id)
    );

    if (!mechanic) {
        alert("Data mekanik tidak ditemukan.");
        return;
    }

    currentMode = "detail";

    fillForm(mechanic);

    setFormDisabled(true);

    const modalTitle = document.getElementById("modalTitle");

    if (modalTitle) {
        modalTitle.textContent = "Detail Mekanik";
    }

    const submitButton = mechanicForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.style.display = "none";
    }

    mechanicModal.classList.add("show");
}


// ========================================
// FILL FORM
// ========================================

function fillForm(mechanic) {

    mechanicId.value = mechanic.id || "";

    nameInput.value = mechanic.name || "";

    phoneInput.value = mechanic.phone || "";

    specializationInput.value =
        mechanic.specialization || "";

    statusInput.value =
        mechanic.status || "ACTIVE";

    addressInput.value =
        mechanic.address || "";

    notesInput.value =
        mechanic.notes || "";
}


// ========================================
// ENABLE / DISABLE FORM
// ========================================

function setFormDisabled(disabled) {

    const inputs = mechanicForm.querySelectorAll(
        "input, select, textarea"
    );

    inputs.forEach(input => {

        if (input.id === "mechanicId") {
            return;
        }

        input.disabled = disabled;
    });
}


// ========================================
// CLOSE MODAL
// ========================================

function closeMechanicModal() {

    mechanicModal.classList.remove("show");

    setFormDisabled(false);

    currentMode = "add";
}


// ========================================
// SUBMIT FORM
// ========================================

mechanicForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (currentMode === "detail") {
        return;
    }

    const name = nameInput.value.trim();

    if (!name) {
        alert("Nama mekanik wajib diisi.");
        nameInput.focus();
        return;
    }

    const payload = {
        name: name,
        phone: phoneInput.value.trim(),
        specialization: specializationInput.value.trim(),
        status: statusInput.value,
        address: addressInput.value.trim(),
        notes: notesInput.value.trim()
    };

    try {

        let response;

        if (currentMode === "edit") {

            response = await fetch(
                `${API_URL}/${encodeURIComponent(mechanicId.value)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

        } else {

            response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Gagal menyimpan mekanik"
            );
        }

        alert(
            currentMode === "edit"
                ? "Mekanik berhasil diperbarui."
                : "Mekanik berhasil ditambahkan."
        );

        closeMechanicModal();

        await loadMechanics();

    } catch (error) {

        console.error("SAVE MECHANIC ERROR:", error);

        alert(
            "❌ Gagal menyimpan mekanik:\n" +
            error.message
        );
    }
});


// ========================================
// DELETE MEKANIK
// ========================================

async function deleteMechanic(id) {

    const mechanic = mechanics.find(
        item => String(item.id) === String(id)
    );

    if (!mechanic) {
        alert("Data mekanik tidak ditemukan.");
        return;
    }

    const yakin = confirm(
        `Yakin ingin menghapus mekanik "${mechanic.name}"?`
    );

    if (!yakin) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Gagal menghapus mekanik"
            );
        }

        alert("Mekanik berhasil dihapus.");

        await loadMechanics();

    } catch (error) {

        console.error("DELETE MECHANIC ERROR:", error);

        alert(
            "❌ Gagal menghapus mekanik:\n" +
            error.message
        );
    }
}


// ========================================
// SEARCH
// ========================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderMechanics
    );
}


// ========================================
// FILTER STATUS
// ========================================

if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderMechanics
    );
}


// ========================================
// BUTTON TAMBAH
// ========================================

const addMechanicBtn =
    document.getElementById("addMechanicBtn");

if (addMechanicBtn) {

    addMechanicBtn.addEventListener(
        "click",
        openAddMechanic
    );
}


// ========================================
// BUTTON TUTUP / BATAL
// ========================================

const closeModalBtn =
    document.getElementById("closeModal");

if (closeModalBtn) {

    closeModalBtn.addEventListener(
        "click",
        closeMechanicModal
    );
}

const cancelBtn =
    document.getElementById("cancelBtn");

if (cancelBtn) {

    cancelBtn.addEventListener(
        "click",
        closeMechanicModal
    );
}


// ========================================
// KLIK LUAR MODAL
// ========================================

if (mechanicModal) {

    mechanicModal.addEventListener(
        "click",
        function (event) {

            if (event.target === mechanicModal) {
                closeMechanicModal();
            }

        }
    );
}


// ========================================
// ESC UNTUK TUTUP MODAL
// ========================================

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            mechanicModal.classList.contains("show")
        ) {
            closeMechanicModal();
        }

    }
);


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ========================================
// LOAD SAAT HALAMAN DIBUKA
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {
        loadMechanics();
    }
);