let customers = [];
let filteredCustomers = [];
let editingCustomerId = null;
let deletingCustomerId = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
checkLogin();
loadCustomers();


$("searchInput").addEventListener("input", searchCustomers);
$("addCustomerButton").addEventListener("click", addCustomer);
$("closeModal").addEventListener("click", closeModal);
$("cancelButton").addEventListener("click", closeModal);
$("customerForm").addEventListener("submit", saveCustomer);

$("cancelDelete").addEventListener("click", closeDeleteModal);
$("confirmDelete").addEventListener("click", deleteCustomer);

$("logoutButton").addEventListener("click", logout);

$("customerModal").addEventListener("click", event => {
    if (event.target === $("customerModal")) {
        closeModal();
    }
});

$("deleteModal").addEventListener("click", event => {
    if (event.target === $("deleteModal")) {
        closeDeleteModal();
    }
});


});

async function checkLogin() {
try {
const response = await fetch("api/me");


    if (!response.ok) {
        location.href = "index.html";
        return;
    }

    const data = await response.json();

    if (!data.user) {
        location.href = "index.html";
        return;
    }

    $("userName").textContent = data.user.username || "User";
    $("userRole").textContent = data.user.role || "OWNER";
} catch (error) {
    console.error(error);
}


}

async function loadCustomers() {
$("customerTableBody").innerHTML = `         <tr>             <td colspan="6">Memuat data pelanggan...</td>         </tr>
    `;


try {
    const response = await fetch("api/customers");

    if (!response.ok) {
        throw new Error("Gagal mengambil data pelanggan.");
    }

    const data = await response.json();

    customers = Array.isArray(data)
        ? data
        : data.customers || data.data || [];

    filteredCustomers = [...customers];

    updateStats();
    renderCustomers();
} catch (error) {
    console.error(error);

    $("customerTableBody").innerHTML = `
        <tr>
            <td colspan="6">
                Gagal memuat data pelanggan.
                <button type="button" onclick="loadCustomers()">
                    Coba Lagi
                </button>
            </td>
        </tr>
    `;
}


}

