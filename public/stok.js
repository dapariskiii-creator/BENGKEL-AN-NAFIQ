
console.log("stok.js berhasil dimuat");

let daftarProduk = [];
let stokMasukData = [];

document.addEventListener("DOMContentLoaded", () => {

    // ================================
    // ELEMENT
    // ================================

    const form = document.getElementById("stockInForm");
    const productSelect = document.getElementById("stockProduct");
    const qtyInput = document.getElementById("stockQuantity");
    const priceInput = document.getElementById("stockBuyPrice");
    const supplierInput = document.getElementById("stockSupplier");
    const invoiceInput = document.getElementById("stockInvoice");
    const dateInput = document.getElementById("stockDate");
    const notesInput = document.getElementById("stockNotes");

    // ================================
    // TANGGAL DEFAULT
    // ================================

    if (dateInput) {

        const sekarang = new Date();

        const tahun = sekarang.getFullYear();
        const bulan = String(
            sekarang.getMonth() + 1
        ).padStart(2, "0");

        const tanggal = String(
            sekarang.getDate()
        ).padStart(2, "0");

        dateInput.value =
            `${tahun}-${bulan}-${tanggal}`;
    }

    // ================================
    // LOAD PRODUK
    // ================================

    loadProduk();

    // ================================
    // SUBMIT STOK MASUK
    // ================================

    form?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const productId =
            productSelect?.value;

        const quantity =
            Number(qtyInput?.value || 0);

        const buyPrice =
            Number(priceInput?.value || 0);

        const supplier =
            supplierInput?.value.trim() || "";

        const invoice =
            invoiceInput?.value.trim() || "";

        const stockDate =
            dateInput?.value || "";

        const notes =
            notesInput?.value.trim() || "";


        // ================================
        // VALIDASI
        // ================================

        if (!productId) {
            alert("Produk wajib dipilih");
            return;
        }

        if (quantity <= 0) {
            alert("Jumlah stok harus lebih dari 0");
            return;
        }

        if (buyPrice < 0) {
            alert("Harga beli tidak boleh minus");
            return;
        }

        if (!stockDate) {
            alert("Tanggal wajib diisi");
            return;
        }


        // ================================
        // DATA
        // ================================

        const data = {

            product_id: productId,

            quantity,

            buy_price: buyPrice,

            supplier,

            invoice_number: invoice,

            stock_date: stockDate,

            notes

        };


        try {

            const response =
                await fetch("/api/stock-in", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(data)

                });


            const result =
                await response.json();


            if (!response.ok) {

                alert(
                    result.message ||
                    "Gagal menyimpan stok masuk"
                );

                console.error(result);

                return;
            }


            alert(
                "Stok masuk berhasil disimpan!"
            );


            form.reset();


            if (dateInput) {

                const sekarang = new Date();

                const tahun =
                    sekarang.getFullYear();

                const bulan =
                    String(
                        sekarang.getMonth() + 1
                    ).padStart(2, "0");

                const tanggal =
                    String(
                        sekarang.getDate()
                    ).padStart(2, "0");

                dateInput.value =
                    `${tahun}-${bulan}-${tanggal}`;
            }


            await loadProduk();

            await loadStokMasuk();


        } catch (error) {

            console.error(
                "STOK MASUK ERROR:",
                error
            );

            alert(
                "Gagal terhubung ke server"
            );

        }

    });


    // ================================
    // LOAD RIWAYAT
    // ================================

    loadStokMasuk();

});


// ========================================
// LOAD PRODUK
// ========================================

async function loadProduk() {

    const select =
        document.getElementById("stockProduct");

    if (!select) return;


    try {

        const response =
            await fetch("/api/products");


        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            console.error(data);

            return;
        }


        if (!Array.isArray(data)) {

            console.error(
                "Data produk bukan array:",
                data
            );

            return;
        }


        daftarProduk = data;


        select.innerHTML = `
            <option value="">
                -- Pilih Produk --
            </option>
        `;


        data.forEach(product => {

            const option =
                document.createElement("option");

            option.value =
                product.id;

            option.textContent =
                `${product.name} | Stok: ${Number(product.stock || 0)}`;

            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "LOAD PRODUK STOK ERROR:",
            error
        );

    }

}


// ========================================
// PRODUK DIPILIH
// ========================================

document.addEventListener(
    "change",
    (event) => {

        if (
            event.target.id !==
            "stockProduct"
        ) {
            return;
        }


        const product =
            daftarProduk.find(
                item =>
                    item.id ===
                    event.target.value
            );


        if (!product) return;


        const priceInput =
            document.getElementById(
                "stockBuyPrice"
            );


        if (priceInput) {

            priceInput.value =
                Number(
                    product.buy_price || 0
                );

        }


        const supplierInput =
            document.getElementById(
                "stockSupplier"
            );


        if (
            supplierInput &&
            product.supplier_name
        ) {

            supplierInput.value =
                product.supplier_name;

        }

    }
);


// ========================================
// LOAD RIWAYAT STOK MASUK
// ========================================

async function loadStokMasuk() {

    const table =
        document.getElementById(
            "stockInTableBody"
        );

    if (!table) return;


    try {

        const response =
            await fetch(
                "/api/stock-in"
            );


        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            console.error(data);

            return;
        }


        stokMasukData =
            Array.isArray(data)
                ? data
                : [];


        renderStokMasuk(
            stokMasukData
        );


    } catch (error) {

        console.error(
            "LOAD STOK MASUK ERROR:",
            error
        );

    }

}


// ========================================
// RENDER RIWAYAT
// ========================================

function renderStokMasuk(data) {

    const table =
        document.getElementById(
            "stockInTableBody"
        );


    if (!table) return;


    if (data.length === 0) {

        table.innerHTML = `
            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                    "
                >

                    📦

                    <br><br>

                    <strong>
                        Belum ada transaksi stok masuk
                    </strong>

                </td>

            </tr>
        `;

        return;
    }


    table.innerHTML =
        data.map(
            (item, index) => {

                const quantity =
                    Number(
                        item.quantity ||
                        item.qty ||
                        0
                    );


                const price =
                    Number(
                        item.buy_price ||
                        item.unit_price ||
                        0
                    );


                const total =
                    quantity * price;


                return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${formatTanggal(
                                item.stock_date ||
                                item.created_at
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                item.product_name ||
                                item.name ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${quantity}
                        </td>

                        <td>
                            ${formatRupiah(price)}
                        </td>

                        <td>
                            ${formatRupiah(total)}
                        </td>

                        <td>
                            ${escapeHtml(
                                item.supplier_name ||
                                item.supplier ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                item.invoice_number ||
                                item.invoice ||
                                "-"
                            )}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ========================================
// FORMAT TANGGAL
// ========================================

function formatTanggal(value) {

    if (!value) return "-";


    const tanggal =
        new Date(value);


    if (isNaN(tanggal.getTime())) {
        return value;
    }


    return tanggal.toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


// ========================================
// FORMAT RUPIAH
// ========================================

function formatRupiah(value) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(
        Number(value || 0)
    );

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {

    return String(value)

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

