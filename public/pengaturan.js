// ========================================
// AN-NAFIQ BENGKEL
// PENGATURAN
// ========================================

let settings = {
    business: {
        name: "AN-NAFIQ BENGKEL",
        phone: "",
        address: "",
        description: ""
    },

    account: {
        username: "bengkel an-nafiq"
    },

    receipt: {
        title: "AN-NAFIQ BENGKEL",
        footer: "Terima kasih telah berkunjung",
        note: ""
    },

    payment: {
        cash: true,
        transfer: false,
        qris: false,
        debit: false,
        credit: false
    },

    service: {
        defaultPrice: 40000
    }
};


// ========================================
// ELEMENT
// ========================================

const $ = (id) => document.getElementById(id);


// ========================================
// TOAST
// ========================================

function showToast(message, type = "success") {

    const toast = $("toast");
    const icon = $("toastIcon");
    const text = $("toastMessage");

    if (!toast || !icon || !text) return;

    icon.textContent = type === "error" ? "❌" : "✅";
    text.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// ========================================
// LOAD LOCAL SETTINGS
// ========================================

function loadLocalSettings() {

    try {

        const saved = localStorage.getItem("an_nafiq_settings");

        if (!saved) return;

        const parsed = JSON.parse(saved);

        settings = {
            ...settings,
            ...parsed,

            business: {
                ...settings.business,
                ...(parsed.business || {})
            },

            account: {
                ...settings.account,
                ...(parsed.account || {})
            },

            receipt: {
                ...settings.receipt,
                ...(parsed.receipt || {})
            },

            payment: {
                ...settings.payment,
                ...(parsed.payment || {})
            },

            service: {
                ...settings.service,
                ...(parsed.service || {})
            }
        };

    } catch (error) {

        console.error("Gagal membaca pengaturan:", error);

    }
}


// ========================================
// SAVE LOCAL SETTINGS
// ========================================

function saveLocalSettings() {

    localStorage.setItem(
        "an_nafiq_settings",
        JSON.stringify(settings)
    );
}


// ========================================
// LOAD SETTINGS FROM API
// ========================================

async function loadSettingsFromAPI() {

    try {

        const response = await fetch("api/settings", {
            credentials: "include"
        });

        if (!response.ok) return;

        const data = await response.json();

        if (!data) return;

        settings = {
            ...settings,
            ...data,

            business: {
                ...settings.business,
                ...(data.business || {})
            },

            account: {
                ...settings.account,
                ...(data.account || {})
            },

            receipt: {
                ...settings.receipt,
                ...(data.receipt || {})
            },

            payment: {
                ...settings.payment,
                ...(data.payment || {})
            },

            service: {
                ...settings.service,
                ...(data.service || {})
            }
        };

        saveLocalSettings();

    } catch (error) {

        // API belum dibuat tidak masalah.
        console.log("API pengaturan belum tersedia, menggunakan penyimpanan lokal.");

    }
}


// ========================================
// SAVE SETTINGS TO API
// ========================================

async function saveSettingsToAPI() {

    try {

        const response = await fetch("api/settings", {

            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            credentials: "include",

            body: JSON.stringify(settings)

        });

        if (!response.ok) {

            throw new Error("API belum tersedia");

        }

        return true;

    } catch (error) {

        console.log("Pengaturan disimpan lokal:", error.message);

        return false;

    }
}


// ========================================
// RENDER
// ========================================

function renderSettings() {

    // PROFIL
    $("businessName").value =
        settings.business.name || "";

    $("businessPhone").value =
        settings.business.phone || "";

    $("businessAddress").value =
        settings.business.address || "";

    $("businessDescription").value =
        settings.business.description || "";


    // ACCOUNT
    $("ownerUsername").value =
        settings.account.username || "bengkel an-nafiq";

    $("sidebarUsername").textContent =
        (settings.account.username || "bengkel an-nafiq").toUpperCase();


    // RECEIPT
    $("receiptTitle").value =
        settings.receipt.title || "";

    $("receiptFooter").value =
        settings.receipt.footer || "";

    $("receiptNote").value =
        settings.receipt.note || "";


    // PAYMENT
    $("paymentCash").checked =
        Boolean(settings.payment.cash);

    $("paymentTransfer").checked =
        Boolean(settings.payment.transfer);

    $("paymentQris").checked =
        Boolean(settings.payment.qris);

    $("paymentDebit").checked =
        Boolean(settings.payment.debit);

    $("paymentCredit").checked =
        Boolean(settings.payment.credit);


    // SERVICE
    $("defaultServicePrice").value =
        Number(settings.service.defaultPrice || 0);
}


// ========================================
// SAVE PROFILE
// ========================================

$("saveProfile").addEventListener("click", async () => {

    settings.business = {

        name: $("businessName").value.trim(),

        phone: $("businessPhone").value.trim(),

        address: $("businessAddress").value.trim(),

        description: $("businessDescription").value.trim()

    };

    saveLocalSettings();

    await saveSettingsToAPI();

    showToast("Profil bengkel berhasil disimpan");

});


// ========================================
// SAVE ACCOUNT
// ========================================

$("saveAccount").addEventListener("click", async () => {

    const username =
        $("ownerUsername").value.trim();

    if (!username) {

        showToast(
            "Username tidak boleh kosong",
            "error"
        );

        return;
    }

    settings.account.username = username;

    saveLocalSettings();

    await saveSettingsToAPI();

    renderSettings();

    showToast("Username berhasil disimpan");

});


// ========================================
// SAVE RECEIPT
// ========================================

$("saveReceipt").addEventListener("click", async () => {

    settings.receipt = {

        title:
            $("receiptTitle").value.trim(),

        footer:
            $("receiptFooter").value.trim(),

        note:
            $("receiptNote").value.trim()

    };

    saveLocalSettings();

    await saveSettingsToAPI();

    showToast("Pengaturan nota berhasil disimpan");

});


// ========================================
// SAVE PAYMENT
// ========================================

$("savePayment").addEventListener("click", async () => {

    settings.payment = {

        cash:
            $("paymentCash").checked,

        transfer:
            $("paymentTransfer").checked,

        qris:
            $("paymentQris").checked,

        debit:
            $("paymentDebit").checked,

        credit:
            $("paymentCredit").checked

    };

    saveLocalSettings();

    await saveSettingsToAPI();

    showToast("Metode pembayaran berhasil disimpan");

});


// ========================================
// SAVE SERVICE
// ========================================

$("saveService").addEventListener("click", async () => {

    const price =
        Number($("defaultServicePrice").value || 0);

    if (price < 0) {

        showToast(
            "Tarif tidak boleh negatif",
            "error"
        );

        return;
    }

    settings.service.defaultPrice = price;

    saveLocalSettings();

    await saveSettingsToAPI();

    showToast("Tarif servis berhasil disimpan");

});


// ========================================
// CHANGE PASSWORD
// ========================================

$("changePassword").addEventListener("click", async () => {

    const oldPassword =
        $("oldPassword").value;

    const newPassword =
        $("newPassword").value;

    const confirmPassword =
        $("confirmPassword").value;


    if (!oldPassword) {

        showToast(
            "Masukkan password lama",
            "error"
        );

        return;
    }


    if (!newPassword) {

        showToast(
            "Masukkan password baru",
            "error"
        );

        return;
    }


    if (newPassword.length < 6) {

        showToast(
            "Password baru minimal 6 karakter",
            "error"
        );

        return;
    }


    if (newPassword !== confirmPassword) {

        showToast(
            "Konfirmasi password tidak sama",
            "error"
        );

        return;
    }


    try {

        const response = await fetch(
            "api/change-password",
            {

                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    oldPassword,
                    newPassword
                })

            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Gagal mengubah password"
            );

        }


        $("oldPassword").value = "";
        $("newPassword").value = "";
        $("confirmPassword").value = "";


        showToast(
            "Password berhasil diubah"
        );


    } catch (error) {

        showToast(
            error.message ||
            "Gagal mengubah password",
            "error"
        );

    }

});


