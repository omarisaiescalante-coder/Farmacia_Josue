const db = require("./database").promise();

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
    Cajero: ["clientes", "medicamentos", "ventas"],
    Farmaceutico: ["clientes", "medicamentos", "recetas", "lote"],
};

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const rememberUser = document.getElementById("rememberUser");
const showLoginPassword = document.getElementById("showLoginPassword");
const loginMessage = document.getElementById("loginMessage");
const sessionUser = document.getElementById("sessionUser");
const menuGrid = document.getElementById("menuOptionsGrid");

function showError(text) {
    loginMessage.textContent = text;
    loginMessage.className = "alert alert-danger";
    setTimeout(() => { loginMessage.className = "alert d-none"; }, 3500);
}

function showMenu(user) {
    const normalizedRole = String(user.rol || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const allowed = permissions[normalizedRole];

    if (!allowed) {
        sessionStorage.removeItem("usuarioActivo");
        appScreen.classList.add("d-none");
        loginScreen.classList.remove("d-none");
        showError("El rol del usuario no está configurado.");
        return;
    }

    sessionUser.textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
    menuGrid.replaceChildren();

    allowed.forEach((name) => {
        const module = modules[name];

        if (!module) {
            return;
        }

        const column = document.createElement("div");
        column.className = "col-12 d-flex";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-light border border-success-subtle shadow-sm rounded-4 p-4 w-100";
        button.innerHTML = '<span class="d-flex align-items-center gap-3"><span class="module-icon badge bg-success rounded-3 p-3 fs-6"></span><span class="text-start"><span class="d-block h5 fw-bold mb-1 module-title"></span><span class="text-secondary module-description"></span></span></span>';

        button.querySelector(".module-icon").textContent = module.title.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
        button.querySelector(".module-title").textContent = module.title;
        button.querySelector(".module-description").textContent = module.description;

        button.addEventListener("click", () => { window.location.href = `${name}.html`; });

        column.appendChild(button);
        menuGrid.appendChild(column);
    });

    loginScreen.classList.add("d-none");
    appScreen.classList.remove("d-none");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = loginUser.value.trim();
    try {
        const [rows] = await db.execute(
            "SELECT id_usuario, nombre, apellido, nombre_usuario, rol FROM usuarios WHERE nombre_usuario = ? AND contrasena = ? AND estado = 'Activo' LIMIT 1",
            [username, loginPassword.value]
        );
        if (!rows.length) throw new Error("Usuario o contraseña incorrectos, o usuario inactivo.");
        const user = rows[0];
        sessionStorage.setItem("usuarioActivo", JSON.stringify(user));
        if (rememberUser.checked) localStorage.setItem("usuarioRecordado", username);
        else localStorage.removeItem("usuarioRecordado");
        loginPassword.value = "";
        showMenu(user);
    } catch (error) {
        showError(error.message);
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    appScreen.classList.add("d-none");
    loginScreen.classList.remove("d-none");
    loginForm.reset();
    loadRememberedUser();
});

showLoginPassword.addEventListener("change", () => {
    loginPassword.type = showLoginPassword.checked ? "text" : "password";
});

function loadRememberedUser() {
    const saved = localStorage.getItem("usuarioRecordado");
    loginUser.value = saved || "";
    rememberUser.checked = Boolean(saved);
}

const savedSession = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
if (savedSession) showMenu(savedSession);
else loadRememberedUser();
