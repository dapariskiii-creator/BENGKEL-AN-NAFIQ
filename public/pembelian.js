/* =====================================================
   PEMBELIAN - AN-NAFIQ BENGKEL
===================================================== */

console.log("✅ pembelian.js berhasil dimuat");

let daftarProduk = [];
let daftarSupplier = [];
let nomorItem = 0;


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    setTanggalHariIni();
    buatNomorPembelian();
    setupForm();

    await loadProduk();
    await loadSupplier();

    tambahItemPembelian();

    hitungTotal();
    aturJatuhTempo();
    hitungSisaHutang();

    await loadRiwayatPembelian();

});


/* =====================================================
   TANGGAL
===================================================== */

function setTanggalHariIni() {

    const input = document.getElementById("purchaseDate");

    if (!input) return;

    input.value = getToday();

}


/* =====================================================
   NOMOR PEMBELIAN
===================================================== */

function buatNomorPembelian() {

    const input = document.getElementById("purchaseNumber");

    if (!input) return;

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    const hour = String(
        now.getHours()
    ).padStart(2, "0");

    const minute = String(
        now.getMinutes()
    ).padStart(2, "0");

    const second = String(
        now.getSeconds()
    ).padStart(2, "0");

    input.value =
        `PUR-${year}${month}${day}-${hour}${minute}${second}`;

}


/* =====================================================
   SETUP FORM
===================================================== */

function setupForm() {

    const addButton =
        document.getElementById("addPurchaseItemButton");

    if (addButton) {

        addButton.addEventListener(
            "click",
            tambahItemPembelian
        );

    }


    const form =
        document.getElementById("purchaseForm");

    if (form) {

        form.addEventListener(
            "submit",
            simpanPembelian
        );

    }


    const discount =
        document.getElementById("purchaseDiscount");

    if (discount) {

        discount.addEventListener(
            "input",
            hitungTotal
        );

    }


    const additionalCost =
        document.getElementById("additionalCost");

    if (additionalCost) {

        additionalCost.addEventListener(
            "input",
            hitungTotal
        );

    }


    const paidAmount =
        document.getElementById("paidAmount");

    if (paidAmount) {

        paidAmount.addEventListener(
            "input",
            hitungSisaHutang
        );

    }


    const paymentStatus =
        document.getElementById("paymentStatus");

    if (paymentStatus) {

        paymentStatus.addEventListener(
            "change",
            () => {

                aturJatuhTempo();

                hitungSisaHutang();

            }
        );

    }


    const resetButton =
        document.getElementById("resetPurchaseButton");

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetFormPembelian
        );

    }


    const search =
        document.getElementById("searchPurchase");

    if (search) {

        search.addEventListener(
            "input",
            filterRiwayat
        );

    }


    const dateFrom =
        document.getElementById("purchaseDateFrom");

    if (dateFrom) {

        dateFrom.addEventListener(
            "change",
            filterRiwayat
        );

    }


    const dateTo =
        document.getElementById("purchaseDateTo");

    if (dateTo) {

        dateTo.addEventListener(
            "change",
            filterRiwayat
        );

    }


    const statusFilter =
        document.getElementById("purchaseStatusFilter");

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            filterRiwayat
        );

    }

}


/* =====================================================
   LOAD PRODUK
===================================================== */

async function loadProduk() {

    try {

        const response =
            await fetch(
                "/api/products",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        if (response.status === 401) {

            window.location.href = "index.html";

            return;

        }


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                result.error ||
                "Gagal mengambil produk"
            );

        }


        if (Array.isArray(result)) {

            daftarProduk = result;

        } else if (
            Array.isArray(result.data)
        ) {

            daftarProduk = result.data;

        } else {

            daftarProduk = [];

        }


        daftarProduk =
            daftarProduk.filter(
                product =>
                    product &&
                    product.active !== false
            );


        console.log(
            "✅ Produk ditemukan:",
            daftarProduk.length,
            daftarProduk
        );


        renderSemuaDropdownProduk();


    } catch (error) {

        console.error(
            "❌ LOAD PRODUK ERROR:",
            error
        );

        daftarProduk = [];

        renderSemuaDropdownProduk();

    }

}


