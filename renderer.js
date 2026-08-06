// Controla la autenticación, las sesiones y el menú principal según el rol.
const db = require("./database").promise();
const { ipcRenderer } = require("electron");

// Relaciona el identificador de cada módulo con su configuración.
const modules = {
    usuarios: require("./usuarios"),
    clientes: require("./clientes"),
    medicamentos: require("./medicamentos"),
    ventas: require("./ventas"),
    compras: require("./compras"),
    lote: require("./lote"),
    facturas: require("./facturas"),
};

// Define qué módulos puede consultar cada tipo de usuario.
const permissions = {
    Administrador: [
        "ventas",
        "medicamentos",
        "clientes",
        "compras",
        "lote",
        "facturas",
        "usuarios",
    ],
    Cajero: [ 
        "ventas",
        "medicamentos",
        "clientes",
        "facturas",
    ],
};

const navigationGroups = [
    {
        label: "Operación",
        modules: ["ventas", "facturas", "clientes"],
    },
    {
        label: "Inventario",
        modules: ["medicamentos", "compras", "lote"],
    },
    {
        label: "Administración",
        modules: ["usuarios"],
    },
];

const moduleIcons = {
    ventas: `
        <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/>
        <path d="M8 8h8M8 12h5"/>
    `,
    facturas: `
        <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/>
        <path d="M8 8h8M8 12h8M8 16h5"/>
    `,
    clientes: `
        <circle cx="9" cy="8" r="3"/>
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 5"/>
    `,
    medicamentos: `
        <path d="m8.5 4.5 11 11a4.25 4.25 0 0 1-6 6l-11-11a4.25 4.25 0 0 1 6-6Z"/>
        <path d="m8 16 8-8"/>
    `,
    compras: `
        <path d="M3 5h2l2 11h10l3-8H6"/>
        <circle cx="9" cy="20" r="1"/>
        <circle cx="17" cy="20" r="1"/>
    `,
    lote: `
        <path d="m12 2 8 4-8 4-8-4 8-4Z"/>
        <path d="m4 10 8 4 8-4M4 14l8 4 8-4M4 18l8 4 8-4"/>
    `,
    usuarios: `
        <circle cx="9" cy="8" r="3"/>
        <path d="M3.5 19a5.5 5.5 0 0 1 9-4.2"/>
        <path d="M17 12.5 21 14v3.2c0 2.7-4 4.8-4 4.8s-4-2.1-4-4.8V14l4-1.5Z"/>
        <path d="m15.5 17.2 1 1 2-2"/>
    `,
};

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const rememberUser = document.getElementById("rememberUser");
const togglePassword = document.getElementById("togglePassword");
const loginMessage = document.getElementById("loginMessage");
const loginMessageText = document.getElementById("loginMessageText");
const loginSubmit = document.getElementById("loginSubmit");
const loginSubmitText = document.getElementById("loginSubmitText");
const loginSpinner = document.getElementById("loginSpinner");
const sessionAvatar = document.getElementById("sessionAvatar");
const sessionUserName = document.getElementById("sessionUserName");
const sessionUserRole = document.getElementById("sessionUserRole");
const welcomeTitle = document.getElementById("welcomeTitle");
const currentDate = document.getElementById("currentDate");
const availableModules = document.getElementById("availableModules");
const roleSummary = document.getElementById("roleSummary");
const menuList = document.getElementById("menuOptionsList");

function normalizeRole(role) {
    return String(role || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getDisplayName(user) {
    const fullName = [user.nombre, user.apellido]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || user.nombre_usuario || "Usuario";
}

function getInitials(name) {
    return String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "UJ";
}

function capitalize(text) {
    return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) {
        return "Buenos días";
    }

    if (hour < 18) {
        return "Buenas tardes";
    }

    return "Buenas noches";
}

function getFriendlyError(error) {
    const unavailableCodes = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "PROTOCOL_CONNECTION_LOST",
    ]);

    if (unavailableCodes.has(error?.code)) {
        return "No fue posible conectar con el sistema. Verifica la conexión e inténtalo nuevamente.";
    }

    return error?.message || "No fue posible iniciar sesión. Inténtalo nuevamente.";
}

function showError(text) {
    loginMessageText.textContent = text;
    loginMessage.classList.remove("d-none");
    loginUser.classList.add("is-invalid");
    loginPassword.classList.add("is-invalid");
    loginUser.setAttribute("aria-invalid", "true");
    loginPassword.setAttribute("aria-invalid", "true");
}

function clearError() {
    loginMessage.classList.add("d-none");
    loginMessageText.textContent = "";
    loginUser.classList.remove("is-invalid");
    loginPassword.classList.remove("is-invalid");
    loginUser.removeAttribute("aria-invalid");
    loginPassword.removeAttribute("aria-invalid");
}

function setLoginLoading(isLoading) {
    loginSubmit.disabled = isLoading;
    loginUser.readOnly = isLoading;
    loginPassword.readOnly = isLoading;
    loginSubmitText.textContent = isLoading ? "Verificando acceso…" : "Iniciar sesión";
    loginSpinner.classList.toggle("d-none", !isLoading);
    loginForm.setAttribute("aria-busy", String(isLoading));
}

function setPasswordVisibility(showPassword) {
    loginPassword.type = showPassword ? "text" : "password";
    togglePassword.setAttribute("aria-pressed", String(showPassword));
    togglePassword.setAttribute(
        "aria-label",
        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
    );
    togglePassword.title = showPassword ? "Ocultar contraseña" : "Mostrar contraseña";
}

