const express = require("express");
const bcrypt = require("bcryptjs");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
require("dotenv").config();

const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// SESSION UNTUK VERCEL + NEON
// ========================================

app.set("trust proxy", 1);

app.use(
    session({
        store: new pgSession({
            pool: db,
            tableName: "user_sessions",
            createTableIfMissing: true
        }),

        secret: process.env.SESSION_SECRET || "an-nafiq-secret",

        resave: false,

        saveUninitialized: false,

        rolling: true,

        cookie: {
            maxAge: 1000 * 60 * 60 * 8,
            httpOnly: true,
            secure: true,
            sameSite: "lax"
        }
    })
);
// ========================================
// FRONTEND
// ========================================

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ========================================
// API STATUS
// ========================================

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "AN-NAFIQ-BENGKEL berjalan!",
        time: new Date().toISOString()
    });
});

// ========================================
// DATABASE TEST
// ========================================

app.get("/api/db-test", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW() AS waktu");

        res.json({
            success: true,
            message: "Database Neon berhasil terhubung!",
            waktu: result.rows[0].waktu
        });

    } catch (error) {
        console.error("DATABASE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Database gagal terhubung",
            error: error.message
        });
    }
});

// ========================================
// LOGIN
// ========================================

app.post("/api/login", async (req, res) => {
    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username dan password wajib diisi"
            });
        }

        const result = await db.query(
            `
            SELECT
                u.id,
                u.username,
                u.password_hash,
                u.full_name,
                u.active,
                r.name AS role
            FROM users u
            LEFT JOIN roles r
                ON r.id = u.role_id
            WHERE u.username = $1
            LIMIT 1
            `,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Username atau password salah"
            });
        }

        const user = result.rows[0];

        if (!user.active) {
            return res.status(403).json({
                success: false,
                message: "Akun tidak aktif"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Username atau password salah"
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        // Update last login kalau kolomnya tersedia
        try {
            await db.query(
                `
                UPDATE users
                SET last_login_at = NOW()
                WHERE id = $1
                `,
                [user.id]
            );
        } catch (error) {
            console.log(
                "INFO: last_login_at tidak diperbarui:",
                error.message
            );
        }

        res.json({
            success: true,
            message: "Login berhasil",
            user: req.session.user
        });

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server",
            error: error.message
        });
    }
});

// ========================================
// API DASHBOARD
// ========================================

app.get("/api/dashboard", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        // ========================================
        // TOTAL PRODUK
        // ========================================

        const productsResult = await db.query(`
            SELECT
                COUNT(*)::int AS total
            FROM products
            WHERE active = TRUE
        `);

        // ========================================
        // OMZET HARI INI
        // ========================================

        const salesTodayResult = await db.query(`
            SELECT
                COALESCE(SUM(total), 0) AS omzet
            FROM sales
            WHERE DATE(sale_date) = CURRENT_DATE
            AND status = 'COMPLETED'
        `);

        // ========================================
        // PIUTANG
        // ========================================
        // Tidak memakai kolom "balance"
        // karena kolom tersebut tidak ada.
        //
        // Kita hitung:
        // total_amount - paid_amount
        // ========================================

        let piutang = 0;

        try {

            const receivableResult = await db.query(`
                SELECT
                    COALESCE(
                        SUM(
                            COALESCE(total_amount, 0)
                            -
                            COALESCE(paid_amount, 0)
                        ),
                        0
                    ) AS total
                FROM accounts_receivable
                WHERE status IN (
                    'OPEN',
                    'PARTIAL',
                    'OVERDUE'
                )
            `);

            piutang = Number(
                receivableResult.rows[0]?.total || 0
            );

        } catch (error) {

            console.log(
                "INFO PIUTANG:",
                error.message
            );

            piutang = 0;
        }

        // ========================================
        // HUTANG
        // ========================================

        let hutang = 0;

        try {

            const payableResult = await db.query(`
                SELECT
                    COALESCE(
                        SUM(
                            COALESCE(total_amount, 0)
                            -
                            COALESCE(paid_amount, 0)
                        ),
                        0
                    ) AS total
                FROM accounts_payable
                WHERE status IN (
                    'OPEN',
                    'PARTIAL',
                    'OVERDUE'
                )
            `);

            hutang = Number(
                payableResult.rows[0]?.total || 0
            );

        } catch (error) {

            console.log(
                "INFO HUTANG:",
                error.message
            );

            hutang = 0;
        }

        // ========================================
        // STOK
        // ========================================

        const stockResult = await db.query(`
            SELECT

                COUNT(*) FILTER (
                    WHERE active = TRUE
                )::int AS total_produk,

                COUNT(*) FILTER (
                    WHERE active = TRUE
                    AND stock > minimum_stock
                )::int AS stok_tersedia,

                COUNT(*) FILTER (
                    WHERE active = TRUE
                    AND stock > 0
                    AND stock <= minimum_stock
                )::int AS stok_menipis,

                COUNT(*) FILTER (
                    WHERE active = TRUE
                    AND stock <= 0
                )::int AS stok_habis,

                COALESCE(
                    SUM(stock * buy_price)
                    FILTER (
                        WHERE active = TRUE
                    ),
                    0
                ) AS nilai_persediaan

            FROM products
        `);

        // ========================================
        // RESPONSE DASHBOARD
        // ========================================

        res.json({

            success: true,

            dashboard: {

                omzet_hari_ini:
                    Number(
                        salesTodayResult.rows[0]?.omzet || 0
                    ),

                total_produk:
                    Number(
                        productsResult.rows[0]?.total || 0
                    ),

                piutang,

                hutang,

                stok: {

                    total_produk:
                        Number(
                            stockResult.rows[0]?.total_produk || 0
                        ),

                    stok_tersedia:
                        Number(
                            stockResult.rows[0]?.stok_tersedia || 0
                        ),

                    stok_menipis:
                        Number(
                            stockResult.rows[0]?.stok_menipis || 0
                        ),

                    stok_habis:
                        Number(
                            stockResult.rows[0]?.stok_habis || 0
                        ),

                    nilai_persediaan:
                        Number(
                            stockResult.rows[0]?.nilai_persediaan || 0
                        )
                }
            }
        });

    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data dashboard",
            error: error.message
        });
    }
});

// ============================================================
// API PRODUK
// ============================================================

// ========================================
// GET SEMUA PRODUK
// ========================================

app.get("/api/products", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const result = await db.query(`
            SELECT
                p.id,
                p.code,
                p.barcode,
                p.name,
                p.brand,

                p.category_id,
                c.name AS category_name,

                p.unit_id,
                u.name AS unit_name,

                p.supplier_id,
                s.name AS supplier_name,

                p.buy_price,
                p.sell_price,
                p.average_cost,
                p.stock,
                p.minimum_stock,
                p.location,
                p.active,
                p.created_at,
                p.updated_at

            FROM products p

            LEFT JOIN categories c
                ON c.id = p.category_id

            LEFT JOIN units u
                ON u.id = p.unit_id

            LEFT JOIN suppliers s
                ON s.id = p.supplier_id

            WHERE p.active = TRUE

            ORDER BY p.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(
            "GET PRODUCTS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data produk",
            error: error.message
        });
    }
});

// ========================================
// TAMBAH PRODUK
// ========================================

app.post("/api/products", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        // PENTING:
        // Frontend mengirim "code",
        // bukan "product_code"

        const {
            code,
            barcode,
            name,
            brand,
            category,
            unit,
            buy_price,
            sell_price,
            stock,
            minimum_stock,
            supplier,
            location
        } = req.body;

        // ========================================
        // VALIDASI
        // ========================================

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Nama produk wajib diisi"
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Kategori wajib dipilih"
            });
        }

        if (!unit) {
            return res.status(400).json({
                success: false,
                message: "Satuan wajib dipilih"
            });
        }

        // ========================================
        // CARI KATEGORI
        // ========================================

        const categoryResult = await db.query(
            `
            SELECT id
            FROM categories
            WHERE UPPER(name) = UPPER($1)
            LIMIT 1
            `,
            [category]
        );

        if (categoryResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Kategori "${category}" tidak ditemukan`
            });
        }

        // ========================================
        // CARI SATUAN
        // ========================================

        const unitResult = await db.query(
            `
            SELECT id
            FROM units
            WHERE UPPER(name) = UPPER($1)
            LIMIT 1
            `,
            [unit]
        );

        if (unitResult.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: `Satuan "${unit}" tidak ditemukan`
            });
        }

        const categoryId =
            categoryResult.rows[0].id;

        const unitId =
            unitResult.rows[0].id;

        // ========================================
        // SUPPLIER
        // ========================================

        let supplierId = null;

        if (supplier) {

            try {

                const supplierResult = await db.query(
                    `
                    SELECT id
                    FROM suppliers
                    WHERE name = $1
                    LIMIT 1
                    `,
                    [supplier]
                );

                if (supplierResult.rows.length > 0) {
                    supplierId =
                        supplierResult.rows[0].id;
                }

            } catch (error) {

                console.log(
                    "INFO SUPPLIER:",
                    error.message
                );

                supplierId = null;
            }
        }

        // ========================================
        // ANGKA
        // ========================================

        const hargaBeli =
            Number(buy_price) || 0;

        const hargaJual =
            Number(sell_price) || 0;

        const stokAwal =
            Number(stock) || 0;

        const stokMinimum =
            Number(minimum_stock) || 0;

        // ========================================
        // INSERT PRODUK
        // ========================================

        const result = await db.query(
            `
            INSERT INTO products (

                code,
                barcode,
                name,
                brand,

                category_id,
                unit_id,
                supplier_id,

                buy_price,
                sell_price,
                average_cost,

                stock,
                minimum_stock,

                location,
                active

            )
            VALUES (

                $1,
                $2,
                $3,
                $4,

                $5,
                $6,
                $7,

                $8,
                $9,
                $10,

                $11,
                $12,

                $13,
                TRUE

            )

            RETURNING *
            `,
            [

                code || null,

                barcode || null,

                name,

                brand || null,

                categoryId,

                unitId,

                supplierId,

                hargaBeli,

                hargaJual,

                hargaBeli,

                stokAwal,

                stokMinimum,

                location || null
            ]
        );

        res.json({
            success: true,
            message: "Produk berhasil ditambahkan",
            product: result.rows[0]
        });

    } catch (error) {

        console.error(
            "ADD PRODUCT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan produk",
            error: error.message
        });
    }
});

// ========================================
// EDIT PRODUK
// ========================================

app.put("/api/products/:id", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const id = req.params.id;

        const {
            code,
            barcode,
            name,
            category,
            unit,
            buy_price,
            sell_price,
            stock,
            minimum_stock,
            supplier,
            location
        } = req.body;


        // ========================================
        // VALIDASI
        // ========================================

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Nama produk wajib diisi"
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Kategori wajib dipilih"
            });
        }

        if (!unit) {
            return res.status(400).json({
                success: false,
                message: "Satuan wajib dipilih"
            });
        }


        // ========================================
        // CARI KATEGORI
        // ========================================

        const categoryResult = await db.query(
            `
            SELECT id
            FROM categories
            WHERE UPPER(name) = UPPER($1)
            LIMIT 1
            `,
            [category]
        );

        if (categoryResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }


        // ========================================
        // CARI SATUAN
        // ========================================

        const unitResult = await db.query(
            `
            SELECT id
            FROM units
            WHERE UPPER(name) = UPPER($1)
            LIMIT 1
            `,
            [unit]
        );

        if (unitResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Satuan tidak ditemukan"
            });
        }


        // ========================================
        // CARI SUPPLIER
        // ========================================

        let supplierId = null;

        if (supplier) {

            const supplierResult = await db.query(
                `
                SELECT id
                FROM suppliers
                WHERE name = $1
                LIMIT 1
                `,
                [supplier]
            );

            if (supplierResult.rows.length > 0) {
                supplierId = supplierResult.rows[0].id;
            }
        }


        // ========================================
        // UPDATE PRODUK
        // ========================================

        const result = await db.query(
            `
            UPDATE products

            SET
                code = $1,
                barcode = $2,
                name = $3,
                category_id = $4,
                unit_id = $5,
                supplier_id = $6,
                buy_price = $7,
                sell_price = $8,
                average_cost = $7,
                stock = $9,
                minimum_stock = $10,
                location = $11,
                updated_at = NOW()

            WHERE id = $12
            AND active = TRUE

            RETURNING *
            `,
            [
                code || null,
                barcode || null,
                name,
                categoryResult.rows[0].id,
                unitResult.rows[0].id,
                supplierId,
                Number(buy_price) || 0,
                Number(sell_price) || 0,
                Number(stock) || 0,
                Number(minimum_stock) || 0,
                location || null,
                id
            ]
        );


        // ========================================
        // PRODUK TIDAK DITEMUKAN
        // ========================================

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });

        }


        // ========================================
        // BERHASIL
        // ========================================

        res.json({
            success: true,
            message: "Produk berhasil diperbarui",
            product: result.rows[0]
        });


    } catch (error) {

        console.error(
            "EDIT PRODUCT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui produk",
            error: error.message
        });

    }

});

