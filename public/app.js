
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

if (loginForm) {
loginForm.addEventListener("submit", async (event) => {
event.preventDefault();



    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "";
    loginMessage.className = "login-message";

    loginButton.disabled = true;
    loginButton.textContent = "MEMPROSES...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            loginMessage.textContent =
                data.message || "Login gagal";

            loginMessage.className =
                "login-message error";

            return;
        }

        loginMessage.textContent = "Login berhasil!";
        loginMessage.className =
            "login-message success";

        setTimeout(() => {
            window.location.href = "/dashboard.html";
        }, 500);

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        loginMessage.textContent =
            "Tidak dapat terhubung ke server.";

        loginMessage.className =
            "login-message error";

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "MASUK";
    }
});


}
