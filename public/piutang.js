
// ========================================
// AN-NAFIQ BENGKEL - PIUTANG
// ========================================

let piutangData = [];
let filteredData = [];
let selectedPiutang = null;

const $ = (id) => document.getElementById(id);


// ========================================
// INIT
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
    loadPiutang();

    $("searchInput").addEventListener("input", filterPiutang);
    $("statusFilter").addEventListener("change", filterPiutang);

    $("closeDetailModal").addEventListener("click", closeDetailModal);
    $("closeDetailButton").addEventListener("click", closeDetailModal);

    $("closePaymentModal").addEventListener("click", closePaymentModal);
    $("cancelPayment").addEventListener("click", closePaymentModal);

    $("paymentForm").addEventListener("submit", handlePayment);

    $("logoutButton").addEventListener("click", logout);

    $("detailModal").addEventListener("click", (event) => {
        if (event.target === $("detailModal")) {
            closeDetailModal();
        }
    });

    $("paymentModal").addEventListener("click", (event) => {
        if (event.target === $("paymentModal")) {
            closePaymentModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDetailModal();
            closePaymentModal();
        }
    });
});


// ========================================
// LOGIN
// ========================================

async function checkLogin() {
    try {
        const response = await fetch("api/me");

        if (!response.ok) {
            window.location.href = "index.html";
            return;
        }

        const data = await response.json();

        const user = data.user || data;

        if (user) {
            if ($("userName")) {
                $("userName").textContent =
                    user.full_name ||
                    user.username ||
                    "bengkel an-nafiq";
            }

            if ($("userRole")) {
                $("userRole").textContent =
                    String(user.role || "OWNER").toUpperCase();
            }
        }

    } catch (error) {
        console.error("CHECK LOGIN ERROR:", error);
        window.location.href = "index.html";
    }
}


// ========================================
// LOAD PIUTANG
// ========================================

async function loadPiutang() {
    showLoading();

    try {
        const response = await fetch("api/receivables");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Gagal mengambil data piutang"
            );
        }

        if (Array.isArray(data)) {
            piutangData = data;
        } else if (Array.isArray(data.receivables)) {
            piutangData = data.receivables;
        } else if (Array.isArray(data.piutang)) {
            piutangData = data.piutang;
        } else if (Array.isArray(data.data)) {
            piutangData = data.data;
        } else {
            piutangData = [];
        }

        filteredData = [...piutangData];

        updateStats();
        renderPiutang();

    } catch (error) {
        console.error("LOAD PIUTANG ERROR:", error);
        showError(error.message);
    }
}


// ========================================
// RENDER
// ========================================