// ========================================
// HAPUS PRODUK
// ========================================

app.delete("/api/products/:id", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const id = req.params.id;

        const result = await db.query(
            `
            UPDATE products

            SET
                active = FALSE,
                updated_at = NOW()

            WHERE id = $1

            RETURNING id
            `,
            [id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Produk berhasil dihapus"
        });

    } catch (error) {

        console.error(
            "DELETE PRODUCT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menghapus produk",
            error: error.message
        });
    }
});
// ========================================
// STOK MASUK
// ========================================

app.post("/api/stock-in", async (req, res) => {

    const client = await db.connect();

    try {

        // ========================================
        // CEK LOGIN
        // ========================================

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const {
            product_id,
            quantity,
            buy_price,
            supplier,
            invoice_number,
            stock_date,
            notes
        } = req.body;

        // ========================================
        // VALIDASI
        // ========================================

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Produk wajib dipilih"
            });
        }

        const qty = Number(quantity);
        const hargaBeli = Number(buy_price) || 0;

        if (qty <= 0) {
            return res.status(400).json({
                success: false,
                message: "Jumlah stok harus lebih dari 0"
            });
        }

        if (hargaBeli < 0) {
            return res.status(400).json({
                success: false,
                message: "Harga beli tidak boleh minus"
            });
        }

        // ========================================
        // MULAI TRANSACTION
        // ========================================

        await client.query("BEGIN");

        // ========================================
        // AMBIL PRODUK
        // ========================================

        const productResult = await client.query(
            `
            SELECT
                id,
                name,
                stock,
                buy_price,
                average_cost
            FROM products
            WHERE id = $1
            AND active = TRUE
            FOR UPDATE
            `,
            [product_id]
        );

        if (productResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        const product = productResult.rows[0];

        const stokLama =
            Number(product.stock || 0);

        const stokBaru =
            stokLama + qty;

        // ========================================
        // HITUNG AVERAGE COST
        // ========================================

        const averageCostLama =
            Number(
                product.average_cost ??
                product.buy_price ??
                0
            );

        let averageCostBaru;

        if (stokLama <= 0) {

            averageCostBaru = hargaBeli;

        } else {

            averageCostBaru =
                (
                    (stokLama * averageCostLama) +
                    (qty * hargaBeli)
                ) / stokBaru;
        }

        // ========================================
        // UPDATE PRODUK
        // ========================================

        await client.query(
            `
            UPDATE products

            SET
                stock = $1,
                buy_price = $2,
                average_cost = $3,
                updated_at = NOW()

            WHERE id = $4
            `,
            [
                stokBaru,
                hargaBeli,
                averageCostBaru,
                product_id
            ]
        );

        // ========================================
        // SIMPAN RIWAYAT STOK
        // ========================================

        const movementResult = await client.query(
            `
            INSERT INTO stock_movements (
                product_id,
                movement_date,
                movement_type,
                reference_type,
                reference_id,
                quantity_in,
                quantity_out,
                balance_after,
                unit_cost,
                notes,
                user_id
            )

            VALUES (
                $1,
                $2,
                'STOCK_IN',
                'STOCK_IN',
                gen_random_uuid(),
                $3,
                0,
                $4,
                $5,
                $6,
                $7
            )

            RETURNING id
            `,
            [
                product_id,
                stock_date
                    ? new Date(stock_date)
                    : new Date(),

                qty,
                stokBaru,
                hargaBeli,

                [
                    supplier
                        ? `Supplier: ${supplier}`
                        : "",

                    invoice_number
                        ? `Invoice: ${invoice_number}`
                        : "",

                    notes
                        ? `Catatan: ${notes}`
                        : ""
                ]
                .filter(Boolean)
                .join(" | "),

                req.session.user.id
            ]
        );

        // ========================================
        // COMMIT
        // ========================================

        await client.query("COMMIT");

        // ========================================
        // RESPONSE
        // ========================================

        res.json({

            success: true,

            message: "Stok masuk berhasil disimpan",

            data: {

                movement_id:
                    movementResult.rows[0].id,

                product_id,

                product_name:
                    product.name,

                quantity: qty,

                stock_before:
                    stokLama,

                stock_after:
                    stokBaru,

                buy_price:
                    hargaBeli,

                average_cost:
                    averageCostBaru
            }
        });

    } catch (error) {

        // ========================================
        // ROLLBACK
        // ========================================

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "ROLLBACK ERROR:",
                rollbackError
            );
        }

        console.error(
            "STOCK IN ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan stok masuk",
            error: error.message
        });

    } finally {

        client.release();

    }

});


// ========================================
// RIWAYAT STOK MASUK
// ========================================

app.get("/api/stock-in", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const result = await db.query(
            `
            SELECT

                sm.id,

                sm.movement_date
                    AS stock_date,

                sm.quantity_in
                    AS quantity,

                sm.unit_cost
                    AS buy_price,

                (
                    sm.quantity_in * sm.unit_cost
                )
                    AS total,

                sm.balance_after
                    AS stock_after,

                p.id
                    AS product_id,

                p.code
                    AS product_code,

                p.name
                    AS product_name,

                COALESCE(
                    NULLIF(
                        substring(
                            sm.notes
                            FROM 'Supplier:[[:space:]]*([^|]+)'
                        ),
                        ''
                    ),
                    s.name
                )
                    AS supplier_name,

                NULLIF(
                    substring(
                        sm.notes
                        FROM 'Invoice:[[:space:]]*([^|]+)'
                    ),
                    ''
                )
                    AS invoice_number,

                COALESCE(
                    NULLIF(
                        substring(
                            sm.notes
                            FROM 'Catatan:[[:space:]]*(.*)$'
                        ),
                        ''
                    ),
                    CASE
                        WHEN sm.notes LIKE 'Supplier:%'
                            THEN NULL
                        ELSE sm.notes
                    END
                )
                    AS notes,

                sm.created_at

            FROM stock_movements sm

            INNER JOIN products p
                ON p.id = sm.product_id

            LEFT JOIN suppliers s
                ON sm.notes LIKE
                    '%Supplier: ' || s.name || '%'

            WHERE sm.movement_type = 'STOCK_IN'

            ORDER BY
                sm.movement_date DESC,
                sm.created_at DESC

            LIMIT 200
            `
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "GET STOCK IN ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat stok masuk",
            error: error.message
        });

    }

});
// =====================================================
// STOK KELUAR
// =====================================================

