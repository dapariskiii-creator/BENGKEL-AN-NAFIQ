let services = [];
let products = [];
let mechanics = [];

let editingServiceId = null;


/* =========================================================
   HELPER
========================================================= */

function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}


function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getValue(obj, keys, fallback = "") {

    for (const key of keys) {

        if (
            obj &&
            obj[key] !== undefined &&
            obj[key] !== null &&
            obj[key] !== ""
        ) {
            return obj[key];
        }

    }

    return fallback;
}


function showToast(message) {

    const toast = document.getElementById("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


/* =========================================================
   LOGIN
========================================================= */

async function checkLogin() {

    try {

        const response = await fetch("/api/me");

        if (!response.ok) {
            window.location.href = "index.html";
            return false;
        }

        const data = await response.json();

        const user =
            data.user ||
            data.data ||
            data;

        const userName =
            document.getElementById("userName");

        const userRole =
            document.getElementById("userRole");

        if (userName) {

            userName.textContent =
                getValue(
                    user,
                    ["full_name", "username"],
                    "User"
                );
        }

        if (userRole) {

            userRole.textContent =
                getValue(
                    user,
                    ["role_name", "role"],
                    "-"
                );
        }

        return true;

    } catch (error) {

        console.error(
            "CHECK LOGIN ERROR:",
            error
        );

        return false;
    }
}


/* =========================================================
   LOAD SERVICES
========================================================= */

async function loadServices() {

    const list =
        document.getElementById("serviceList");

    if (list) {

        list.innerHTML = `
            <div class="loading">
                Memuat data servis...
            </div>
        `;
    }

    try {

        const response =
            await fetch("/api/service-orders");

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
                "Gagal mengambil data servis"
            );
        }

        services =
            Array.isArray(data)
                ? data
                : (
                    data.service_orders ||
                    data.services ||
                    data.data ||
                    []
                );

        renderServices();
        updateStats();

    } catch (error) {

        console.error(
            "LOAD SERVICES ERROR:",
            error
        );

        if (list) {

            list.innerHTML = `
                <div class="empty">

                    <h3>
                        Belum bisa mengambil data servis
                    </h3>

                    <p>
                        ${escapeHtml(error.message)}
                    </p>

                </div>
            `;
        }
    }
}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const response =
            await fetch("/api/products");

        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;
        }

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
                : (
                    data.products ||
                    data.data ||
                    []
                );

    } catch (error) {

        console.error(
            "LOAD PRODUCTS ERROR:",
            error
        );

        products = [];
    }
}


/* =========================================================
   LOAD MECHANICS
========================================================= */

async function loadMechanics() {

    try {

        const response =
            await fetch("/api/mechanics");

        if (response.status === 401) {

            window.location.href =
                "index.html";

            return;
        }

        if (!response.ok) {

            throw new Error(
                "Gagal mengambil mekanik"
            );
        }

        const data =
            await response.json();

        mechanics =
            Array.isArray(data)
                ? data
                : (
                    data.mechanics ||
                    data.data ||
                    []
                );

        renderMechanics();

    } catch (error) {

        console.error(
            "LOAD MECHANICS ERROR:",
            error
        );

        mechanics = [];

        renderMechanics();
    }
}


/* =========================================================
   RENDER MECHANICS
========================================================= */

function renderMechanics() {

    const select =
        document.getElementById(
            "mechanicSelect"
        );

    if (!select) return;

    select.innerHTML = `
        <option value="">
            Pilih mekanik
        </option>
    `;

    mechanics.forEach(mechanic => {

        const id =
            getValue(
                mechanic,
                ["id"],
                ""
            );

        const name =
            getValue(
                mechanic,
                [
                    "name",
                    "full_name",
                    "mechanic_name"
                ],
                "Mekanik"
            );

        if (!id) return;

        select.innerHTML += `
            <option value="${escapeHtml(id)}">
                ${escapeHtml(name)}
            </option>
        `;
    });
}


