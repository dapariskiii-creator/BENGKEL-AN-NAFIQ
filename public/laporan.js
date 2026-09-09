// ======================================================
// AN-NAFIQ BENGKEL - LAPORAN
// ======================================================

const SUMMARY_API = "/api/reports/summary";
const SALES_API = "/api/reports/sales";
const SERVICES_API = "/api/reports/services";
const PURCHASES_API = "/api/reports/purchases";
const CASH_API = "/api/reports/cash";

// ======================================================
// HELPER
// ======================================================

function formatRupiah(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

function formatNumber(value) {
    return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

function formatDate(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getDateParams() {
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";

    const params = new URLSearchParams();

    if (startDate) {
        params.set("start_date", startDate);
    }

    if (endDate) {
        params.set("end_date", endDate);
    }

    return params.toString();
}

// ======================================================
// LOADING & ERROR
// ======================================================

function showLoading() {
    const loading = document.getElementById("loading");

    if (loading) {
        loading.style.display = "flex";
    }
}

function hideLoading() {
    const loading = document.getElementById("loading");

    if (loading) {
        loading.style.display = "none";
    }
}

function showError(message) {
    const errorBox = document.getElementById("errorBox");
    const errorMessage = document.getElementById("errorMessage");

    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (errorBox) {
        errorBox.style.display = "block";
    }
}

function hideError() {
    const errorBox = document.getElementById("errorBox");

    if (errorBox) {
        errorBox.style.display = "none";
    }
}

// ======================================================
// FETCH API
// ======================================================

async function fetchApi(url) {
    const query = getDateParams();

    const finalUrl = query
        ? `${url}?${query}`
        : url;

    const response = await fetch(finalUrl);

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error("Server mengirim response yang tidak valid.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message ||
            `Gagal mengambil data dari ${url}`
        );
    }

    return result;
}

// ======================================================
// SUMMARY
// ======================================================

async function loadSummary() {
    const result = await fetchApi(SUMMARY_API);

    renderSummary(result);
}

function renderSummary(result) {
    const data = result || {};

    const penjualan = data.penjualan || {};
    const servis = data.servis || {};
    const pembelian = data.pembelian || {};
    const kas = data.kas || {};
    const piutang = data.piutang || {};
    const hutang = data.hutang || {};
    const ringkasan = data.ringkasan || {};

    // =========================
    // RINGKASAN UTAMA
    // =========================

    setText(
        "totalOmzet",
        formatRupiah(ringkasan.omzet)
    );

    setText(
        "totalPenjualan",
        formatRupiah(penjualan.total)
    );

    setText(
        "jumlahPenjualan",
        `${formatNumber(penjualan.transaksi)} transaksi`
    );

    setText(
        "totalServis",
        formatRupiah(servis.total)
    );

    setText(
        "jumlahServis",
        `${formatNumber(servis.transaksi)} transaksi`
    );

    setText(
        "totalPembelian",
        formatRupiah(pembelian.total)
    );

    setText(
        "jumlahPembelian",
        `${formatNumber(pembelian.transaksi)} transaksi`
    );

    // =========================
    // KAS
    // =========================

    setText(
        "totalPemasukan",
        formatRupiah(kas.pemasukan)
    );

    setText(
        "totalPengeluaran",
        formatRupiah(kas.pengeluaran)
    );

    setText(
        "saldoKas",
        formatRupiah(kas.saldo)
    );

    // =========================
    // LABA
    // =========================

    setText(
        "labaKotor",
        formatRupiah(ringkasan.laba_kotor)
    );

    // =========================
    // PIUTANG
    // =========================

    setText(
        "jumlahPiutang",
        `${formatNumber(piutang.transaksi)} transaksi`
    );

    setText(
        "totalPiutang",
        formatRupiah(piutang.total)
    );

    setText(
        "piutangTerbayar",
        formatRupiah(piutang.terbayar)
    );

    setText(
        "piutangSisa",
        formatRupiah(piutang.sisa)
    );

    // =========================
    // HUTANG
    // =========================

    setText(
        "jumlahHutang",
        `${formatNumber(hutang.transaksi)} transaksi`
    );

    setText(
        "totalHutang",
        formatRupiah(hutang.total)
    );

    setText(
        "hutangTerbayar",
        formatRupiah(hutang.terbayar)
    );

    setText(
        "hutangSisa",
        formatRupiah(hutang.sisa)
    );
}

// ======================================================
// PENJUALAN
// ======================================================

async function loadSales() {
    const result = await fetchApi(SALES_API);

    renderSales(result.data || []);
}

function renderSales(data) {
    const tbody = document.getElementById("salesTableBody");
    const count = document.getElementById("salesCount");

    if (!tbody) return;

    if (count) {
        count.textContent = `${formatNumber(data.length)} transaksi`;
    }

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Belum ada transaksi penjualan.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const invoice =
            item.invoice_number ||
            item.invoice ||
            "-";

        const subtotal =
            item.subtotal || 0;

        const discount =
            item.discount || 0;

        const total =
            item.total || 0;

        const payment =
            item.payment_method ||
            "-";

        const status =
            item.status ||
            "-";

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>
                        ${escapeHtml(invoice)}
                    </strong>
                </td>

                <td>
                    ${formatDate(item.sale_date)}
                </td>

                <td>
                    ${formatRupiah(subtotal)}
                </td>

                <td>
                    ${formatRupiah(discount)}
                </td>

                <td>
                    <strong>
                        ${formatRupiah(total)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(payment)}
                </td>

                <td>
                    <span class="status-badge">
                        ${escapeHtml(status)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

// ======================================================
// SERVIS
// ======================================================

async function loadServices() {
    const result = await fetchApi(SERVICES_API);

    renderServices(result.data || []);
}

function renderServices(data) {
    const tbody = document.getElementById("servicesTableBody");
    const count = document.getElementById("servicesCount");

    if (!tbody) return;

    if (count) {
        count.textContent = `${formatNumber(data.length)} transaksi`;
    }

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Belum ada transaksi servis.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const serviceNumber =
            item.order_number ||
            item.service_number ||
            "-";

        const customer =
            item.customer_name ||
            "-";

        const vehicle =
            item.vehicle_name ||
            item.vehicle_type ||
            "-";

        const plate =
            item.license_plate ||
            item.vehicle_number ||
            "";

        const mechanic =
            item.mechanic_name ||
            "-";

        const status =
            item.status ||
            "-";

        const total =
            item.final_cost ??
            item.total ??
            item.estimated_cost ??
            0;

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>
                        ${escapeHtml(serviceNumber)}
                    </strong>
                </td>

                <td>
                    ${formatDate(
                        item.order_date ||
                        item.service_date ||
                        item.created_at
                    )}
                </td>

                <td>
                    ${escapeHtml(customer)}
                </td>

                <td>
                    ${escapeHtml(vehicle)}
                    ${
                        plate
                            ? `<br><small>${escapeHtml(plate)}</small>`
                            : ""
                    }
                </td>

                <td>
                    ${escapeHtml(mechanic)}
                </td>

                <td>
                    <span class="status-badge">
                        ${escapeHtml(status)}
                    </span>
                </td>

                <td>
                    <strong>
                        ${formatRupiah(total)}
                    </strong>
                </td>
            </tr>
        `;
    }).join("");
}

// ======================================================
// PEMBELIAN
// ======================================================

async function loadPurchases() {
    const section = document.getElementById("purchasesTableBody");

    if (!section) return;

    try {
        const result = await fetchApi(PURCHASES_API);

        renderPurchases(result.data || []);
    } catch (error) {
        section.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    Gagal mengambil laporan pembelian.
                </td>
            </tr>
        `;

        console.error("Laporan pembelian:", error);
    }
}

function renderPurchases(data) {
    const tbody = document.getElementById("purchasesTableBody");
    const count = document.getElementById("purchasesCount");

    if (!tbody) return;

    if (count) {
        count.textContent = `${formatNumber(data.length)} transaksi`;
    }

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    Belum ada transaksi pembelian.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const purchaseNumber =
            item.purchase_number || "-";

        const supplier =
            item.supplier_name || "-";

        const total =
            item.total || 0;

        const paid =
            item.paid_amount || 0;

        const paymentMethod =
            item.payment_method || "-";

        const paymentStatus =
            item.payment_status || "-";

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>
                        ${escapeHtml(purchaseNumber)}
                    </strong>
                </td>

                <td>
                    ${formatDate(item.purchase_date)}
                </td>

                <td>
                    ${escapeHtml(supplier)}
                </td>

                <td>
                    ${formatRupiah(item.subtotal)}
                </td>

                <td>
                    ${formatRupiah(item.discount)}
                </td>

                <td>
                    <strong>
                        ${formatRupiah(total)}
                    </strong>
                </td>

                <td>
                    ${formatRupiah(paid)}
                </td>

                <td>
                    <span class="status-badge">
                        ${escapeHtml(paymentStatus)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

// ======================================================
// KAS
// ======================================================

async function loadCash() {
    const section = document.getElementById("cashTableBody");

    if (!section) return;

    try {
        const result = await fetchApi(CASH_API);

        renderCash(result.data || []);
    } catch (error) {
        section.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Gagal mengambil laporan kas.
                </td>
            </tr>
        `;

        console.error("Laporan kas:", error);
    }
}

function renderCash(data) {
    const tbody = document.getElementById("cashTableBody");
    const count = document.getElementById("cashCount");

    if (!tbody) return;

    if (count) {
        count.textContent = `${formatNumber(data.length)} transaksi`;
    }

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Belum ada transaksi kas.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const type =
            String(item.transaction_type || "")
                .toUpperCase();

        const amount =
            Number(item.amount || 0);

        const description =
            item.description || "-";

        const paymentMethod =
            item.payment_method || "-";

        const referenceType =
            item.reference_type || "-";

        const isIncome = type === "IN";

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    ${formatDate(item.transaction_date)}
                </td>

                <td>
                    <span class="cash-type ${isIncome ? "cash-in" : "cash-out"}">
                        ${isIncome ? "PEMASUKAN" : "PENGELUARAN"}
                    </span>
                </td>

                <td>
                    <strong>
                        ${formatRupiah(amount)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(paymentMethod)}
                </td>

                <td>
                    ${escapeHtml(referenceType)}
                </td>

                <td>
                    ${escapeHtml(description)}
                </td>
            </tr>
        `;
    }).join("");
}

// ======================================================
// UTILITY DOM
// ======================================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

// ======================================================
// LOAD SEMUA LAPORAN
// ======================================================

async function loadReport() {
    showLoading();
    hideError();

    try {
        await Promise.all([
            loadSummary(),
            loadSales(),
            loadServices(),
            loadPurchases(),
            loadCash()
        ]);
    } catch (error) {
        console.error("Laporan:", error);

        showError(
            error.message ||
            "Terjadi kesalahan saat mengambil data laporan."
        );
    } finally {
        hideLoading();
    }
}

// ======================================================
// REFRESH
// ======================================================

function refreshReport() {
    loadReport();
}

// ======================================================
// FILTER TANGGAL
// ======================================================

function setToday() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const date = `${year}-${month}-${day}`;

    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");

    if (startDate) startDate.value = date;
    if (endDate) endDate.value = date;

    loadReport();
}

function setThisMonth() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");

    const firstDay = `${year}-${month}-01`;

    const lastDayDate = new Date(
        year,
        today.getMonth() + 1,
        0
    );

    const lastDay = String(
        lastDayDate.getDate()
    ).padStart(2, "0");

    const endDate = `${year}-${month}-${lastDay}`;

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (startInput) startInput.value = firstDay;
    if (endInput) endInput.value = endDate;

    loadReport();
}

function setThisYear() {
    const year = new Date().getFullYear();

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (startInput) {
        startInput.value = `${year}-01-01`;
    }

    if (endInput) {
        endInput.value = `${year}-12-31`;
    }

    loadReport();
}

// ======================================================
// CETAK
// ======================================================

function printReport() {
    window.print();
}

// ======================================================
// LOGOUT
// ======================================================

function logout() {
    if (
        confirm(
            "Apakah Anda yakin ingin keluar dari aplikasi?"
        )
    ) {
        window.location.href = "index.html";
    }
}

// ======================================================
// START
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadReport();
    }
);