app.post("/api/stock-out", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    const {
        product_id,
        quantity,
        stock_date,
        notes
    } = req.body;

    const qty = Number(quantity);

    if (!product_id) {
        return res.status(400).json({
            success: false,
            message: "Produk wajib dipilih"
        });
    }

    if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({
            success: false,
            message: "Jumlah stok keluar harus lebih dari 0"
        });
    }

    const client = await db.connect();

    try {

        // ========================================
        // MULAI TRANSACTION
        // ========================================

        await client.query("BEGIN");


        // ========================================
        // AMBIL PRODUK + KUNCI BARIS
        // ========================================

        const productResult = await client.query(
            `
            SELECT
                id,
                name,
                stock,
                average_cost,
                active
            FROM products
            WHERE id = $1
            FOR UPDATE
            `,
            [product_id]
        );

        if (productResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        const product = productResult.rows[0];


        // ========================================
        // CEK PRODUK AKTIF
        // ========================================

        if (!product.active) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Produk sudah tidak aktif"
            });
        }


        // ========================================
        // HITUNG STOK
        // ========================================

        const oldStock =
            Number(product.stock || 0);

        const averageCost =
            Number(product.average_cost || 0);

        const newStock =
            oldStock - qty;


        // ========================================
        // CEK SETTING STOK MINUS
        // ========================================

        const settingResult = await client.query(
            `
            SELECT setting_value
            FROM settings
            WHERE setting_key = 'allow_negative_stock'
            LIMIT 1
            `
        );

        let allowNegativeStock = false;

        if (settingResult.rows.length > 0) {

            const settingValue =
                settingResult.rows[0].setting_value;

            allowNegativeStock =
                settingValue === true ||
                settingValue === "true" ||
                settingValue === "TRUE" ||
                settingValue === "1";
        }


        // ========================================
        // CEK STOK CUKUP
        // ========================================

        if (!allowNegativeStock && newStock < 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    `Stok tidak cukup. Stok ${product.name} saat ini hanya ${oldStock}`
            });
        }


        // ========================================
        // UPDATE STOK PRODUK
        // ========================================

        await client.query(
            `
            UPDATE products
            SET
                stock = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                newStock,
                product_id
            ]
        );


        // ========================================
        // CATAT KARTU STOK
        // ========================================

        const movementResult = await client.query(
            `
            INSERT INTO stock_movements (
                product_id,
                movement_date,
                movement_type,
                reference_type,
                reference_id,
                quantity_in,
                quantity_out,
                balance_after,
                unit_cost,
                notes,
                user_id
            )
            VALUES (
                $1,
                $2,
                'STOCK_OUT',
                'STOCK_OUT',
                gen_random_uuid(),
                0,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            RETURNING id
            `,
            [
                product_id,

                stock_date
                    ? new Date(stock_date)
                    : new Date(),

                qty,
                newStock,
                averageCost,

                notes || "Stok keluar",

                req.session.user.id
            ]
        );


        // ========================================
        // COMMIT
        // ========================================

        await client.query("COMMIT");


        // ========================================
        // RESPONSE
        // ========================================

        return res.json({

            success: true,

            message:
                "Stok keluar berhasil disimpan",

            movement_id:
                movementResult.rows[0].id,

            product_id:
                product_id,

            product_name:
                product.name,

            stock_before:
                oldStock,

            quantity_out:
                qty,

            stock_after:
                newStock,

            unit_cost:
                averageCost
        });


    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "ROLLBACK ERROR:",
                rollbackError
            );
        }

        console.error(
            "STOK OUT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan stok keluar",
            error: error.message
        });

    } finally {

        client.release();

    }

});
// =====================================================
// RIWAYAT STOK KELUAR
// =====================================================

app.get("/api/stock-out", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const result = await db.query(
            `
            SELECT
                sm.id,
                sm.movement_date,
                sm.product_id,
                p.name AS product_name,
                p.code AS product_code,
                sm.quantity_out,
                sm.unit_cost,
                sm.balance_after,
                sm.notes,
                sm.created_at
            FROM stock_movements sm
            INNER JOIN products p
                ON p.id = sm.product_id
            WHERE sm.movement_type = 'STOCK_OUT'
            ORDER BY
                sm.movement_date DESC,
                sm.created_at DESC
            LIMIT 200
            `
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "GET STOCK OUT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat stok keluar",
            error: error.message
        });

    }

});
// ========================================
// CEK SESSION
// ========================================

app.get("/api/me", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});

// ========================================
// LOGOUT
// ========================================

app.post("/api/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                success: false,
                message: "Gagal logout"
            });
        }

        res.json({
            success: true,
            message: "Logout berhasil"
        });
    });
});
// =====================================================
// API SUPPLIER
// =====================================================

// GET SEMUA SUPPLIER
app.get("/api/suppliers", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const result = await db.query(`
            SELECT
                id,
                name
            FROM suppliers
            ORDER BY name ASC
        `);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error("GET SUPPLIERS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil data supplier",
            error: error.message
        });
    }
});

// =====================================================
// PEMBELIAN
// =====================================================

app.post("/api/purchases", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    const client = await db.connect();

    try {

        const {
            purchase_number,
            purchase_date,
            supplier_id,
            invoice_number,
            payment_method,
            payment_status,
            paid_amount,
            due_date,
            notes,
            discount,
            additional_cost,
            items
        } = req.body;

        // =====================================================
        // VALIDASI
        // =====================================================

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "Supplier wajib dipilih"
            });
        }

        if (!purchase_date) {
            return res.status(400).json({
                success: false,
                message: "Tanggal pembelian wajib diisi"
            });
        }

        if (!payment_method) {
            return res.status(400).json({
                success: false,
                message: "Metode pembayaran wajib dipilih"
            });
        }

        if (!["PAID", "PARTIAL", "CREDIT"].includes(payment_status)) {
            return res.status(400).json({
                success: false,
                message: "Status pembayaran tidak valid"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Minimal harus ada 1 produk"
            });
        }

        const discountValue = Number(discount) || 0;
        const additionalCostValue = Number(additional_cost) || 0;
        const paidAmountValue = Number(paid_amount) || 0;

        if (
            !Number.isFinite(discountValue) ||
            discountValue < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Diskon tidak valid"
            });
        }

        if (
            !Number.isFinite(additionalCostValue) ||
            additionalCostValue < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Biaya tambahan tidak valid"
            });
        }

        if (
            !Number.isFinite(paidAmountValue) ||
            paidAmountValue < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Jumlah dibayar tidak valid"
            });
        }

        // =====================================================
        // MULAI TRANSACTION
        // =====================================================

        await client.query("BEGIN");

        // =====================================================
        // CEK SUPPLIER
        // =====================================================

        const supplierResult = await client.query(
            `
            SELECT
                id,
                name
            FROM suppliers
            WHERE id = $1
            LIMIT 1
            `,
            [supplier_id]
        );

        if (supplierResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Supplier tidak ditemukan"
            });
        }

        const supplierName =
            supplierResult.rows[0].name;

        // =====================================================
        // CEK METODE PEMBAYARAN
        // =====================================================

        const paymentMethodResult = await client.query(
            `
            SELECT
                id,
                code,
                name,
                type
            FROM payment_methods
            WHERE active = TRUE
            AND (
                UPPER(code) = UPPER($1)
                OR UPPER(name) = UPPER($1)
            )
            ORDER BY
                CASE
                    WHEN UPPER(code) = UPPER($1)
                    THEN 0
                    ELSE 1
                END
            LIMIT 1
            `,
            [payment_method]
        );

        if (paymentMethodResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    `Metode pembayaran "${payment_method}" tidak ditemukan`
            });
        }

        const paymentMethod =
            paymentMethodResult.rows[0];

        // =====================================================
        // NOMOR PEMBELIAN
        // =====================================================

        let nomorPembelian =
            purchase_number ||
            `PUR-${Date.now()}`;

        const existingPurchase =
            await client.query(
                `
                SELECT id
                FROM purchases
                WHERE purchase_number = $1
                LIMIT 1
                `,
                [nomorPembelian]
            );

        if (existingPurchase.rows.length > 0) {

            nomorPembelian =
                `PUR-${Date.now()}-${Math.floor(
                    Math.random() * 1000
                )}`;
        }

        // =====================================================
        // PROSES ITEM
        // =====================================================

        let subtotal = 0;

        const processedItems = [];

        for (const item of items) {

            const productId =
                item.product_id;

            const quantity =
                Number(item.quantity);

            const unitPrice =
                Number(item.unit_price);

            const itemDiscount =
                Number(item.discount) || 0;

            if (!productId) {
                throw new Error(
                    "Produk pada item pembelian tidak valid"
                );
            }

            if (
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                throw new Error(
                    "Jumlah produk harus lebih dari 0"
                );
            }

            if (
                !Number.isFinite(unitPrice) ||
                unitPrice < 0
            ) {
                throw new Error(
                    "Harga beli tidak valid"
                );
            }

            if (
                !Number.isFinite(itemDiscount) ||
                itemDiscount < 0
            ) {
                throw new Error(
                    "Diskon item tidak valid"
                );
            }

            const itemSubtotal =
                Math.max(
                    0,
                    (quantity * unitPrice) -
                    itemDiscount
                );

            const productResult =
                await client.query(
                    `
                    SELECT
                        id,
                        code,
                        name,
                        stock,
                        buy_price,
                        average_cost,
                        active
                    FROM products
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [productId]
                );

            if (productResult.rows.length === 0) {
                throw new Error(
                    `Produk dengan ID ${productId} tidak ditemukan`
                );
            }

            const product =
                productResult.rows[0];

            if (!product.active) {
                throw new Error(
                    `Produk "${product.name}" sudah tidak aktif`
                );
            }

            subtotal += itemSubtotal;

            processedItems.push({
                product,
                product_id: productId,
                quantity,
                unit_price: unitPrice,
                discount: itemDiscount,
                subtotal: itemSubtotal
            });
        }

        // =====================================================
        // HITUNG TOTAL
        // =====================================================

        const total =
            Math.max(
                0,
                subtotal -
                discountValue +
                additionalCostValue
            );

        // =====================================================
        // VALIDASI PEMBAYARAN
        // =====================================================

        if (paidAmountValue > total) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Jumlah dibayar tidak boleh lebih besar dari total"
            });
        }

        if (
            payment_status === "PAID" &&
            paidAmountValue !== total
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Status Lunas harus dibayar penuh"
            });
        }

        if (
            payment_status === "CREDIT" &&
            paidAmountValue !== 0
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Status Hutang harus memiliki pembayaran Rp 0"
            });
        }

        if (
            payment_status === "PARTIAL" &&
            (
                paidAmountValue <= 0 ||
                paidAmountValue >= total
            )
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Status Partial harus dibayar sebagian"
            });
        }

        const remainingDebt =
            Math.max(
                0,
                total - paidAmountValue
            );

        // =====================================================
        // INSERT PEMBELIAN
        // =====================================================

        const purchaseResult =
            await client.query(
                `
                INSERT INTO purchases (
                    purchase_number,
                    purchase_date,
                    supplier_id,
                    user_id,
                    subtotal,
                    discount,
                    additional_cost,
                    total,
                    payment_method,
                    payment_status,
                    paid_amount,
                    due_date,
                    notes,
                    status
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    'COMPLETED'
                )
                RETURNING *
                `,
                [
                    nomorPembelian,
                    new Date(purchase_date),
                    supplier_id,
                    req.session.user.id,
                    subtotal,
                    discountValue,
                    additionalCostValue,
                    total,
                    payment_method,
                    payment_status,
                    paidAmountValue,
                    due_date
                        ? new Date(due_date)
                        : null,
                    notes || null
                ]
            );

        const purchase =
            purchaseResult.rows[0];

        // =====================================================
        // UPDATE STOK + PURCHASE ITEMS
        // =====================================================

        for (const item of processedItems) {

            const product =
                item.product;

            const oldStock =
                Number(product.stock || 0);

            const oldAverageCost =
                Number(
                    product.average_cost ??
                    product.buy_price ??
                    0
                );

            const newStock =
                oldStock +
                item.quantity;

            let newAverageCost;

            if (oldStock <= 0) {

                newAverageCost =
                    item.unit_price;

            } else {

                newAverageCost =
                    (
                        (oldStock * oldAverageCost) +
                        (
                            item.quantity *
                            item.unit_price
                        )
                    ) /
                    newStock;
            }

            // =================================================
            // UPDATE PRODUK
            // =================================================

            await client.query(
                `
                UPDATE products
                SET
                    stock = $1,
                    buy_price = $2,
                    average_cost = $3,
                    updated_at = NOW()
                WHERE id = $4
                `,
                [
                    newStock,
                    item.unit_price,
                    newAverageCost,
                    item.product_id
                ]
            );

            // =================================================
            // PURCHASE ITEM
            // =================================================

            await client.query(
                `
                INSERT INTO purchase_items (
                    purchase_id,
                    product_id,
                    quantity,
                    unit_price,
                    discount,
                    subtotal
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                `,
                [
                    purchase.id,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    item.discount,
                    item.subtotal
                ]
            );

            // =================================================
            // STOCK MOVEMENT
            // =================================================

            await client.query(
                `
                INSERT INTO stock_movements (
                    product_id,
                    movement_date,
                    movement_type,
                    reference_type,
                    reference_id,
                    quantity_in,
                    quantity_out,
                    balance_after,
                    unit_cost,
                    notes,
                    user_id
                )
                VALUES (
                    $1,
                    $2,
                    'STOCK_IN',
                    'PURCHASE',
                    $3,
                    $4,
                    0,
                    $5,
                    $6,
                    $7,
                    $8
                )
                `,
                [
                    item.product_id,
                    new Date(purchase_date),
                    purchase.id,
                    item.quantity,
                    newStock,
                    item.unit_price,
                    `Pembelian ${nomorPembelian}`,
                    req.session.user.id
                ]
            );
        }

        // =====================================================
        // PEMBAYARAN
        // =====================================================

        if (paidAmountValue > 0) {

            // =================================================
            // PURCHASE PAYMENT
            // =================================================

            await client.query(
                `
                INSERT INTO purchase_payments (
                    purchase_id,
                    payment_method_id,
                    amount,
                    reference_number,
                    notes
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                `,
                [
                    purchase.id,
                    paymentMethod.id,
                    paidAmountValue,
                    invoice_number || null,
                    `Pembayaran pembelian ${nomorPembelian}`
                ]
            );

            // =================================================
            // KAS KELUAR
            // =================================================

            await client.query(
                `
                INSERT INTO cash_transactions (
                    transaction_date,
                    transaction_type,
                    payment_method,
                    amount,
                    description,
                    reference_type,
                    reference_id,
                    user_id
                )
                VALUES (
                    $1,
                    'OUT',
                    $2,
                    $3,
                    $4,
                    'PURCHASE',
                    $5,
                    $6
                )
                `,
                [
                    new Date(purchase_date),
                    paymentMethod.code,
                    paidAmountValue,
                    `Pembayaran pembelian ${nomorPembelian} - ${supplierName}`,
                    purchase.id,
                    req.session.user.id
                ]
            );
        }

        // =====================================================
        // BUAT HUTANG SUPPLIER
        // =====================================================

        if (remainingDebt > 0) {

            const payableNumber =
                `HUT-${Date.now()}-${Math.floor(
                    Math.random() * 1000
                )}`;

            const payableStatus =
                paidAmountValue > 0
                    ? "PARTIAL"
                    : "OPEN";

            await client.query(
                `
                INSERT INTO accounts_payable (
                    payable_number,
                    supplier_id,
                    purchase_id,
                    payable_date,
                    due_date,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    status,
                    notes
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10
                )
                `,
                [
                    payableNumber,
                    supplier_id,
                    purchase.id,
                    new Date(purchase_date),
                    due_date
                        ? new Date(due_date)
                        : null,
                    total,
                    paidAmountValue,
                    remainingDebt,
                    payableStatus,
                    notes ||
                    `Hutang pembelian ${nomorPembelian}`
                ]
            );
        }

        // =====================================================
        // COMMIT
        // =====================================================

        await client.query("COMMIT");

        // =====================================================
        // RESPONSE
        // =====================================================

        return res.json({

            success: true,

            message:
                "Pembelian berhasil disimpan",

            data: {

                id:
                    purchase.id,

                purchase_number:
                    purchase.purchase_number,

                supplier:
                    supplierName,

                subtotal,

                discount:
                    discountValue,

                additional_cost:
                    additionalCostValue,

                total,

                paid_amount:
                    paidAmountValue,

                remaining_debt:
                    remainingDebt,

                payment_status,

                payment_method:
                    paymentMethod.code,

                stock_updated:
                    true,

                cash_updated:
                    paidAmountValue > 0,

                payable_created:
                    remainingDebt > 0
            }
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "PURCHASE ROLLBACK ERROR:",
                rollbackError
            );
        }

        console.error(
            "CREATE PURCHASE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Gagal menyimpan pembelian",
            error:
                error.message
        });

    } finally {

        client.release();

    }
});
// =====================================================
// RIWAYAT PEMBELIAN
// =====================================================

app.get("/api/purchases", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const result = await db.query(
            `
            SELECT

                p.id,

                p.purchase_number,

                p.purchase_date,

                p.supplier_id,

                s.name AS supplier_name,

                p.subtotal,

                p.discount,

                p.additional_cost,

                p.total,

                p.payment_method,

                p.payment_status,

                p.paid_amount,

                GREATEST(
                    p.total - p.paid_amount,
                    0
                ) AS remaining_debt,

                p.due_date,

                p.notes,

                p.status,

                p.created_at

            FROM purchases p

            LEFT JOIN suppliers s
                ON s.id = p.supplier_id

            ORDER BY
                p.purchase_date DESC,
                p.created_at DESC

            LIMIT 200
            `
        );


        return res.json({

            success: true,

            data:
                result.rows

        });


    } catch (error) {

        console.error(
            "GET PURCHASES ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil riwayat pembelian",

            error:
                error.message
        });

    }
});


// =====================================================
// DETAIL PEMBELIAN
// =====================================================

