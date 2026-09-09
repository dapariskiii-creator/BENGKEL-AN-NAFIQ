
console.log("produk.js berhasil dimuat");

let produkSedangDiedit = null;
let semuaProduk = [];

document.addEventListener("DOMContentLoaded", () => {

    const tombolTambah = document.getElementById("addProductButton");
    const modal = document.getElementById("productModal");
    const tombolTutup = document.getElementById("closeModalButton");
    const tombolBatal = document.getElementById("cancelProductButton");
    const form = document.getElementById("productForm");

    // =========================
    // TAMBAH PRODUK
    // =========================

    tombolTambah?.addEventListener("click", () => {

        produkSedangDiedit = null;

        form.reset();

        const judul = modal?.querySelector("h2");

        if (judul) {
            judul.textContent = "Tambah Produk";
        }

        modal?.classList.remove("hidden");
    });


    // =========================
    // TUTUP MODAL
    // =========================

    tombolTutup?.addEventListener("click", tutupModal);

    tombolBatal?.addEventListener("click", tutupModal);


    modal?.addEventListener("click", (event) => {

        if (event.target === modal) {
            tutupModal();
        }

    });


    // =========================
    // SIMPAN / EDIT PRODUK
    // =========================

    form?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const data = {

            code:
                document.getElementById("productCode").value.trim(),

            barcode:
                document.getElementById("barcode").value.trim(),

            name:
                document.getElementById("productName").value.trim(),

            category:
                document.getElementById("category").value,

            unit:
                document.getElementById("unit").value,

            buy_price:
                Number(
                    document.getElementById("buyPrice").value || 0
                ),

            sell_price:
                Number(
                    document.getElementById("sellPrice").value || 0
                ),

            stock:
                Number(
                    document.getElementById("stock").value || 0
                ),

            minimum_stock:
                Number(
                    document.getElementById("minimumStock").value || 0
                ),

            supplier:
                document.getElementById("supplier").value.trim(),

            location:
                document.getElementById("location").value.trim()
        };


        if (!data.name) {
            alert("Nama produk wajib diisi");
            return;
        }

        if (!data.category) {
            alert("Kategori wajib dipilih");
            return;
        }

        if (!data.unit) {
            alert("Satuan wajib dipilih");
            return;
        }


        try {

            let url = "/api/products";
            let method = "POST";

            if (produkSedangDiedit) {

                url = "/api/products/" + produkSedangDiedit;
                method = "PUT";

            }


            const response = await fetch(url, {

                method,

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)

            });


            const hasil = await response.json();


            if (!response.ok) {

                alert(
                    hasil.message ||
                    "Gagal menyimpan produk"
                );

                console.error(hasil);

                return;
            }


            if (produkSedangDiedit) {

                alert("Produk berhasil diperbarui!");

            } else {

                alert("Produk berhasil ditambahkan!");

            }


            tutupModal();

            await loadProducts();


        } catch (error) {

            console.error("ERROR SIMPAN:", error);

            alert("Gagal terhubung ke server");

        }

    });


    // =========================
    // PENCARIAN
    // =========================

    const searchInput =
        document.getElementById("searchProduct");


    searchInput?.addEventListener("input", () => {
        filterProducts();
    });


    // =========================
    // FILTER STOK
    // =========================

    const stockFilter =
        document.getElementById("stockFilter");


    stockFilter?.addEventListener("change", () => {
        filterProducts();
    });


    // =========================
    // RESET FILTER
    // =========================

    const resetButton =
        document.getElementById("resetProductFilter");


    resetButton?.addEventListener("click", () => {

        if (searchInput) {
            searchInput.value = "";
        }

        if (stockFilter) {
            stockFilter.value = "";
        }

        filterProducts();

    });


    // =========================
    // LOAD AWAL
    // =========================

    loadProducts();

});


// ========================================
// TUTUP MODAL
// ========================================

function tutupModal() {

    const modal =
        document.getElementById("productModal");

    const form =
        document.getElementById("productForm");

    modal?.classList.add("hidden");

    form?.reset();

    produkSedangDiedit = null;

}


// ========================================
// LOAD PRODUK
// ========================================

