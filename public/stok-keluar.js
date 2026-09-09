// =====================================================
// STOK KELUAR - AN-NAFIQ BENGKEL
// =====================================================

console.log("stok-keluar.js berhasil dimuat");

let daftarProduk = [];
let stokKeluarData = [];

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("stockOutForm");
    const productSelect = document.getElementById("stockOutProduct");
    const currentStock = document.getElementById("currentStock");
    const quantityInput = document.getElementById("stockOutQuantity");
    const dateInput = document.getElementById("stockOutDate");
    const reasonInput = document.getElementById("stockOutReason");
    const notesInput = document.getElementById("stockOutNotes");

    if (!form) {
        console.error("Form stockOutForm tidak ditemukan");
        return;
    }

    // =================================================
    // TANGGAL DEFAULT
    // =================================================

    if (dateInput) {
        dateInput.value = getToday();
    }

    // =================================================
    // LOAD DATA AWAL
    // =================================================

    loadProduk();
    loadStokKeluar();

    // =================================================
    // PILIH PRODUK
    // =================================================

    if (productSelect) {

        productSelect.addEventListener("change", () => {

            const productId = productSelect.value;

            const produk = daftarProduk.find(
                item => String(item.id) === String(productId)
            );

            if (!produk) {
                currentStock.value = "0";
                return;
            }

            currentStock.value =
                `${formatNumber(produk.stock)} ${produk.unit_name || ""}`;

        });

    }

    // =================================================
    // CEK JUMLAH STOK
    // =================================================

    if (quantityInput) {

        quantityInput.addEventListener("input", () => {

            const productId = productSelect.value;
            const quantity = Number(quantityInput.value);

            const produk = daftarProduk.find(
                item => String(item.id) === String(productId)
            );

            if (!produk) return;

            const stock = Number(produk.stock || 0);

            if (quantity > stock) {

                quantityInput.setCustomValidity(
                    `Stok tersedia hanya ${formatNumber(stock)}`
                );

            } else {

                quantityInput.setCustomValidity("");

            }

        });

    }

    // =================================================
    // SUBMIT STOK KELUAR
    // =================================================

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const productId = productSelect.value;
        const quantity = Number(quantityInput.value);
        const stockDate = dateInput.value;
        const reason = reasonInput
            ? reasonInput.value.trim()
            : "";
        const notes = notesInput
            ? notesInput.value.trim()
            : "";

        // ---------------------------------------------
        // VALIDASI PRODUK
        // ---------------------------------------------

        if (!productId) {

            alert("Pilih produk terlebih dahulu.");

            return;

        }

        // ---------------------------------------------
        // VALIDASI JUMLAH
        // ---------------------------------------------

        if (
            !Number.isFinite(quantity) ||
            quantity <= 0
        ) {

            alert(
                "Jumlah stok keluar harus lebih dari 0."
            );

            return;

        }

        // ---------------------------------------------
        // CARI PRODUK
        // ---------------------------------------------

        const produk = daftarProduk.find(
            item => String(item.id) === String(productId)
        );

        if (!produk) {

            alert("Produk tidak ditemukan.");

            return;

        }

        const stokSekarang =
            Number(produk.stock || 0);

        // ---------------------------------------------
        // CEK STOK
        // ---------------------------------------------

        if (quantity > stokSekarang) {

            alert(
                "Stok tidak cukup.\n\n" +
                `Stok tersedia: ${formatNumber(stokSekarang)}\n` +
                `Jumlah keluar: ${formatNumber(quantity)}`
            );

            return;

        }

        // ---------------------------------------------
        // SIAPKAN CATATAN
        // ---------------------------------------------

        const noteParts = [];

        if (reason) {

            noteParts.push(
                `Alasan: ${reason}`
            );

        }

        if (notes) {

            noteParts.push(
                `Catatan: ${notes}`
            );

        }

        const finalNotes =
            noteParts.join(" | ");

        // ---------------------------------------------
        // SIMPAN
        // ---------------------------------------------

        try {

            const response =
                await fetch(
                    "/api/stock-out",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({

                            product_id:
                                productId,

                            quantity:
                                quantity,

                            stock_date:
                                stockDate,

                            notes:
                                finalNotes

                        })

                    }
                );


            const result =
                await response.json();


            // -----------------------------------------
            // SESSION HABIS
            // -----------------------------------------

            if (response.status === 401) {

                window.location.href =
                    "index.html";

                return;

            }


            // -----------------------------------------
            // ERROR
            // -----------------------------------------

            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Gagal menyimpan stok keluar."
                );

            }


            // -----------------------------------------
            // HASIL
            // -----------------------------------------

            alert(
                "Stok keluar berhasil disimpan.\n\n" +

                `Produk: ${produk.name}\n` +

                `Jumlah: ${formatNumber(quantity)}\n` +

                `Stok sebelumnya: ${formatNumber(stokSekarang)}\n` +

                `Stok sekarang: ${
                    formatNumber(
                        result.stock_after
                    )
                }`
            );


            // -----------------------------------------
            // RESET FORM
            // -----------------------------------------

            form.reset();


            if (dateInput) {

                dateInput.value =
                    getToday();

            }


            if (currentStock) {

                currentStock.value =
                    "0";

            }


            // -----------------------------------------
            // LOAD ULANG
            // -----------------------------------------

            await loadProduk();

            await loadStokKeluar();


        } catch (error) {

            console.error(
                "ERROR STOK KELUAR:",
                error
            );

            alert(
                error.message ||
                "Terjadi kesalahan saat menyimpan stok keluar."
            );

        }

    });

});