/* =====================================================
   LOAD SUPPLIER
===================================================== */

async function loadSupplier() {

    const select =
        document.getElementById("supplier");


    if (!select) {

        console.error(
            "❌ Element #supplier tidak ditemukan"
        );

        return;

    }


    try {

        console.log(
            "🔄 Mengambil data supplier..."
        );


        const response =
            await fetch(
                "/api/suppliers",
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept": "application/json"
                    }

                }
            );


        console.log(
            "📡 Supplier API status:",
            response.status
        );


        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;

        }


        const result =
            await response.json();


        console.log(
            "📦 Supplier API result:",
            result
        );


        if (!response.ok) {

            throw new Error(
                result.message ||
                result.error ||
                "Gagal mengambil supplier"
            );

        }


        if (Array.isArray(result)) {

            daftarSupplier = result;

        } else if (
            result &&
            Array.isArray(result.data)
        ) {

            daftarSupplier = result.data;

        } else {

            daftarSupplier = [];

        }


        /*
         * Pastikan hanya supplier yang valid.
         */

        daftarSupplier =
            daftarSupplier.filter(
                supplier =>
                    supplier &&
                    supplier.id &&
                    supplier.name
            );


        console.log(
            "✅ Supplier ditemukan:",
            daftarSupplier.length,
            daftarSupplier
        );


        renderSupplier();


    } catch (error) {

        console.error(
            "❌ LOAD SUPPLIER ERROR:",
            error
        );


        /*
         * Jika API gagal,
         * coba ambil dari produk.
         */

        ambilSupplierDariProduk();

    }

}


/* =====================================================
   SUPPLIER DARI PRODUK
===================================================== */

function ambilSupplierDariProduk() {

    const map =
        new Map();


    daftarProduk.forEach(
        product => {

            const nama =
                String(
                    product.supplier_name || ""
                ).trim();


            if (!nama) return;


            const key =
                nama.toLowerCase();


            if (!map.has(key)) {

                map.set(
                    key,
                    {
                        id: nama,
                        name: nama
                    }
                );

            }

        }
    );


    daftarSupplier =
        Array.from(
            map.values()
        );


    renderSupplier();

}


/* =====================================================
   RENDER SUPPLIER
===================================================== */

