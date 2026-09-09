
// =========================================================
// AN-NAFIQ BENGKEL
// KAS & KEUANGAN
// keuangan.js
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // ELEMENT
    // =====================================================

    const saldoKas = document.getElementById("saldoKas");
    const kasMasuk = document.getElementById("kasMasuk");
    const kasKeluar = document.getElementById("kasKeluar");
    const arusKas = document.getElementById("arusKas");

    const totalMasuk = document.getElementById("totalMasuk");
    const totalKeluar = document.getElementById("totalKeluar");
    const totalTransaksi = document.getElementById("totalTransaksi");

    const cashTableBody = document.getElementById("cashTableBody");
    const tableInfo = document.getElementById("tableInfo");

    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const typeFilter = document.getElementById("typeFilter");
    const paymentFilter = document.getElementById("paymentFilter");

    const btnFilter = document.getElementById("btnFilter");
    const btnResetFilter = document.getElementById("btnResetFilter");

    const btnTambahPengeluaran =
        document.getElementById("btnTambahPengeluaran");

    // Modal
    const expenseModal = document.getElementById("expenseModal");
    const closeExpenseModal =
        document.getElementById("closeExpenseModal");

    const expenseForm = document.getElementById("expenseForm");

    const expenseDate =
        document.getElementById("expenseDate");

    const expenseCategory =
        document.getElementById("expenseCategory");

    const expenseDescription =
        document.getElementById("expenseDescription");

    const expenseAmount =
        document.getElementById("expenseAmount");

    const expensePayment =
        document.getElementById("expensePayment");

    const expenseNotes =
        document.getElementById("expenseNotes");

    const expenseError =
        document.getElementById("expenseError");

    const cancelExpense =
        document.getElementById("cancelExpense");

    const saveExpense =
        document.getElementById("saveExpense");


    // =====================================================
    // STATE
    // =====================================================

    let transactions = [];


    // =====================================================
    // FORMAT RUPIAH
    // =====================================================

    function formatRupiah(value) {

        const number = Number(value) || 0;

        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }).format(number);
    }


    // =====================================================
    // FORMAT TANGGAL
    // =====================================================

    function formatDate(dateValue) {

        if (!dateValue) {
            return "-";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }


    // =====================================================
    // FORMAT JAM
    // =====================================================

    function formatTime(dateValue) {

        if (!dateValue) {
            return "-";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    // =====================================================
    // ESCAPE HTML
    // =====================================================

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    // =====================================================
    // LABEL METODE PEMBAYARAN
    // =====================================================

    function paymentLabel(method) {

        const value = String(method || "").toUpperCase();

        switch (value) {

            case "CASH":
                return "Cash";

            case "TRANSFER":
                return "Transfer";

            case "QRIS":
                return "QRIS";

            default:
                return method || "-";
        }
    }


    // =====================================================
    // LABEL JENIS TRANSAKSI
    // =====================================================

    function typeLabel(type) {

        const value = String(type || "").toUpperCase();

        if (value === "IN") {
            return "Kas Masuk";
        }

        if (value === "OUT") {
            return "Kas Keluar";
        }

        return "-";
    }


    // =====================================================
    // LOAD USER
    // =====================================================

    async function loadUser() {

        try {

            const response = await fetch("api/me");

            if (!response.ok) {
                return;
            }

            const result = await response.json();

            const user =
                result.user ||
                result.data ||
                result;

            const username =
                document.getElementById("ownerName");

            if (username && user) {

                username.textContent =
                    user.full_name ||
                    user.username ||
                    "Owner";
            }

        } catch (error) {

            console.error(
                "Gagal mengambil data user:",
                error
            );
        }
    }


    // =====================================================
    // BUILD QUERY
    // =====================================================

    function buildQuery() {

        const params = new URLSearchParams();

        if (startDate && startDate.value) {
            params.set(
                "start_date",
                startDate.value
            );
        }

        if (endDate && endDate.value) {
            params.set(
                "end_date",
                endDate.value
            );
        }

        if (
            typeFilter &&
            typeFilter.value &&
            typeFilter.value !== "ALL"
        ) {
            params.set(
                "type",
                typeFilter.value
            );
        }

        if (
            paymentFilter &&
            paymentFilter.value &&
            paymentFilter.value !== "ALL"
        ) {
            params.set(
                "payment_method",
                paymentFilter.value
            );
        }

        const query = params.toString();

        return query
            ? `?${query}`
            : "";
    }


    // =====================================================
    // LOAD TRANSACTIONS
    // =====================================================

    async function loadTransactions() {

        try {

            cashTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-row">
                        Memuat transaksi...
                    </td>
                </tr>
            `;

            const query = buildQuery();

            const response = await fetch(
                `api/cash-transactions${query}`
            );

            const result = await response.json();

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Gagal mengambil data kas"
                );
            }

            transactions =
                result.data ||
                result.transactions ||
                result.rows ||
                result;

            if (!Array.isArray(transactions)) {
                transactions = [];
            }

            renderTransactions();

        } catch (error) {

            console.error(
                "LOAD CASH ERROR:",
                error
            );

            cashTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-row">
                        Gagal memuat transaksi kas.
                    </td>
                </tr>
            `;

            resetStats();
        }
    }


    // =====================================================
    // RENDER TRANSACTIONS
    // =====================================================

    function renderTransactions() {

        let totalIn = 0;
        let totalOut = 0;

        transactions.forEach(transaction => {

            const amount =
                Number(transaction.amount) || 0;

            const type =
                String(
                    transaction.transaction_type ||
                    transaction.type ||
                    ""
                ).toUpperCase();

            if (type === "IN") {
                totalIn += amount;
            }

            if (type === "OUT") {
                totalOut += amount;
            }
        });

        const balance = totalIn - totalOut;

        // Stats utama
        if (saldoKas) {
            saldoKas.textContent =
                formatRupiah(balance);
        }

        if (kasMasuk) {
            kasMasuk.textContent =
                formatRupiah(totalIn);
        }

        if (kasKeluar) {
            kasKeluar.textContent =
                formatRupiah(totalOut);
        }

        if (arusKas) {
            arusKas.textContent =
                formatRupiah(balance);
        }

        // Summary
        if (totalMasuk) {
            totalMasuk.textContent =
                formatRupiah(totalIn);
        }

        if (totalKeluar) {
            totalKeluar.textContent =
                formatRupiah(totalOut);
        }

        if (totalTransaksi) {
            totalTransaksi.textContent =
                transactions.length;
        }

        // Info
        if (tableInfo) {

            tableInfo.textContent =
                `${transactions.length} transaksi`;
        }

        // Table
        if (!transactions.length) {

            cashTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-row">
                        Belum ada transaksi kas.
                    </td>
                </tr>
            `;

            return;
        }

        cashTableBody.innerHTML =
            transactions
                .map(
                    (transaction, index) =>
                        renderTransactionRow(
                            transaction,
                            index
                        )
                )
                .join("");
    }


    // =====================================================
    // RENDER ROW
    // =====================================================

    function renderTransactionRow(
        transaction,
        index
    ) {

        const type =
            String(
                transaction.transaction_type ||
                transaction.type ||
                ""
            ).toUpperCase();

        const amount =
            Number(transaction.amount) || 0;

        const date =
            transaction.transaction_date ||
            transaction.created_at;

        const paymentMethod =
            transaction.payment_method ||
            "-";

        const description =
            transaction.description ||
            "-";

        const referenceType =
            transaction.reference_type ||
            "";

        let badgeClass = "type-out";
        let amountClass = "amount-out";
        let amountSign = "-";

        if (type === "IN") {

            badgeClass = "type-in";
            amountClass = "amount-in";
            amountSign = "+";
        }

        let source = typeLabel(type);

        if (referenceType) {

            source =
                escapeHtml(referenceType);
        }

        return `
            <tr>

                <td>
                    <div class="date-main">
                        ${formatDate(date)}
                    </div>

                    <div class="date-time">
                        ${formatTime(date)}
                    </div>
                </td>

                <td>
                    <span class="type-badge ${badgeClass}">
                        ${type === "IN"
                            ? "MASUK"
                            : "KELUAR"}
                    </span>
                </td>

                <td>
                    <div class="transaction-description">
                        ${escapeHtml(description)}
                    </div>
                </td>

                <td>
                    <span class="payment-badge">
                        ${escapeHtml(
                            paymentLabel(paymentMethod)
                        )}
                    </span>
                </td>

                <td>
                    <span class="reference-badge">
                        ${source}
                    </span>
                </td>

                <td class="${amountClass}">
                    ${amountSign}
                    ${formatRupiah(amount)}
                </td>

                <td>
                    <span class="row-number">
                        ${index + 1}
                    </span>
                </td>

            </tr>
        `;
    }


    // =====================================================
    // RESET STATS
    // =====================================================

    function resetStats() {

        if (saldoKas) {
            saldoKas.textContent =
                formatRupiah(0);
        }

        if (kasMasuk) {
            kasMasuk.textContent =
                formatRupiah(0);
        }

        if (kasKeluar) {
            kasKeluar.textContent =
                formatRupiah(0);
        }

        if (arusKas) {
            arusKas.textContent =
                formatRupiah(0);
        }

        if (totalMasuk) {
            totalMasuk.textContent =
                formatRupiah(0);
        }

        if (totalKeluar) {
            totalKeluar.textContent =
                formatRupiah(0);
        }

        if (totalTransaksi) {
            totalTransaksi.textContent =
                "0";
        }

        if (tableInfo) {
            tableInfo.textContent =
                "0 transaksi";
        }
    }


    // =====================================================
    // DEFAULT DATE
    // =====================================================

    function setDefaultDate() {

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        if (expenseDate) {
            expenseDate.value = today;
        }
    }


    // =====================================================
    // OPEN EXPENSE MODAL
    // =====================================================

    function openExpenseModal() {

        if (!expenseModal) {
            return;
        }

        if (expenseForm) {
            expenseForm.reset();
        }

        setDefaultDate();

        if (expensePayment) {
            expensePayment.value = "CASH";
        }

        if (expenseError) {
            expenseError.textContent = "";
            expenseError.style.display = "none";
        }

        expenseModal.classList.add("show");

        setTimeout(() => {

            if (expenseCategory) {
                expenseCategory.focus();
            }

        }, 100);
    }


    // =====================================================
    // CLOSE EXPENSE MODAL
    // =====================================================

    function closeExpense() {

        if (!expenseModal) {
            return;
        }

        expenseModal.classList.remove("show");
    }


    // =====================================================
    // SAVE EXPENSE
    // =====================================================

    async function saveExpenseData(event) {

        event.preventDefault();

        if (!expenseDate.value) {

            showExpenseError(
                "Tanggal pengeluaran wajib diisi."
            );

            return;
        }

        if (!expenseDescription.value.trim()) {

            showExpenseError(
                "Keterangan pengeluaran wajib diisi."
            );

            expenseDescription.focus();

            return;
        }

        const amount =
            Number(
                expenseAmount.value
            );

        if (!amount || amount <= 0) {

            showExpenseError(
                "Nominal pengeluaran harus lebih dari Rp0."
            );

            expenseAmount.focus();

            return;
        }

        if (
            !expensePayment.value
        ) {

            showExpenseError(
                "Metode pembayaran wajib dipilih."
            );

            return;
        }

        const payload = {

            transaction_date:
                expenseDate.value,

            category:
                expenseCategory
                    ? expenseCategory.value
                    : "LAINNYA",

            description:
                expenseDescription
                    .value
                    .trim(),

            amount,

            payment_method:
                expensePayment.value,

            notes:
                expenseNotes
                    ? expenseNotes.value.trim()
                    : ""
        };


        try {

            saveExpense.disabled = true;

            saveExpense.textContent =
                "Menyimpan...";

            if (expenseError) {

                expenseError.textContent =
                    "";

                expenseError.style.display =
                    "none";
            }


            const response = await fetch(
                "api/cash-transactions/expense",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );

            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Gagal menyimpan pengeluaran."
                );
            }


            closeExpense();

            await loadTransactions();


            alert(
                "Pengeluaran berhasil disimpan."
            );


        } catch (error) {

            console.error(
                "SAVE EXPENSE ERROR:",
                error
            );

            showExpenseError(
                error.message ||
                "Gagal menyimpan pengeluaran."
            );


        } finally {

            saveExpense.disabled =
                false;

            saveExpense.textContent =
                "Simpan Pengeluaran";
        }
    }


    // =====================================================
    // ERROR MODAL
    // =====================================================

    function showExpenseError(message) {

        if (!expenseError) {

            alert(message);

            return;
        }

        expenseError.textContent =
            message;

        expenseError.style.display =
            "block";
    }


    // =====================================================
    // FILTER
    // =====================================================

    if (btnFilter) {

        btnFilter.addEventListener(
            "click",
            () => {

                loadTransactions();
            }
        );
    }


    // =====================================================
    // RESET FILTER
    // =====================================================

    if (btnResetFilter) {

        btnResetFilter.addEventListener(
            "click",
            () => {

                if (startDate) {
                    startDate.value = "";
                }

                if (endDate) {
                    endDate.value = "";
                }

                if (typeFilter) {
                    typeFilter.value = "ALL";
                }

                if (paymentFilter) {
                    paymentFilter.value = "ALL";
                }

                loadTransactions();
            }
        );
    }


    // =====================================================
    // OPEN MODAL
    // =====================================================

    if (btnTambahPengeluaran) {

        btnTambahPengeluaran.addEventListener(
            "click",
            openExpenseModal
        );
    }


    // =====================================================
    // CLOSE MODAL
    // =====================================================

    if (closeExpenseModal) {

        closeExpenseModal.addEventListener(
            "click",
            closeExpense
        );
    }


    if (cancelExpense) {

        cancelExpense.addEventListener(
            "click",
            closeExpense
        );
    }


    // =====================================================
    // CLICK OUTSIDE MODAL
    // =====================================================

    if (expenseModal) {

        expenseModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    expenseModal
                ) {
                    closeExpense();
                }
            }
        );
    }


    // =====================================================
    // ESC CLOSE MODAL
    // =====================================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                expenseModal &&
                expenseModal.classList.contains("show")
            ) {

                closeExpense();
            }
        }
    );


    // =====================================================
    // FORM SUBMIT
    // =====================================================

    if (expenseForm) {

        expenseForm.addEventListener(
            "submit",
            saveExpenseData
        );
    }


    // =====================================================
    // AUTO FORMAT NOMINAL
    // =====================================================

    if (expenseAmount) {

        expenseAmount.addEventListener(
            "input",
            () => {

                let value =
                    expenseAmount.value
                        .replace(/\D/g, "");

                if (value) {

                    expenseAmount.value =
                        Number(value);
                }
            }
        );
    }


    // =====================================================
    // SIDEBAR SUBMENU
    // =====================================================

    const submenuButtons =
        document.querySelectorAll(
            ".submenu-toggle"
        );

    submenuButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const parent =
                    button.closest(
                        ".menu-group"
                    );

                if (!parent) {
                    return;
                }

                parent.classList.toggle(
                    "open"
                );
            }
        );
    });


    // =====================================================
    // LOGOUT
    // =====================================================

    const logoutButton =
        document.getElementById("logoutBtn");

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    await fetch(
                        "api/logout",
                        {
                            method: "POST"
                        }
                    );

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                } finally {

                    window.location.href =
                        "login.html";
                }
            }
        );
    }


    // =====================================================
    // INIT
    // =====================================================

    async function init() {

        await loadUser();

        setDefaultDate();

        await loadTransactions();
    }


    init();

});

