/* =========================================================
   AN-NAFIQ BENGKEL
   KASIR
========================================================= */

let products = [];
let cart = [];

let selectedPaymentMethod = "CASH";
let lastSale = null;

let selectedCategory = "all";

/* =========================================================
   HELPER
========================================================= */

function formatRupiah(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getProductCategory(product) {
    if (product.category_name) {
        return product.category_name;
    }

    if (product.category) {
        return product.category;
    }

    return "Lainnya";
}

function getProductCode(product) {
    return (
        product.code ||
        product.product_code ||
        product.barcode ||
        "-"
    );
}

function getProductStock(product) {
    return Number(product.stock || 0);
}

function getProductPrice(product) {
    return Number(
        product.sell_price ??
        product.selling_price ??
        product.price ??
        0
    );
}

/* =========================================================
   AUTH
========================================================= */

async function checkLogin() {

    try {

        const response = await fetch("/api/me", {
            credentials: "include"
        });

        if (!response.ok) {
            window.location.href = "/index.html";
            return false;
        }

        const data = await response.json();

        const user = data.user || data;

        if (user.full_name) {
            document.getElementById("userName").textContent =
                user.full_name;
        } else if (user.username) {
            document.getElementById("userName").textContent =
                user.username;
        }

        if (user.role_name) {
            document.getElementById("userRole").textContent =
                user.role_name;
        } else if (user.role) {
            document.getElementById("userRole").textContent =
                user.role;
        }

        return true;

    } catch (error) {

        console.error(error);

        window.location.href = "/index.html";

        return false;
    }
}

/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    const grid = document.getElementById("productsGrid");

    grid.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Memuat produk...</p>
        </div>
    `;

    try {

        const response = await fetch("/api/products", {
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Gagal mengambil produk"
            );
        }

        if (Array.isArray(data)) {
            products = data;
        } else if (Array.isArray(data.products)) {
            products = data.products;
        } else if (Array.isArray(data.data)) {
            products = data.data;
        } else {
            products = [];
        }

        buildCategories();

        renderProducts();

    } catch (error) {

        console.error(error);

        grid.innerHTML = `
            <div class="loading">
                <p>❌ Gagal memuat produk.</p>
                <button
                    class="refresh-btn"
                    onclick="loadProducts()"
                >
                    Coba Lagi
                </button>
            </div>
        `;

        showToast(
            error.message || "Gagal memuat produk",
            "error"
        );
    }
}

/* =========================================================
   CATEGORIES
========================================================= */

function buildCategories() {

    const container =
        document.getElementById("categoryFilter");

    const categories = [
        ...new Set(
            products.map(product =>
                getProductCategory(product)
            )
        )
    ].filter(Boolean);

    container.innerHTML = `
        <button
            class="category-btn ${selectedCategory === "all" ? "active" : ""}"
            data-category="all"
            onclick="selectCategory('all')"
        >
            Semua
        </button>
    `;

    categories.forEach(category => {

        const button = document.createElement("button");

        button.className =
            "category-btn " +
            (selectedCategory === category ? "active" : "");

        button.textContent = category;

        button.onclick = () =>
            selectCategory(category);

        container.appendChild(button);
    });
}

function selectCategory(category) {

    selectedCategory = category;

    buildCategories();

    renderProducts();
}

/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

    const grid =
        document.getElementById("productsGrid");

    const keyword =
        document
            .getElementById("searchProduct")
            .value
            .trim()
            .toLowerCase();

    let filtered = products.filter(product => {

        const name =
            String(product.name || "")
                .toLowerCase();

        const code =
            String(getProductCode(product))
                .toLowerCase();

        const barcode =
            String(product.barcode || "")
                .toLowerCase();

        const category =
            String(getProductCategory(product))
                .toLowerCase();

        const matchSearch =
            !keyword ||
            name.includes(keyword) ||
            code.includes(keyword) ||
            barcode.includes(keyword) ||
            category.includes(keyword);

        const matchCategory =
            selectedCategory === "all" ||
            getProductCategory(product) === selectedCategory;

        return matchSearch && matchCategory;
    });

    if (filtered.length === 0) {

        grid.innerHTML = `
            <div class="loading">
                <p>Produk tidak ditemukan.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML = filtered.map(product => {

        const stock = getProductStock(product);

        const price = getProductPrice(product);

        const disabled =
            product.active === false ||
            stock <= 0;

        let stockClass = "";

        if (stock <= 0) {
            stockClass = "stock-empty";
        } else if (
            product.minimum_stock &&
            stock <= Number(product.minimum_stock)
        ) {
            stockClass = "stock-low";
        }

        return `
            <div
                class="product-card ${disabled ? "disabled" : ""}"
                onclick="${disabled ? "" : `addToCart('${product.id}')`}"
            >

                <div class="product-category">
                    ${escapeHtml(getProductCategory(product))}
                </div>

                <div class="product-name">
                    ${escapeHtml(product.name || "Produk")}
                </div>

                <div class="product-code">
                    ${escapeHtml(getProductCode(product))}
                </div>

                <div class="product-bottom">

                    <div class="product-price">
                        ${formatRupiah(price)}
                    </div>

                    <div class="product-stock ${stockClass}">
                        Stok: ${stock}
                    </div>

                </div>

            </div>
        `;
    }).join("");
}

