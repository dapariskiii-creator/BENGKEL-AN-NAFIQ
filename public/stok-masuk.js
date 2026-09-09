let products = [];


// =====================================================
// FORMAT RUPIAH
// =====================================================

function formatRupiah(value) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(Number(value) || 0);

}


// =====================================================
// LOAD PRODUCTS
// =====================================================

async function loadProducts() {

    const select =
        document.getElementById("product");

    try {

        const response =
            await fetch(
                "/api/products",
                {
                    credentials: "include"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Gagal mengambil produk"
            );

        }

        const data =
            await response.json();

        products =
            Array.isArray(data)
                ? data
                : data.products || [];


        select.innerHTML =
            `<option value="">
                Pilih produk
            </option>`;


        products.forEach(product => {

            const option =
                document.createElement("option");

            option.value =
                product.id;

            option.textContent =
                `${product.code || "-"} - ${product.name}`;


            select.appendChild(option);

        });


        updateProductInfo();

        updateStats();

    } catch (error) {

        console.error(
            "LOAD PRODUCTS ERROR:",
            error
        );

        showMessage(
            "Gagal memuat daftar produk.",
            "error"
        );

    }

}


// =====================================================
// PRODUCT SELECT
// =====================================================

function updateProductInfo() {

    const productId =
        document.getElementById("product").value;

    const product =
        products.find(
            item =>
                String(item.id) === String(productId)
        );


    const info =
        document.getElementById("productInfo");

    const unitCost =
        document.getElementById("unitCost");


    if (!product) {

        info.textContent = "";

        return;

    }


    info.textContent =
        `Stok sekarang: ${product.stock || 0} ${product.unit_name || ""}`;


    if (
        !unitCost.value &&
        product.buy_price !== undefined
    ) {

        unitCost.value =
            product.buy_price || 0;

    }

}


// =====================================================
// STATS
// =====================================================

function updateStats() {

    const total =
        products.length;

    const lowStock =
        products.filter(product =>
            Number(product.stock || 0) <=
            Number(product.minimum_stock || 0)
        ).length;


    document.getElementById(
        "totalProducts"
    ).textContent = total;


    document.getElementById(
        "lowStockProducts"
    ).textContent = lowStock;

}


// =====================================================
// MESSAGE
// =====================================================

function showMessage(
    message,
    type
) {

    const box =
        document.getElementById(
            "stockInMessage"
        );


    box.textContent =
        message;

    box.className =
        `message ${type}`;


    setTimeout(
        () => {

            box.className =
                "message";

            box.textContent =
                "";

        },
        5000
    );

}


// =====================================================
// SUBMIT STOCK IN
// =====================================================

async function submitStockIn(event) {

    event.preventDefault();


    const productId =
        document.getElementById(
            "product"
        ).value;


    const quantity =
        Number(
            document.getElementById(
                "quantity"
            ).value
        );


    const unitCost =
        Number(
            document.getElementById(
                "unitCost"
            ).value
        ) || 0;


    const movementDate =
        document.getElementById(
            "movementDate"
        ).value;


    const reference =
        document.getElementById(
            "reference"
        ).value.trim();


    const notes =
        document.getElementById(
            "notes"
        ).value.trim();


    if (!productId) {

        showMessage(
            "Pilih produk terlebih dahulu.",
            "error"
        );

        return;
    }


    if (!quantity || quantity <= 0) {

        showMessage(
            "Jumlah stok harus lebih dari 0.",
            "error"
        );

        return;
    }


    if (!movementDate) {

        showMessage(
            "Tanggal wajib diisi.",
            "error"
        );

        return;
    }


    const button =
        document.getElementById(
            "saveButton"
        );


    button.disabled = true;

    button.textContent =
        "⏳ Menyimpan...";


    try {

        const response =
            await fetch(
                "/api/stock-in",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({

                        productId,

                        quantity,

                        unitCost,

                        movementDate,

                        reference,

                        notes

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Gagal menyimpan stok masuk"
            );

        }


        showMessage(
            data.message ||
            "Stok masuk berhasil disimpan.",
            "success"
        );


        document.getElementById(
            "stockInForm"
        ).reset();


        setToday();


        await loadProducts();

        await loadHistory();


    } catch (error) {

        console.error(
            "STOCK IN ERROR:",
            error
        );

        showMessage(
            error.message ||
            "Terjadi kesalahan.",
            "error"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "📥 Simpan Stok Masuk";

    }

}


// =====================================================
// LOAD HISTORY
// =====================================================

async function loadHistory() {

    const tbody =
        document.getElementById(
            "historyBody"
        );


    try {

        const response =
            await fetch(
                "/api/stock-in",
                {
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Gagal mengambil riwayat"
            );

        }


        const data =
            await response.json();


        const rows =
            Array.isArray(data)
                ? data
                : data.data ||
                  data.movements ||
                  data.stockMovements ||
                  [];


        if (!rows.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty">
                        Belum ada riwayat stok masuk.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML =
            rows.map(
                (item, index) => {

                    const date =
                        item.movement_date ||
                        item.date ||
                        item.created_at;


                    return `
                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                ${formatDate(date)}
                            </td>

                            <td>
                                <strong>
                                    ${item.product_name || "-"}
                                </strong>
                                <br>
                                <small>
                                    ${item.product_code || ""}
                                </small>
                            </td>

                            <td>
                                ${item.quantity_in || item.quantity || 0}
                            </td>

                            <td>
                                ${formatRupiah(
                                    item.unit_cost || 0
                                )}
                            </td>

                            <td>
                                ${item.balance_after ?? "-"}
                            </td>

                            <td>
                                ${item.reference_type || "-"}
                            </td>

                            <td>
                                ${item.notes || "-"}
                            </td>

                        </tr>
                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "LOAD HISTORY ERROR:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    Gagal memuat riwayat stok masuk.
                </td>
            </tr>
        `;

    }

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (Number.isNaN(
        date.getTime()
    )) {

        return value;

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


// =====================================================
// TODAY
// =====================================================

function setToday() {

    const input =
        document.getElementById(
            "movementDate"
        );


    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


    input.value =
        `${year}-${month}-${day}`;

}


// =====================================================
// INIT
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setToday();

        document
            .getElementById("product")
            .addEventListener(
                "change",
                updateProductInfo
            );


        document
            .getElementById("stockInForm")
            .addEventListener(
                "submit",
                submitStockIn
            );


        await loadProducts();

        await loadHistory();

    }
);