const pool = require("./database").promise();

const modules = {
    clientes: require("./clientes"),
    usuarios: require("./usuarios"),
    medicamentos: require("./medicamentos"),
    recetas: require("./recetas"),
    lote: require("./lote"),
    ventas: require("./ventas"),
};

const permissions = {
    Administrador: Object.keys(modules),
    Jefa: Object.keys(modules),
    Cajero: [
        "clientes",
        "medicamentos",
        "ventas",
        "detalles_venta",
        "movimientos_puntos",
    ],
    Farmaceutico: [
        "clientes",
        "medicamentos",
        "recetas",
        "detalle_recetas",
        "lote",
    ],
};

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const rememberUser = document.getElementById("rememberUser");
const showLoginPassword = document.getElementById("showLoginPassword");
const sessionUser = document.getElementById("sessionUser");
const logoutBtn = document.getElementById("logoutBtn");
const menuOptionsGrid = document.getElementById("menuOptionsGrid");

loadRememberedUser();
restoreSession();

loginForm.addEventListener("submit", login);
logoutBtn.addEventListener("click", logout);

showLoginPassword.addEventListener("change", () => {
    loginPassword.type = showLoginPassword.checked ? "text" : "password";
});

menuOptionsGrid.addEventListener("click", (event) => {
    const option = event.target.closest("[data-menu-option]");

    if (option) {
        window.location.href = `${option.dataset.menuOption}.html`;
    }
});

async function login(event) {
    event.preventDefault();

    try {
        const [rows] = await pool.query(
            `SELECT *
             FROM usuarios
             WHERE nombre_usuario = ?
               AND contrasena = ?
               AND estado = 'Activo'
             LIMIT 1`,
            [loginUser.value.trim(), loginPassword.value]
        );

        if (!rows.length) {
            showMessage("Usuario o contraseña incorrectos, o usuario inactivo.");
            return;
        }

        if (rememberUser.checked) {
            localStorage.setItem("usuarioRecordado", loginUser.value.trim());
        } else {
            localStorage.removeItem("usuarioRecordado");
        }

        sessionStorage.setItem("usuarioActivo", JSON.stringify(rows[0]));
        openPanel(rows[0]);
        loginPassword.value = "";
    } catch (error) {
        showMessage(`Error al iniciar sesión: ${error.message}`);
    }
}

function restoreSession() {
    const user = JSON.parse(
        sessionStorage.getItem("usuarioActivo") || "null"
    );

    if (user) {
        openPanel(user);
    }
}

function openPanel(user) {
    loginScreen.classList.add("d-none");
    appScreen.classList.remove("d-none");
    sessionUser.textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
    renderMenu(user.rol);
}

function renderMenu(role) {
    const allowedModules = permissions[role] || [];

    menuOptionsGrid.innerHTML = allowedModules
        .filter((key) => modules[key])
        .map((key) => {
            const module = modules[key];
            const initials = module.title
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

            return `
                <div class="col-12 d-flex">
                    <button
                        class="module-card w-100"
                        type="button"
                        data-menu-option="${key}"
                    >
                        <span class="module-icon">${escapeHtml(initials)}</span>
                        <span class="text-start flex-grow-1">
                            <span class="d-block h5 fw-bold mb-1">
                                ${escapeHtml(module.title)}
                            </span>
                            <span class="d-block small text-secondary fw-normal">
                                ${escapeHtml(module.description)}
                            </span>
                        </span>
                    </button>
                </div>
            `;
        })
        .join("");
}

function logout() {
    sessionStorage.removeItem("usuarioActivo");
    appScreen.classList.add("d-none");
    loginScreen.classList.remove("d-none");
    loginForm.reset();
    loginPassword.type = "password";
    loadRememberedUser();
}

function loadRememberedUser() {
    const savedUser = localStorage.getItem("usuarioRecordado");
    loginUser.value = savedUser || "";
    rememberUser.checked = Boolean(savedUser);
}

function showMessage(text) {
    loginMessage.textContent = text;
    loginMessage.className = "alert alert-danger";
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