// ========================================
// RESET LOCAL
// ========================================

$("resetLocal").addEventListener("click", () => {

    const yakin = confirm(
        "Yakin ingin mereset pengaturan lokal di browser ini?"
    );

    if (!yakin) return;

    localStorage.removeItem(
        "an_nafiq_settings"
    );

    settings = {

        business: {
            name: "AN-NAFIQ BENGKEL",
            phone: "",
            address: "",
            description: ""
        },

        account: {
            username: "bengkel an-nafiq"
        },

        receipt: {
            title: "AN-NAFIQ BENGKEL",
            footer: "Terima kasih telah berkunjung",
            note: ""
        },

        payment: {
            cash: true,
            transfer: false,
            qris: false,
            debit: false,
            credit: false
        },

        service: {
            defaultPrice: 40000
        }

    };

    renderSettings();

    showToast(
        "Pengaturan lokal berhasil direset"
    );

});


// ========================================
// MOBILE SIDEBAR
// ========================================

$("mobileMenu").addEventListener("click", () => {

    $("sidebar").classList.toggle("open");

});


// ========================================
// LOGOUT
// ========================================

$("logoutBtn").addEventListener("click", async () => {

    const yakin = confirm(
        "Yakin ingin keluar dari akun?"
    );

    if (!yakin) return;

    try {

        await fetch(
            "api/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.log("Logout API error:", error);

    }

    window.location.href = "index.html";

});


// ========================================
// INIT
// ========================================

async function init() {

    loadLocalSettings();

    renderSettings();

    await loadSettingsFromAPI();

    renderSettings();

}

init();