function renderCustomers() {
const tableBody = $("customerTableBody");


$("customerCount").textContent =
    `${filteredCustomers.length} pelanggan`;

if (filteredCustomers.length === 0) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="6">
                Belum ada pelanggan.
            </td>
        </tr>
    `;
    return;
}

tableBody.innerHTML = filteredCustomers.map((customer, index) => {
    const id = customer.id;
    const name = getName(customer);
    const phone = getPhone(customer);
    const email = customer.email || "";
    const address = getAddress(customer);
    const debt = getDebt(customer);

    return `
        <tr>
            <td>${index + 1}</td>

            <td>
                <strong>${escapeHtml(name)}</strong>
                ${email ? `<small>${escapeHtml(email)}</small>` : ""}
            </td>

            <td>${escapeHtml(phone)}</td>

            <td>${escapeHtml(address)}</td>

            <td>
                ${
                    debt > 0
                        ? `<span class="debt">${formatRupiah(debt)}</span>`
                        : `<span class="no-debt">Lunas</span>`
                }
            </td>

            <td>
                <button
                    type="button"
                    onclick="editCustomer('${escapeAttribute(id)}')"
                >
                    ✏️
                </button>

                <button
                    type="button"
                    onclick="openDeleteModal('${escapeAttribute(id)}')"
                >
                    🗑️
                </button>
            </td>
        </tr>
    `;
}).join("");


}

function updateStats() {
$("totalCustomers").textContent = customers.length;


const phoneCount = customers.filter(
    customer => getPhone(customer) !== "-"
).length;

$("customersWithPhone").textContent = phoneCount;

const debtCount = customers.filter(
    customer => getDebt(customer) > 0
).length;

$("customersWithDebt").textContent = debtCount;


}

function searchCustomers() {
const keyword = $("searchInput").value.trim().toLowerCase();


if (!keyword) {
    filteredCustomers = [...customers];
} else {
    filteredCustomers = customers.filter(customer => {
        return (
            getName(customer).toLowerCase().includes(keyword) ||
            getPhone(customer).toLowerCase().includes(keyword) ||
            String(customer.email || "")
                .toLowerCase()
                .includes(keyword) ||
            getAddress(customer).toLowerCase().includes(keyword)
        );
    });
}

renderCustomers();


}

function addCustomer() {
editingCustomerId = null;

$("customerForm").reset();
$("customerId").value = "";

$("modalTitle").textContent = "Tambah Pelanggan";
$("saveButton").textContent = "Simpan Pelanggan";

$("customerModal").classList.add("show");
$("customerName").focus();


}

function editCustomer(id) {
const customer = customers.find(
item => String(item.id) === String(id)
);


if (!customer) {
    alert("Pelanggan tidak ditemukan.");
    return;
}

editingCustomerId = id;

$("customerId").value = id;

$("customerName").value =
    getName(customer) === "Tanpa Nama"
        ? ""
        : getName(customer);

$("customerPhone").value =
    getPhone(customer) === "-"
        ? ""
        : getPhone(customer);

$("customerEmail").value = customer.email || "";

$("customerAddress").value =
    getAddress(customer) === "-"
        ? ""
        : getAddress(customer);

$("customerNotes").value =
    customer.notes || customer.catatan || "";

$("modalTitle").textContent = "Edit Pelanggan";
$("saveButton").textContent = "Simpan Perubahan";

$("customerModal").classList.add("show");
$("customerName").focus();


}

function closeModal() {
$("customerModal").classList.remove("show");
$("customerForm").reset();
editingCustomerId = null;
}

async function saveCustomer(event) {
event.preventDefault();


const name = $("customerName").value.trim();

if (!name) {
    alert("Nama pelanggan wajib diisi.");
    $("customerName").focus();
    return;
}

const payload = {
    name: name,
    phone: $("customerPhone").value.trim(),
    email: $("customerEmail").value.trim(),
    address: $("customerAddress").value.trim(),
    notes: $("customerNotes").value.trim()
};

const button = $("saveButton");
const wasEditing = Boolean(editingCustomerId);

button.disabled = true;
button.textContent = "Menyimpan...";

try {
    const url = wasEditing
        ? `api/customers/${encodeURIComponent(editingCustomerId)}`
        : "api/customers";

    const method = wasEditing ? "PUT" : "POST";

    const response = await fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Gagal menyimpan pelanggan."
        );
    }

    closeModal();
    await loadCustomers();

    alert(
        wasEditing
            ? "Pelanggan berhasil diperbarui."
            : "Pelanggan berhasil ditambahkan."
    );
} catch (error) {
    console.error(error);
    alert(error.message);
} finally {
    button.disabled = false;
    button.textContent = wasEditing
        ? "Simpan Perubahan"
        : "Simpan Pelanggan";
}


}

function openDeleteModal(id) {
const customer = customers.find(
item => String(item.id) === String(id)
);


if (!customer) {
    alert("Pelanggan tidak ditemukan.");
    return;
}

deletingCustomerId = id;

$("deleteMessage").textContent =
    `Data "${getName(customer)}" akan dihapus.`;

$("deleteModal").classList.add("show");


}

function closeDeleteModal() {
$("deleteModal").classList.remove("show");
deletingCustomerId = null;
}

async function deleteCustomer() {
if (!deletingCustomerId) {
return;
}


const button = $("confirmDelete");

button.disabled = true;
button.textContent = "Menghapus...";

try {
    const response = await fetch(
        `api/customers/${encodeURIComponent(deletingCustomerId)}`,
        {
            method: "DELETE"
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Gagal menghapus pelanggan."
        );
    }

    closeDeleteModal();
    await loadCustomers();

    alert("Pelanggan berhasil dihapus.");
} catch (error) {
    console.error(error);
    alert(error.message);
} finally {
    button.disabled = false;
    button.textContent = "Hapus";
}


}

async function logout() {
if (!confirm("Yakin ingin keluar?")) {
return;
}


try {
    await fetch("api/logout", {
        method: "POST"
    });
} catch (error) {
    console.error(error);
}

location.href = "index.html";


}

function toggleSubmenu(submenuId, arrowId) {
const submenu = $(submenuId);
const arrow = $(arrowId);


if (submenu) {
    submenu.classList.toggle("show");
}

if (arrow) {
    arrow.classList.toggle("open");
}


}

function getName(customer) {
return (
customer.name ||
customer.nama ||
customer.customer_name ||
"Tanpa Nama"
);
}

function getPhone(customer) {
return (
customer.phone ||
customer.no_hp ||
customer.phone_number ||
"-"
);
}

function getAddress(customer) {
return (
customer.address ||
customer.alamat ||
"-"
);
}

function getDebt(customer) {
return Number(
customer.debt ??
customer.piutang ??
customer.total_debt ??
customer.total_piutang ??
0
);
}

function formatRupiah(value) {
return new Intl.NumberFormat("id-ID", {
style: "currency",
currency: "IDR",
maximumFractionDigits: 0
}).format(Number(value) || 0);
}

function escapeHtml(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, "&quot;")
.replace(/'/g, "'");
}

function escapeAttribute(value) {
return String(value ?? "")
.replace(/\\/g, "\\\\")
.replace(/'/g, "\'");
}




document.addEventListener("keydown", event => {
if (event.key !== "Escape") {
return;
}

closeModal();
closeDeleteModal();


});