function renderSupplier() {

    const select =
        document.getElementById("supplier");


    if (!select) {

        console.error(
            "❌ Select #supplier tidak ditemukan"
        );

        return;

    }


    const selected =
        select.value;


    /*
     * Bersihkan dropdown.
     */

    select.innerHTML = "";


    /*
     * Option default.
     */

    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";

    defaultOption.textContent =
        "Pilih supplier";


    select.appendChild(
        defaultOption
    );


    /*
     * Masukkan semua supplier.
     */

    daftarSupplier.forEach(
        supplier => {

            if (
                !supplier ||
                !supplier.id
            ) {

                return;

            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                String(
                    supplier.id
                );


            option.textContent =
                String(
                    supplier.name ||
                    "-"
                );


            select.appendChild(
                option
            );

        }
    );


    /*
     * Kembalikan pilihan sebelumnya
     * jika masih tersedia.
     */

    if (selected) {

        const exists =
            Array.from(
                select.options
            ).some(
                option =>
                    option.value === selected
            );


        if (exists) {

            select.value =
                selected;

        }

    }


    console.log(
        "🔎 OPTION SUPPLIER:",
        Array.from(
            select.options
        ).map(
            option => ({
                value: option.value,
                text: option.textContent
            })
        )
    );

}


/* =====================================================
   TAMBAH ITEM
===================================================== */

function tambahItemPembelian() {

    const tbody =
        document.getElementById(
            "purchaseItemsBody"
        );


    if (!tbody) return;


    nomorItem++;


    const row =
        document.createElement(
            "tr"
        );


    row.dataset.item =
        nomorItem;


    row.innerHTML = `

        <td>
            ${nomorItem}
        </td>

        <td>
            <select
                class="purchase-product"
                required
            >
                <option value="">
                    Pilih produk
                </option>

                ${buatOptionProduk()}

            </select>
        </td>

        <td>
            <input
                type="text"
                class="purchase-current-stock"
                value="0"
                readonly
            >
        </td>

        <td>
            <input
                type="number"
                class="purchase-quantity"
                min="0.01"
                step="0.01"
                value="1"
                required
            >
        </td>

        <td>
            <input
                type="number"
                class="purchase-price"
                min="0"
                step="0.01"
                value="0"
                required
            >
        </td>

        <td>
            <input
                type="number"
                class="purchase-discount"
                min="0"
                step="0.01"
                value="0"
            >
        </td>

        <td>
            <input
                type="text"
                class="purchase-subtotal"
                value="Rp 0"
                readonly
            >
        </td>

        <td>
            <button
                type="button"
                class="btn btn-secondary remove-purchase-item"
            >
                Hapus
            </button>
        </td>

    `;


    tbody.appendChild(
        row
    );


    pasangEventItem(
        row
    );


    updateTombolHapus();

    hitungSubtotalRow(
        row
    );

}


/* =====================================================
   OPTION PRODUK
===================================================== */

function buatOptionProduk() {

    return daftarProduk
        .map(
            product => {

                const stock =
                    Number(
                        product.stock || 0
                    );


                const unit =
                    product.unit_name ||
                    "";


                return `
                    <option value="${escapeHtml(
                        product.id
                    )}">
                        ${escapeHtml(
                            product.name || "-"
                        )}
                        | Stok:
                        ${formatNumber(
                            stock
                        )}
                        ${escapeHtml(
                            unit
                        )}
                    </option>
                `;

            }
        )
        .join("");

}


/* =====================================================
   EVENT ITEM
===================================================== */

function pasangEventItem(row) {

    const product =
        row.querySelector(
            ".purchase-product"
        );


    const quantity =
        row.querySelector(
            ".purchase-quantity"
        );


    const price =
        row.querySelector(
            ".purchase-price"
        );


    const discount =
        row.querySelector(
            ".purchase-discount"
        );


    const removeButton =
        row.querySelector(
            ".remove-purchase-item"
        );


    if (product) {

        product.addEventListener(
            "change",
            () => {

                isiDataProduk(
                    row
                );

                hitungSubtotalRow(
                    row
                );

            }
        );

    }


    if (quantity) {

        quantity.addEventListener(
            "input",
            () => {

                hitungSubtotalRow(
                    row
                );

            }
        );

    }


    if (price) {

        price.addEventListener(
            "input",
            () => {

                hitungSubtotalRow(
                    row
                );

            }
        );

    }


    if (discount) {

        discount.addEventListener(
            "input",
            () => {

                hitungSubtotalRow(
                    row
                );

            }
        );

    }


    if (removeButton) {

        removeButton.addEventListener(
            "click",
            () => {

                const rows =
                    document.querySelectorAll(
                        "#purchaseItemsBody tr"
                    );


                if (rows.length <= 1) {

                    tampilkanPesan(
                        "Minimal harus ada 1 produk.",
                        "error"
                    );

                    return;

                }


                row.remove();


                renumberItem();

                updateTombolHapus();

                hitungTotal();

            }
        );

    }

}


/* =====================================================
   ISI DATA PRODUK
===================================================== */

function isiDataProduk(row) {

    const select =
        row.querySelector(
            ".purchase-product"
        );


    const stockInput =
        row.querySelector(
            ".purchase-current-stock"
        );


    const priceInput =
        row.querySelector(
            ".purchase-price"
        );


    if (!select) return;


    const product =
        daftarProduk.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    select.value
                )
        );


    if (!product) {

        if (stockInput) {

            stockInput.value =
                "0";

        }


        if (priceInput) {

            priceInput.value =
                "0";

        }


        return;

    }


    if (stockInput) {

        stockInput.value =
            `${formatNumber(
                product.stock || 0
            )} ${
                product.unit_name || ""
            }`;

    }


    if (priceInput) {

        const harga =
            product.buy_price ??
            product.average_cost ??
            0;


        priceInput.value =
            Number(
                harga
            );

    }

}