function renderPiutang() {
    const tbody = $("piutangTableBody");

    if (!tbody) return;

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    Tidak ada data piutang.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredData.map((item, index) => {

        const customerName = getCustomerName(item);
        const transactionNumber = getTransactionNumber(item);

        const total = getTotal(item);
        const paid = getPaid(item);
        const remaining = Math.max(total - paid, 0);

        const date = getDate(item);
        const dueDate = getDueDate(item);

        const status = getStatus(
            item,
            total,
            paid,
            remaining,
            dueDate
        );

        return `
            <tr>

                <td>${index + 1}</td>

                <td>
                    <strong>${escapeHtml(customerName)}</strong>
                </td>

                <td>
                    ${escapeHtml(transactionNumber)}
                </td>

                <td>
                    ${formatDate(date)}
                </td>

                <td>
                    ${formatDate(dueDate)}
                </td>

                <td>
                    <strong>${formatRupiah(total)}</strong>
                </td>

                <td>
                    ${formatRupiah(paid)}
                </td>

                <td>
                    <strong>${formatRupiah(remaining)}</strong>
                </td>

                <td>
                    <span class="status ${status.className}">
                        ${status.label}
                    </span>
                </td>

                <td>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="action-button detail"
                            title="Detail"
                            onclick="openDetail('${escapeAttribute(item.id)}')">
                            👁️
                        </button>

                        ${
                            remaining > 0
                                ? `
                                <button
                                    type="button"
                                    class="action-button pay"
                                    title="Bayar"
                                    onclick="openPayment('${escapeAttribute(item.id)}')">
                                    💰
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


// ========================================
// STATS
// ========================================

function updateStats() {

    let totalPiutang = 0;
    let belumJatuhTempo = 0;
    let jatuhTempo = 0;
    let sudahLunas = 0;

    piutangData.forEach((item) => {

        const total = getTotal(item);
        const paid = getPaid(item);
        const remaining = Math.max(total - paid, 0);

        const status = getStatus(
            item,
            total,
            paid,
            remaining,
            getDueDate(item)
        );

        totalPiutang += remaining;

        if (status.type === "lunas") {
            sudahLunas += total;
        } else if (status.type === "jatuh_tempo") {
            jatuhTempo += remaining;
        } else {
            belumJatuhTempo += remaining;
        }
    });

    $("totalPiutang").textContent =
        formatRupiah(totalPiutang);

    $("belumJatuhTempo").textContent =
        formatRupiah(belumJatuhTempo);

    $("jatuhTempo").textContent =
        formatRupiah(jatuhTempo);

    $("sudahLunas").textContent =
        formatRupiah(sudahLunas);
}


// ========================================
// SEARCH & FILTER
// ========================================

function filterPiutang() {

    const keyword =
        ($("searchInput").value || "")
            .trim()
            .toLowerCase();

    const selectedStatus =
        $("statusFilter").value;

    filteredData = piutangData.filter((item) => {

        const customerName =
            getCustomerName(item).toLowerCase();

        const transactionNumber =
            getTransactionNumber(item).toLowerCase();

        const matchesSearch =
            !keyword ||
            customerName.includes(keyword) ||
            transactionNumber.includes(keyword);

        if (!matchesSearch) {
            return false;
        }

        const total = getTotal(item);
        const paid = getPaid(item);
        const remaining = Math.max(total - paid, 0);

        const status = getStatus(
            item,
            total,
            paid,
            remaining,
            getDueDate(item)
        );

        if (selectedStatus === "semua") {
            return true;
        }

        return status.type === selectedStatus;
    });

    renderPiutang();
}


// ========================================
// DETAIL
// ========================================

function openDetail(id) {

    selectedPiutang = piutangData.find(
        item => String(item.id) === String(id)
    );

    if (!selectedPiutang) {
        alert("Data piutang tidak ditemukan.");
        return;
    }

    const total = getTotal(selectedPiutang);
    const paid = getPaid(selectedPiutang);
    const remaining = Math.max(total - paid, 0);

    const status = getStatus(
        selectedPiutang,
        total,
        paid,
        remaining,
        getDueDate(selectedPiutang)
    );

    $("detailContent").innerHTML = `

        <div class="detail-grid">

            <div class="detail-item">
                <span>Pelanggan</span>
                <strong>
                    ${escapeHtml(
                        getCustomerName(selectedPiutang)
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>No. Transaksi</span>
                <strong>
                    ${escapeHtml(
                        getTransactionNumber(selectedPiutang)
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Tanggal Transaksi</span>
                <strong>
                    ${formatDate(
                        getDate(selectedPiutang)
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Jatuh Tempo</span>
                <strong>
                    ${formatDate(
                        getDueDate(selectedPiutang)
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Total</span>
                <strong>
                    ${formatRupiah(total)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Terbayar</span>
                <strong>
                    ${formatRupiah(paid)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Sisa Piutang</span>
                <strong>
                    ${formatRupiah(remaining)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Status</span>
                <strong>
                    <span class="status ${status.className}">
                        ${status.label}
                    </span>
                </strong>
            </div>

        </div>
    `;

    $("detailModal").classList.add("show");
}


function closeDetailModal() {
    $("detailModal").classList.remove("show");
}


// ========================================
// PAYMENT MODAL
// ========================================

function openPayment(id) {

    selectedPiutang = piutangData.find(
        item => String(item.id) === String(id)
    );

    if (!selectedPiutang) {
        alert("Data piutang tidak ditemukan.");
        return;
    }

    const total = getTotal(selectedPiutang);
    const paid = getPaid(selectedPiutang);
    const remaining = Math.max(total - paid, 0);

    $("paymentReceivableId").value =
        selectedPiutang.id;

    $("paymentCustomerName").value =
        getCustomerName(selectedPiutang);

    $("paymentRemaining").value =
        formatRupiah(remaining);

    $("paymentAmount").value = "";

    $("paymentAmount").max = remaining;

    $("paymentMethod").value = "";

    $("paymentNotes").value = "";

    $("paymentModal").classList.add("show");

    setTimeout(() => {
        $("paymentAmount").focus();
    }, 100);
}


function closePaymentModal() {
    $("paymentModal").classList.remove("show");
}


// ========================================
// PAYMENT
// ========================================

async function handlePayment(event) {

    event.preventDefault();

    if (!selectedPiutang) {
        alert("Data piutang tidak ditemukan.");
        return;
    }

    const amount =
        Number($("paymentAmount").value);

    const method =
        $("paymentMethod").value;

    const notes =
        $("paymentNotes").value.trim();

    const total = getTotal(selectedPiutang);
    const paid = getPaid(selectedPiutang);
    const remaining = Math.max(total - paid, 0);

    if (!amount || amount <= 0) {
        alert("Masukkan jumlah pembayaran.");
        return;
    }

    if (amount > remaining) {
        alert(
            "Jumlah pembayaran tidak boleh lebih besar dari sisa piutang."
        );
        return;
    }

    if (!method) {
        alert("Pilih metode pembayaran.");
        return;
    }

    const submitButton =
        $("paymentForm").querySelector(
            'button[type="submit"]'
        );

    const originalText =
        submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";

    try {

        const response = await fetch(
            "api/receivables/" +
            encodeURIComponent(selectedPiutang.id) +
            "/payment",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    amount,
                    payment_method: method,
                    notes
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Gagal menyimpan pembayaran"
            );
        }

        alert(
            data.message ||
            "Pembayaran berhasil disimpan."
        );

        closePaymentModal();

        await loadPiutang();

    } catch (error) {

        console.error(
            "PAYMENT ERROR:",
            error
        );

        alert(
            error.message ||
            "Gagal menyimpan pembayaran."
        );

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}


// ========================================
// STATUS
// ========================================

function getStatus(
    item,
    total,
    paid,
    remaining,
    dueDate
) {

    if (remaining <= 0) {
        return {
            type: "lunas",
            label: "Lunas",
            className: "status-lunas"
        };
    }

    if (paid > 0 && remaining > 0) {
        return {
            type: "sebagian",
            label: "Dibayar Sebagian",
            className: "status-sebagian"
        };
    }

    if (dueDate) {

        const due =
            new Date(dueDate);

        const today =
            new Date();

        today.setHours(
            0, 0, 0, 0
        );

        due.setHours(
            0, 0, 0, 0
        );

        if (due < today) {
            return {
                type: "jatuh_tempo",
                label: "Jatuh Tempo",
                className: "status-jatuh-tempo"
            };
        }
    }

    return {
        type: "belum",
        label: "Belum Jatuh Tempo",
        className: "status-belum"
    };
}


// ========================================
// DATA HELPERS
// ========================================

function getCustomerName(item) {

    return (
        item.customer_name ||
        item.customerName ||
        item.name ||
        item.customer?.name ||
        "Tanpa Nama"
    );
}


function getTransactionNumber(item) {

    return (
        item.transaction_number ||
        item.transactionNumber ||
        item.invoice_number ||
        item.invoice ||
        item.sale_number ||
        item.code ||
        "-"
    );
}


function getTotal(item) {

    return Number(
        item.total_amount ??
        item.total ??
        item.amount ??
        item.original_amount ??
        item.grand_total ??
        0
    );
}


function getPaid(item) {

    return Number(
        item.paid_amount ??
        item.paid ??
        item.amount_paid ??
        item.total_paid ??
        0
    );
}


function getDate(item) {

    return (
        item.transaction_date ||
        item.sale_date ||
        item.date ||
        item.created_at ||
        null
    );
}


function getDueDate(item) {

    return (
        item.due_date ||
        item.dueDate ||
        item.payment_due_date ||
        null
    );
}


// ========================================
// FORMAT
// ========================================

function formatRupiah(value) {

    const number =
        Number(value) || 0;

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(number);
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}


// ========================================
// HTML SECURITY
// ========================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


// ========================================
// LOADING / ERROR
// ========================================

function showLoading() {

    $("piutangTableBody").innerHTML = `
        <tr>
            <td colspan="10" class="loading">
                Memuat data piutang...
            </td>
        </tr>
    `;
}


function showError(message) {

    $("piutangTableBody").innerHTML = `
        <tr>
            <td colspan="10" class="empty-state">
                <strong>Gagal memuat data piutang.</strong>
                <br>
                <small>
                    ${escapeHtml(
                        message ||
                        "Terjadi kesalahan."
                    )}
                </small>
                <br><br>
                <button
                    type="button"
                    class="btn-primary"
                    onclick="loadPiutang()">
                    Coba Lagi
                </button>
            </td>
        </tr>
    `;
}


// ========================================
// LOGOUT
// ========================================

async function logout() {

    try {

        await fetch(
            "api/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {
        console.error(
            "LOGOUT ERROR:",
            error
        );
    }

    window.location.href =
        "index.html";
}


// ========================================
// SIDEBAR SUBMENU
// ========================================

function toggleSubmenu(
    submenuId,
    arrowId
) {

    const submenu =
        $(submenuId);

    const arrow =
        $(arrowId);

    if (!submenu) return;

    const isOpen =
        submenu.style.display === "block";

    submenu.style.display =
        isOpen ? "none" : "block";

    if (arrow) {
        arrow.textContent =
            isOpen ? "▼" : "▲";
    }
}