/* =========================================================
   FIND MECHANIC NAME
========================================================= */

function getMechanicName(service) {

    const directName =
        getValue(
            service,
            [
                "mechanic_name",
                "mechanic_full_name"
            ],
            ""
        );

    if (directName) {
        return directName;
    }

    const mechanicId =
        getValue(
            service,
            ["mechanic_id"],
            ""
        );

    if (!mechanicId) {
        return "-";
    }

    const mechanic =
        mechanics.find(
            item =>
                String(
                    getValue(item, ["id"], "")
                ) === String(mechanicId)
        );

    if (!mechanic) {
        return "-";
    }

    return getValue(
        mechanic,
        [
            "name",
            "full_name",
            "mechanic_name"
        ],
        "-"
    );
}


/* =========================================================
   RENDER SERVICES
========================================================= */

function renderServices() {

    const list =
        document.getElementById(
            "serviceList"
        );

    if (!list) return;

    const searchElement =
        document.getElementById(
            "searchInput"
        );

    const statusElement =
        document.getElementById(
            "statusFilter"
        );

    const search =
        searchElement
            ? searchElement.value
                .toLowerCase()
                .trim()
            : "";

    const status =
        statusElement
            ? statusElement.value
            : "all";

    const filtered =
        services.filter(service => {

            const serviceNumber =
                getValue(
                    service,
                    [
                        "order_number",
                        "service_number",
                        "invoice_number"
                    ],
                    ""
                );

            const customer =
                getValue(
                    service,
                    [
                        "customer_name",
                        "customer"
                    ],
                    "Umum"
                );

            const plate =
                getValue(
                    service,
                    [
                        "vehicle_plate",
                        "plate_number",
                        "license_plate"
                    ],
                    ""
                );

            const vehicle =
                getValue(
                    service,
                    [
                        "vehicle_model",
                        "vehicle_name",
                        "vehicle",
                        "vehicle_type"
                    ],
                    ""
                );

            const mechanic =
                getMechanicName(service);

            const currentStatus =
                String(
                    getValue(
                        service,
                        ["status"],
                        "MENUNGGU"
                    )
                ).toUpperCase();

            const text =
                `
                ${serviceNumber}
                ${customer}
                ${plate}
                ${vehicle}
                ${mechanic}
                `
                    .toLowerCase();

            const matchSearch =
                !search ||
                text.includes(search);

            const matchStatus =
                status === "all" ||
                currentStatus === status;

            return (
                matchSearch &&
                matchStatus
            );
        });


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty">

                <h3>
                    Belum ada data servis
                </h3>

                <p>
                    Silakan buat servis baru.
                </p>

            </div>
        `;

        return;
    }


    list.innerHTML =
        filtered
            .map(serviceCard)
            .join("");
}


/* =========================================================
   SERVICE CARD
========================================================= */

function serviceCard(service) {

    const id =
        getValue(
            service,
            ["id"],
            ""
        );

    const number =
        getValue(
            service,
            [
                "order_number",
                "service_number",
                "invoice_number"
            ],
            "-"
        );

    const customer =
        getValue(
            service,
            [
                "customer_name",
                "customer"
            ],
            "Umum"
        );


    const plate =
        getValue(
            service,
            [
                "vehicle_plate",
                "plate_number",
                "license_plate"
            ],
            "-"
        );


    const vehicle =
        getValue(
            service,
            [
                "vehicle_model",
                "vehicle_name",
                "vehicle",
                "vehicle_type"
            ],
            "-"
        );


    const mechanic =
        getMechanicName(service);


    const total =
        Number(
            getValue(
                service,
                [
                    "final_cost",
                    "subtotal",
                    "estimated_cost",
                    "total_amount",
                    "total",
                    "grand_total"
                ],
                0
            )
        );


    const status =
        String(
            getValue(
                service,
                ["status"],
                "MENUNGGU"
            )
        ).toUpperCase();


    const date =
        getValue(
            service,
            [
                "order_date",
                "service_date",
                "created_at",
                "createdAt"
            ],
            ""
        );


    return `
        <div class="service-card">

            <div class="service-head">

                <div>

                    <div class="service-number">
                        ${escapeHtml(number)}
                    </div>

                    <div class="service-date">
                        ${formatDate(date)}
                    </div>

                </div>


                <span
                    class="status status-${escapeHtml(status)}"
                >
                    ${statusLabel(status)}
                </span>

            </div>


            <div class="service-info">

                <div>

                    <div class="info-label">
                        PELANGGAN
                    </div>

                    <div class="info-value">
                        ${escapeHtml(customer)}
                    </div>

                </div>


                <div>

                    <div class="info-label">
                        KENDARAAN
                    </div>

                    <div class="info-value">
                        ${escapeHtml(vehicle)}
                    </div>

                </div>


                <div>

                    <div class="info-label">
                        NO. POLISI
                    </div>

                    <div class="info-value">
                        ${escapeHtml(plate)}
                    </div>

                </div>


                <div>

                    <div class="info-label">
                        MEKANIK
                    </div>

                    <div class="info-value">
                        ${escapeHtml(mechanic)}
                    </div>

                </div>

            </div>


            <div class="service-footer">

                <div>

                    <div class="info-label">
                        TOTAL
                    </div>

                    <div class="service-total">
                        ${rupiah(total)}
                    </div>

                </div>


                <button
                    type="button"
                    class="detail-btn"
                    onclick="openDetail('${escapeHtml(id)}')"
                >
                    Lihat Detail →
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   STATUS LABEL
========================================================= */

function statusLabel(status) {

    const labels = {

        MENUNGGU:
            "Menunggu",

        WAITING:
            "Menunggu",

        DIKERJAKAN:
            "Dikerjakan",

        IN_PROGRESS:
            "Dikerjakan",

        WORKING:
            "Dikerjakan",

        SELESAI:
            "Selesai",

        COMPLETED:
            "Selesai",

        DIAMBIL:
            "Diambil",

        PICKED_UP:
            "Diambil",

        BATAL:
            "Batal",

        CANCELLED:
            "Batal"

    };

    return (
        labels[String(status).toUpperCase()] ||
        status
    );
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    let waiting = 0;
    let working = 0;
    let completed = 0;
    let revenue = 0;


    services.forEach(service => {

        const status =
            String(
                getValue(
                    service,
                    ["status"],
                    "MENUNGGU"
                )
            ).toUpperCase();


        const total =
            Number(
                getValue(
                    service,
                    [
                        "final_cost",
                        "subtotal",
                        "estimated_cost",
                        "total_amount",
                        "total",
                        "grand_total"
                    ],
                    0
                )
            );


        if (
            status === "MENUNGGU" ||
            status === "WAITING"
        ) {
            waiting++;
        }


        if (
            status === "DIKERJAKAN" ||
            status === "IN_PROGRESS" ||
            status === "WORKING"
        ) {
            working++;
        }


        if (
            status === "SELESAI" ||
            status === "COMPLETED" ||
            status === "DIAMBIL" ||
            status === "PICKED_UP"
        ) {
            completed++;
        }


        if (
            status !== "BATAL" &&
            status !== "CANCELLED"
        ) {
            revenue += total;
        }

    });


    const waitingCount =
        document.getElementById(
            "waitingCount"
        );

    const workingCount =
        document.getElementById(
            "workingCount"
        );

    const completedCount =
        document.getElementById(
            "completedCount"
        );

    const serviceRevenue =
        document.getElementById(
            "serviceRevenue"
        );


    if (waitingCount) {
        waitingCount.textContent =
            waiting;
    }

    if (workingCount) {
        workingCount.textContent =
            working;
    }

    if (completedCount) {
        completedCount.textContent =
            completed;
    }

    if (serviceRevenue) {
        serviceRevenue.textContent =
            rupiah(revenue);
    }
}


/* =========================================================
   OPEN SERVICE FORM
========================================================= */

async function openServiceForm() {

    editingServiceId = null;


    const modalTitle =
        document.getElementById(
            "modalTitle"
        );

    const form =
        document.getElementById(
            "serviceForm"
        );

    const itemsContainer =
        document.getElementById(
            "serviceItems"
        );

    const discountInput =
        document.getElementById(
            "discountInput"
        );

    const statusInput =
        document.getElementById(
            "serviceStatus"
        );


    if (modalTitle) {
        modalTitle.textContent =
            "Servis Baru";
    }


    if (form) {
        form.reset();
    }


    if (itemsContainer) {
        itemsContainer.innerHTML = "";
    }


    if (discountInput) {
        discountInput.value = 0;
    }


    if (statusInput) {
        statusInput.value =
            "MENUNGGU";
    }


    await loadProducts();
    await loadMechanics();


    addServiceItem();


    renderProductOptions();

    calculateTotal();


    const modal =
        document.getElementById(
            "serviceModal"
        );

    if (modal) {
        modal.classList.add("show");
    }
}


/* =========================================================
   CLOSE SERVICE FORM
========================================================= */

function closeServiceForm() {

    const modal =
        document.getElementById(
            "serviceModal"
        );

    if (modal) {
        modal.classList.remove("show");
    }
}


/* =========================================================
   ADD SERVICE ITEM
========================================================= */

function addServiceItem() {

    const container =
        document.getElementById(
            "serviceItems"
        );

    if (!container) return;


    const row =
        document.createElement("div");

    row.className =
        "item-row";


    row.innerHTML = `

        <select
            class="item-product"
            onchange="itemChanged(this)"
        >

            <option value="">
                Pilih jasa / sparepart
            </option>

            <option value="JASA">
                🔧 Jasa Servis
            </option>

            ${productOptionsHtml()}

        </select>


        <input
            type="number"
            class="item-qty"
            value="1"
            min="1"
            step="0.01"
            oninput="calculateTotal()"
        >


        <input
            type="number"
            class="item-price"
            value="0"
            min="0"
            step="1"
            oninput="calculateTotal()"
            placeholder="Harga"
        >


        <button
            type="button"
            class="remove-item"
            onclick="removeServiceItem(this)"
        >
            ×
        </button>

    `;


    container.appendChild(row);

    calculateTotal();
}


/* =========================================================
   PRODUCT OPTIONS
========================================================= */

function productOptionsHtml() {

    return products
        .filter(product => {

            const active =
                getValue(
                    product,
                    ["active"],
                    true
                );

            return active !== false;
        })
        .map(product => {

            const id =
                getValue(
                    product,
                    ["id"],
                    ""
                );


            const name =
                getValue(
                    product,
                    [
                        "name",
                        "product_name"
                    ],
                    "Produk"
                );


            const price =
                Number(
                    getValue(
                        product,
                        [
                            "sell_price",
                            "selling_price",
                            "price"
                        ],
                        0
                    )
                );


            if (!id) {
                return "";
            }


            return `
                <option
                    value="${escapeHtml(id)}"
                    data-price="${price}"
                >
                    ${escapeHtml(name)}
                    - ${rupiah(price)}
                </option>
            `;

        })
        .join("");
}


/* =========================================================
   RENDER PRODUCT OPTIONS
========================================================= */

function renderProductOptions() {

    document
        .querySelectorAll(
            ".item-product"
        )
        .forEach(select => {

            const current =
                select.value;


            select.innerHTML = `

                <option value="">
                    Pilih jasa / sparepart
                </option>

                <option value="JASA">
                    🔧 Jasa Servis
                </option>

                ${productOptionsHtml()}

            `;


            if (current) {
                select.value =
                    current;
            }

        });
}


/* =========================================================
   ITEM CHANGED
========================================================= */
/* =========================================================
   ITEM CHANGED
========================================================= */

async function itemChanged(select) {

    const row =
        select.closest(".item-row");

    if (!row) {
        return;
    }

    const priceInput =
        row.querySelector(".item-price");

    if (!priceInput) {
        return;
    }


    /* ==========================================
       JASA SERVIS
    ========================================== */

    if (select.value === "JASA") {

        let defaultPrice = 50000;

        try {

            const response =
                await fetch(
                    "api/settings",
                    {
                        credentials: "include"
                    }
                );


            if (response.ok) {

                const settings =
                    await response.json();


                defaultPrice =
                    Number(
                        settings?.service?.defaultPrice ||
                        50000
                    );
            }


        } catch (error) {

            console.error(
                "Gagal mengambil pengaturan servis:",
                error
            );


            /* ======================================
               FALLBACK LOCAL STORAGE
            ====================================== */

            try {

                const localSettings =
                    JSON.parse(
                        localStorage.getItem(
                            "an_nafiq_settings"
                        ) || "{}"
                    );


                defaultPrice =
                    Number(
                        localSettings?.service?.defaultPrice ||
                        50000
                    );


            } catch {

                defaultPrice = 50000;

            }

        }


        priceInput.value =
            defaultPrice;


        calculateTotal();


        return;
    }


    /* ==========================================
       PRODUK / SPAREPART
    ========================================== */

    const option =
        select.options[
            select.selectedIndex
        ];


    const price =
        Number(
            option?.dataset?.price || 0
        );


    priceInput.value =
        price;


    calculateTotal();

}
/* =========================================================
   REMOVE ITEM
========================================================= */

function removeServiceItem(button) {

    const row =
        button.closest(
            ".item-row"
        );

    if (row) {
        row.remove();
    }

    calculateTotal();
}


/* =========================================================
   CALCULATE TOTAL
========================================================= */

function calculateTotal() {

    let subtotal = 0;


    document
        .querySelectorAll(
            ".item-row"
        )
        .forEach(row => {

            const qty =
                Number(
                    row.querySelector(
                        ".item-qty"
                    )?.value || 0
                );


            const price =
                Number(
                    row.querySelector(
                        ".item-price"
                    )?.value || 0
                );


            if (
                qty > 0 &&
                price >= 0
            ) {

                subtotal +=
                    qty * price;
            }

        });


    const discountInput =
        document.getElementById(
            "discountInput"
        );


    const discount =
        Number(
            discountInput?.value || 0
        );


    const total =
        Math.max(
            0,
            subtotal - discount
        );


    const subtotalDisplay =
        document.getElementById(
            "subtotalDisplay"
        );

    const totalDisplay =
        document.getElementById(
            "totalDisplay"
        );


    if (subtotalDisplay) {

        subtotalDisplay.textContent =
            rupiah(subtotal);
    }


    if (totalDisplay) {

        totalDisplay.textContent =
            rupiah(total);
    }


    return {
        subtotal,
        discount,
        total
    };
}


/* =========================================================
   GET FORM VALUE
========================================================= */

function formValue(id) {

    const element =
        document.getElementById(id);

    if (!element) {
        return "";
    }

    return String(
        element.value ?? ""
    ).trim();
}


/* =========================================================
   SUBMIT SERVICE
========================================================= */

async function submitService(event) {

    event.preventDefault();


    const totals =
        calculateTotal();


    const items = [];


    document
        .querySelectorAll(
            ".item-row"
        )
        .forEach(row => {

            const productSelect =
                row.querySelector(
                    ".item-product"
                );

            const qtyInput =
                row.querySelector(
                    ".item-qty"
                );

            const priceInput =
                row.querySelector(
                    ".item-price"
                );


            if (
                !productSelect ||
                !qtyInput ||
                !priceInput
            ) {
                return;
            }


            const selected =
                productSelect.value;


            const quantity =
                Number(
                    qtyInput.value || 0
                );


            const price =
                Number(
                    priceInput.value || 0
                );


            if (
                !selected ||
                quantity <= 0
            ) {
                return;
            }


            const isService =
                selected === "JASA";


            items.push({

                item_type:
                    isService
                        ? "SERVICE"
                        : "PRODUCT",

                product_id:
                    isService
                        ? null
                        : selected,

                description:
                    isService
                        ? "Jasa Servis"
                        : "",

                quantity,

                unit_price:
                    price,

                subtotal:
                    quantity * price

            });

        });


    /* ==========================================
       DATA SERVICE
       ========================================== */

    const customerName =
        formValue(
            "customerName"
        );


    const customerPhone =
        formValue(
            "customerPhone"
        );


    const vehiclePlate =
        formValue(
            "vehiclePlate"
        );


    const vehicleName =
        formValue(
            "vehicleName"
        );


    const vehicleKm =
        Number(
            formValue(
                "vehicleKm"
            ) || 0
        );


    const mechanicId =
        formValue(
            "mechanicSelect"
        ) || null;


    const complaint =
        formValue(
            "complaint"
        );


    const mechanicNotes =
        formValue(
            "mechanicNotes"
        );


    const status =
        formValue(
            "serviceStatus"
        ) ||
        "MENUNGGU";


    /* ==========================================
       VALIDASI
       ========================================== */

    if (!vehiclePlate) {

        showToast(
            "Nomor polisi wajib diisi."
        );

        return;
    }


    if (!complaint) {

        showToast(
            "Keluhan pelanggan wajib diisi."
        );

        return;
    }


    if (!items.length) {

        showToast(
            "Tambahkan minimal 1 jasa atau sparepart."
        );

        return;
    }


    /* ==========================================
       PAYLOAD
       ========================================== */

    const payload = {

        customer_name:
            customerName,

        customer_phone:
            customerPhone,

        phone:
            customerPhone,

        vehicle_plate:
            vehiclePlate,

        license_plate:
            vehiclePlate,

        vehicle_name:
            vehicleName,

        vehicle_model:
            vehicleName,

        vehicle_km:
            vehicleKm,

        current_km:
            vehicleKm,

        mechanic_id:
            mechanicId,

        complaint:
            complaint,

        mechanic_notes:
            mechanicNotes,

        items,

        subtotal:
            totals.subtotal,

        discount:
            totals.discount,

        total:
            totals.total,

        estimated_cost:
            totals.total,

        final_cost:
            totals.total,

        status

    };


    console.log(
        "SERVICE PAYLOAD:",
        payload
    );


    try {

        const url =
            editingServiceId
                ? `/api/service-orders/${editingServiceId}`
                : "/api/service-orders";


        const method =
            editingServiceId
                ? "PUT"
                : "POST";


        const response =
            await fetch(
                url,
                {
                    method,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const data =
            await response.json();


        console.log(
            "SERVICE RESPONSE:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Gagal menyimpan servis"
            );
        }


        showToast(
            editingServiceId
                ? "Servis berhasil diperbarui."
                : "Servis berhasil dibuat."
        );


        closeServiceForm();


        editingServiceId =
            null;


        await loadServices();


    } catch (error) {

        console.error(
            "SUBMIT SERVICE ERROR:",
            error
        );


        showToast(
            error.message ||
            "Gagal menyimpan servis"
        );
    }
}


/* =========================================================
   FORM SUBMIT
========================================================= */

function setupFormSubmit() {

    const form =
        document.getElementById(
            "serviceForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        submitService
    );
}


/* =========================================================
   OPEN DETAIL
========================================================= */

async function openDetail(id) {

    if (!id) {
        return;
    }


    const modal =
        document.getElementById(
            "detailModal"
        );


    const detail =
        document.getElementById(
            "serviceDetail"
        );


    if (!modal || !detail) {
        return;
    }


    detail.innerHTML = `
        <div class="loading">
            Memuat detail...
        </div>
    `;


    modal.classList.add(
        "show"
    );


    try {

        const response =
            await fetch(
                `/api/service-orders/${id}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Gagal mengambil detail"
            );
        }


        const service =
            data.service_order ||
            data.service ||
            data.data ||
            data;


        const items =
            data.items ||
            service.items ||
            [];


        renderDetail(
            service,
            items
        );


    } catch (error) {

        console.error(
            "DETAIL ERROR:",
            error
        );


        detail.innerHTML = `
            <div class="empty">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


/* =========================================================
   RENDER DETAIL
========================================================= */

function renderDetail(
    service,
    items
) {

    const detail =
        document.getElementById(
            "serviceDetail"
        );


    if (!detail) {
        return;
    }


    const customer =
        getValue(
            service,
            [
                "customer_name",
                "customer"
            ],
            "Umum"
        );


    const phone =
        getValue(
            service,
            [
                "customer_phone",
                "phone"
            ],
            "-"
        );


    const vehicle =
        getValue(
            service,
            [
                "vehicle_model",
                "vehicle_name",
                "vehicle",
                "vehicle_type"
            ],
            "-"
        );


    const plate =
        getValue(
            service,
            [
                "vehicle_plate",
                "plate_number",
                "license_plate"
            ],
            "-"
        );


    const mechanic =
        getMechanicName(
            service
        );


    const complaint =
        getValue(
            service,
            [
                "complaint",
                "customer_complaint"
            ],
            "-"
        );


    const inspection =
        getValue(
            service,
            [
                "inspection"
            ],
            "-"
        );


    const serviceDescription =
        getValue(
            service,
            [
                "service_description"
            ],
            "-"
        );


    const notes =
        getValue(
            service,
            [
                "mechanic_notes",
                "notes"
            ],
            "-"
        );


    const status =
        String(
            getValue(
                service,
                ["status"],
                "MENUNGGU"
            )
        ).toUpperCase();


    const total =
        Number(
            getValue(
                service,
                [
                    "final_cost",
                    "subtotal",
                    "estimated_cost",
                    "total_amount",
                    "total",
                    "grand_total"
                ],
                0
            )
        );


    detail.innerHTML = `

        <div class="detail-row">

            <span>
                Pelanggan
            </span>

            <strong>
                ${escapeHtml(customer)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                No. HP
            </span>

            <strong>
                ${escapeHtml(phone)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Kendaraan
            </span>

            <strong>
                ${escapeHtml(vehicle)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                No. Polisi
            </span>

            <strong>
                ${escapeHtml(plate)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Mekanik
            </span>

            <strong>
                ${escapeHtml(mechanic)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Status
            </span>

            <span
                class="status status-${escapeHtml(status)}"
            >
                ${statusLabel(status)}
            </span>

        </div>


        <div class="detail-row">

            <span>
                Keluhan
            </span>

            <strong>
                ${escapeHtml(complaint)}
            </strong>

        </div>


        ${
            inspection &&
            inspection !== "-"
                ? `
                    <div class="detail-row">

                        <span>
                            Pemeriksaan
                        </span>

                        <strong>
                            ${escapeHtml(inspection)}
                        </strong>

                    </div>
                `
                : ""
        }


        ${
            serviceDescription &&
            serviceDescription !== "-"
                ? `
                    <div class="detail-row">

                        <span>
                            Pekerjaan
                        </span>

                        <strong>
                            ${escapeHtml(
                                serviceDescription
                            )}
                        </strong>

                    </div>
                `
                : ""
        }


        <div class="detail-row">

            <span>
                Catatan Mekanik
            </span>

            <strong>
                ${escapeHtml(notes)}
            </strong>

        </div>


        <div class="detail-items">

            <h3>
                Pekerjaan & Sparepart
            </h3>


            ${
                items.length

                    ? items
                        .map(item => {

                            const itemType =
                                String(
                                    getValue(
                                        item,
                                        ["item_type"],
                                        ""
                                    )
                                ).toUpperCase();


                            const name =
                                getValue(
                                    item,
                                    [
                                        "product_name",
                                        "name",
                                        "item_name",
                                        "description"
                                    ],
                                    itemType === "SERVICE"
                                        ? "Jasa Servis"
                                        : "Item"
                                );


                            const qty =
                                Number(
                                    getValue(
                                        item,
                                        [
                                            "quantity",
                                            "qty"
                                        ],
                                        1
                                    )
                                );


                            const price =
                                Number(
                                    getValue(
                                        item,
                                        [
                                            "unit_price",
                                            "price"
                                        ],
                                        0
                                    )
                                );


                            const subtotal =
                                Number(
                                    getValue(
                                        item,
                                        [
                                            "subtotal"
                                        ],
                                        qty * price
                                    )
                                );


                            return `

                                <div
                                    class="detail-item"
                                >

                                    <span>

                                        ${escapeHtml(
                                            name
                                        )}

                                        × ${qty}

                                    </span>


                                    <strong>

                                        ${rupiah(
                                            subtotal
                                        )}

                                    </strong>

                                </div>

                            `;

                        })
                        .join("")

                    : `

                        <p
                            style="
                                margin-top:10px;
                                color:#6b7280
                            "
                        >
                            Belum ada item.
                        </p>

                    `
            }

        </div>


        <div
            class="detail-row"
            style="margin-top:15px"
        >

            <span>
                Total
            </span>

            <strong
                style="
                    font-size:20px;
                    color:#15803d
                "
            >
                ${rupiah(total)}
            </strong>

        </div>

    `;
}


/* =========================================================
   CLOSE DETAIL
========================================================= */

function closeDetail() {

    const modal =
        document.getElementById(
            "detailModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (sidebar) {

        sidebar.classList.toggle(
            "show"
        );
    }
}


/* =========================================================
   SUBMENU
========================================================= */

function toggleSubmenu(id) {

    const submenu =
        document.getElementById(id);


    if (!submenu) {
        return;
    }


    submenu.classList.toggle(
        "open"
    );
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    try {

        await fetch(
            "/api/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );
    }


    window.location.href =
        "index.html";
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const search =
        document.getElementById(
            "searchInput"
        );


    if (search) {

        search.addEventListener(
            "input",
            renderServices
        );
    }


    const filter =
        document.getElementById(
            "statusFilter"
        );


    if (filter) {

        filter.addEventListener(
            "change",
            renderServices
        );
    }
}


/* =========================================================
   DISCOUNT INPUT
========================================================= */

function setupDiscount() {

    const discount =
        document.getElementById(
            "discountInput"
        );


    if (discount) {

        discount.addEventListener(
            "input",
            calculateTotal
        );
    }
}


/* =========================================================
   CLOSE MODAL WHEN CLICK OUTSIDE
========================================================= */

function setupModalOutsideClick() {

    const serviceModal =
        document.getElementById(
            "serviceModal"
        );


    const detailModal =
        document.getElementById(
            "detailModal"
        );


    if (serviceModal) {

        serviceModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    serviceModal
                ) {

                    closeServiceForm();
                }
            }
        );
    }


    if (detailModal) {

        detailModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    detailModal
                ) {

                    closeDetail();
                }
            }
        );
    }
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    const loggedIn =
        await checkLogin();


    if (!loggedIn) {
        return;
    }


    setupFormSubmit();

    setupSearch();

    setupDiscount();

    setupModalOutsideClick();


    await Promise.all([
        loadProducts(),
        loadMechanics()
    ]);


    await loadServices();
}


/* =========================================================
   START
========================================================= */

init();