// ========================================
// AN-NAFIQ BENGKEL
// PENJUALAN.JS
// ========================================

console.log("penjualan.js terbaca");

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ELEMENT
    // ========================================

    const productList = document.getElementById("productList");
    const productCount = document.getElementById("productCount");

    const searchProduct =
        document.getElementById("searchProduct");

    const categoryButtons =
        document.querySelectorAll(".category-button");

    const cartItems =
        document.getElementById("cartItems");

    const cartCount =
        document.getElementById("cartCount");

    const clearCart =
        document.getElementById("clearCart");

    const subtotalElement =
        document.getElementById("subtotal");

    const discountInput =
        document.getElementById("discount");

    const totalElement =
        document.getElementById("total");

    const paidAmount =
        document.getElementById("paidAmount");

    const changeElement =
        document.getElementById("change");

    const saleNotes =
        document.getElementById("saleNotes");

    const saveSale =
        document.getElementById("saveSale");

    const paymentButtons =
        document.querySelectorAll(".payment-button");

    const userName =
        document.getElementById("userName");

    const userRole =
        document.getElementById("userRole");

    const todayDate =
        document.getElementById("todayDate");


    // ========================================
    // DATA
    // ========================================

    let products = [];

    let cart = [];

    let selectedCategory = "semua";

    let paymentMethod = "CASH";


    // ========================================
    // RUPIAH
    // ========================================

    function rupiah(value) {

        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }).format(Number(value) || 0);

    }


    // ========================================
    // TANGGAL
    // ========================================

    if (todayDate) {

        todayDate.textContent =
            new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });

    }


    // ========================================
    // LOGIN
    // ========================================

    async function loadUser() {

        try {

            const response =
                await fetch("api/me", {
                    credentials: "include"
                });

            const data =
                await response.json();

            if (!response.ok || !data.success) {

                window.location.href = "index.html";
                return;

            }

            if (userName) {

                userName.textContent =
                    data.user.full_name ||
                    data.user.username ||
                    "User";

            }

            if (userRole) {

                userRole.textContent =
                    data.user.role ||
                    "USER";

            }

        } catch (error) {

            console.error("Gagal cek login:", error);

        }

    }


    // ========================================
    // LOAD PRODUCTS
    // ========================================

    async function loadProducts() {

        try {

            productList.innerHTML = `
                <div class="loading">
                    ⏳
                    <p>Memuat produk...</p>
                </div>
            `;

            const response =
                await fetch("api/products", {
                    credentials: "include"
                });

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
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

            renderProducts();

        } catch (error) {

            console.error(
                "LOAD PRODUCTS ERROR:",
                error
            );

            products = [];

            productCount.textContent =
                "0 produk";

            productList.innerHTML = `
                <div class="empty-products">
                    <div>⚠️</div>
                    <h3>Gagal memuat produk</h3>
                    <p>
                        Pastikan server dan database berjalan.
                    </p>
                    <button
                        type="button"
                        id="retryProducts"
                        class="retry-button"
                    >
                        Coba Lagi
                    </button>
                </div>
            `;

            const retry =
                document.getElementById("retryProducts");

            if (retry) {

                retry.addEventListener(
                    "click",
                    loadProducts
                );

            }

        }

    }


    // ========================================
    // RENDER PRODUCTS
    // ========================================

    function renderProducts() {

        const keyword =
            searchProduct.value
                .trim()
                .toLowerCase();

        const filtered =
            products.filter(product => {

                const name =
                    String(
                        product.name ||
                        product.product_name ||
                        ""
                    ).toLowerCase();

                const code =
                    String(
                        product.code ||
                        product.product_code ||
                        ""
                    ).toLowerCase();

                const barcode =
                    String(
                        product.barcode ||
                        ""
                    ).toLowerCase();

                const category =
                    String(
                        product.category ||
                        ""
                    ).toLowerCase();


                const searchMatch =
                    !keyword ||
                    name.includes(keyword) ||
                    code.includes(keyword) ||
                    barcode.includes(keyword);


                let categoryMatch = true;

                if (selectedCategory !== "semua") {

                    categoryMatch =
                        category === selectedCategory;

                }

                return searchMatch && categoryMatch;

            });


        productCount.textContent =
            `${filtered.length} produk`;


        if (filtered.length === 0) {

            productList.innerHTML = `
                <div class="empty-products">
                    <div>📦</div>
                    <h3>Produk tidak ditemukan</h3>
                    <p>
                        Belum ada produk yang sesuai.
                    </p>
                </div>
            `;

            return;

        }


        productList.innerHTML = "";


        filtered.forEach(product => {

            const id =
                product.id;

            const name =
                product.name ||
                product.product_name ||
                "Produk";

            const code =
                product.code ||
                product.product_code ||
                "-";

            const category =
                product.category ||
                "lainnya";

            const stock =
                Number(
                    product.stock ??
                    product.current_stock ??
                    0
                );

            const price =
                Number(
                    product.sell_price ??
                    product.sale_price ??
                    product.price ??
                    0
                );


            const card =
                document.createElement("button");

            card.type = "button";

            card.className =
                "product-card";

            card.disabled =
                stock <= 0;


            card.innerHTML = `

                <div class="product-icon">
                    📦
                </div>

                <div class="product-info">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <small>
                        ${escapeHtml(code)}
                    </small>

                    <span>
                        ${escapeHtml(category)}
                    </span>

                </div>

                <div class="product-right">

                    <strong>
                        ${rupiah(price)}
                    </strong>

                    <small>
                        Stok: ${stock}
                    </small>

                </div>

            `;


            if (stock > 0) {

                card.addEventListener(
                    "click",
                    () => addToCart(product)
                );

            }


            productList.appendChild(card);

        });

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


    // ========================================
    // ADD CART
    // ========================================

    function addToCart(product) {

        const id =
            product.id;

        const stock =
            Number(
                product.stock ??
                product.current_stock ??
                0
            );

        const existing =
            cart.find(
                item => String(item.id) === String(id)
            );


        if (existing) {

            if (existing.qty >= stock) {

                alert("Jumlah melebihi stok.");

                return;

            }

            existing.qty++;

        } else {

            cart.push({

                id: product.id,

                name:
                    product.name ||
                    product.product_name ||
                    "Produk",

                code:
                    product.code ||
                    product.product_code ||
                    "-",

                sell_price:
                    Number(
                        product.sell_price ??
                        product.sale_price ??
                        product.price ??
                        0
                    ),

                stock: stock,

                qty: 1

            });

        }


        renderCart();

    }


    // ========================================
    // RENDER CART
    // ========================================

    function renderCart() {

        if (cart.length === 0) {

            cartItems.innerHTML = `
                <div class="empty-cart">

                    <div>🛒</div>

                    <h3>Keranjang masih kosong</h3>

                    <p>
                        Pilih produk untuk memulai transaksi.
                    </p>

                </div>
            `;

            cartCount.textContent =
                "0 item";

            updateSummary();

            return;

        }


        let totalQty = 0;

        cartItems.innerHTML = "";


        cart.forEach(item => {

            totalQty += item.qty;


            const itemElement =
                document.createElement("div");

            itemElement.className =
                "cart-item";


            itemElement.innerHTML = `

                <div class="cart-product">

                    <strong>
                        ${escapeHtml(item.name)}
                    </strong>

                    <small>
                        ${rupiah(item.sell_price)}
                    </small>

                </div>


                <div class="cart-controls">

                    <button
                        type="button"
                        class="qty-button"
                        data-action="minus"
                    >
                        −
                    </button>

                    <strong>
                        ${item.qty}
                    </strong>

                    <button
                        type="button"
                        class="qty-button"
                        data-action="plus"
                    >
                        +
                    </button>

                    <button
                        type="button"
                        class="remove-button"
                        data-action="remove"
                    >
                        ×
                    </button>

                </div>


                <strong class="cart-price">
                    ${rupiah(
                        item.sell_price * item.qty
                    )}
                </strong>

            `;


            itemElement
                .querySelector(
                    '[data-action="minus"]'
                )
                .addEventListener(
                    "click",
                    () => changeQty(item.id, -1)
                );


            itemElement
                .querySelector(
                    '[data-action="plus"]'
                )
                .addEventListener(
                    "click",
                    () => changeQty(item.id, 1)
                );


            itemElement
                .querySelector(
                    '[data-action="remove"]'
                )
                .addEventListener(
                    "click",
                    () => removeFromCart(item.id)
                );


            cartItems.appendChild(
                itemElement
            );

        });


        cartCount.textContent =
            `${totalQty} item`;


        updateSummary();

    }


    // ========================================
    // CHANGE QTY
    // ========================================

    function changeQty(id, amount) {

        const item =
            cart.find(
                item => String(item.id) === String(id)
            );

        if (!item) return;


        const newQty =
            item.qty + amount;


        if (newQty <= 0) {

            removeFromCart(id);

            return;

        }


        if (newQty > item.stock) {

            alert("Jumlah melebihi stok.");

            return;

        }


        item.qty =
            newQty;


        renderCart();

    }


    // ========================================
    // REMOVE
    // ========================================

    function removeFromCart(id) {

        cart =
            cart.filter(
                item => String(item.id) !== String(id)
            );

        renderCart();

    }


    // ========================================
    // SUMMARY
    // ========================================

    function updateSummary() {

        const subtotal =
            cart.reduce(
                (sum, item) =>
                    sum +
                    item.sell_price * item.qty,
                0
            );


        let discount =
            Number(
                discountInput.value
            ) || 0;


        if (discount > subtotal) {

            discount =
                subtotal;

            discountInput.value =
                subtotal;

        }


        const total =
            Math.max(
                0,
                subtotal - discount
            );


        const paid =
            Number(
                paidAmount.value
            ) || 0;


        const change =
            Math.max(
                0,
                paid - total
            );


        subtotalElement.textContent =
            rupiah(subtotal);

        totalElement.textContent =
            rupiah(total);

        changeElement.textContent =
            rupiah(change);

    }


    // ========================================
    // CATEGORY
    // ========================================

    categoryButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                categoryButtons
                    .forEach(
                        btn =>
                            btn.classList.remove("active")
                    );

                button.classList.add("active");

                selectedCategory =
                    button.dataset.category;

                renderProducts();

            }
        );

    });


    // ========================================
    // SEARCH
    // ========================================

    searchProduct.addEventListener(
        "input",
        renderProducts
    );


    // ========================================
    // DISCOUNT
    // ========================================

    discountInput.addEventListener(
        "input",
        updateSummary
    );


    // ========================================
    // PAID
    // ========================================

    paidAmount.addEventListener(
        "input",
        updateSummary
    );


    // ========================================
    // PAYMENT METHOD
    // ========================================

    paymentButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                paymentButtons
                    .forEach(
                        btn =>
                            btn.classList.remove("active")
                    );

                button.classList.add("active");

                paymentMethod =
                    button.dataset.payment;

            }
        );

    });


    // ========================================
    // CLEAR CART
    // ========================================

    clearCart.addEventListener(
        "click",
        () => {

            if (cart.length === 0) return;


            const yakin =
                confirm(
                    "Kosongkan semua produk di keranjang?"
                );


            if (!yakin) return;


            cart = [];

            renderCart();

        }
    );


    // ========================================
    // SAVE SALE
    // ========================================

    saveSale.addEventListener(
        "click",
        async () => {

            if (cart.length === 0) {

                alert(
                    "Keranjang masih kosong."
                );

                return;

            }


            const subtotal =
                cart.reduce(
                    (sum, item) =>
                        sum +
                        item.sell_price * item.qty,
                    0
                );


            const discount =
                Number(
                    discountInput.value
                ) || 0;


            const total =
                Math.max(
                    0,
                    subtotal - discount
                );


            const paid =
                Number(
                    paidAmount.value
                ) || 0;


            if (paid < total) {

                alert(
                    "Uang dibayar masih kurang."
                );

                return;

            }


            const payload = {

                payment_method:
                    paymentMethod,

                discount:
                    discount,

                paid_amount:
                    paid,

                notes:
                    saleNotes.value.trim(),

                items:
                    cart.map(item => ({

                        product_id:
                            item.id,

                        quantity:
                            item.qty,

                        price:
                            item.sell_price

                    }))

            };


            try {

                saveSale.disabled =
                    true;

                saveSale.textContent =
                    "⏳ MENYIMPAN...";


                const response =
                    await fetch(
                        "api/sales",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "include",

                            body:
                                JSON.stringify(payload)
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok ||
                    !data.success) {

                    throw new Error(
                        data.message ||
                        "Transaksi gagal disimpan."
                    );

                }


                alert(
                    "✅ Transaksi berhasil disimpan."
                );


                cart = [];

                discountInput.value =
                    0;

                paidAmount.value =
                    0;

                saleNotes.value =
                    "";

                renderCart();

                await loadProducts();


            } catch (error) {

                console.error(
                    "SAVE SALE ERROR:",
                    error
                );

                alert(
                    "Gagal menyimpan transaksi:\n" +
                    error.message
                );

            } finally {

                saveSale.disabled =
                    false;

                saveSale.textContent =
                    "💰 SIMPAN TRANSAKSI";

            }

        }
    );


    // ========================================
    // SIDEBAR SUBMENU
    // ========================================

    const produkMenuButton =
        document.getElementById(
            "produkMenuButton"
        );

    const produkSubmenu =
        document.getElementById(
            "produkSubmenu"
        );

    const produkArrow =
        document.getElementById(
            "produkArrow"
        );


    produkMenuButton.addEventListener(
        "click",
        () => {

            produkSubmenu.classList.toggle(
                "show"
            );

            produkArrow.classList.toggle(
                "open"
            );

        }
    );


    const pembelianMenuButton =
        document.getElementById(
            "pembelianMenuButton"
        );

    const pembelianSubmenu =
        document.getElementById(
            "pembelianSubmenu"
        );

    const pembelianArrow =
        document.getElementById(
            "pembelianArrow"
        );


    pembelianMenuButton.addEventListener(
        "click",
        () => {

            pembelianSubmenu.classList.toggle(
                "show"
            );

            pembelianArrow.classList.toggle(
                "open"
            );

        }
    );


    // ========================================
    // LOGOUT
    // ========================================

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    logoutButton.addEventListener(
        "click",
        async () => {

            const yakin =
                confirm(
                    "Apakah kamu yakin ingin keluar?"
                );


            if (!yakin) return;


            try {

                const response =
                    await fetch(
                        "api/logout",
                        {
                            method: "POST",
                            credentials: "include"
                        }
                    );


                const data =
                    await response.json();


                if (data.success) {

                    window.location.href =
                        "index.html";

                } else {

                    alert(
                        "Gagal logout."
                    );

                }

            } catch (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

                alert(
                    "Tidak dapat terhubung ke server."
                );

            }

        }
    );


    // ========================================
    // START
    // ========================================

    loadUser();

    loadProducts();

    renderCart();

});