app.get("/api/purchases/:id", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const purchaseResult =
            await db.query(
                `
                SELECT

                    p.*,

                    s.name AS supplier_name

                FROM purchases p

                LEFT JOIN suppliers s
                    ON s.id = p.supplier_id

                WHERE p.id = $1

                LIMIT 1
                `,
                [req.params.id]
            );


        if (purchaseResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Pembelian tidak ditemukan"
            });
        }


        const itemsResult =
            await db.query(
                `
                SELECT

                    pi.id,

                    pi.product_id,

                    pr.code AS product_code,

                    pr.name AS product_name,

                    pi.quantity,

                    pi.unit_price,

                    pi.discount,

                    pi.subtotal

                FROM purchase_items pi

                INNER JOIN products pr
                    ON pr.id = pi.product_id

                WHERE pi.purchase_id = $1

                ORDER BY pi.created_at ASC
                `,
                [req.params.id]
            );


        return res.json({

            success: true,

            data: {

                purchase:
                    purchaseResult.rows[0],

                items:
                    itemsResult.rows
            }
        });


    } catch (error) {

        console.error(
            "GET PURCHASE DETAIL ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil detail pembelian",

            error:
                error.message
        });

    }
});
// =====================================================
// KASIR / PENJUALAN
// =====================================================

app.post("/api/sales", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    const client = await db.connect();

    try {

        const {
            customer_id,
            payment_method,
            paid_amount,
            discount,
            notes,
            items
        } = req.body;

        // =================================================
        // VALIDASI
        // =================================================

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Minimal harus ada 1 produk"
            });
        }

        if (!payment_method) {
            return res.status(400).json({
                success: false,
                message: "Metode pembayaran wajib dipilih"
            });
        }

        const discountValue = Number(discount) || 0;
        const paidAmountValue = Number(paid_amount) || 0;

        if (!Number.isFinite(discountValue) || discountValue < 0) {
            return res.status(400).json({
                success: false,
                message: "Diskon tidak valid"
            });
        }

        if (!Number.isFinite(paidAmountValue) || paidAmountValue < 0) {
            return res.status(400).json({
                success: false,
                message: "Jumlah pembayaran tidak valid"
            });
        }

        await client.query("BEGIN");

        // =================================================
        // CEK METODE PEMBAYARAN
        // =================================================

        const paymentMethodResult = await client.query(
            `
            SELECT
                id,
                code,
                name,
                type
            FROM payment_methods
            WHERE active = TRUE
            AND (
                UPPER(code) = UPPER($1)
                OR UPPER(name) = UPPER($1)
            )
            ORDER BY
                CASE
                    WHEN UPPER(code) = UPPER($1)
                    THEN 0
                    ELSE 1
                END
            LIMIT 1
            `,
            [payment_method]
        );

        if (paymentMethodResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    `Metode pembayaran "${payment_method}" tidak ditemukan`
            });
        }

        const paymentMethod =
            paymentMethodResult.rows[0];

        // =================================================
        // PROSES PRODUK
        // =================================================

        let subtotal = 0;

        const processedItems = [];

        for (const item of items) {

            const productId =
                item.product_id;

            const quantity =
                Number(item.quantity);

            if (!productId) {
                throw new Error(
                    "Produk penjualan tidak valid"
                );
            }

            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new Error(
                    "Jumlah produk harus lebih dari 0"
                );
            }

            // Kunci produk supaya aman dari transaksi bersamaan
            const productResult = await client.query(
                `
                SELECT
                    id,
                    code,
                    name,
                    stock,
                    sell_price,
                    average_cost,
                    active
                FROM products
                WHERE id = $1
                FOR UPDATE
                `,
                [productId]
            );

            if (productResult.rows.length === 0) {
                throw new Error(
                    "Produk tidak ditemukan"
                );
            }

            const product =
                productResult.rows[0];

            if (!product.active) {
                throw new Error(
                    `Produk "${product.name}" sudah tidak aktif`
                );
            }

            const currentStock =
                Number(product.stock || 0);

            if (currentStock < quantity) {
                throw new Error(
                    `Stok "${product.name}" tidak cukup. Stok tersedia ${currentStock}`
                );
            }

            const unitPrice =
                Number(item.unit_price ?? product.sell_price ?? 0);

            const itemDiscount =
                Number(item.discount) || 0;

            if (unitPrice < 0) {
                throw new Error(
                    `Harga produk "${product.name}" tidak valid`
                );
            }

            if (itemDiscount < 0) {
                throw new Error(
                    "Diskon item tidak valid"
                );
            }

            const itemSubtotal =
                Math.max(
                    0,
                    (quantity * unitPrice) -
                    itemDiscount
                );

            subtotal += itemSubtotal;

            processedItems.push({
                product,
                product_id: productId,
                quantity,
                unit_price: unitPrice,
                discount: itemDiscount,
                subtotal: itemSubtotal
            });
        }

        // =================================================
        // TOTAL
        // =================================================

        const total =
            Math.max(
                0,
                subtotal - discountValue
            );

        if (total <= 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Total penjualan harus lebih dari 0"
            });
        }

        if (paidAmountValue < total) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Pembayaran kurang dari total penjualan"
            });
        }

        const changeAmount =
            paidAmountValue - total;

        // =================================================
        // NOMOR INVOICE
        // =================================================

        let invoiceNumber =
            `INV-${Date.now()}`;

        const existingInvoice =
            await client.query(
                `
                SELECT id
                FROM sales
                WHERE invoice_number = $1
                LIMIT 1
                `,
                [invoiceNumber]
            );

        if (existingInvoice.rows.length > 0) {

            invoiceNumber =
                `INV-${Date.now()}-${Math.floor(
                    Math.random() * 1000
                )}`;
        }

        // =================================================
        // INSERT SALES
        // =================================================

        const saleResult =
            await client.query(
                `
                INSERT INTO sales (
                    invoice_number,
                    sale_date,
                    customer_id,
                    cashier_id,
                    subtotal,
                    discount,
                    total,
                    paid_amount,
                    change_amount,
                    notes,
                    status,
                    payment_method,
                    payment_status
                )
                VALUES (
                    $1,
                    NOW(),
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    'COMPLETED',
                    $10,
                    'PAID'
                )
                RETURNING *
                `,
                [
                    invoiceNumber,
                    customer_id || null,
                    req.session.user.id,
                    subtotal,
                    discountValue,
                    total,
                    paidAmountValue,
                    changeAmount,
                    notes || null,
                    paymentMethod.code
                ]
            );

        const sale =
            saleResult.rows[0];

        // =================================================
        // ITEM PENJUALAN + STOK
        // =================================================

        let totalHpp = 0;

        for (const item of processedItems) {

            const product =
                item.product;

            const oldStock =
                Number(product.stock || 0);

            const newStock =
                oldStock - item.quantity;

            const averageCost =
                Number(product.average_cost ?? 0);

            const hpp =
                item.quantity * averageCost;

            totalHpp += hpp;

            // ---------------------------------------------
            // INSERT SALE ITEM
            // ---------------------------------------------

            await client.query(
                `
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    quantity,
                    unit_price,
                    discount,
                    subtotal
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                `,
                [
                    sale.id,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    item.discount,
                    item.subtotal
                ]
            );

            // ---------------------------------------------
            // UPDATE STOK
            // ---------------------------------------------

            await client.query(
                `
                UPDATE products
                SET
                    stock = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    newStock,
                    item.product_id
                ]
            );

            // ---------------------------------------------
            // STOCK MOVEMENT
            // ---------------------------------------------

            await client.query(
                `
                INSERT INTO stock_movements (
                    product_id,
                    movement_date,
                    movement_type,
                    reference_type,
                    reference_id,
                    quantity_in,
                    quantity_out,
                    balance_after,
                    unit_cost,
                    notes,
                    user_id
                )
                VALUES (
                    $1,
                    NOW(),
                    'STOCK_OUT',
                    'SALE',
                    $2,
                    0,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                `,
                [
                    item.product_id,
                    sale.id,
                    item.quantity,
                    newStock,
                    averageCost,
                    `Penjualan ${invoiceNumber}`,
                    req.session.user.id
                ]
            );
        }

        // =================================================
        // PEMBAYARAN PENJUALAN
        // =================================================

        await client.query(
            `
            INSERT INTO sale_payments (
                sale_id,
                payment_method_id,
                amount,
                reference_number,
                notes
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5
            )
            `,
            [
                sale.id,
                paymentMethod.id,
                total,
                invoiceNumber,
                `Pembayaran ${invoiceNumber}`
            ]
        );

        // =================================================
        // KAS MASUK
        // =================================================

        await client.query(
            `
            INSERT INTO cash_transactions (
                transaction_date,
                transaction_type,
                payment_method,
                amount,
                description,
                reference_type,
                reference_id,
                user_id
            )
            VALUES (
                NOW(),
                'IN',
                $1,
                $2,
                $3,
                'SALE',
                $4,
                $5
            )
            `,
            [
                paymentMethod.code,
                total,
                `Penjualan ${invoiceNumber}`,
                sale.id,
                req.session.user.id
            ]
        );

        // =================================================
        // COMMIT
        // =================================================

        await client.query("COMMIT");

        // =================================================
        // RESPONSE
        // =================================================

        return res.json({
            success: true,
            message: "Penjualan berhasil disimpan",

            data: {
                id: sale.id,
                invoice_number: invoiceNumber,
                subtotal,
                discount: discountValue,
                total,
                paid_amount: paidAmountValue,
                change_amount: changeAmount,
                total_hpp: totalHpp,
                gross_profit: total - totalHpp,
                payment_method: paymentMethod.code
            }
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "SALE ROLLBACK ERROR:",
                rollbackError
            );
        }

        console.error(
            "CREATE SALE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan penjualan",
            error: error.message
        });

    } finally {

        client.release();

    }
});


// =====================================================
// RIWAYAT PENJUALAN
// =====================================================

app.get("/api/sales", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const result = await db.query(
            `
            SELECT
                s.id,
                s.invoice_number,
                s.sale_date,
                s.subtotal,
                s.discount,
                s.total,
                s.paid_amount,
                s.change_amount,
                s.payment_method,
                s.payment_status,
                s.status,
                s.notes,
                u.full_name AS cashier_name

            FROM sales s

            LEFT JOIN users u
                ON u.id = s.cashier_id

            ORDER BY
                s.sale_date DESC,
                s.created_at DESC

            LIMIT 200
            `
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "GET SALES ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat penjualan",
            error: error.message
        });

    }

});


// =====================================================
// DETAIL PENJUALAN
// =====================================================

app.get("/api/sales/:id", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const saleResult =
            await db.query(
                `
                SELECT
                    s.*,
                    u.full_name AS cashier_name

                FROM sales s

                LEFT JOIN users u
                    ON u.id = s.cashier_id

                WHERE s.id = $1

                LIMIT 1
                `,
                [req.params.id]
            );

        if (saleResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Penjualan tidak ditemukan"
            });
        }

        const itemsResult =
            await db.query(
                `
                SELECT
                    si.id,
                    si.product_id,
                    p.code AS product_code,
                    p.name AS product_name,
                    si.quantity,
                    si.unit_price,
                    si.discount,
                    si.subtotal

                FROM sale_items si

                INNER JOIN products p
                    ON p.id = si.product_id

                WHERE si.sale_id = $1

                ORDER BY si.id ASC
                `,
                [req.params.id]
            );

        return res.json({
            success: true,
            data: {
                sale: saleResult.rows[0],
                items: itemsResult.rows
            }
        });

    } catch (error) {

        console.error(
            "GET SALE DETAIL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil detail penjualan",
            error: error.message
        });
    }
});
// ========================================
// CUSTOMERS API
// ========================================

// GET semua pelanggan
app.get("/api/customers", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const result = await db.query(`
            SELECT
                id,
                code,
                name,
                phone,
                address,
                workshop_name,
                vehicle_plate,
                credit_limit,
                payment_terms_days,
                notes,
                active,
                created_at,
                updated_at
            FROM customers
            ORDER BY name ASC
        `);

        res.json({
            success: true,
            customers: result.rows
        });

    } catch (error) {
        console.error("GET CUSTOMERS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pelanggan",
            error: error.message
        });
    }
});


// POST tambah pelanggan
app.post("/api/customers", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const {
            code,
            name,
            phone,
            address,
            workshop_name,
            vehicle_plate,
            credit_limit,
            payment_terms_days,
            notes
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama pelanggan wajib diisi"
            });
        }

        const result = await db.query(`
            INSERT INTO customers (
                code,
                name,
                phone,
                address,
                workshop_name,
                vehicle_plate,
                credit_limit,
                payment_terms_days,
                notes,
                active
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                true
            )
            RETURNING *
        `, [
            code || null,
            name.trim(),
            phone || null,
            address || null,
            workshop_name || null,
            vehicle_plate || null,
            Number(credit_limit) || 0,
            Number(payment_terms_days) || 0,
            notes || null
        ]);

        res.status(201).json({
            success: true,
            message: "Pelanggan berhasil ditambahkan",
            customer: result.rows[0]
        });

    } catch (error) {
        console.error("ADD CUSTOMER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan pelanggan",
            error: error.message
        });
    }
});


// PUT edit pelanggan
app.put("/api/customers/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;

        const {
            code,
            name,
            phone,
            address,
            workshop_name,
            vehicle_plate,
            credit_limit,
            payment_terms_days,
            notes,
            active
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama pelanggan wajib diisi"
            });
        }

        const result = await db.query(`
            UPDATE customers
            SET
                code = $1,
                name = $2,
                phone = $3,
                address = $4,
                workshop_name = $5,
                vehicle_plate = $6,
                credit_limit = $7,
                payment_terms_days = $8,
                notes = $9,
                active = $10,
                updated_at = NOW()
            WHERE id = $11
            RETURNING *
        `, [
            code || null,
            name.trim(),
            phone || null,
            address || null,
            workshop_name || null,
            vehicle_plate || null,
            Number(credit_limit) || 0,
            Number(payment_terms_days) || 0,
            notes || null,
            active !== false,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Pelanggan tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Pelanggan berhasil diperbarui",
            customer: result.rows[0]
        });

    } catch (error) {
        console.error("UPDATE CUSTOMER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui pelanggan",
            error: error.message
        });
    }
});


// DELETE pelanggan
app.delete("/api/customers/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;

        const result = await db.query(`
            DELETE FROM customers
            WHERE id = $1
            RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Pelanggan tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Pelanggan berhasil dihapus"
        });

    } catch (error) {
        console.error("DELETE CUSTOMER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus pelanggan",
            error: error.message
        });
    }
});
// ========================================
// PIUTANG / ACCOUNTS RECEIVABLE
// ========================================