/* =====================================================
   HITUNG SUBTOTAL BARIS
===================================================== */

function hitungSubtotalRow(row) {

    if (!row) return;


    const quantity =
        Number(
            row.querySelector(
                ".purchase-quantity"
            )?.value || 0
        );


    const price =
        Number(
            row.querySelector(
                ".purchase-price"
            )?.value || 0
        );


    const discount =
        Number(
            row.querySelector(
                ".purchase-discount"
            )?.value || 0
        );


    let subtotal =
        quantity * price;


    subtotal -= discount;


    if (subtotal < 0) {

        subtotal = 0;

    }


    const subtotalInput =
        row.querySelector(
            ".purchase-subtotal"
        );


    if (subtotalInput) {

        subtotalInput.value =
            `Rp ${formatNumber(
                subtotal
            )}`;

    }


    hitungTotal();

}


/* =====================================================
   HITUNG TOTAL
===================================================== */

function hitungTotal() {

    const rows =
        document.querySelectorAll(
            "#purchaseItemsBody tr"
        );


    let subtotal = 0;


    rows.forEach(
        row => {

            const quantity =
                Number(
                    row.querySelector(
                        ".purchase-quantity"
                    )?.value || 0
                );


            const price =
                Number(
                    row.querySelector(
                        ".purchase-price"
                    )?.value || 0
                );


            const discount =
                Number(
                    row.querySelector(
                        ".purchase-discount"
                    )?.value || 0
                );


            let value =
                quantity * price;


            value -= discount;


            if (value < 0) {

                value = 0;

            }


            subtotal += value;

        }
    );


    const purchaseDiscount =
        Number(
            document.getElementById(
                "purchaseDiscount"
            )?.value || 0
        );


    const additionalCost =
        Number(
            document.getElementById(
                "additionalCost"
            )?.value || 0
        );


    let total =
        subtotal -
        purchaseDiscount +
        additionalCost;


    if (total < 0) {

        total = 0;

    }


    const subtotalElement =
        document.getElementById(
            "purchaseSubtotal"
        );


    const totalElement =
        document.getElementById(
            "purchaseTotal"
        );


    if (subtotalElement) {

        const text =
            `Rp ${formatNumber(
                subtotal
            )}`;


        if (
            "value" in subtotalElement
        ) {

            subtotalElement.value =
                text;

        } else {

            subtotalElement.textContent =
                text;

        }

    }


    if (totalElement) {

        const text =
            `Rp ${formatNumber(
                total
            )}`;


        if (
            "value" in totalElement
        ) {

            totalElement.value =
                text;

        } else {

            totalElement.textContent =
                text;

        }

    }


    hitungSisaHutang();

}


/* =====================================================
   AMBIL TOTAL
===================================================== */

function ambilTotalPembelian() {

    const element =
        document.getElementById(
            "purchaseTotal"
        );


    if (!element) return 0;


    let value = "";


    if (
        "value" in element
    ) {

        value =
            element.value || "";

    } else {

        value =
            element.textContent || "";

    }


    const angka =
        String(value)
            .replace(
                /[^0-9]/g,
                ""
            );


    return Number(
        angka
    ) || 0;

}


/* =====================================================
   HITUNG SISA HUTANG
===================================================== */

function hitungSisaHutang() {

    const total =
        ambilTotalPembelian();


    const paid =
        Number(
            document.getElementById(
                "paidAmount"
            )?.value || 0
        );


    let remaining =
        total - paid;


    if (remaining < 0) {

        remaining = 0;

    }


    const element =
        document.getElementById(
            "remainingDebt"
        );


    if (!element) return;


    const text =
        `Rp ${formatNumber(
            remaining
        )}`;


    if ("value" in element) {

        element.value =
            text;

    } else {

        element.textContent =
            text;

    }

}


/* =====================================================
   JATUH TEMPO
===================================================== */