/* =========================================================
   SEARCH
========================================================= */

document
    .getElementById("searchProduct")
    .addEventListener("input", renderProducts);

/* =========================================================
   CART
========================================================= */

function addToCart(productId) {

    const product =
        products.find(
            item => String(item.id) === String(productId)
        );

    if (!product) {
        showToast("Produk tidak ditemukan", "error");
        return;
    }

    const stock = getProductStock(product);

    if (stock <= 0) {
        showToast("Stok produk habis", "error");
        return;
    }

    const existing =
        cart.find(
            item =>
                String(item.product_id) ===
                String(product.id)
        );

    if (existing) {

        if (existing.quantity >= stock) {
            showToast(
                "Jumlah melebihi stok tersedia",
                "error"
            );
            return;
        }

        existing.quantity++;

    } else {

        cart.push({
            product_id: product.id,
            name: product.name,
            code: getProductCode(product),
            price: getProductPrice(product),
            quantity: 1,
            stock: stock
        });

    }

    renderCart();

    showToast(
        `${product.name} ditambahkan`,
        "success"
    );
}

function increaseQty(productId) {

    const item =
        cart.find(
            item =>
                String(item.product_id) ===
                String(productId)
        );

    if (!item) return;

    if (item.quantity >= item.stock) {

        showToast(
            "Jumlah sudah mencapai stok tersedia",
            "error"
        );

        return;
    }

    item.quantity++;

    renderCart();
}

function decreaseQty(productId) {

    const item =
        cart.find(
            item =>
                String(item.product_id) ===
                String(productId)
        );

    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {

        cart =
            cart.filter(
                cartItem =>
                    String(cartItem.product_id) !==
                    String(productId)
            );
    }

    renderCart();
}

function removeFromCart(productId) {

    cart =
        cart.filter(
            item =>
                String(item.product_id) !==
                String(productId)
        );

    renderCart();
}

function clearCart() {

    if (cart.length === 0) {
        return;
    }

    const confirmClear =
        confirm(
            "Kosongkan semua isi keranjang?"
        );

    if (!confirmClear) {
        return;
    }

    cart = [];

    renderCart();
}

/* =========================================================
   RENDER CART
========================================================= */

