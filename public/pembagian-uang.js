const API = "api";

let distributions = [];


// =====================================================
// ELEMENT
// =====================================================

const tableBody =
    document.getElementById("distributionTableBody");

const tableInfo =
    document.getElementById("tableInfo");

const saldoKas =
    document.getElementById("saldoKas");

const pembagianHariIni =
    document.getElementById("pembagianHariIni");

const totalPembagian =
    document.getElementById("totalPembagian");

const jumlahTransaksi =
    document.getElementById("jumlahTransaksi");

const modal =
    document.getElementById("distributionModal");

const form =
    document.getElementById("distributionForm");

const formError =
    document.getElementById("formError");


// =====================================================
// FORMAT RUPIAH
// =====================================================

function rupiah(value) {

    return "Rp " + Number(value || 0)
        .toLocaleString("id-ID");

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
// FORMAT TANGGAL
// =====================================================

function formatDate(value) {

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


// =====================================================
// CEK LOGIN
// =====================================================

async function checkLogin() {

    try {

        const response =
            await fetch(`${API}/me`);

        if (!response.ok) {
            throw new Error("Belum login");
        }

        const result =
            await response.json();

        const user =
            result.user || result.data || result;

        if (user) {

            document.getElementById("ownerName")
                .textContent =
                user.full_name ||
                user.username ||
                "Owner AN-NAFIQ BENGKEL";

            document.getElementById("ownerRole")
                .textContent =
                user.role ||
                "Administrator";
        }

    } catch (error) {

        window.location.href =
            "login.html";

    }

}


// =====================================================
// LOAD DATA
// =====================================================

async function loadDistributions() {

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading">
                Memuat data...
            </td>
        </tr>
    `;

    try {

        const params =
            new URLSearchParams();

        const startDate =
            document.getElementById("startDate").value;

        const endDate =
            document.getElementById("endDate").value;

        const category =
            document.getElementById("categoryFilter").value;

        if (startDate) {
            params.set(
                "start_date",
                startDate
            );
        }

        if (endDate) {
            params.set(
                "end_date",
                endDate
            );
        }

        if (category) {
            params.set(
                "category",
                category
            );
        }

        const query =
            params.toString();

        const response =
            await fetch(
                `${API}/money-distributions${query ? "?" + query : ""}`
            );

        const result =
            await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Gagal mengambil data"
            );
        }

        distributions =
            result.data || [];

        renderTable();

        updateStats();

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

        tableInfo.textContent =
            "Gagal memuat data";

    }

}


// =====================================================
// RENDER TABLE
// =====================================================

function renderTable() {

    const keyword =
        document.getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();

    let filtered =
        distributions.filter(item => {

            if (!keyword) {
                return true;
            }

            return (
                String(item.recipient || "")
                    .toLowerCase()
                    .includes(keyword)
                ||
                String(item.description || "")
                    .toLowerCase()
                    .includes(keyword)
                ||
                String(item.distribution_number || "")
                    .toLowerCase()
                    .includes(keyword)
            );

        });


    if (filtered.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    Belum ada pembagian uang.
                </td>
            </tr>
        `;

        tableInfo.textContent =
            "0 transaksi";

        return;
    }


    tableBody.innerHTML =
        filtered.map(item => {

            return `
                <tr>

                    <td>
                        ${formatDate(item.distribution_date)}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                item.distribution_number
                            )}
                        </strong>
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                item.recipient
                            )}
                        </strong>
                    </td>

                    <td>
                        <span class="badge badge-category">
                            ${escapeHtml(
                                item.category
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="badge badge-method">
                            ${escapeHtml(
                                item.payment_method
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(
                            item.description || "-"
                        )}
                    </td>

                    <td class="amount">
                        - ${rupiah(item.amount)}
                    </td>

                    <td>

                        <button
                            class="btn-detail"
                            onclick="showDetail('${item.id}')"
                        >
                            Detail
                        </button>

                        <button
                            class="btn-delete"
                            onclick="deleteDistribution('${item.id}')"
                        >
                            Hapus
                        </button>

                    </td>

                </tr>
            `;

        }).join("");


    tableInfo.textContent =
        `${filtered.length} transaksi`;

}


// =====================================================
// UPDATE STATS
// =====================================================

function updateStats() {

    const total =
        distributions.reduce(
            (sum, item) =>
                sum + Number(item.amount || 0),
            0
        );

    const today =
        new Date().toISOString().slice(0, 10);

    const todayTotal =
        distributions
            .filter(item => {

                if (!item.distribution_date) {
                    return false;
                }

                return new Date(item.distribution_date)
                    .toISOString()
                    .slice(0, 10) === today;

            })
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );


    totalPembagian.textContent =
        rupiah(total);

    pembagianHariIni.textContent =
        rupiah(todayTotal);

    jumlahTransaksi.textContent =
        distributions.length;


    loadCashBalance();

}


// =====================================================
// LOAD SALDO KAS
// =====================================================

async function loadCashBalance() {

    try {

        const response =
            await fetch(
                `${API}/cash-summary`
            );

        const result =
            await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Gagal mengambil saldo kas"
            );
        }

        const balance =
            Number(
                result.balance ??
                result.saldo ??
                result.data?.balance ??
                0
            );

        saldoKas.textContent =
            rupiah(balance);

    } catch (error) {

        console.error(
            "SALDO KAS ERROR:",
            error
        );

        saldoKas.textContent =
            "Rp 0";

    }

}


// =====================================================
// MODAL
// =====================================================