function createModuleButton(name, module) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-link module-nav-item d-flex align-items-center gap-3 w-100 text-start px-2 py-2";
    button.setAttribute("aria-label", `Abrir ${module.title}`);
    button.innerHTML = `
        <span class="module-icon d-inline-flex align-items-center justify-content-center rounded-3 flex-shrink-0" aria-hidden="true">
            <svg class="icon" viewBox="0 0 24 24"></svg>
        </span>
        <span class="module-copy flex-grow-1 overflow-hidden">
            <span class="module-title d-block fw-semibold text-truncate"></span>
            <span class="module-description d-block text-truncate"></span>
        </span>
        <svg class="icon module-arrow ms-auto flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6"/>
        </svg>
    `;

    button.querySelector(".module-icon .icon").innerHTML = moduleIcons[name] || "";
    button.querySelector(".module-title").textContent = module.title;
    button.querySelector(".module-description").textContent = module.description;
    button.addEventListener("click", () => {
        window.location.href = `${name}.html`;
    });

    return button;
}

function renderNavigation(allowed) {
    menuList.replaceChildren();

    navigationGroups.forEach((group) => {
        const visibleModules = group.modules.filter((name) => allowed.includes(name));

        if (!visibleModules.length) {
            return;
        }

        const groupElement = document.createElement("section");
        groupElement.className = "nav-group";

        const label = document.createElement("p");
        label.className = "nav-group__label text-uppercase fw-bold px-2 mb-2";
        label.textContent = group.label;

        const list = document.createElement("div");
        list.className = "nav nav-pills flex-column flex-nowrap gap-1";

        visibleModules.forEach((name) => {
            const module = modules[name];

            if (module) {
                list.appendChild(createModuleButton(name, module));
            }
        });

        groupElement.append(label, list);
        menuList.appendChild(groupElement);
    });
}

function updateSessionSummary(user, allowed) {
    const displayName = getDisplayName(user);
    const firstName = String(user.nombre || displayName).trim().split(/\s+/)[0];
    const formattedDate = new Intl.DateTimeFormat("es-HN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    sessionAvatar.textContent = getInitials(displayName);
    sessionUserName.textContent = displayName;
    sessionUserName.title = displayName;
    sessionUserRole.textContent = user.rol || "Usuario";
    welcomeTitle.textContent = `${getGreeting()}, ${firstName}`;
    currentDate.textContent = capitalize(formattedDate);
    availableModules.textContent = `${allowed.length} ${allowed.length === 1 ? "módulo" : "módulos"}`;
    roleSummary.textContent = user.rol || "Usuario";
}

// Renderiza el menú autorizado después de validar el usuario.
function showMenu(user) {
    const allowed = permissions[normalizeRole(user.rol)];

    if (!allowed) {
        sessionStorage.removeItem("usuarioActivo");
        appScreen.classList.add("d-none");
        loginScreen.classList.remove("d-none");
        showError("El rol del usuario no está configurado.");
        return;
    }

    renderNavigation(allowed);
    updateSessionSummary(user, allowed);
    loginScreen.classList.add("d-none");
    appScreen.classList.remove("d-none");
    document.title = "Panel principal | Farmacia Josue";
}

function loadRememberedUser() {
    const savedUser = localStorage.getItem("usuarioRecordado") || "";

    loginUser.value = savedUser;
    rememberUser.checked = Boolean(savedUser);

    requestAnimationFrame(() => {
        (savedUser ? loginPassword : loginUser).focus();
    });
}

// Valida credenciales, inicia la sesión y muestra el panel principal.
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    if (!loginForm.checkValidity()) {
        loginForm.reportValidity();
        return;
    }

    const username = loginUser.value.trim();
    setLoginLoading(true);

    try {
        const [rows] = await db.execute(
            "SELECT id_usuario, nombre, apellido, nombre_usuario, rol FROM usuarios WHERE nombre_usuario = ? AND contrasena = ? AND estado = 'Activo' LIMIT 1",
            [username, loginPassword.value]
        );

        if (!rows.length) {
            throw new Error("Usuario o contraseña incorrectos, o usuario inactivo.");
        }

        const user = rows[0];
        sessionStorage.setItem("usuarioActivo", JSON.stringify(user));
        ipcRenderer.send("session:set-user", user);

        if (rememberUser.checked) {
            localStorage.setItem("usuarioRecordado", username);
        } else {
            localStorage.removeItem("usuarioRecordado");
        }

        loginPassword.value = "";
        setPasswordVisibility(false);
        showMenu(user);
    } catch (error) {
        showError(getFriendlyError(error));
        loginPassword.select();
    } finally {
        setLoginLoading(false);
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    ipcRenderer.send("session:clear-user");
    appScreen.classList.add("d-none");
    loginScreen.classList.remove("d-none");
    loginForm.reset();
    clearError();
    setPasswordVisibility(false);
    document.title = "Farmacia Josue | Sistema de gestión";
    loadRememberedUser();
});

togglePassword.addEventListener("click", () => {
    setPasswordVisibility(loginPassword.type === "password");
    loginPassword.focus();
});

loginUser.addEventListener("input", clearError);
loginPassword.addEventListener("input", clearError);

let savedSession = ipcRenderer.sendSync("session:get-user");

if (!savedSession) {
    try {
        savedSession = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
    } catch {
        sessionStorage.removeItem("usuarioActivo");
    }
}

if (savedSession) {
    showMenu(savedSession);
} else {
    loadRememberedUser();
}