function aturJatuhTempo() {

    const status =
        document.getElementById(
            "paymentStatus"
        )?.value;


    const dueDate =
        document.getElementById(
            "dueDate"
        );


    if (!dueDate) return;


    if (
        status === "CREDIT" ||
        status === "PARTIAL"
    ) {

        dueDate.required =
            true;

    } else {

        dueDate.required =
            false;

        dueDate.value =
            "";

    }

}


/* =====================================================
   RENAME NOMOR ITEM
===================================================== */

function renumberItem() {

    const rows =
        document.querySelectorAll(
            "#purchaseItemsBody tr"
        );


    rows.forEach(
        (row, index) => {

            const cell =
                row.querySelector(
                    "td:first-child"
                );


            if (cell) {

                cell.textContent =
                    index + 1;

            }

        }
    );


    nomorItem =
        rows.length;

}


/* =====================================================
   UPDATE HAPUS
===================================================== */

function updateTombolHapus() {

    const buttons =
        document.querySelectorAll(
            ".remove-purchase-item"
        );


    buttons.forEach(
        button => {

            button.disabled =
                buttons.length <= 1;

        }
    );

}


/* =====================================================
   UPDATE DROPDOWN PRODUK
===================================================== */

function renderSemuaDropdownProduk() {

    const selects =
        document.querySelectorAll(
            ".purchase-product"
        );


    selects.forEach(
        select => {

            const selected =
                select.value;


            select.innerHTML = `
                <option value="">
                    Pilih produk
                </option>

                ${buatOptionProduk()}
            `;


            if (selected) {

                const exists =
                    Array.from(
                        select.options
                    ).some(
                        option =>
                            option.value ===
                            selected
                    );


                if (exists) {

                    select.value =
                        selected;

                }

            }

        }
    );

}


/* =====================================================
   SIMPAN PEMBELIAN
===================================================== */