async function loadProducts() {

    const table =
        document.getElementById("productTableBody");

    if (!table) return;


    try {

        const response =
            await fetch("/api/products");


        if (response.status === 401) {

            window.location.href = "index.html";

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


        semuaProduk = data;

        filterProducts();


    } catch (error) {

        console.error(
            "LOAD PRODUCTS ERROR:",
            error
        );

    }

}


// ========================================
// FILTER PRODUK
// ========================================

function filterProducts() {

    const searchInput =
        document.getElementById("searchProduct");

    const stockFilter =
        document.getElementById("stockFilter");


    const keyword =
        (searchInput?.value || "")
        .trim()
        .toLowerCase();


    const filter =
        stockFilter?.value || "";


    let hasil = semuaProduk.filter(product => {

        const nama =
            String(product.name || "").toLowerCase();

        const kode =
            String(product.code || "").toLowerCase();

        const barcode =
            String(product.barcode || "").toLowerCase();


        const cocokSearch =
            !keyword ||
            nama.includes(keyword) ||
            kode.includes(keyword) ||
            barcode.includes(keyword);


        const stock =
            Number(product.stock || 0);

        const minimum =
            Number(product.minimum_stock || 0);


        let cocokStock = true;


        if (filter === "available") {

            cocokStock =
                stock > minimum;

        }


        if (filter === "low") {

            cocokStock =
                stock > 0 &&
                stock <= minimum;

        }


        if (filter === "empty") {

            cocokStock =
                stock <= 0;

        }


        return cocokSearch && cocokStock;

    });


    renderProducts(hasil);

}


// ========================================
// RENDER PRODUK
// ========================================

function renderProducts(products) {

    const table =
        document.getElementById("productTableBody");

    const total =
        document.getElementById("totalProducts");

    const tersedia =
        document.getElementById("availableProducts");

    const menipis =
        document.getElementById("lowStockProducts");

    const habis =
        document.getElementById("outOfStockProducts");

    const count =
        document.getElementById("productCount");


    if (!table) return;


    // =========================
    // STATISTIK
    // =========================

    if (total) {

        total.textContent =
            semuaProduk.length;

    }


    let jumlahTersedia = 0;
    let jumlahMenipis = 0;
    let jumlahHabis = 0;


    semuaProduk.forEach(product => {

        const stock =
            Number(product.stock || 0);

        const minimum =
            Number(product.minimum_stock || 0);


        if (stock <= 0) {

            jumlahHabis++;

        } else if (stock <= minimum) {

            jumlahMenipis++;

        } else {

            jumlahTersedia++;

        }

    });


    if (tersedia) {

        tersedia.textContent =
            jumlahTersedia;

    }


    if (menipis) {

        menipis.textContent =
            jumlahMenipis;

    }


    if (habis) {

        habis.textContent =
            jumlahHabis;

    }


    if (count) {

        count.textContent =
            `${products.length} produk`;

    }


    // =========================
    // TIDAK ADA HASIL
    // =========================

    if (products.length === 0) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:40px;
                    "
                >
                    📦
                    <br><br>

                    <strong>
                        Tidak ada produk
                    </strong>

                    <br><br>

                    Coba ubah pencarian
                    atau filter stok.
                </td>
            </tr>
        `;

        return;
    }


    // =========================
    // TAMPILKAN PRODUK
    // =========================

    table.innerHTML = products.map(
        (product, index) => {

            const stock =
                Number(product.stock || 0);

            const minimum =
                Number(product.minimum_stock || 0);


            let status = "";


            if (stock <= 0) {

                status = "Habis";

            } else if (stock <= minimum) {

                status = "Menipis";

            } else {

                status = "Tersedia";

            }


            return `
                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                product.name || "-"
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(
                            product.code || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            product.category_name || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            product.unit_name || "-"
                        )}
                    </td>

                    <td>
                        ${formatRupiah(
                            product.buy_price
                        )}
                    </td>

                    <td>
                        ${formatRupiah(
                            product.sell_price
                        )}
                    </td>

                    <td>
                        ${stock}
                    </td>

                    <td>
                        ${status}
                    </td>

                    <td>

                        <button
                            type="button"
                            onclick="editProduk('${product.id}')"
                            title="Edit Produk"
                        >
                            ✏️
                        </button>

                        <button
                            type="button"
                            onclick="hapusProduk('${product.id}')"
                            title="Hapus Produk"
                        >
                            🗑️
                        </button>

                    </td>

                </tr>
            `;

        }
    ).join("");

}


// ========================================
// EDIT PRODUK
// ========================================

async function editProduk(id) {

    try {

        const product =
            semuaProduk.find(item => item.id === id);


        if (!product) {

            alert("Produk tidak ditemukan");

            return;
        }


        produkSedangDiedit = id;


        document.getElementById("productCode").value =
            product.code || "";

        document.getElementById("barcode").value =
            product.barcode || "";

        document.getElementById("productName").value =
            product.name || "";

        document.getElementById("category").value =
            product.category_name || "";

        document.getElementById("unit").value =
            product.unit_name || "";

        document.getElementById("buyPrice").value =
            product.buy_price || 0;

        document.getElementById("sellPrice").value =
            product.sell_price || 0;

        document.getElementById("stock").value =
            product.stock || 0;

        document.getElementById("minimumStock").value =
            product.minimum_stock || 0;

        document.getElementById("supplier").value =
            product.supplier_name || "";

        document.getElementById("location").value =
            product.location || "";


        const modal =
            document.getElementById("productModal");


        const judul =
            modal?.querySelector("h2");


        if (judul) {

            judul.textContent =
                "Edit Produk";

        }


        modal?.classList.remove("hidden");


    } catch (error) {

        console.error(
            "EDIT PRODUCT ERROR:",
            error
        );

        alert("Gagal membuka produk");

    }

}


// ========================================
// HAPUS PRODUK
// ========================================

async function hapusProduk(id) {

    const yakin =
        confirm(
            "Yakin ingin menghapus produk ini?"
        );


    if (!yakin) return;


    try {

        const response =
            await fetch(
                "/api/products/" + id,
                {
                    method: "DELETE"
                }
            );


        const hasil =
            await response.json();


        if (!response.ok) {

            alert(
                hasil.message ||
                "Gagal menghapus produk"
            );

            return;
        }


        alert(
            "Produk berhasil dihapus"
        );


        await loadProducts();


    } catch (error) {

        console.error(
            "HAPUS PRODUK ERROR:",
            error
        );

        alert(
            "Gagal menghapus produk"
        );

    }

}


// ========================================
// RUPIAH
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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

