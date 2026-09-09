// ================================
// AN-NAFIQ BENGKEL
// DASHBOARD.JS
// ================================

console.log("dashboard.js terbaca");

document.addEventListener("DOMContentLoaded", async () => {

    // ================================
    // NAVIGASI SIDEBAR
    // ================================

    document.querySelectorAll(".menu-item").forEach((menuItem) => {

        menuItem.addEventListener("click", function (event) {

            const href = this.getAttribute("href");

            // Kalau link memiliki tujuan, arahkan langsung
            if (href && href !== "#") {
                event.preventDefault();
                window.location.href = href;
            }

        });

    });


    // ================================
    // TANGGAL
    // ================================

    const todayDate = document.getElementById("todayDate");

    if (todayDate) {

        const sekarang = new Date();

        todayDate.textContent =
            sekarang.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });

    }


    // ================================
    // CEK LOGIN
    // ================================

    try {

        const meResponse = await fetch("/api/me", {
            method: "GET",
            credentials: "include"
        });

        const meData = await meResponse.json();

        if (!meResponse.ok || !meData.success) {

            window.location.href = "/index.html";
            return;

        }


        // ================================
        // USER
        // ================================

        const userName =
            document.getElementById("userName");

        const userRole =
            document.getElementById("userRole");

        if (userName) {

            userName.textContent =
                meData.user.full_name ||
                meData.user.username;

        }

        if (userRole) {

            userRole.textContent =
                meData.user.role ||
                "USER";

        }


        // ================================
        // AMBIL DATA DASHBOARD
        // ================================

        const dashboardResponse =
            await fetch("/api/dashboard", {
                method: "GET",
                credentials: "include"
            });

        const dashboardData =
            await dashboardResponse.json();

        if (!dashboardResponse.ok ||
            !dashboardData.success) {

            console.error(
                "Gagal mengambil dashboard:",
                dashboardData
            );

            return;

        }


        const data =
            dashboardData.dashboard;


        // ================================
        // FORMAT RUPIAH
        // ================================

        function rupiah(angka) {

            return new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0
            }).format(Number(angka) || 0);

        }


        // ================================
        // STAT CARDS
        // ================================

        const statCards =
            document.querySelectorAll(".stat-card");


        // Omzet Hari Ini
        if (statCards[0]) {

            const angka =
                statCards[0].querySelector("strong");

            if (angka) {

                angka.textContent =
                    rupiah(data.omzet_hari_ini);

            }

        }


        // Total Produk
        if (statCards[3]) {

            const angka =
                statCards[3].querySelector("strong");

            if (angka) {

                angka.textContent =
                    data.total_produk;

            }

        }


        // ================================
        // PIUTANG
        // ================================

        const piutangBadge =
            document.querySelector(
                ".panel:nth-of-type(1) .badge"
            );

        if (piutangBadge) {

            piutangBadge.textContent =
                rupiah(data.piutang);

        }


        // ================================
        // HUTANG
        // ================================

        const hutangBadge =
            document.querySelector(
                ".panel:nth-of-type(2) .badge"
            );

        if (hutangBadge) {

            hutangBadge.textContent =
                rupiah(data.hutang);

        }


        // ================================
        // STOCK
        // ================================

        const stockItems =
            document.querySelectorAll(".stock-item");


        // Total Produk
        if (stockItems[0]) {

            const angka =
                stockItems[0].querySelector("strong");

            if (angka) {

                angka.textContent =
                    data.stok.total_produk;

            }

        }


        // Stok Menipis
        if (stockItems[1]) {

            const angka =
                stockItems[1].querySelector("strong");

            if (angka) {

                angka.textContent =
                    data.stok.stok_menipis;

            }

        }


        // Stok Habis
        if (stockItems[2]) {

            const angka =
                stockItems[2].querySelector("strong");

            if (angka) {

                angka.textContent =
                    data.stok.stok_habis;

            }

        }


        // Nilai Persediaan
        if (stockItems[3]) {

            const angka =
                stockItems[3].querySelector("strong");

            if (angka) {

                angka.textContent =
                    rupiah(
                        data.stok.nilai_persediaan
                    );

            }

        }


        // ================================
        // SELESAI
        // ================================

        console.log(
            "Dashboard berhasil dimuat:",
            data
        );


    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );

    }


    // ================================
    // LOGOUT
    // ================================

    const logoutButton =
        document.getElementById("logoutButton");

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                const yakin =
                    confirm(
                        "Apakah kamu yakin ingin keluar?"
                    );

                if (!yakin) {
                    return;
                }


                try {

                    const response =
                        await fetch(
                            "/api/logout",
                            {
                                method: "POST",
                                credentials: "include"
                            }
                        );


                    const data =
                        await response.json();


                    if (data.success) {

                        window.location.href =
                            "/index.html";

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

    }

});