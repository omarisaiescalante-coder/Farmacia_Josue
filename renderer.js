const db = require("./database");
const pool = db.promise();

const modules = {
    clientes: require("./clientes"),
    usuarios: require("./usuarios"),
    medicamentos: require("./medicamentos"),
    recetas: require("./recetas"),
    lote: require("./lote"),
    ventas: require("./ventas"),
};

let currentModule = null;
let editingId = null;
let currentRows = [];

/* =========================================================
   ELEMENTOS DEL HTML
========================================================= */

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");

const menuOptions = document.getElementById("menuOptions");
const menuOptionsGrid = document.getElementById("menuOptionsGrid");
const crudSection = document.getElementById("crudSection");

const loginForm = document.getElementById("loginForm");
const crudForm = document.getElementById("crudForm");
const tableContainer = document.getElementById("tableContainer");

const moduleTitle = document.getElementById("moduleTitle");
const moduleDescription = document.getElementById("moduleDescription");
const sessionUser = document.getElementById("sessionUser");

const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const logoutBtn = document.getElementById("logoutBtn");
const backMenuBtn = document.getElementById("backMenuBtn");

const appMessage = document.getElementById("appMessage");
const loginMessage = document.getElementById("loginMessage");

const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const rememberUser = document.getElementById("rememberUser");
const showLoginPassword = document.getElementById(
    "showLoginPassword"
);

/* =========================================================
   INICIALIZACIÓN
========================================================= */

loadRememberedUser();

loginForm.addEventListener("submit", login);
saveBtn.addEventListener("click", saveRecord);
clearBtn.addEventListener("click", clearForm);
logoutBtn.addEventListener("click", logout);

/*
Este botón permite volver desde cualquier módulo
al menú principal.
*/
backMenuBtn.addEventListener("click", showMenuOptions);

showLoginPassword.addEventListener("change", () => {
    loginPassword.type = showLoginPassword.checked
        ? "text"
        : "password";
});

/*
Detecta cuál botón del menú fue presionado.
*/
menuOptionsGrid.addEventListener("click", (event) => {
    const button = event.target.closest(
        "[data-menu-option]"
    );

    if (button) {
        changeModule(button.dataset.menuOption);
    }
});

/* =========================================================
   MENSAJES
========================================================= */

function showMessage(target, text, type = "ok") {
    target.textContent = text;

    target.className =
        type === "ok"
            ? "alert alert-success"
            : "alert alert-danger";

    window.setTimeout(() => {
        target.className = "alert d-none";
        target.textContent = "";
    }, 3500);
}

/* =========================================================
   RECORDAR USUARIO
========================================================= */

function loadRememberedUser() {
    const savedUser = localStorage.getItem(
        "usuarioRecordado"
    );

    if (savedUser) {
        loginUser.value = savedUser;
        rememberUser.checked = true;
    } else {
        loginUser.value = "";
        rememberUser.checked = false;
    }
}

/* =========================================================
   INICIAR SESIÓN
========================================================= */

async function login(event) {
    event.preventDefault();

    const usuario = loginUser.value.trim();
    const contrasena = loginPassword.value.trim();

    try {
        const [rows] = await pool.query(
            `SELECT *
             FROM usuarios
             WHERE nombre_usuario = ?
             AND contrasena = ?
             AND estado = 'Activo'
             LIMIT 1`,
            [usuario, contrasena]
        );

        if (rows.length === 0) {
            showMessage(
                loginMessage,
                "Usuario o contraseña incorrectos, o usuario inactivo.",
                "error"
            );

            return;
        }

        /*
        Guardar o eliminar el usuario recordado.
        */
        if (rememberUser.checked) {
            localStorage.setItem(
                "usuarioRecordado",
                usuario
            );
        } else {
            localStorage.removeItem(
                "usuarioRecordado"
            );
        }

        const user = rows[0];

        sessionUser.textContent =
            `${user.nombre} ${user.apellido} - ${user.rol}`;

        loginPassword.value = "";
        loginPassword.type = "password";
        showLoginPassword.checked = false;

        loginScreen.classList.add("d-none");
        appScreen.classList.remove("d-none");

        /*
        Después de iniciar sesión se muestran
        los módulos centrados.
        */
        showMenuOptions();
    } catch (error) {
        showMessage(
            loginMessage,
            `Error al iniciar sesión: ${error.message}`,
            "error"
        );
    }
}