function renderCart() {

    const container =
        document.getElementById("cartList");

    const count =
        cart.reduce(
            (total, item) =>
                total + item.quantity,
            0
        );

    document.getElementById("cartCount").textContent =
        `${count} item`;

    if (cart.length === 0) {

        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">🛒</div>
                <h3>Keranjang masih kosong</h3>
                <p>
                    Pilih produk di sebelah kiri
                    untuk memulai transaksi.
                </p>
            </div>
        `;

        calculateTotal();

        return;
    }

    container.innerHTML =
        cart.map(item => {

            const itemTotal =
                item.price * item.quantity;

            return `
                <div class="cart-item">

                    <div>

                        <div class="cart-item-name">
                            ${escapeHtml(item.name)}
                        </div>

                        <div class="cart-item-price">
                            ${formatRupiah(item.price)}
                        </div>

                        <div class="cart-controls">

                            <button
                                class="qty-btn"
                                onclick="decreaseQty('${item.product_id}')"
                            >
                                −
                            </button>

                            <span class="qty-number">
                                ${item.quantity}
                            </span>

                            <button
                                class="qty-btn"
                                onclick="increaseQty('${item.product_id}')"
                            >
                                +
                            </button>

                            <button
                                class="remove-btn"
                                onclick="removeFromCart('${item.product_id}')"
                                title="Hapus"
                            >
                                🗑
                            </button>

                        </div>

                    </div>

                    <div class="cart-item-total">
                        ${formatRupiah(itemTotal)}
                    </div>

                </div>
            `;

        }).join("");

    calculateTotal();
}

/* =========================================================
   TOTAL
========================================================= */

function getSubtotal() {

    return cart.reduce(
        (total, item) =>
            total +
            (item.price * item.quantity),
        0
    );
}

function getDiscount() {

    const discount =
        Number(
            document.getElementById(
                "discountInput"
            ).value || 0
        );

    return Math.max(0, discount);
}

function getTotal() {

    const subtotal = getSubtotal();

    const discount = getDiscount();

    return Math.max(
        0,
        subtotal - discount
    );
}

function calculateTotal() {

    const subtotal = getSubtotal();

    const discount = getDiscount();

    const total = getTotal();

    document.getElementById("subtotalText")
        .textContent =
        formatRupiah(subtotal);

    document.getElementById("discountText")
        .textContent =
        `- ${formatRupiah(discount)}`;

    document.getElementById("totalText")
        .textContent =
        formatRupiah(total);

    calculateChange();
}

/* =========================================================
   DISCOUNT EVENT
========================================================= */

document
    .getElementById("discountInput")
    .addEventListener(
        "input",
        calculateTotal
    );

/* =========================================================
   PAYMENT
========================================================= */

function selectPaymentMethod(method) {

    selectedPaymentMethod = method;

    document
        .querySelectorAll(".payment-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.method === method
            );

        });

    const paidInput =
        document.getElementById("paidAmount");

    if (method !== "CASH") {

        paidInput.value =
            getTotal();

        paidInput.readOnly = true;

    } else {

        paidInput.readOnly = false;

    }

    calculateChange();
}

function addPaymentAmount(amount) {

    const input =
        document.getElementById("paidAmount");

    let current =
        Number(input.value || 0);

    current += Number(amount);

    input.value = current;

    calculateChange();
}

function setExactPayment() {

    document.getElementById("paidAmount").value =
        getTotal();

    calculateChange();
}

document
    .getElementById("paidAmount")
    .addEventListener(
        "input",
        calculateChange
    );

function calculateChange() {

    const total = getTotal();

    const paid =
        Number(
            document.getElementById(
                "paidAmount"
            ).value || 0
        );

    const change =
        Math.max(
            0,
            paid - total
        );

    document.getElementById("changeText")
        .textContent =
        formatRupiah(change);
}

/* =========================================================
   PROCESS SALE
========================================================= */

async function processSale() {

    if (cart.length === 0) {

        showToast(
            "Keranjang masih kosong",
            "error"
        );

        return;
    }

    const total = getTotal();

    const paidAmount =
        Number(
            document.getElementById(
                "paidAmount"
            ).value || 0
        );

    if (total <= 0) {

        showToast(
            "Total transaksi tidak valid",
            "error"
        );

        return;
    }

    if (paidAmount < total) {

        showToast(
            "Uang pembayaran masih kurang",
            "error"
        );

        document
            .getElementById("paidAmount")
            .focus();

        return;
    }

    const payButton =
        document.getElementById("payBtn");

    payButton.disabled = true;

    payButton.innerHTML = `
        <span>⏳</span>
        Menyimpan...
    `;

    const customerName =
        document
            .getElementById("customerName")
            .value
            .trim();

    const notes =
        document
            .getElementById("saleNotes")
            .value
            .trim();

    /*
       Customer name sementara dimasukkan
       ke notes jika belum ada customer_id.
    */

    let finalNotes = notes;

    if (customerName) {

        finalNotes =
            `Pelanggan: ${customerName}` +
            (notes
                ? ` | ${notes}`
                : "");

    }

    const payload = {

        items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.price,
            discount: 0
        })),

        discount: getDiscount(),

        paid_amount: paidAmount,

        payment_method:
            selectedPaymentMethod,

        notes: finalNotes

    };

    try {

        const response =
            await fetch(
                "/api/sales",
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Transaksi gagal disimpan"
            );

        }

        lastSale = data;

        showSuccessModal(data);

        cart = [];

        document.getElementById(
            "customerName"
        ).value = "";

        document.getElementById(
            "saleNotes"
        ).value = "";

        document.getElementById(
            "discountInput"
        ).value = 0;

        document.getElementById(
            "paidAmount"
        ).value = 0;

        selectPaymentMethod("CASH");

        renderCart();

        await loadProducts();

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Gagal menyimpan transaksi",
            "error"
        );

    } finally {

        payButton.disabled = false;

        payButton.innerHTML = `
            <span>✓</span>
            Bayar & Simpan
        `;

    }
}

/* =========================================================
   SUCCESS MODAL
========================================================= */

function showSuccessModal(data) {

    const invoice =
        data.invoice_number ||
        data.invoice ||
        data.sale?.invoice_number ||
        "-";

    const total =
        Number(
            data.total ||
            data.sale?.total ||
            getTotal()
        );

    document.getElementById(
        "successInvoice"
    ).textContent = invoice;

    document.getElementById(
        "successTotal"
    ).textContent =
        formatRupiah(total);

    document
        .getElementById("successModal")
        .classList.add("show");
}

function closeSuccessModal() {

    document
        .getElementById("successModal")
        .classList.remove("show");

    document
        .getElementById("searchProduct")
        .focus();
}

/* =========================================================
   PRINT
========================================================= */

function printLastInvoice() {

    if (!lastSale) {
        showToast(
            "Data transaksi tidak tersedia",
            "error"
        );
        return;
    }

    const invoice =
        lastSale.invoice_number ||
        lastSale.invoice ||
        "-";

    const total =
        Number(
            lastSale.total ||
            getTotal()
        );

    const items =
        lastSale.items ||
        [];

    const printWindow =
        window.open(
            "",
            "_blank",
            "width=400,height=700"
        );

    if (!printWindow) {

        showToast(
            "Popup diblokir browser",
            "error"
        );

        return;
    }

    const itemRows =
        items.length > 0
            ? items.map(item => `
                <tr>
                    <td>
                        ${escapeHtml(
                            item.name ||
                            item.product_name ||
                            "Produk"
                        )}
                    </td>

                    <td style="text-align:center">
                        ${item.quantity || 1}
                    </td>

                    <td style="text-align:right">
                        ${formatRupiah(
                            item.subtotal ||
                            (
                                Number(item.unit_price || 0) *
                                Number(item.quantity || 0)
                            )
                        )}
                    </td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="3">
                        Transaksi ${escapeHtml(invoice)}
                    </td>
                </tr>
            `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>

            <title>${escapeHtml(invoice)}</title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    width: 300px;
                    margin: 20px auto;
                    color: #111;
                    font-size: 12px;
                }

                h2 {
                    text-align: center;
                    margin: 0;
                }

                .center {
                    text-align: center;
                }

                .line {
                    border-top: 1px dashed #111;
                    margin: 10px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                td {
                    padding: 4px 0;
                    vertical-align: top;
                }

                .total {
                    font-size: 17px;
                    font-weight: bold;
                }

                @media print {
                    body {
                        margin: 0 auto;
                    }
                }

            </style>

        </head>

        <body>

            <h2>AN-NAFIQ BENGKEL</h2>

            <div class="center">
                Penjualan
            </div>

            <div class="line"></div>

            <div>
                Invoice:
                <strong>
                    ${escapeHtml(invoice)}
                </strong>
            </div>

            <div>
                ${new Date().toLocaleString("id-ID")}
            </div>

            <div class="line"></div>

            <table>

                ${itemRows}

            </table>

            <div class="line"></div>

            <table>

                <tr>
                    <td>
                        Total
                    </td>

                    <td style="text-align:right">
                        <strong>
                            ${formatRupiah(total)}
                        </strong>
                    </td>
                </tr>

            </table>

            <div class="line"></div>

            <div class="center">
                Terima kasih
            </div>

            <div class="center">
                AN-NAFIQ BENGKEL
            </div>

        </body>
        </html>
    `);

    printWindow.document.close();

    setTimeout(() => {

        printWindow.focus();

        printWindow.print();

    }, 300);
}