// GET DATA PIUTANG
app.get("/api/receivables", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const result = await db.query(`
            SELECT
                ar.id,
                ar.receivable_number,
                ar.customer_id,
                ar.sale_id,
                ar.receivable_date,
                ar.due_date,
                ar.total_amount,
                ar.paid_amount,
                ar.balance_amount,
                ar.status,
                ar.notes,
                ar.created_at,
                ar.updated_at,

                c.name AS customer_name,
                c.phone AS customer_phone,
                c.vehicle_plate,

                s.id AS sale_id_data

            FROM accounts_receivable ar

            LEFT JOIN customers c
                ON c.id = ar.customer_id

            LEFT JOIN sales s
                ON s.id = ar.sale_id

            ORDER BY ar.receivable_date DESC, ar.created_at DESC
        `);

        res.json({
            success: true,
            receivables: result.rows
        });

    } catch (error) {
        console.error("GET /api/receivables ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data piutang",
            error: error.message
        });
    }
});


// GET DETAIL PIUTANG
app.get("/api/receivables/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;

        const result = await db.query(`
            SELECT
                ar.*,
                c.name AS customer_name,
                c.phone AS customer_phone,
                c.address AS customer_address,
                c.vehicle_plate
            FROM accounts_receivable ar
            LEFT JOIN customers c
                ON c.id = ar.customer_id
            WHERE ar.id = $1
            LIMIT 1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data piutang tidak ditemukan"
            });
        }

        res.json({
            success: true,
            receivable: result.rows[0]
        });

    } catch (error) {
        console.error("GET /api/receivables/:id ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail piutang",
            error: error.message
        });
    }
});


// PEMBAYARAN PIUTANG
app.post("/api/receivables/:id/payment", async (req, res) => {
    const client = await db.connect();

    try {
        if (!req.session.user) {
            client.release();

            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;
        const {
            amount,
            payment_method = "cash",
            notes = ""
        } = req.body;

        const paymentAmount = Number(amount);

        if (!paymentAmount || paymentAmount <= 0) {
            client.release();

            return res.status(400).json({
                success: false,
                message: "Nominal pembayaran tidak valid"
            });
        }

        await client.query("BEGIN");

        // Ambil piutang
        const receivableResult = await client.query(`
            SELECT *
            FROM accounts_receivable
            WHERE id = $1
            FOR UPDATE
        `, [id]);

        if (receivableResult.rows.length === 0) {
            await client.query("ROLLBACK");
            client.release();

            return res.status(404).json({
                success: false,
                message: "Data piutang tidak ditemukan"
            });
        }

        const receivable = receivableResult.rows[0];

        const currentPaid = Number(receivable.paid_amount || 0);
        const totalAmount = Number(receivable.total_amount || 0);
        const currentBalance = Number(
            receivable.balance_amount ??
            (totalAmount - currentPaid)
        );

        if (paymentAmount > currentBalance) {
            await client.query("ROLLBACK");
            client.release();

            return res.status(400).json({
                success: false,
                message: `Pembayaran melebihi sisa piutang. Sisa piutang Rp ${currentBalance.toLocaleString("id-ID")}`
            });
        }

        const newPaid = currentPaid + paymentAmount;
        const newBalance = Math.max(totalAmount - newPaid, 0);

        let newStatus = "belum";

        if (newBalance <= 0) {
            newStatus = "lunas";
        } else if (newPaid > 0) {
            newStatus = "sebagian";
        } else {
            newStatus = "belum";
        }

        // Update piutang
        const updateResult = await client.query(`
            UPDATE accounts_receivable
            SET
                paid_amount = $1,
                balance_amount = $2,
                status = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [
            newPaid,
            newBalance,
            newStatus,
            id
        ]);

        // Simpan pembayaran ke sale_payments
        if (receivable.sale_id) {
            try {
                await client.query(`
                    INSERT INTO sale_payments
                    (
                        sale_id,
                        payment_date,
                        amount,
                        payment_method,
                        notes
                    )
                    VALUES
                    ($1, NOW(), $2, $3, $4)
                `, [
                    receivable.sale_id,
                    paymentAmount,
                    payment_method,
                    notes
                ]);
            } catch (paymentError) {
                console.warn(
                    "Peringatan: pembayaran tidak masuk sale_payments:",
                    paymentError.message
                );
            }
        }

        await client.query("COMMIT");

        client.release();

        res.json({
            success: true,
            message: "Pembayaran piutang berhasil",
            receivable: updateResult.rows[0]
        });

    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback error:", rollbackError);
        }

        client.release();

        console.error(
            "POST /api/receivables/:id/payment ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan pembayaran piutang",
            error: error.message
        });
    }
});
// ========================================
// HUTANG SUPPLIER / ACCOUNTS PAYABLE
// ========================================

// GET SEMUA HUTANG SUPPLIER
app.get("/api/payables", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const result = await db.query(`
            SELECT
                ap.id,
                ap.payable_number,
                ap.supplier_id,
                ap.purchase_id,
                ap.payable_date,
                ap.due_date,
                ap.total_amount,
                ap.paid_amount,
                ap.balance_amount,
                ap.status,
                ap.notes,
                ap.created_at,
                ap.updated_at,

                s.name AS supplier_name,
                s.phone AS supplier_phone,
                s.address AS supplier_address,

                p.purchase_number,
                p.purchase_date,
                p.payment_method,
                p.payment_status

            FROM accounts_payable ap

            LEFT JOIN suppliers s
                ON s.id = ap.supplier_id

            LEFT JOIN purchases p
                ON p.id = ap.purchase_id

            ORDER BY ap.payable_date DESC, ap.created_at DESC
        `);

        res.json({
            success: true,
            payables: result.rows
        });

    } catch (error) {
        console.error("GET /api/payables ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data hutang",
            error: error.message
        });
    }
});


// GET DETAIL HUTANG
app.get("/api/payables/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;

        const result = await db.query(`
            SELECT
                ap.*,

                s.name AS supplier_name,
                s.code AS supplier_code,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                s.address AS supplier_address,

                p.purchase_number,
                p.purchase_date,
                p.subtotal,
                p.discount,
                p.additional_cost,
                p.total AS purchase_total,
                p.payment_method,
                p.payment_status,
                p.notes AS purchase_notes

            FROM accounts_payable ap

            LEFT JOIN suppliers s
                ON s.id = ap.supplier_id

            LEFT JOIN purchases p
                ON p.id = ap.purchase_id

            WHERE ap.id = $1
            LIMIT 1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data hutang tidak ditemukan"
            });
        }

        res.json({
            success: true,
            payable: result.rows[0]
        });

    } catch (error) {
        console.error("GET /api/payables/:id ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail hutang",
            error: error.message
        });
    }
});


// PEMBAYARAN HUTANG
app.post("/api/payables/:id/payment", async (req, res) => {
    const client = await db.connect();

    try {
        if (!req.session.user) {
            client.release();

            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }

        const { id } = req.params;

        const {
            amount,
            payment_method = "cash",
            notes = ""
        } = req.body;

        const paymentAmount = Number(amount);

        if (!paymentAmount || paymentAmount <= 0) {
            client.release();

            return res.status(400).json({
                success: false,
                message: "Nominal pembayaran tidak valid"
            });
        }

        await client.query("BEGIN");

        // Ambil data hutang dan kunci baris
        const payableResult = await client.query(`
            SELECT *
            FROM accounts_payable
            WHERE id = $1
            FOR UPDATE
        `, [id]);

        if (payableResult.rows.length === 0) {
            await client.query("ROLLBACK");
            client.release();

            return res.status(404).json({
                success: false,
                message: "Data hutang tidak ditemukan"
            });
        }

        const payable = payableResult.rows[0];

        const totalAmount = Number(payable.total_amount || 0);
        const currentPaid = Number(payable.paid_amount || 0);

        const currentBalance = Number(
            payable.balance_amount ??
            (totalAmount - currentPaid)
        );

        if (currentBalance <= 0) {
            await client.query("ROLLBACK");
            client.release();

            return res.status(400).json({
                success: false,
                message: "Hutang ini sudah lunas"
            });
        }

        if (paymentAmount > currentBalance) {
            await client.query("ROLLBACK");
            client.release();

            return res.status(400).json({
                success: false,
                message:
                    "Pembayaran melebihi sisa hutang. Sisa hutang Rp " +
                    currentBalance.toLocaleString("id-ID")
            });
        }

        const newPaid = currentPaid + paymentAmount;
        const newBalance = Math.max(
            totalAmount - newPaid,
            0
        );

        let newStatus = "belum";

        if (newBalance <= 0) {
            newStatus = "lunas";
        } else if (newPaid > 0) {
            newStatus = "sebagian";
        }

        // Update hutang
        const updateResult = await client.query(`
            UPDATE accounts_payable
            SET
                paid_amount = $1,
                balance_amount = $2,
                status = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [
            newPaid,
            newBalance,
            newStatus,
            id
        ]);

       // =====================================================
// CATAT KAS KELUAR PEMBAYARAN HUTANG
// =====================================================

await client.query(`
    INSERT INTO cash_transactions (
        transaction_date,
        transaction_type,
        payment_method,
        amount,
        description,
        reference_type,
        reference_id,
        user_id
    )
    VALUES (
        NOW(),
        'OUT',
        $1,
        $2,
        $3,
        'PAYABLE',
        $4,
        $5
    )
`, [
    payment_method.toUpperCase(),
    paymentAmount,
    `Pembayaran hutang supplier ${payable.payable_number}`,
    id,
    req.session.user.id
]);

        await client.query("COMMIT");

        client.release();

        res.json({
            success: true,
            message: "Pembayaran hutang berhasil",
            payable: updateResult.rows[0]
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }

        client.release();

        console.error(
            "POST /api/payables/:id/payment ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan pembayaran hutang",
            error: error.message
        });
    }
});
// =====================================================
// KAS & KEUANGAN
// =====================================================

// GET RIWAYAT KAS
app.get("/api/cash-transactions", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {
        const {
            start_date,
            end_date,
            type,
            payment_method
        } = req.query;

        let conditions = [];
        let params = [];
        let index = 1;

        if (start_date) {
            conditions.push(`
                transaction_date >= $${index}
            `);

            params.push(new Date(`${start_date}T00:00:00`));
            index++;
        }

        if (end_date) {
            conditions.push(`
                transaction_date < $${index}
            `);

            const nextDate = new Date(`${end_date}T00:00:00`);
            nextDate.setDate(nextDate.getDate() + 1);

            params.push(nextDate);
            index++;
        }

        if (type && ["IN", "OUT"].includes(type.toUpperCase())) {
            conditions.push(`
                UPPER(transaction_type) = $${index}
            `);

            params.push(type.toUpperCase());
            index++;
        }

        if (
            payment_method &&
            ["CASH", "TRANSFER", "QRIS"].includes(
                payment_method.toUpperCase()
            )
        ) {
            conditions.push(`
                UPPER(payment_method) = $${index}
            `);

            params.push(payment_method.toUpperCase());
            index++;
        }

        let sql = `
            SELECT
                id,
                transaction_date,
                transaction_type,
                payment_method,
                amount,
                description,
                reference_type,
                reference_id,
                user_id,
                created_at
            FROM cash_transactions
        `;

        if (conditions.length > 0) {
            sql += `
                WHERE ${conditions.join(" AND ")}
            `;
        }

        sql += `
            ORDER BY transaction_date DESC, id DESC
        `;

        const result = await db.query(sql, params);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error(
            "GET CASH TRANSACTIONS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil transaksi kas",
            error: error.message
        });
    }
});