async function simpanPembelian(event) {

    event.preventDefault();


    const supplierId =
        document.getElementById(
            "supplier"
        )?.value;


    const purchaseDate =
        document.getElementById(
            "purchaseDate"
        )?.value;


    const invoiceNumber =
        document.getElementById(
            "invoiceNumber"
        )?.value
        .trim() || "";


    const paymentMethod =
        document.getElementById(
            "paymentMethod"
        )?.value;


    const paymentStatus =
        document.getElementById(
            "paymentStatus"
        )?.value;


    const paidAmount =
        Number(
            document.getElementById(
                "paidAmount"
            )?.value || 0
        );


    const dueDate =
        document.getElementById(
            "dueDate"
        )?.value || null;


    const notes =
        document.getElementById(
            "purchaseNotes"
        )?.value
        .trim() || "";


    const purchaseDiscount =
        Number(
            document.getElementById(
                "purchaseDiscount"
            )?.value || 0
        );


    const additionalCost =
        Number(
            document.getElementById(
                "additionalCost"
            )?.value || 0
        );


    /* =================================================
       VALIDASI UTAMA
    ================================================= */

    if (!supplierId) {

        tampilkanPesan(
            "Supplier wajib dipilih.",
            "error"
        );

        return;

    }


    if (!purchaseDate) {

        tampilkanPesan(
            "Tanggal pembelian wajib diisi.",
            "error"
        );

        return;

    }


    if (!paymentMethod) {

        tampilkanPesan(
            "Metode pembayaran wajib dipilih.",
            "error"
        );

        return;

    }


    if (!paymentStatus) {

        tampilkanPesan(
            "Status pembayaran wajib dipilih.",
            "error"
        );

        return;

    }


    if (
        purchaseDiscount < 0 ||
        additionalCost < 0
    ) {

        tampilkanPesan(
            "Diskon atau biaya tambahan tidak valid.",
            "error"
        );

        return;

    }


    const rows =
        document.querySelectorAll(
            "#purchaseItemsBody tr"
        );


    const items = [];


    rows.forEach(
        row => {

            const productId =
                row.querySelector(
                    ".purchase-product"
                )?.value;


            const quantity =
                Number(
                    row.querySelector(
                        ".purchase-quantity"
                    )?.value || 0
                );


            const unitPrice =
                Number(
                    row.querySelector(
                        ".purchase-price"
                    )?.value || 0
                );


            const discount =
                Number(
                    row.querySelector(
                        ".purchase-discount"
                    )?.value || 0
                );


            if (productId) {

                items.push({

                    product_id:
                        productId,

                    quantity:
                        quantity,

                    unit_price:
                        unitPrice,

                    discount:
                        discount

                });

            }

        }
    );


    if (items.length === 0) {

        tampilkanPesan(
            "Tambahkan minimal satu produk.",
            "error"
        );

        return;

    }


    for (
        const item of items
    ) {

        if (
            !Number.isFinite(
                item.quantity
            ) ||
            item.quantity <= 0
        ) {

            tampilkanPesan(
                "Jumlah produk harus lebih dari 0.",
                "error"
            );

            return;

        }


        if (
            !Number.isFinite(
                item.unit_price
            ) ||
            item.unit_price < 0
        ) {

            tampilkanPesan(
                "Harga beli tidak valid.",
                "error"
            );

            return;

        }


        if (
            !Number.isFinite(
                item.discount
            ) ||
            item.discount < 0
        ) {

            tampilkanPesan(
                "Diskon produk tidak valid.",
                "error"
            );

            return;

        }

    }


    const total =
        ambilTotalPembelian();


    if (
        !Number.isFinite(
            paidAmount
        ) ||
        paidAmount < 0
    ) {

        tampilkanPesan(
            "Jumlah dibayar tidak valid.",
            "error"
        );

        return;

    }


    if (
        paidAmount > total
    ) {

        tampilkanPesan(
            "Jumlah dibayar tidak boleh lebih besar dari total.",
            "error"
        );

        return;

    }


    /*
     * PAID = wajib lunas.
     */

    if (
        paymentStatus === "PAID" &&
        paidAmount !== total
    ) {

        tampilkanPesan(
            "Status Lunas harus dibayar penuh.",
            "error"
        );

        return;

    }


    /*
     * CREDIT = belum ada pembayaran.
     */

    if (
        paymentStatus === "CREDIT" &&
        paidAmount !== 0
    ) {

        tampilkanPesan(
            "Status Hutang tidak boleh memiliki pembayaran.",
            "error"
        );

        return;

    }


    /*
     * PARTIAL = harus ada pembayaran,
     * tetapi tidak boleh lunas penuh.
     */

    if (
        paymentStatus === "PARTIAL" &&
        (
            paidAmount <= 0 ||
            paidAmount >= total
        )
    ) {

        tampilkanPesan(
            "Status Sebagian harus memiliki pembayaran sebagian dari total.",
            "error"
        );

        return;

    }


    /*
     * CREDIT dan PARTIAL wajib jatuh tempo.
     */

    if (
        (
            paymentStatus === "CREDIT" ||
            paymentStatus === "PARTIAL"
        ) &&
        !dueDate
    ) {

        tampilkanPesan(
            "Tanggal jatuh tempo wajib diisi.",
            "error"
        );

        return;

    }


    const payload = {

        purchase_number:
            document.getElementById(
                "purchaseNumber"
            )?.value || null,

        purchase_date:
            purchaseDate,

        supplier_id:
            supplierId,

        invoice_number:
            invoiceNumber,

        payment_method:
            paymentMethod,

        payment_status:
            paymentStatus,

        paid_amount:
            paidAmount,

        due_date:
            dueDate,

        notes:
            notes,

        discount:
            purchaseDiscount,

        additional_cost:
            additionalCost,

        items:
            items

    };


    console.log(
        "📤 PAYLOAD PEMBELIAN:",
        payload
    );


    try {

        tampilkanPesan(
            "Menyimpan pembelian...",
            "loading"
        );


        const response =
            await fetch(
                "/api/purchases",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        let result = {};


        try {

            result =
                await response.json();

        } catch {

            result = {};

        }


        console.log(
            "📥 RESPONSE PEMBELIAN:",
            response.status,
            result
        );


        if (
            response.status === 401
        ) {

            window.location.href =
                "index.html";

            return;

        }


        if (!response.ok) {

            throw new Error(
                result.message ||
                result.error ||
                `Server error ${response.status}`
            );

        }


        if (
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Pembelian gagal disimpan."
            );

        }


        tampilkanPesan(
            "Pembelian berhasil disimpan.",
            "success"
        );


        resetFormPembelian();


        await loadProduk();

        await loadSupplier();

        await loadRiwayatPembelian();


    } catch (error) {

        console.error(
            "❌ SIMPAN PEMBELIAN ERROR:",
            error
        );


        tampilkanPesan(
            error.message ||
            "Gagal menyimpan pembelian.",
            "error"
        );

    }

}