/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message, type = "success") {

    const toast =
        document.getElementById("toast");

    const icon =
        document.getElementById("toastIcon");

    const text =
        document.getElementById("toastMessage");

    text.textContent = message;

    toast.className =
        `toast ${type}`;

    icon.textContent =
        type === "error"
            ? "!"
            : "✓";

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);
}

/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    document
        .getElementById("sidebar")
        .classList.toggle("open");
}

function toggleSubmenu(menuId, arrowId) {

    const menu =
        document.getElementById(menuId);

    const arrow =
        document.getElementById(arrowId);

    if (!menu) return;

    menu.classList.toggle("show");

    if (arrow) {
        arrow.classList.toggle(
            "open",
            menu.classList.contains("show")
        );
    }
}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    const confirmed =
        confirm(
            "Apakah kamu yakin ingin keluar?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(error);

    } finally {

        window.location.href =
            "/index.html";

    }
}

/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
         Enter pada pencarian
         */

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
                "searchProduct"
        ) {

            const keyword =
                document
                    .getElementById(
                        "searchProduct"
                    )
                    .value
                    .trim()
                    .toLowerCase();

            if (!keyword) return;

            const found =
                products.find(product => {

                    const name =
                        String(
                            product.name || ""
                        ).toLowerCase();

                    const code =
                        String(
                            getProductCode(product)
                        ).toLowerCase();

                    const barcode =
                        String(
                            product.barcode || ""
                        ).toLowerCase();

                    return (
                        name === keyword ||
                        code === keyword ||
                        barcode === keyword
                    );

                });

            if (found) {
                addToCart(found.id);
            }

        }

        /*
         Escape untuk menutup modal
         */

        if (event.key === "Escape") {

            document
                .getElementById(
                    "successModal"
                )
                .classList.remove("show");

        }

    }
);

/* =========================================================
   INIT
========================================================= */

async function initKasir() {

    const loggedIn =
        await checkLogin();

    if (!loggedIn) {
        return;
    }

    await loadProducts();

    renderCart();

    selectPaymentMethod("CASH");

}

document.addEventListener(
    "DOMContentLoaded",
    initKasir
);