// GET RINGKASAN KAS
app.get("/api/cash-summary", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {
        const result = await db.query(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN UPPER(transaction_type) = 'IN'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_in,

                COALESCE(
                    SUM(
                        CASE
                            WHEN UPPER(transaction_type) = 'OUT'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_out

            FROM cash_transactions
        `);

        const totalIn =
            Number(result.rows[0].total_in || 0);

        const totalOut =
            Number(result.rows[0].total_out || 0);

        return res.json({
            success: true,
            total_in: totalIn,
            total_out: totalOut,
            balance: totalIn - totalOut
        });

    } catch (error) {
        console.error(
            "GET CASH SUMMARY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil saldo kas",
            error: error.message
        });
    }
});


// TAMBAH PENGELUARAN MANUAL
app.post("/api/cash-transactions/expense", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {
        const {
            transaction_date,
            category,
            description,
            amount,
            payment_method,
            notes
        } = req.body;

        const value = Number(amount || 0);

        if (!transaction_date) {
            return res.status(400).json({
                success: false,
                message: "Tanggal pengeluaran wajib diisi"
            });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: "Deskripsi pengeluaran wajib diisi"
            });
        }

        if (value <= 0) {
            return res.status(400).json({
                success: false,
                message: "Jumlah pengeluaran harus lebih dari 0"
            });
        }

        const method =
            String(payment_method || "CASH").toUpperCase();

        if (!["CASH", "TRANSFER", "QRIS"].includes(method)) {
            return res.status(400).json({
                success: false,
                message: "Metode pembayaran tidak valid"
            });
        }

        let finalDescription =
            description.trim();

        if (category && category.trim()) {
            finalDescription =
                `[${category.trim()}] ${finalDescription}`;
        }

        if (notes && notes.trim()) {
            finalDescription +=
                ` - ${notes.trim()}`;
        }

        const result = await db.query(
            `
            INSERT INTO cash_transactions (
                transaction_date,
                transaction_type,
                payment_method,
                amount,
                description,
                reference_type,
                reference_id,
                user_id
            )
            VALUES (
                $1,
                'OUT',
                $2,
                $3,
                $4,
                'EXPENSE',
                NULL,
                $5
            )
            RETURNING *
            `,
            [
                new Date(`${transaction_date}T00:00:00`),
                method,
                value,
                finalDescription,
                req.session.user.id
            ]
        );

        return res.json({
            success: true,
            message: "Pengeluaran berhasil disimpan",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            "CREATE EXPENSE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan pengeluaran",
            error: error.message
        });
    }
});
// =====================================================
// PEMBAGIAN UANG
// =====================================================

// GET RIWAYAT PEMBAGIAN UANG
app.get("/api/money-distributions", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }

    try {

        const {
            start_date,
            end_date,
            category
        } = req.query;

        let conditions = [];
        let params = [];
        let index = 1;


        if (start_date) {

            conditions.push(`
                distribution_date >= $${index}
            `);

            params.push(
                new Date(`${start_date}T00:00:00`)
            );

            index++;
        }


        if (end_date) {

            const nextDate =
                new Date(`${end_date}T00:00:00`);

            nextDate.setDate(
                nextDate.getDate() + 1
            );

            conditions.push(`
                distribution_date < $${index}
            `);

            params.push(nextDate);

            index++;
        }


        if (category) {

            conditions.push(`
                UPPER(category) = $${index}
            `);

            params.push(
                String(category).toUpperCase()
            );

            index++;
        }


        let sql = `
            SELECT
                id,
                distribution_number,
                distribution_date,
                recipient,
                category,
                amount,
                payment_method,
                description,
                notes,
                user_id,
                created_at
            FROM money_distributions
        `;


        if (conditions.length > 0) {

            sql += `
                WHERE ${conditions.join(" AND ")}
            `;

        }


        sql += `
            ORDER BY
                distribution_date DESC,
                created_at DESC
        `;


        const result =
            await db.query(
                sql,
                params
            );


        return res.json({
            success: true,
            data: result.rows
        });


    } catch (error) {

        console.error(
            "GET MONEY DISTRIBUTIONS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Gagal mengambil riwayat pembagian uang",
            error:
                error.message
        });

    }

});


// =====================================================
// TAMBAH PEMBAGIAN UANG
// =====================================================

app.post("/api/money-distributions", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Belum login"
        });
    }


    const client =
        await db.connect();


    try {

        const {
            distribution_date,
            recipient,
            category,
            amount,
            payment_method = "CASH",
            description,
            notes = ""
        } = req.body;


        const amountValue =
            Number(amount);


        // =============================================
        // VALIDASI
        // =============================================

        if (!recipient ||
            !String(recipient).trim()) {

            return res.status(400).json({
                success: false,
                message:
                    "Penerima wajib diisi"
            });
        }


        if (![
            "GAJI",
            "PEMILIK",
            "OPERASIONAL",
            "LAINNYA"
        ].includes(
            String(category).toUpperCase()
        )) {

            return res.status(400).json({
                success: false,
                message:
                    "Kategori pembagian tidak valid"
            });
        }


        if (!Number.isFinite(amountValue) ||
            amountValue <= 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Nominal pembagian tidak valid"
            });
        }


        const paymentMethod =
            String(payment_method)
                .toUpperCase();


        if (![
            "CASH",
            "TRANSFER",
            "QRIS"
        ].includes(paymentMethod)) {

            return res.status(400).json({
                success: false,
                message:
                    "Metode pembayaran tidak valid"
            });
        }


        if (!description ||
            !String(description).trim()) {

            return res.status(400).json({
                success: false,
                message:
                    "Keterangan wajib diisi"
            });
        }


        // =============================================
        // TRANSACTION
        // =============================================

        await client.query("BEGIN");


        // =============================================
        // CEK SALDO KAS
        // =============================================

        const cashResult =
            await client.query(`
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN UPPER(transaction_type) = 'IN'
                                THEN amount

                                WHEN UPPER(transaction_type) = 'OUT'
                                THEN -amount

                                ELSE 0
                            END
                        ),
                        0
                    ) AS balance

                FROM cash_transactions
            `);


        const currentBalance =
            Number(
                cashResult.rows[0]?.balance || 0
            );


        if (amountValue > currentBalance) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    `Saldo kas tidak cukup. Saldo tersedia ${currentBalance.toLocaleString("id-ID")}`
            });

        }


        // =============================================
        // NOMOR PEMBAGIAN
        // =============================================

        const distributionNumber =
            `BAG-${Date.now()}-${Math.floor(
                Math.random() * 1000
            )}`;


        // =============================================
        // SIMPAN PEMBAGIAN
        // =============================================

        const distributionResult =
            await client.query(`
                INSERT INTO money_distributions
                (
                    distribution_number,
                    distribution_date,
                    recipient,
                    category,
                    amount,
                    payment_method,
                    description,
                    notes,
                    user_id
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9
                )
                RETURNING *
            `, [

                distributionNumber,

                distribution_date
                    ? new Date(distribution_date)
                    : new Date(),

                String(recipient).trim(),

                String(category)
                    .toUpperCase(),

                amountValue,

                paymentMethod,

                String(description).trim(),

                notes || null,

                req.session.user.id

            ]);


        const distribution =
            distributionResult.rows[0];


        // =============================================
        // KAS KELUAR
        // =============================================

        await client.query(`
            INSERT INTO cash_transactions
            (
                transaction_date,
                transaction_type,
                payment_method,
                amount,
                description,
                reference_type,
                reference_id,
                user_id
            )
            VALUES
            (
                $1,
                'OUT',
                $2,
                $3,
                $4,
                'DISTRIBUTION',
                $5,
                $6
            )
        `, [

            distribution.distribution_date,

            paymentMethod,

            amountValue,

            `Pembagian uang ${distributionNumber} - ${String(recipient).trim()}`,

            distribution.id,

            req.session.user.id

        ]);


        // =============================================
        // COMMIT
        // =============================================

        await client.query(
            "COMMIT"
        );


        return res.json({
            success: true,
            message:
                "Pembagian uang berhasil disimpan",
            data:
                distribution
        });


    } catch (error) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch (rollbackError) {

            console.error(
                "ROLLBACK ERROR:",
                rollbackError
            );

        }


        console.error(
            "POST MONEY DISTRIBUTION ERROR:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Gagal menyimpan pembagian uang",
            error:
                error.message
        });


    } finally {

        client.release();

    }

});


// =====================================================
// HAPUS PEMBAGIAN UANG
// =====================================================

app.delete(
    "/api/money-distributions/:id",
    async (req, res) => {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Belum login"
            });
        }


        const client =
            await db.connect();


        try {

            const { id } =
                req.params;


            await client.query(
                "BEGIN"
            );


            // =========================================
            // AMBIL DATA PEMBAGIAN
            // =========================================

            const distributionResult =
                await client.query(`
                    SELECT *
                    FROM money_distributions
                    WHERE id = $1
                    FOR UPDATE
                `, [id]);


            if (
                distributionResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Data pembagian tidak ditemukan"
                });

            }


            const distribution =
                distributionResult.rows[0];


            // =========================================
            // CEK TRANSAKSI KAS
            // =========================================

            const cashResult =
                await client.query(`
                    SELECT id
                    FROM cash_transactions
                    WHERE reference_type = 'DISTRIBUTION'
                      AND reference_id = $1
                `, [id]);


            // =========================================
            // HAPUS TRANSAKSI KAS
            // =========================================

            if (cashResult.rows.length > 0) {

                await client.query(`
                    DELETE FROM cash_transactions
                    WHERE reference_type = 'DISTRIBUTION'
                      AND reference_id = $1
                `, [id]);

            }


            // =========================================
            // HAPUS PEMBAGIAN
            // =========================================

            await client.query(`
                DELETE FROM money_distributions
                WHERE id = $1
            `, [id]);


            await client.query(
                "COMMIT"
            );


            return res.json({
                success: true,
                message:
                    "Pembagian berhasil dihapus",
                data: distribution
            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "ROLLBACK ERROR:",
                    rollbackError
                );

            }


            console.error(
                "DELETE MONEY DISTRIBUTION ERROR:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus pembagian",
                error:
                    error.message
            });


        } finally {

            client.release();

        }

    }
);
// ========================================
// API MEKANIK
// ========================================

// GET semua mekanik
app.get("/api/mechanics", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                id,
                name,
                phone,
                specialization,
                status,
                address,
                notes,
                created_at,
                updated_at
            FROM mechanics
            ORDER BY created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("GET MECHANICS ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data mekanik"
        });
    }
});


// GET satu mekanik berdasarkan ID
app.get("/api/mechanics/:id", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                id,
                name,
                phone,
                specialization,
                status,
                address,
                notes,
                created_at,
                updated_at
            FROM mechanics
            WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Mekanik tidak ditemukan"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("GET MECHANIC ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data mekanik"
        });
    }
});


// POST tambah mekanik
app.post("/api/mechanics", async (req, res) => {
    try {
        const {
            name,
            phone,
            specialization,
            status,
            address,
            notes
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama mekanik wajib diisi"
            });
        }

        const result = await db.query(`
            INSERT INTO mechanics
            (
                name,
                phone,
                specialization,
                status,
                address,
                notes
            )
            VALUES
            ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            String(name).trim(),
            phone ? String(phone).trim() : null,
            specialization ? String(specialization).trim() : null,
            status || "ACTIVE",
            address ? String(address).trim() : null,
            notes ? String(notes).trim() : null
        ]);

        res.status(201).json({
            success: true,
            message: "Mekanik berhasil ditambahkan",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("POST MECHANIC ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menambahkan mekanik"
        });
    }
});