/* =====================================================
   RESET FORM
===================================================== */

function resetFormPembelian() {

    const form =
        document.getElementById(
            "purchaseForm"
        );


    if (form) {

        form.reset();

    }


    const tbody =
        document.getElementById(
            "purchaseItemsBody"
        );


    if (tbody) {

        tbody.innerHTML = "";

    }


    nomorItem =
        0;


    setTanggalHariIni();

    buatNomorPembelian();

    tambahItemPembelian();

    hitungTotal();

    aturJatuhTempo();

    hitungSisaHutang();

}


/* =====================================================
   LOAD RIWAYAT PEMBELIAN
===================================================== */

async function loadRiwayatPembelian() {

    try {

        const response =
            await fetch(
                "/api/purchases",
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }

                }
            );


        if (
            response.status === 404
        ) {

            console.warn(
                "⚠️ API /api/purchases belum dibuat."
            );

            renderRiwayatPembelian([]);

            return;

        }


        if (
            response.status === 401
        ) {

            window.location.href =
                "index.html";

            return;

        }


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                result.error ||
                "Gagal mengambil riwayat."
            );

        }


        const data =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(
                        result.data
                    )
                        ? result.data
                        : []
                );


        renderRiwayatPembelian(
            data
        );


    } catch (error) {

        console.warn(
            "⚠️ Riwayat pembelian:",
            error.message
        );

        renderRiwayatPembelian(
            []
        );

    }

}


/* =====================================================
   RENDER RIWAYAT
===================================================== */

function renderRiwayatPembelian(data) {

    const tbody =
        document.getElementById(
            "purchaseTableBody"
        );


    if (!tbody) return;


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Belum ada riwayat pembelian
                </td>
            </tr>
        `;

        return;

    }


    tbody.innerHTML =
        data
            .map(
                (item, index) => {

                    const total =
                        Number(
                            item.total || 0
                        );


                    const paid =
                        Number(
                            item.paid_amount || 0
                        );


                    const remaining =
                        Math.max(
                            total - paid,
                            0
                        );


                    return `
                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                ${formatTanggal(
                                    item.purchase_date
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.purchase_number ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.supplier_name ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.invoice_number ||
                                    "-"
                                )}
                            </td>

                            <td>
                                Rp ${formatNumber(
                                    total
                                )}
                            </td>

                            <td>
                                Rp ${formatNumber(
                                    paid
                                )}
                            </td>

                            <td>
                                Rp ${formatNumber(
                                    remaining
                                )}
                            </td>

                            <td>
                                ${formatStatus(
                                    item.payment_status
                                )}
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    onclick="lihatPembelian('${escapeHtml(
                                        item.id
                                    )}')"
                                >
                                    Detail
                                </button>
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");

}


/* =====================================================
   DETAIL
===================================================== */