function openModal() {

    modal.classList.add("show");

    formError.classList.remove("show");

    formError.textContent = "";

    document.getElementById(
        "distributionDate"
    ).value =
        new Date()
            .toISOString()
            .slice(0, 10);

    document.getElementById(
        "recipient"
    ).focus();

}


function closeModal() {

    modal.classList.remove("show");

    form.reset();

    formError.classList.remove("show");

    formError.textContent = "";

}


// =====================================================
// TAMBAH DATA
// =====================================================

async function saveDistribution(event) {

    event.preventDefault();

    formError.classList.remove("show");

    formError.textContent = "";


    const data = {

        distribution_date:
            document.getElementById(
                "distributionDate"
            ).value,

        recipient:
            document.getElementById(
                "recipient"
            ).value.trim(),

        category:
            document.getElementById(
                "category"
            ).value,

        amount:
            Number(
                document.getElementById(
                    "amount"
                ).value
            ),

        payment_method:
            document.getElementById(
                "paymentMethod"
            ).value,

        description:
            document.getElementById(
                "description"
            ).value.trim(),

        notes:
            document.getElementById(
                "notes"
            ).value.trim()

    };


    if (!data.recipient) {

        showFormError(
            "Penerima wajib diisi."
        );

        return;
    }


    if (!data.category) {

        showFormError(
            "Kategori wajib dipilih."
        );

        return;
    }


    if (!Number.isFinite(data.amount) ||
        data.amount <= 0) {

        showFormError(
            "Nominal pembagian tidak valid."
        );

        return;
    }


    if (!data.description) {

        showFormError(
            "Keterangan wajib diisi."
        );

        return;
    }


    const button =
        document.getElementById(
            "saveDistribution"
        );

    button.disabled = true;

    button.textContent =
        "Menyimpan...";


    try {

        const response =
            await fetch(
                `${API}/money-distributions`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(data)
                }
            );


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Gagal menyimpan pembagian"
            );
        }


        alert(
            "Pembagian uang berhasil disimpan."
        );

        closeModal();

        await loadDistributions();

    } catch (error) {

        console.error(error);

        showFormError(
            error.message
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Simpan Pembagian";

    }

}


function showFormError(message) {

    formError.textContent =
        message;

    formError.classList.add("show");

}


// =====================================================
// DETAIL
// =====================================================

function showDetail(id) {

    const item =
        distributions.find(
            x => String(x.id) === String(id)
        );

    if (!item) {
        return;
    }

    alert(
        "DETAIL PEMBAGIAN\n\n" +

        "Nomor: " +
        item.distribution_number +

        "\nTanggal: " +
        formatDate(
            item.distribution_date
        ) +

        "\nPenerima: " +
        item.recipient +

        "\nKategori: " +
        item.category +

        "\nMetode: " +
        item.payment_method +

        "\nNominal: " +
        rupiah(item.amount) +

        "\nKeterangan: " +
        (item.description || "-") +

        "\nCatatan: " +
        (item.notes || "-")
    );

}


// =====================================================
// DELETE
// =====================================================

async function deleteDistribution(id) {

    const item =
        distributions.find(
            x => String(x.id) === String(id)
        );

    if (!item) {
        return;
    }


    const confirmed =
        confirm(
            `Hapus pembagian ${rupiah(item.amount)} untuk ${item.recipient}?\n\n` +
            "Transaksi kas terkait juga akan dikembalikan."
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API}/money-distributions/${id}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Gagal menghapus pembagian"
            );
        }


        alert(
            "Pembagian berhasil dihapus."
        );


        await loadDistributions();


    } catch (error) {

        console.error(error);

        alert(
            error.message
        );

    }

}


// =====================================================
// SEARCH
// =====================================================

document.getElementById(
    "searchInput"
).addEventListener(
    "input",
    renderTable
);


// =====================================================
// FILTER
// =====================================================

document.getElementById(
    "btnFilter"
).addEventListener(
    "click",
    loadDistributions
);


document.getElementById(
    "btnReset"
).addEventListener(
    "click",
    () => {

        document.getElementById(
            "startDate"
        ).value = "";

        document.getElementById(
            "endDate"
        ).value = "";

        document.getElementById(
            "categoryFilter"
        ).value = "";

        document.getElementById(
            "searchInput"
        ).value = "";

        loadDistributions();

    }
);


// =====================================================
// MODAL EVENT
// =====================================================

document.getElementById(
    "btnTambahPembagian"
).addEventListener(
    "click",
    openModal
);


document.getElementById(
    "closeModal"
).addEventListener(
    "click",
    closeModal
);


document.getElementById(
    "cancelModal"
).addEventListener(
    "click",
    closeModal
);


modal.addEventListener(
    "click",
    event => {

        if (event.target === modal) {
            closeModal();
        }

    }
);


form.addEventListener(
    "submit",
    saveDistribution
);


// =====================================================
// LOGOUT
// =====================================================

document.getElementById(
    "logoutBtn"
).addEventListener(
    "click",
    async () => {

        try {

            await fetch(
                `${API}/logout`,
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


// =====================================================
// SUBMENU
// =====================================================

document.querySelectorAll(
    ".menu-toggle"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const submenu =
                button.nextElementSibling;

            if (!submenu) {
                return;
            }

            submenu.style.display =
                submenu.style.display === "block"
                    ? "none"
                    : "block";

        }
    );

});


// =====================================================
// START
// =====================================================

(async function init() {

    await checkLogin();

    await loadDistributions();

})();