// PUT edit mekanik
app.put("/api/mechanics/:id", async (req, res) => {
    try {
        const {
            name,
            phone,
            specialization,
            status,
            address,
            notes
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama mekanik wajib diisi"
            });
        }

        const result = await db.query(`
            UPDATE mechanics
            SET
                name = $1,
                phone = $2,
                specialization = $3,
                status = $4,
                address = $5,
                notes = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [
            String(name).trim(),
            phone ? String(phone).trim() : null,
            specialization ? String(specialization).trim() : null,
            status || "ACTIVE",
            address ? String(address).trim() : null,
            notes ? String(notes).trim() : null,
            req.params.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Mekanik tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Mekanik berhasil diperbarui",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("PUT MECHANIC ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal memperbarui mekanik"
        });
    }
});


// DELETE mekanik
app.delete("/api/mechanics/:id", async (req, res) => {
    try {
        const result = await db.query(`
            DELETE FROM mechanics
            WHERE id = $1
            RETURNING *
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Mekanik tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Mekanik berhasil dihapus"
        });

    } catch (error) {
        console.error("DELETE MECHANIC ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menghapus mekanik"
        });
    }
});
// ========================================
// API SERVICE ORDERS / SERVIS
// ========================================

// GET SEMUA SERVIS
app.get("/api/service-orders", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                so.id,
                so.order_number,
                so.order_date,
                so.customer_id,
                so.customer_name,
                so.mechanic_id,
                m.name AS mechanic_name,
                so.phone,
                so.vehicle_plate,
                so.vehicle_brand,
                so.vehicle_model,
                so.vehicle_year,
                so.current_km,
                so.complaint,
                so.inspection,
                so.service_description,
                so.mechanic_notes,
                so.notes,
                so.items,
                so.subtotal,
                so.discount,
                so.status,
                so.estimated_cost,
                so.final_cost,
                so.started_at,
                so.completed_at,
                so.picked_up_at,
                so.created_by,
                so.created_at,
                so.updated_at
            FROM service_orders so
            LEFT JOIN mechanics m
                ON so.mechanic_id = m.id
            ORDER BY so.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("GET SERVICE ORDERS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data servis",
            error: error.message
        });
    }
});


// GET SATU SERVIS
app.get("/api/service-orders/:id", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                so.id,
                so.order_number,
                so.order_date,
                so.customer_id,
                so.customer_name,
                so.mechanic_id,
                m.name AS mechanic_name,
                so.phone,
                so.vehicle_plate,
                so.vehicle_brand,
                so.vehicle_model,
                so.vehicle_year,
                so.current_km,
                so.complaint,
                so.inspection,
                so.service_description,
                so.mechanic_notes,
                so.notes,
                so.items,
                so.subtotal,
                so.discount,
                so.status,
                so.estimated_cost,
                so.final_cost,
                so.started_at,
                so.completed_at,
                so.picked_up_at,
                so.created_by,
                so.created_at,
                so.updated_at
            FROM service_orders so
            LEFT JOIN mechanics m
                ON so.mechanic_id = m.id
            WHERE so.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data servis tidak ditemukan"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("GET SERVICE ORDER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail servis",
            error: error.message
        });
    }
});


// POST SERVIS BARU
app.post("/api/service-orders", async (req, res) => {
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            phone,

            mechanic_id,

            vehicle_plate,
            vehicle_brand,
            vehicle_model,
            vehicle_year,
            vehicle_km,
            current_km,

            complaint,
            inspection,
            service_description,
            mechanic_notes,
            notes,

            items,
            subtotal,
            discount,
            total,

            estimated_cost,
            final_cost,
            status
        } = req.body;


        // ================================
        // VALIDASI
        // ================================

        if (!customer_name || !String(customer_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama pelanggan wajib diisi"
            });
        }


        // ================================
        // NOMOR SERVIS
        // ================================

        const orderNumber =
            "SRV-" +
            Date.now().toString().slice(-8);


        // ================================
        // DATA TELEPON
        // ================================

        const customerPhone =
            customer_phone || phone || null;


        // ================================
        // DATA KM
        // ================================

        let vehicleKm = null;

        if (
            vehicle_km !== undefined &&
            vehicle_km !== "" &&
            vehicle_km !== null
        ) {
            vehicleKm = Number(vehicle_km);
        } else if (
            current_km !== undefined &&
            current_km !== "" &&
            current_km !== null
        ) {
            vehicleKm = Number(current_km);
        }


        // ================================
        // ITEM SERVIS
        // ================================

        const serviceItems =
            Array.isArray(items)
                ? items
                : [];


        // ================================
        // TOTAL
        // ================================

        const serviceSubtotal =
            Number(subtotal) || 0;

        const serviceDiscount =
            Number(discount) || 0;

        const serviceTotal =
            total !== undefined &&
            total !== null &&
            total !== ""
                ? Number(total) || 0
                : serviceSubtotal - serviceDiscount;


        const serviceEstimatedCost =
            estimated_cost !== undefined &&
            estimated_cost !== null &&
            estimated_cost !== ""
                ? Number(estimated_cost) || 0
                : serviceTotal;


        const serviceFinalCost =
            final_cost !== undefined &&
            final_cost !== null &&
            final_cost !== ""
                ? Number(final_cost) || 0
                : serviceTotal;


        // ================================
        // INSERT
        // ================================

        const result = await db.query(`
            INSERT INTO service_orders
            (
                id,
                order_number,
                order_date,
                customer_id,
                customer_name,
                mechanic_id,
                phone,
                vehicle_plate,
                vehicle_brand,
                vehicle_model,
                vehicle_year,
                current_km,
                complaint,
                inspection,
                service_description,
                mechanic_notes,
                notes,
                items,
                subtotal,
                discount,
                status,
                estimated_cost,
                final_cost,
                created_by,
                created_at,
                updated_at
            )
            VALUES
            (
                gen_random_uuid(),
                $1,
                CURRENT_TIMESTAMP,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18,
                $19,
                $20,
                $21,
                $22,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING *
        `, [
            orderNumber,

            customer_id || null,
            String(customer_name).trim(),

            mechanic_id || null,

            customerPhone,

            vehicle_plate || null,
            vehicle_brand || null,
            vehicle_model || null,

            vehicle_year
                ? Number(vehicle_year)
                : null,

            vehicleKm,

            complaint || null,
            inspection || null,
            service_description || null,
            mechanic_notes || null,
            notes || mechanic_notes || null,

            JSON.stringify(serviceItems),

            serviceSubtotal,
            serviceDiscount,

            status || "MENUNGGU",

            serviceEstimatedCost,
            serviceFinalCost,

            req.session?.user?.id || null
        ]);


        res.status(201).json({
            success: true,
            message: "Servis berhasil disimpan",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("POST SERVICE ORDER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan servis",
            error: error.message
        });
    }
});


// PUT / EDIT SERVIS
app.put("/api/service-orders/:id", async (req, res) => {
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            phone,

            mechanic_id,

            vehicle_plate,
            vehicle_brand,
            vehicle_model,
            vehicle_year,
            vehicle_km,
            current_km,

            complaint,
            inspection,
            service_description,
            mechanic_notes,
            notes,

            items,
            subtotal,
            discount,
            total,

            estimated_cost,
            final_cost,
            status
        } = req.body;


        // ================================
        // VALIDASI
        // ================================

        if (!customer_name || !String(customer_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama pelanggan wajib diisi"
            });
        }


        // ================================
        // TELEPON
        // ================================

        const customerPhone =
            customer_phone || phone || null;


        // ================================
        // KM
        // ================================

        let vehicleKm = null;

        if (
            vehicle_km !== undefined &&
            vehicle_km !== "" &&
            vehicle_km !== null
        ) {
            vehicleKm = Number(vehicle_km);
        } else if (
            current_km !== undefined &&
            current_km !== "" &&
            current_km !== null
        ) {
            vehicleKm = Number(current_km);
        }


        // ================================
        // ITEM
        // ================================

        const serviceItems =
            Array.isArray(items)
                ? items
                : [];


        // ================================
        // TOTAL
        // ================================

        const serviceSubtotal =
            Number(subtotal) || 0;

        const serviceDiscount =
            Number(discount) || 0;

        const serviceTotal =
            total !== undefined &&
            total !== null &&
            total !== ""
                ? Number(total) || 0
                : serviceSubtotal - serviceDiscount;


        const serviceEstimatedCost =
            estimated_cost !== undefined &&
            estimated_cost !== null &&
            estimated_cost !== ""
                ? Number(estimated_cost) || 0
                : serviceTotal;


        const serviceFinalCost =
            final_cost !== undefined &&
            final_cost !== null &&
            final_cost !== ""
                ? Number(final_cost) || 0
                : serviceTotal;


        // ================================
        // UPDATE
        // ================================

        const result = await db.query(`
            UPDATE service_orders
            SET
                customer_id = $1,
                customer_name = $2,
                mechanic_id = $3,
                phone = $4,
                vehicle_plate = $5,
                vehicle_brand = $6,
                vehicle_model = $7,
                vehicle_year = $8,
                current_km = $9,
                complaint = $10,
                inspection = $11,
                service_description = $12,
                mechanic_notes = $13,
                notes = $14,
                items = $15,
                subtotal = $16,
                discount = $17,
                status = $18,
                estimated_cost = $19,
                final_cost = $20,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $21
            RETURNING *
        `, [
            customer_id || null,
            String(customer_name).trim(),

            mechanic_id || null,

            customerPhone,

            vehicle_plate || null,
            vehicle_brand || null,
            vehicle_model || null,

            vehicle_year
                ? Number(vehicle_year)
                : null,

            vehicleKm,

            complaint || null,
            inspection || null,
            service_description || null,
            mechanic_notes || null,
            notes || mechanic_notes || null,

            JSON.stringify(serviceItems),

            serviceSubtotal,
            serviceDiscount,

            status || "MENUNGGU",

            serviceEstimatedCost,
            serviceFinalCost,

            req.params.id
        ]);


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data servis tidak ditemukan"
            });
        }


        res.json({
            success: true,
            message: "Servis berhasil diperbarui",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("PUT SERVICE ORDER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui servis",
            error: error.message
        });
    }
});


// DELETE SERVIS
app.delete("/api/service-orders/:id", async (req, res) => {
    try {
        const result = await db.query(`
            DELETE FROM service_orders
            WHERE id = $1
            RETURNING id
        `, [req.params.id]);


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data servis tidak ditemukan"
            });
        }


        res.json({
            success: true,
            message: "Servis berhasil dihapus"
        });

    } catch (error) {
        console.error("DELETE SERVICE ORDER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus servis",
            error: error.message
        });
    }
});
// ========================================
// API LAPORAN
// ========================================

