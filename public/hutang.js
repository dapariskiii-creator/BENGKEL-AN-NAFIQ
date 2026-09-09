// ============================================================
// AN-NAFIQ BENGKEL - HUTANG SUPPLIER
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initHutang();
});

let semuaHutang = [];
let hutangTerpilih = null;

// ============================================================
// INIT
// ============================================================

async function initHutang() {
    setupSidebar();
    setupEvents();
    await cekLogin();
    await loadHutang();
}

// ============================================================
// CEK LOGIN
// ============================================================

async function cekLogin() {
    try {
        const response = await fetch("api/me");
        const data = await response.json();

        if (!data.success && !data.user) {
            window.location.href = "login.html";
            return;
        }

        const user = data.user || data;

        const usernameEl = document.querySelector(".user-name");
        const roleEl = document.querySelector(".user-role");

        if (usernameEl && user.full_name) {
            usernameEl.textContent = user.full_name;
        }

        if (roleEl && user.role) {
            roleEl.textContent = user.role;
        }
    } catch (error) {
        console.error("Gagal mengecek login:", error);
    }
}

// ============================================================
// LOAD DATA HUTANG
// ============================================================

async function loadHutang() {
    try {
        showLoading();

        const response = await fetch("api/payables");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Gagal mengambil data hutang");
        }

        if (Array.isArray(data)) {
            semuaHutang = data;
        } else if (Array.isArray(data.payables)) {
            semuaHutang = data.payables;
        } else if (Array.isArray(data.hutang)) {
            semuaHutang = data.hutang;
        } else if (Array.isArray(data.data)) {
            semuaHutang = data.data;
        } else {
            semuaHutang = [];
        }

        updateStats();
        renderTable();

    } catch (error) {
        console.error("Error load hutang:", error);

        const tbody = document.getElementById("hutangTableBody");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:30px;">
                        <div style="color:#dc2626;">
                            Gagal mengambil data hutang.
                        </div>
                        <small>${escapeHtml(error.message)}</small>
                    </td>
                </tr>
            `;
        }

    }
}

// ============================================================
// STATISTIK
// ============================================================

function updateStats() {
    let totalHutang = 0;
    let belumJatuhTempo = 0;
    let jatuhTempo = 0;
    let sudahLunas = 0;

    semuaHutang.forEach(item => {
        const total = toNumber(item.total_amount);
        const balance = toNumber(item.balance_amount);

        const status = getStatus(item);
        const jatuhTempoStatus = getDueStatus(item);

        if (status === "lunas") {
            sudahLunas += total;
        } else {
            totalHutang += balance;

            if (jatuhTempoStatus === "jatuh_tempo") {
                jatuhTempo += balance;
            } else {
                belumJatuhTempo += balance;
            }
        }
    });

    setText("totalHutang", formatRupiah(totalHutang));
    setText("belumJatuhTempo", formatRupiah(belumJatuhTempo));
    setText("jatuhTempo", formatRupiah(jatuhTempo));
    setText("sudahLunas", formatRupiah(sudahLunas));
}

// ============================================================
// RENDER TABLE
// ============================================================

function renderTable() {
    const tbody = document.getElementById("hutangTableBody");

    if (!tbody) return;

    const keyword = (
        document.getElementById("searchInput")?.value || ""
    ).toLowerCase().trim();

    const filter = document.getElementById("statusFilter")?.value || "semua";

    let data = semuaHutang.filter(item => {

        const supplier = String(
            item.supplier_name || ""
        ).toLowerCase();

        const purchaseNumber = String(
            item.purchase_number || ""
        ).toLowerCase();

        const payableNumber = String(
            item.payable_number || ""
        ).toLowerCase();

        const cocokSearch =
            !keyword ||
            supplier.includes(keyword) ||
            purchaseNumber.includes(keyword) ||
            payableNumber.includes(keyword);

        if (!cocokSearch) return false;

        const status = getStatus(item);
        const dueStatus = getDueStatus(item);

        if (filter === "belum") {
            return status === "belum";
        }

        if (filter === "jatuh_tempo") {
            return dueStatus === "jatuh_tempo" && status !== "lunas";
        }

        if (filter === "sebagian") {
            return status === "sebagian";
        }

        if (filter === "lunas") {
            return status === "lunas";
        }

        return true;
    });

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:35px;">
                    Tidak ada data hutang.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((item, index) => {

        const total = toNumber(item.total_amount);
        const paid = toNumber(item.paid_amount);
        const balance = toNumber(item.balance_amount);

        const status = getStatus(item);
        const dueStatus = getDueStatus(item);

        let badgeClass = "status-belum";
        let statusText = "Belum Dibayar";

        if (status === "sebagian") {
            badgeClass = "status-sebagian";
            statusText = "Sebagian";
        }

        if (status === "lunas") {
            badgeClass = "status-lunas";
            statusText = "Lunas";
        }

        if (
            status !== "lunas" &&
            dueStatus === "jatuh_tempo"
        ) {
            badgeClass = "status-jatuh-tempo";
            statusText = "Jatuh Tempo";
        }

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>
                        ${escapeHtml(item.supplier_name || "-")}
                    </strong>
                    ${
                        item.supplier_phone
                            ? `<br><small>${escapeHtml(item.supplier_phone)}</small>`
                            : ""
                    }
                </td>

                <td>
                    ${escapeHtml(item.purchase_number || "-")}
                </td>

                <td>
                    ${formatTanggal(item.payable_date)}
                </td>

                <td>
                    ${formatTanggal(item.due_date)}
                </td>

                <td>
                    <strong>${formatRupiah(total)}</strong>
                </td>

                <td>
                    ${formatRupiah(paid)}
                </td>

                <td>
                    <strong>
                        ${formatRupiah(balance)}
                    </strong>
                </td>

                <td>
                    <span class="status-badge ${badgeClass}">
                        ${statusText}
                    </span>
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            class="btn-action btn-detail"
                            onclick="lihatDetail('${item.id}')"
                            title="Detail"
                        >
                            Detail
                        </button>

                        ${
                            balance > 0
                                ? `
                                    <button
                                        class="btn-action btn-bayar"
                                        onclick="bukaPembayaran('${item.id}')"
                                        title="Bayar"
                                    >
                                        Bayar
                                    </button>
                                  `
                                : ""
                        }

                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ============================================================
// DETAIL
// ============================================================

async function lihatDetail(id) {
    try {
        const itemLokal = semuaHutang.find(item => item.id === id);

        let item = itemLokal;

        try {
            const response = await fetch(`api/payables/${id}`);
            const data = await response.json();

            if (response.ok) {
                item = data.payable || data.data || data;
            }
        } catch (error) {
            console.warn("Detail API gagal, menggunakan data tabel.");
        }

        hutangTerpilih = item;

        const modal = document.getElementById("detailModal");

        if (!modal) return;

        setText(
            "detailSupplier",
            item.supplier_name || "-"
        );

        setText(
            "detailPurchase",
            item.purchase_number || "-"
        );

        setText(
            "detailPayableNumber",
            item.payable_number || "-"
        );

        setText(
            "detailDate",
            formatTanggal(item.payable_date)
        );

        setText(
            "detailDueDate",
            formatTanggal(item.due_date)
        );

        setText(
            "detailTotal",
            formatRupiah(item.total_amount)
        );

        setText(
            "detailPaid",
            formatRupiah(item.paid_amount)
        );

        setText(
            "detailBalance",
            formatRupiah(item.balance_amount)
        );

        setText(
            "detailStatus",
            getStatusText(item)
        );

        setText(
            "detailNotes",
            item.notes || "-"
        );

        modal.classList.add("show");

    } catch (error) {
        console.error(error);
        alert("Gagal membuka detail hutang.");
    }
}

// ============================================================
// PEMBAYARAN
// ============================================================

function bukaPembayaran(id) {
    const item = semuaHutang.find(item => item.id === id);

    if (!item) {
        alert("Data hutang tidak ditemukan.");
        return;
    }

    const balance = toNumber(item.balance_amount);

    if (balance <= 0) {
        alert("Hutang ini sudah lunas.");
        return;
    }

    hutangTerpilih = item;

    setValue("paymentId", item.id);
    setValue(
        "paymentSupplier",
        item.supplier_name || "-"
    );
    setValue(
        "paymentBalance",
        formatRupiah(balance)
    );
    setValue("paymentAmount", "");
    setValue("paymentNotes", "");

    const method = document.getElementById("paymentMethod");

    if (method) {
        method.value = "cash";
    }

    const modal = document.getElementById("paymentModal");

    if (modal) {
        modal.classList.add("show");
    }

    setTimeout(() => {
        document.getElementById("paymentAmount")?.focus();
    }, 100);
}

// ============================================================
// PROSES PEMBAYARAN
// ============================================================

async function prosesPembayaran(event) {
    if (event) {
        event.preventDefault();
    }

    const id =
        document.getElementById("paymentId")?.value;

    const amount =
        toNumber(
            document.getElementById("paymentAmount")?.value
        );

    const paymentMethod =
        document.getElementById("paymentMethod")?.value || "cash";

    const notes =
        document.getElementById("paymentNotes")?.value || "";

    if (!id) {
        alert("ID hutang tidak ditemukan.");
        return;
    }

    if (!amount || amount <= 0) {
        alert("Masukkan nominal pembayaran.");
        return;
    }

    const item = semuaHutang.find(
        item => item.id === id
    );

    if (!item) {
        alert("Data hutang tidak ditemukan.");
        return;
    }

    const balance = toNumber(item.balance_amount);

    if (amount > balance) {
        alert(
            "Nominal pembayaran tidak boleh lebih besar dari sisa hutang."
        );
        return;
    }

    const konfirmasi = confirm(
        `Bayar hutang supplier sebesar ${formatRupiah(amount)}?`
    );

    if (!konfirmasi) {
        return;
    }

    const button =
        document.querySelector(
            "#paymentModal button[type='submit']"
        );

    const buttonText = button
        ? button.textContent
        : "";

    try {
        if (button) {
            button.disabled = true;
            button.textContent = "Memproses...";
        }

        const response = await fetch(
            `api/payables/${id}/payment`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: amount,
                    payment_method: paymentMethod,
                    notes: notes
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message ||
                "Pembayaran gagal diproses."
            );
        }

        alert("Pembayaran hutang berhasil.");

        tutupModal("paymentModal");

        await loadHutang();

    } catch (error) {
        console.error(error);

        alert(
            "Pembayaran gagal: " +
            error.message
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = buttonText || "Simpan Pembayaran";
        }
    }
}

// ============================================================
// MODAL
// ============================================================

function tutupModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.remove("show");
    }
}

function setupModalClick() {
    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                modal.classList.remove("show");
            }

        });
    });
}

// ============================================================
// EVENT
// ============================================================

function setupEvents() {

    const searchInput =
        document.getElementById("searchInput");

    if (searchInput) {
        searchInput.addEventListener(
            "input",
            renderTable
        );
    }

    const statusFilter =
        document.getElementById("statusFilter");

    if (statusFilter) {
        statusFilter.addEventListener(
            "change",
            renderTable
        );
    }

    const paymentForm =
        document.getElementById("paymentForm");

    if (paymentForm) {
        paymentForm.addEventListener(
            "submit",
            prosesPembayaran
        );
    }

    setupModalClick();

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            tutupModal("detailModal");
            tutupModal("paymentModal");
        }

    });
}

// ============================================================
// SIDEBAR
// ============================================================

function setupSidebar() {

    document.querySelectorAll(".submenu-toggle").forEach(button => {

        button.addEventListener("click", () => {

            const parent = button.parentElement;

            if (parent) {
                parent.classList.toggle("open");
            }

        });

    });

    const logoutButton =
        document.querySelector(
            "[data-action='logout'], .logout-btn"
        );

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                const yakin = confirm(
                    "Yakin ingin keluar?"
                );

                if (!yakin) return;

                try {
                    await fetch(
                        "api/logout",
                        {
                            method: "POST"
                        }
                    );
                } catch (error) {
                    console.error(error);
                }

                window.location.href =
                    "login.html";
            }
        );
    }
}

// ============================================================
// STATUS
// ============================================================

function getStatus(item) {

    const status =
        String(item.status || "")
            .toLowerCase()
            .trim();

    const balance =
        toNumber(item.balance_amount);

    if (balance <= 0) {
        return "lunas";
    }

    if (
        status === "lunas" ||
        status === "paid"
    ) {
        return "lunas";
    }

    if (
        status === "sebagian" ||
        status === "partial"
    ) {
        return "sebagian";
    }

    return "belum";
}

function getStatusText(item) {

    const status = getStatus(item);
    const due = getDueStatus(item);

    if (status === "lunas") {
        return "Lunas";
    }

    if (status === "sebagian") {

        if (due === "jatuh_tempo") {
            return "Sebagian - Jatuh Tempo";
        }

        return "Sebagian";
    }

    if (due === "jatuh_tempo") {
        return "Jatuh Tempo";
    }

    return "Belum Dibayar";
}

// ============================================================
// JATUH TEMPO
// ============================================================

function getDueStatus(item) {

    if (!item.due_date) {
        return "belum";
    }

    const balance =
        toNumber(item.balance_amount);

    if (balance <= 0) {
        return "lunas";
    }

    const dueDate =
        new Date(item.due_date);

    if (Number.isNaN(dueDate.getTime())) {
        return "belum";
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
        return "jatuh_tempo";
    }

    return "belum";
}

// ============================================================
// FORMAT RUPIAH
// ============================================================

function formatRupiah(value) {

    const number = toNumber(value);

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }
    ).format(number);
}

// ============================================================
// FORMAT TANGGAL
// ============================================================

function formatTanggal(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}

// ============================================================
// NUMBER
// ============================================================

function toNumber(value) {

    const number =
        Number.parseFloat(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

// ============================================================
// SET TEXT
// ============================================================

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

// ============================================================
// SET VALUE
// ============================================================

function setValue(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value = value;
    }
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// LOADING
// ============================================================

function showLoading() {

    const tbody =
        document.getElementById(
            "hutangTableBody"
        );

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td
                colspan="10"
                style="
                    text-align:center;
                    padding:35px;
                "
            >
                Memuat data hutang...
            </td>
        </tr>
    `;
}