// =====================================================
// LOAD PRODUK
// =====================================================

async function loadProduk() {

    try {

        const response =
            await fetch(
                "/api/products",
                {
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;

        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Gagal mengambil data produk."
            );

        }


        daftarProduk =
            Array.isArray(data)
                ? data
                : (data.data || []);


        daftarProduk =
            daftarProduk.filter(
                produk =>
                    produk.active !== false
            );


        renderProduk();


    } catch (error) {

        console.error(
            "GAGAL LOAD PRODUK:",
            error
        );

        daftarProduk = [];

        renderProduk();

    }

}


// =====================================================
// RENDER PRODUK
// =====================================================

function renderProduk() {

    const select =
        document.getElementById(
            "stockOutProduct"
        );

    if (!select) return;


    select.innerHTML = `
        <option value="">
            Pilih produk
        </option>
    `;


    daftarProduk.forEach(produk => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            produk.id;


        option.textContent =
            `${produk.name} | Stok: ${
                formatNumber(produk.stock)
            } ${
                produk.unit_name || ""
            }`;


        select.appendChild(
            option
        );

    });

}


// =====================================================
// LOAD RIWAYAT STOK KELUAR
// =====================================================

async function loadStokKeluar() {

    try {

        const response =
            await fetch(
                "/api/stock-out",
                {
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;

        }


        const result =
            await response.json();


        console.log(
            "RIWAYAT STOK KELUAR:",
            result
        );


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Gagal mengambil riwayat stok keluar."
            );

        }


        if (
            result &&
            result.success === true &&
            Array.isArray(result.data)
        ) {

            stokKeluarData =
                result.data;

        } else if (
            Array.isArray(result)
        ) {

            stokKeluarData =
                result;

        } else {

            stokKeluarData = [];

        }


        renderStokKeluar();


    } catch (error) {

        console.error(
            "LOAD STOK KELUAR ERROR:",
            error
        );

        stokKeluarData = [];

        renderStokKeluar();

    }

}


// =====================================================
// RENDER RIWAYAT
// =====================================================

function renderStokKeluar() {

    const tbody =
        document.getElementById(
            "stockOutTableBody"
        );

    if (!tbody) return;


    if (
        !stokKeluarData ||
        stokKeluarData.length === 0
    ) {

        tbody.innerHTML = `
            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >

                    Belum ada riwayat stok keluar

                    <div
                        style="
                            margin-top:8px;
                            color:#777;
                        "
                    >
                        Data stok keluar akan muncul di sini.
                    </div>

                </td>

            </tr>
        `;

        return;

    }


    tbody.innerHTML =
        stokKeluarData.map(
            (item, index) => {

                const quantity =
                    Number(
                        item.quantity_out || 0
                    );


                const unitCost =
                    Number(
                        item.unit_cost || 0
                    );


                const totalCost =
                    quantity * unitCost;


                const balanceAfter =
                    Number(
                        item.balance_after ?? 0
                    );


                const reason =
                    extractReason(
                        item.notes
                    );


                const notes =
                    extractNotes(
                        item.notes
                    );


                return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${formatTanggal(
                                item.movement_date
                            )}
                        </td>

                        <td>

                            <strong>
                                ${escapeHtml(
                                    item.product_name ||
                                    "-"
                                )}
                            </strong>

                            ${
                                item.product_code
                                    ? `
                                        <div
                                            style="
                                                font-size:12px;
                                                color:#777;
                                            "
                                        >
                                            ${escapeHtml(
                                                item.product_code
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </td>

                        <td>
                            ${formatNumber(
                                quantity
                            )}
                        </td>

                        <td>
                            Rp ${formatNumber(
                                unitCost
                            )}
                        </td>

                        <td>
                            Rp ${formatNumber(
                                totalCost
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                balanceAfter
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                notes !== "-"
                                    ? notes
                                    : reason
                            )}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// =====================================================
// TANGGAL HARI INI
// =====================================================

function getToday() {

    const today =
        new Date();


    const year =
        today.getFullYear();


    const month =
        String(
            today.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            today.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


// =====================================================
// FORMAT ANGKA
// =====================================================

function formatNumber(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "id-ID",
        {
            maximumFractionDigits: 2
        }
    );

}


// =====================================================
// FORMAT TANGGAL
// =====================================================

function formatTanggal(value) {

    if (!value) return "-";


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

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
// AMBIL ALASAN
// =====================================================

function extractReason(notes) {

    if (!notes) return "-";


    const text =
        String(notes);


    const match =
        text.match(
            /Alasan:\s*(.*?)(?:\s*\|\s*Catatan:|$)/i
        );


    if (!match) {

        return "-";

    }


    return match[1].trim() || "-";

}


// =====================================================
// AMBIL CATATAN
// =====================================================

function extractNotes(notes) {

    if (!notes) return "-";


    const text =
        String(notes);


    const match =
        text.match(
            /Catatan:\s*(.*)$/i
        );


    if (!match) {

        return "-";

    }


    return match[1].trim() || "-";

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}