/* =========================================================
   CERRAR SESIÓN
========================================================= */

function logout() {
    loginForm.reset();

    loginPassword.type = "password";
    showLoginPassword.checked = false;

    clearForm();

    tableContainer.innerHTML = "";

    currentModule = null;
    currentRows = [];

    menuOptions.classList.remove("d-none");
    crudSection.classList.add("d-none");
    backMenuBtn.classList.add("d-none");

    appScreen.classList.add("d-none");
    loginScreen.classList.remove("d-none");

    sessionUser.textContent = "Usuario";

    loadRememberedUser();
    loginUser.focus();
}

/* =========================================================
   MOSTRAR MENÚ PRINCIPAL
========================================================= */

function showMenuOptions() {
    currentModule = null;
    editingId = null;
    currentRows = [];

    crudForm.innerHTML = "";
    tableContainer.innerHTML = "";

    saveBtn.textContent = "Guardar";

    /*
    Mostrar el menú principal.
    */
    menuOptions.classList.remove("d-none");

    /*
    Ocultar el formulario del módulo.
    */
    crudSection.classList.add("d-none");

    /*
    Ocultar el botón Volver cuando estamos
    en el menú principal.
    */
    backMenuBtn.classList.add("d-none");

    /*
    Crear los botones de los módulos.

    La clase text-center centra el nombre.
    La clase w-100 hace que todos tengan
    el mismo ancho.
    */
    menuOptionsGrid.innerHTML = Object.entries(modules)
        .map(([key, module]) => {
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
                        <span class="d-flex align-items-center gap-3 gap-sm-4">
                            <span class="module-icon">${escapeHtml(initials)}</span>
                            <span class="d-flex flex-grow-1 align-items-center justify-content-between gap-3">
                                <span>
                                <span class="d-block h5 fw-bold mb-1">${escapeHtml(module.title)}</span>
                                <span class="d-block small text-secondary fw-normal">${escapeHtml(module.description)}</span>
                                </span>
                                <span class="module-arrow" aria-hidden="true">→</span>
                            </span>
                        </span>
                    </button>
                </div>
            `;
        })
        .join("");
}

/* =========================================================
   ABRIR UN MÓDULO
========================================================= */

async function changeModule(moduleName) {
    if (!modules[moduleName]) {
        showMessage(
            appMessage,
            "El módulo seleccionado no existe.",
            "error"
        );

        return;
    }

    currentModule = moduleName;
    editingId = null;

    /*
    Ocultar el menú principal.
    */
    menuOptions.classList.add("d-none");

    /*
    Mostrar la sección CRUD.
    */
    crudSection.classList.remove("d-none");

    /*
    Mostrar el botón Volver atrás.
    */
    backMenuBtn.classList.remove("d-none");

    const config = modules[currentModule];

    moduleTitle.textContent = config.title;
    moduleDescription.textContent =
        config.description;

    renderForm();

    await loadRows();
}

/* =========================================================
   CREAR FORMULARIO DINÁMICO
========================================================= */

function renderForm() {
    const config = modules[currentModule];

    crudForm.innerHTML = "";

    config.fields.forEach((field) => {
        const group = document.createElement("div");

        group.className = field.full
            ? "col-12"
            : field.wide
                ? "col-12 col-md-6"
                : "col-12 col-md-6 col-xl-3";

        const label = document.createElement("label");

        label.htmlFor = field.name;
        label.textContent = field.label;
        label.className = "form-label fw-semibold";

        group.appendChild(label);

        let input;

        if (field.type === "select") {
            input = document.createElement("select");
            input.className = "form-select";

            field.options.forEach((option) => {
                const opt =
                    document.createElement("option");

                opt.value = option;
                opt.textContent = option;

                input.appendChild(opt);
            });
        } else if (field.type === "textarea") {
            input =
                document.createElement("textarea");

            input.rows = 3;
            input.className = "form-control";
        } else {
            input =
                document.createElement("input");

            input.type = field.type || "text";
            input.className = "form-control";

            if (field.step) {
                input.step = field.step;
            }
        }

        input.id = field.name;
        input.name = field.name;

        if (field.required) {
            input.required = true;
        }

        group.appendChild(input);

        /*
        Crear la opción Mostrar contraseña
        en campos de tipo password.
        */
        if (field.type === "password") {
            input.dataset.passwordField = "true";

            const toggleContainer =
                document.createElement("div");

            toggleContainer.className =
                "form-check mt-2";

            const toggle =
                document.createElement("input");

            toggle.type = "checkbox";
            toggle.id = `show-${field.name}`;
            toggle.className =
                "form-check-input";

            toggle.addEventListener(
                "change",
                () => {
                    input.type = toggle.checked
                        ? "text"
                        : "password";
                }
            );

            const toggleLabel =
                document.createElement("label");

            toggleLabel.htmlFor = toggle.id;
            toggleLabel.className =
                "form-check-label";

            toggleLabel.textContent =
                "Mostrar contraseña";

            toggleContainer.append(
                toggle,
                toggleLabel
            );

            group.appendChild(toggleContainer);
        }

        crudForm.appendChild(group);
    });

    saveBtn.textContent = "Guardar";
}

/* =========================================================
   CARGAR REGISTROS
========================================================= */

async function loadRows() {
    if (!currentModule) {
        return;
    }

    const config = modules[currentModule];

    try {
        const [rows] = await pool.query(
            `SELECT *
             FROM ${config.table}
             ORDER BY ${config.id} DESC`
        );

        currentRows = rows;

        renderTable(rows);
    } catch (error) {
        showMessage(
            appMessage,
            `Error al cargar datos: ${error.message}`,
            "error"
        );
    }
}

/* =========================================================
   CREAR TABLA
========================================================= */

function renderTable(rows) {
    const config = modules[currentModule];

    if (rows.length === 0) {
        tableContainer.innerHTML = `
            <div
                class="alert alert-secondary
                       mb-0 text-center"
            >
                No hay registros para mostrar.
            </div>
        `;

        return;
    }

    const columns = config.fields
        .filter(
            (field) =>
                !field.name.startsWith("id_")
        )
        .map((field) => field.name);

    const header = columns
        .map((column) => {
            return `
                <th>
                    ${escapeHtml(
                        getColumnLabel(
                            config,
                            column
                        )
                    )}
                </th>
            `;
        })
        .join("");

    const body = rows
        .map((row, index) => {
            const cells = columns
                .map((column) => {
                    return `
                        <td>
                            ${escapeHtml(
                                formatValue(
                                    row[column]
                                )
                            )}
                        </td>
                    `;
                })
                .join("");

            return `
                <tr>
                    ${cells}

                    <td>
                        <div class="d-flex gap-2">
                            <button
                                class="btn btn-outline-success btn-sm"
                                type="button"
                                onclick="editRecord(${index})"
                            >
                                Editar
                            </button>

                            <button
                                class="btn btn-danger btn-sm"
                                type="button"
                                onclick="deleteRecord(
                                    ${Number(
                                        row[config.id]
                                    )}
                                )"
                            >
                                Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");

    tableContainer.innerHTML = `
        <table
            class="table records-table
                   table-hover
                   align-middle mb-0"
        >
            <thead>
                <tr>
                    ${header}
                    <th>Acciones</th>
                </tr>
            </thead>

            <tbody>
                ${body}
            </tbody>
        </table>
    `;
}

/* =========================================================
   OBTENER NOMBRE DE COLUMNA
========================================================= */

function getColumnLabel(config, column) {
    const field = config.fields.find(
        (item) => item.name === column
    );

    return field
        ? field.label
        : column;
}

/* =========================================================
   FORMATEAR VALORES
========================================================= */

function formatValue(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    if (value instanceof Date) {
        return value
            .toISOString()
            .slice(0, 10);
    }

    return String(value);
}

function formatForInput(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    if (value instanceof Date) {
        return value
            .toISOString()
            .slice(0, 10);
    }

    return String(value);
}

/* =========================================================
   EVITAR CÓDIGO HTML EN LA TABLA
========================================================= */

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   OBTENER DATOS DEL FORMULARIO
========================================================= */

function getFormData() {
    const config = modules[currentModule];
    const data = {};

    for (const field of config.fields) {
        const element =
            document.getElementById(field.name);

        if (!element) {
            throw new Error(
                `No se encontró el campo: ${field.label}`
            );
        }

        const value = element.value.trim();

        if (field.required && !value) {
            element.focus();

            throw new Error(
                `Complete el campo: ${field.label}`
            );
        }

        data[field.name] = value || null;
    }

    return data;
}

/* =========================================================
   GUARDAR O ACTUALIZAR
========================================================= */

async function saveRecord() {
    if (!currentModule) {
        showMessage(
            appMessage,
            "Seleccione un módulo.",
            "error"
        );

        return;
    }

    const config = modules[currentModule];

    try {
        const data = getFormData();

        const columns = Object.keys(data);
        const values = Object.values(data);

        /*
        Actualizar registro.
        */
        if (editingId !== null) {
            const setClause = columns
                .map(
                    (column) =>
                        `${column} = ?`
                )
                .join(", ");

            await pool.query(
                `UPDATE ${config.table}
                 SET ${setClause}
                 WHERE ${config.id} = ?`,
                [...values, editingId]
            );

            showMessage(
                appMessage,
                "Registro actualizado correctamente."
            );
        } else {
            /*
            Insertar registro nuevo.
            */
            const placeholders = columns
                .map(() => "?")
                .join(", ");

            await pool.query(
                `INSERT INTO ${config.table}
                 (${columns.join(", ")})
                 VALUES (${placeholders})`,
                values
            );

            showMessage(
                appMessage,
                "Registro guardado correctamente."
            );
        }

        clearForm();

        await loadRows();
    } catch (error) {
        showMessage(
            appMessage,
            error.message,
            "error"
        );
    }
}

/* =========================================================
   EDITAR REGISTRO
========================================================= */

window.editRecord = function editRecord(index) {
    const config = modules[currentModule];
    const row = currentRows[index];

    if (!row) {
        showMessage(
            appMessage,
            "No se encontró el registro.",
            "error"
        );

        return;
    }

    editingId = row[config.id];

    config.fields.forEach((field) => {
        const element =
            document.getElementById(field.name);

        if (element) {
            element.value = formatForInput(
                row[field.name]
            );
        }
    });

    saveBtn.textContent = "Actualizar";

    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
};

/* =========================================================
   ELIMINAR REGISTRO
========================================================= */

window.deleteRecord =
    async function deleteRecord(id) {
        const config = modules[currentModule];

        const accepted = window.confirm(
            "¿Desea eliminar este registro?"
        );

        if (!accepted) {
            return;
        }

        try {
            await pool.query(
                `DELETE FROM ${config.table}
                 WHERE ${config.id} = ?`,
                [id]
            );

            showMessage(
                appMessage,
                "Registro eliminado correctamente."
            );

            clearForm();

            await loadRows();
        } catch (error) {
            showMessage(
                appMessage,
                `No se pudo eliminar: ${error.message}`,
                "error"
            );
        }
    };

/* =========================================================
   LIMPIAR FORMULARIO
========================================================= */

function clearForm() {
    if (crudForm) {
        crudForm.reset();

        /*
        Volver a ocultar los campos
        de contraseña.
        */
        crudForm
            .querySelectorAll(
                '[data-password-field="true"]'
            )
            .forEach((input) => {
                input.type = "password";
            });

        /*
        Desmarcar las opciones de
        mostrar contraseña.
        */
        crudForm
            .querySelectorAll(
                'input[id^="show-"]'
            )
            .forEach((checkbox) => {
                checkbox.checked = false;
            });
    }

    editingId = null;
    saveBtn.textContent = "Guardar";
}