// GET RINGKASAN LAPORAN
app.get("/api/reports/summary", async (req, res) => {
    try {
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        const dateCondition = (column) => {
            if (startDate && endDate) {
                return `${column} >= $1 AND ${column} < ($2::date + INTERVAL '1 day')`;
            }

            if (startDate) {
                return `${column} >= $1`;
            }

            if (endDate) {
                return `${column} < ($1::date + INTERVAL '1 day')`;
            }

            return "TRUE";
        };

        const params =
            startDate && endDate
                ? [startDate, endDate]
                : startDate
                    ? [startDate]
                    : endDate
                        ? [endDate]
                        : [];


        // ================================
        // PENJUALAN
        // ================================

        const sales = await db.query(`
            SELECT
                COUNT(*)::INTEGER AS total_transaksi,
                COALESCE(SUM(total), 0) AS total_penjualan,
                COALESCE(SUM(discount), 0) AS total_diskon,
                COALESCE(SUM(paid_amount), 0) AS total_dibayar
            FROM sales
            WHERE ${dateCondition("sale_date")}
            AND COALESCE(status, '') NOT IN ('CANCELLED', 'BATAL')
        `, params);


        // ================================
        // SERVIS
        // ================================

        const services = await db.query(`
            SELECT
                COUNT(*)::INTEGER AS total_transaksi,
                COALESCE(SUM(final_cost), 0) AS total_servis,
                COALESCE(SUM(estimated_cost), 0) AS estimasi_servis
            FROM service_orders
            WHERE ${dateCondition("order_date")}
            AND COALESCE(status, '') NOT IN ('BATAL', 'CANCELLED')
        `, params);


        // ================================
        // PEMBELIAN
        // ================================

        const purchases = await db.query(`
            SELECT
                COUNT(*)::INTEGER AS total_transaksi,
                COALESCE(SUM(total), 0) AS total_pembelian,
                COALESCE(SUM(paid_amount), 0) AS total_dibayar
            FROM purchases
            WHERE ${dateCondition("purchase_date")}
            AND COALESCE(status, '') NOT IN ('CANCELLED', 'BATAL')
        `, params);


        // ================================
        // KAS
        // ================================

        const cash = await db.query(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(transaction_type) IN
                                ('income', 'pemasukan', 'in')
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS total_pemasukan,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(transaction_type) IN
                                ('expense', 'pengeluaran', 'out')
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS total_pengeluaran
            FROM cash_transactions
            WHERE ${dateCondition("transaction_date")}
        `, params);


        // ================================
        // PIUTANG
        // ================================

        const receivable = await db.query(`
            SELECT
                COUNT(*)::INTEGER AS total_piutang,
                COALESCE(SUM(total_amount), 0) AS total_piutang,
                COALESCE(SUM(paid_amount), 0) AS total_terbayar,
                COALESCE(SUM(balance_amount), 0) AS total_sisa
            FROM accounts_receivable
            WHERE ${dateCondition("receivable_date")}
        `, params);


        // ================================
        // HUTANG
        // ================================

        const payable = await db.query(`
    SELECT
        COUNT(*)::INTEGER AS jumlah_transaksi,
        COALESCE(SUM(total_amount), 0) AS total_hutang,
        COALESCE(SUM(paid_amount), 0) AS total_terbayar,
        COALESCE(SUM(balance_amount), 0) AS total_sisa
    FROM accounts_payable
    WHERE ${dateCondition("payable_date")}
`, params);

        const totalPenjualan =
            Number(sales.rows[0].total_penjualan) || 0;

        const totalServis =
            Number(services.rows[0].total_servis) || 0;

        const totalPembelian =
            Number(purchases.rows[0].total_pembelian) || 0;

        const totalPemasukan =
            Number(cash.rows[0].total_pemasukan) || 0;

        const totalPengeluaran =
            Number(cash.rows[0].total_pengeluaran) || 0;


        // ================================
        // RINGKASAN
        // ================================

        const omzet =
            totalPenjualan + totalServis;

        const labaKotor =
            omzet - totalPembelian;

        const saldoKas =
            totalPemasukan - totalPengeluaran;


        res.json({
            success: true,

            periode: {
                start_date: startDate,
                end_date: endDate
            },

            penjualan: {
                transaksi:
                    sales.rows[0].total_transaksi,
                total:
                    totalPenjualan,
                diskon:
                    Number(sales.rows[0].total_diskon) || 0,
                dibayar:
                    Number(sales.rows[0].total_dibayar) || 0
            },

            servis: {
                transaksi:
                    services.rows[0].total_transaksi,
                total:
                    totalServis,
                estimasi:
                    Number(services.rows[0].estimasi_servis) || 0
            },

            pembelian: {
                transaksi:
                    purchases.rows[0].total_transaksi,
                total:
                    totalPembelian,
                dibayar:
                    Number(purchases.rows[0].total_dibayar) || 0
            },

            kas: {
                pemasukan:
                    totalPemasukan,
                pengeluaran:
                    totalPengeluaran,
                saldo:
                    saldoKas
            },

            piutang: {
                transaksi:
                    receivable.rows[0].total_piutang,
                total:
                    Number(receivable.rows[0].total_piutang) || 0,
                terbayar:
                    Number(receivable.rows[0].total_terbayar) || 0,
                sisa:
                    Number(receivable.rows[0].total_sisa) || 0
            },

            hutang: {
                transaksi:
                    payable.rows[0].jumlah_transaksi,
                total:
                    Number(payable.rows[0].total_hutang) || 0,
                terbayar:
                    Number(payable.rows[0].total_terbayar) || 0,
                sisa:
                    Number(payable.rows[0].total_sisa) || 0
            },

            ringkasan: {
                omzet: omzet,
                laba_kotor: labaKotor,
                saldo_kas: saldoKas
            }
        });

    } catch (error) {

        console.error(
            "GET REPORT SUMMARY ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan",
            error: error.message
        });
    }
});


// ========================================
// LAPORAN PENJUALAN
// ========================================

app.get("/api/reports/sales", async (req, res) => {
    try {

        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        let query = `
            SELECT
                id,
                invoice_number,
                sale_date,
                customer_id,
                subtotal,
                discount,
                total,
                payment_method,
                payment_status,
                paid_amount,
                change_amount,
                status
            FROM sales
            WHERE 1 = 1
        `;

        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND sale_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND sale_date < ($${params.length}::date + INTERVAL '1 day')`;
        }

        query += ` ORDER BY sale_date DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "GET SALES REPORT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan penjualan",
            error: error.message
        });
    }
});


// ========================================
// LAPORAN SERVIS
// ========================================

app.get("/api/reports/services", async (req, res) => {
    try {

        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        let query = `
            SELECT
                so.id,
                so.order_number,
                so.order_date,
                so.customer_name,
                so.phone,
                so.vehicle_plate,
                so.vehicle_brand,
                so.vehicle_model,
                so.mechanic_id,
                m.name AS mechanic_name,
                so.status,
                so.subtotal,
                so.discount,
                so.estimated_cost,
                so.final_cost
            FROM service_orders so
            LEFT JOIN mechanics m
                ON so.mechanic_id = m.id
            WHERE 1 = 1
        `;

        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND so.order_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND so.order_date < ($${params.length}::date + INTERVAL '1 day')`;
        }

        query += ` ORDER BY so.order_date DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "GET SERVICE REPORT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan servis",
            error: error.message
        });
    }
});
// ========================================
// LAPORAN PEMBELIAN
// ========================================

app.get("/api/reports/purchases", async (req, res) => {
    try {
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        let query = `
            SELECT
                p.id,
                p.purchase_number,
                p.purchase_date,
                p.supplier_id,
                s.name AS supplier_name,
                p.subtotal,
                p.discount,
                p.additional_cost,
                p.total,
                p.payment_method,
                p.payment_status,
                p.paid_amount,
                p.due_date,
                p.status
            FROM purchases p
            LEFT JOIN suppliers s
                ON p.supplier_id = s.id
            WHERE 1 = 1
        `;

        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND p.purchase_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND p.purchase_date < ($${params.length}::date + INTERVAL '1 day')`;
        }

        query += ` ORDER BY p.purchase_date DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("GET PURCHASE REPORT ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan pembelian",
            error: error.message
        });
    }
});


// ========================================
// LAPORAN KAS
// ========================================

app.get("/api/reports/cash", async (req, res) => {
    try {
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        let query = `
            SELECT
                id,
                transaction_date,
                transaction_type,
                payment_method,
                amount,
                description,
                reference_type,
                reference_id,
                created_at
            FROM cash_transactions
            WHERE 1 = 1
        `;

        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND transaction_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND transaction_date < ($${params.length}::date + INTERVAL '1 day')`;
        }

        query += ` ORDER BY transaction_date DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("GET CASH REPORT ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan kas",
            error: error.message
        });
    }
});
// ========================================
// API PENGATURAN
// ========================================

// Ambil semua pengaturan
app.get("/api/settings", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT setting_key, setting_value
            FROM settings
            ORDER BY setting_key
        `);

        const settings = {};

        for (const row of result.rows) {
            try {
                settings[row.setting_key] = JSON.parse(row.setting_value);
            } catch {
                settings[row.setting_key] = row.setting_value;
            }
        }

        res.json(settings);

    } catch (error) {
        console.error("GET /api/settings:", error);

        res.status(500).json({
            message: "Gagal mengambil pengaturan"
        });
    }
});


// ========================================
// SIMPAN PENGATURAN
// ========================================

app.put("/api/settings", async (req, res) => {

    const client = await db.connect();

    try {

        const data = req.body || {};

        await client.query("BEGIN");


        // --------------------------------
        // Fungsi simpan setting
        // --------------------------------

        async function saveSetting(key, value, description = "") {

            const stringValue =
                typeof value === "string"
                    ? value
                    : JSON.stringify(value);


            const check = await client.query(
                `
                SELECT id
                FROM settings
                WHERE setting_key = $1
                LIMIT 1
                `,
                [key]
            );


            if (check.rows.length > 0) {

                await client.query(
                    `
                    UPDATE settings
                    SET
                        setting_value = $1,
                        description = $2,
                        updated_at = NOW()
                    WHERE setting_key = $3
                    `,
                    [
                        stringValue,
                        description,
                        key
                    ]
                );

            } else {

                await client.query(
                    `
                    INSERT INTO settings
                    (
                        setting_key,
                        setting_value,
                        description,
                        updated_at
                    )
                    VALUES
                    ($1, $2, $3, NOW())
                    `,
                    [
                        key,
                        stringValue,
                        description
                    ]
                );

            }
        }


        // --------------------------------
        // PROFIL BENGKEL
        // --------------------------------

        if (data.business) {

            await saveSetting(
                "business",
                data.business,
                "Profil AN-NAFIQ BENGKEL"
            );

        }


        // --------------------------------
        // NOTA
        // --------------------------------

        if (data.receipt) {

            await saveSetting(
                "receipt",
                data.receipt,
                "Pengaturan nota"
            );

        }


        // --------------------------------
        // PEMBAYARAN
        // --------------------------------

        if (data.payment) {

            await saveSetting(
                "payment",
                data.payment,
                "Metode pembayaran"
            );

        }


        // --------------------------------
        // SERVIS
        // --------------------------------

        if (data.service) {

            await saveSetting(
                "service",
                data.service,
                "Pengaturan servis"
            );

        }


        // --------------------------------
        // ACCOUNT
        // --------------------------------

        if (data.account && data.account.username) {

            const username =
                String(data.account.username).trim();


            if (username.length > 0) {

                // Cari user OWNER lama
                const ownerResult = await client.query(`
                    SELECT
                        u.id,
                        u.username
                    FROM users u
                    LEFT JOIN roles r
                        ON r.id = u.role_id
                    WHERE
                        UPPER(COALESCE(r.name, 'OWNER')) = 'OWNER'
                    ORDER BY u.created_at ASC
                    LIMIT 1
                `);


                if (ownerResult.rows.length > 0) {

                    await client.query(
                        `
                        UPDATE users
                        SET
                            username = $1,
                            updated_at = NOW()
                        WHERE id = $2
                        `,
                        [
                            username,
                            ownerResult.rows[0].id
                        ]
                    );

                }

            }

        }


        await client.query("COMMIT");


        res.json({
            success: true,
            message: "Pengaturan berhasil disimpan"
        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error("PUT /api/settings:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan pengaturan",
            error: error.message
        });

    } finally {

        client.release();

    }

});


// ========================================
// UBAH PASSWORD OWNER
// ========================================

app.put("/api/change-password", async (req, res) => {

    try {

        const {
            oldPassword,
            newPassword
        } = req.body || {};


        if (!oldPassword || !newPassword) {

            return res.status(400).json({
                message: "Password lama dan password baru wajib diisi"
            });

        }


        if (newPassword.length < 6) {

            return res.status(400).json({
                message: "Password baru minimal 6 karakter"
            });

        }


        // --------------------------------
        // Cari OWNER
        // --------------------------------

        const ownerResult = await db.query(`
            SELECT
                u.id,
                u.username,
                u.password_hash
            FROM users u
            LEFT JOIN roles r
                ON r.id = u.role_id
            WHERE
                UPPER(COALESCE(r.name, 'OWNER')) = 'OWNER'
            ORDER BY u.created_at ASC
            LIMIT 1
        `);


        if (ownerResult.rows.length === 0) {

            return res.status(404).json({
                message: "Akun OWNER tidak ditemukan"
            });

        }


        const owner = ownerResult.rows[0];


        // --------------------------------
        // Cek password lama
        // --------------------------------

        const passwordMatch =
            await bcrypt.compare(
                oldPassword,
                owner.password_hash
            );


        if (!passwordMatch) {

            return res.status(401).json({
                message: "Password lama salah"
            });

        }


        // --------------------------------
        // Hash password baru
        // --------------------------------

        const newPasswordHash =
            await bcrypt.hash(
                newPassword,
                10
            );


        // --------------------------------
        // Update password
        // --------------------------------

        await db.query(
            `
            UPDATE users
            SET
                password_hash = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                newPasswordHash,
                owner.id
            ]
        );


        res.json({
            success: true,
            message: "Password berhasil diubah"
        });


    } catch (error) {

        console.error(
            "PUT /api/change-password:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengubah password"
        });

    }

});
// ========================================
// 404 API
// ========================================

app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message: "API tidak ditemukan"
    });
});

// ========================================
// SERVER
// ========================================

app.listen(PORT, () => {

    console.log("========================================");
    console.log("   AN-NAFIQ BENGKEL");
    console.log("========================================");
    console.log(
        `Server berjalan di http://localhost:${PORT}`
    );
    console.log("========================================");

});