async function lihatPembelian(id) {

    if (!id) return;


    try {

        const response =
            await fetch(
                `/api/purchases/${encodeURIComponent(
                    id
                )}`,
                {
                    method: "GET",

                    credentials:
                        "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                result.error ||
                "Gagal mengambil detail pembelian."
            );

        }


        const purchase =
            result.data ||
            result;


        alert(
            `DETAIL PEMBELIAN

Nomor:
${purchase.purchase_number || "-"}

Tanggal:
${formatTanggal(
    purchase.purchase_date
)}

Supplier:
${purchase.supplier_name || "-"}

Invoice:
${purchase.invoice_number || "-"}

Total:
Rp ${formatNumber(
    purchase.total
)}`
        );


    } catch (error) {

        console.error(
            "DETAIL PEMBELIAN ERROR:",
            error
        );


        alert(
            error.message ||
            "Gagal mengambil detail pembelian."
        );

    }

}


/* =====================================================
   FILTER
===================================================== */

async function filterRiwayat() {

    try {

        const response =
            await fetch(
                "/api/purchases",
                {
                    method: "GET",

                    credentials:
                        "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }

                }
            );


        if (!response.ok) {

            return;

        }


        const result =
            await response.json();


        const data =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(
                        result.data
                    )
                        ? result.data
                        : []
                );


        const search =
            document.getElementById(
                "searchPurchase"
            )?.value
            .trim()
            .toLowerCase() || "";


        const dateFrom =
            document.getElementById(
                "purchaseDateFrom"
            )?.value || "";


        const dateTo =
            document.getElementById(
                "purchaseDateTo"
            )?.value || "";


        const status =
            document.getElementById(
                "purchaseStatusFilter"
            )?.value || "";


        const filtered =
            data.filter(
                item => {

                    const supplier =
                        String(
                            item.supplier_name ||
                            ""
                        )
                        .toLowerCase();


                    const invoice =
                        String(
                            item.invoice_number ||
                            ""
                        )
                        .toLowerCase();


                    const number =
                        String(
                            item.purchase_number ||
                            ""
                        )
                        .toLowerCase();


                    const itemStatus =
                        String(
                            item.payment_status ||
                            ""
                        );


                    const searchMatch =
                        !search ||
                        supplier.includes(
                            search
                        ) ||
                        invoice.includes(
                            search
                        ) ||
                        number.includes(
                            search
                        );


                    const date =
                        item.purchase_date
                            ? String(
                                item.purchase_date
                            ).substring(
                                0,
                                10
                            )
                            : "";


                    const fromMatch =
                        !dateFrom ||
                        date >= dateFrom;


                    const toMatch =
                        !dateTo ||
                        date <= dateTo;


                    const statusMatch =
                        !status ||
                        itemStatus === status;


                    return (
                        searchMatch &&
                        fromMatch &&
                        toMatch &&
                        statusMatch
                    );

                }
            );


        renderRiwayatPembelian(
            filtered
        );


    } catch (error) {

        console.warn(
            "FILTER ERROR:",
            error.message
        );

    }

}


/* =====================================================
   PESAN
===================================================== */

function tampilkanPesan(
    message,
    type = "success"
) {

    const element =
        document.getElementById(
            "purchaseMessage"
        );


    if (!element) {

        console.log(
            message
        );

        return;

    }


    element.style.display =
        "block";


    element.textContent =
        message;


    if (
        type === "error"
    ) {

        element.style.color =
            "#b91c1c";

    } else if (
        type === "loading"
    ) {

        element.style.color =
            "#555";

    } else {

        element.style.color =
            "#15803d";

    }

}


/* =====================================================
   STATUS
===================================================== */

function formatStatus(status) {

    const map = {

        PAID:
            "Lunas",

        PARTIAL:
            "Sebagian",

        CREDIT:
            "Hutang"

    };


    return escapeHtml(
        map[status] ||
        status ||
        "-"
    );

}


/* =====================================================
   FORMAT ANGKA
===================================================== */

function formatNumber(value) {

    const number =
        Number(
            value || 0
        );


    return number.toLocaleString(
        "id-ID",
        {
            maximumFractionDigits: 2
        }
    );

}


/* =====================================================
   FORMAT TANGGAL
===================================================== */

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


/* =====================================================
   GET TODAY
===================================================== */

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


/* =====================================================
   ESCAPE HTML
===================================================== */

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


/* =====================================================
   EXPORT GLOBAL
===================================================== */

window.lihatPembelian =
    lihatPembelian;