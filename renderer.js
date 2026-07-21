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

let currentModule = "clientes";
let editingId = null;
let currentRows = [];

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const crudForm = document.getElementById("crudForm");
const tableContainer = document.getElementById("tableContainer");
const moduleTitle = document.getElementById("moduleTitle");
const moduleDescription = document.getElementById("moduleDescription");
const sessionUser = document.getElementById("sessionUser");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const logoutBtn = document.getElementById("logoutBtn");
const appMessage = document.getElementById("appMessage");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", login);
saveBtn.addEventListener("click", saveRecord);
clearBtn.addEventListener("click", clearForm);
logoutBtn.addEventListener("click", logout);

document.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => changeModule(button.dataset.module));
});

function showMessage(target, text, type = "ok") {
    target.textContent = text;
    target.className = type === "ok" ? "alert alert-success" : "alert alert-danger";

    setTimeout(() => {
        target.className = "alert d-none";
        target.textContent = "";
    }, 3500);
}

async function login(event) {
    event.preventDefault();
    const usuario = document.getElementById("loginUser").value.trim();
    const contrasena = document.getElementById("loginPassword").value.trim();

    try {
        const [rows] = await pool.query(
            "SELECT * FROM usuarios WHERE nombre_usuario = ? AND contrasena = ? AND estado = 'Activo' LIMIT 1",
            [usuario, contrasena]
        );

        if (rows.length === 0) {
            showMessage(loginMessage, "Usuario o contrasena incorrectos, o usuario inactivo.", "error");
            return;
        }

        const user = rows[0];
        sessionUser.textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
        loginScreen.classList.add("d-none");
        appScreen.classList.remove("d-none");
        await changeModule("clientes");
    } catch (error) {
        showMessage(loginMessage, `Error de conexion: ${error.message}`, "error");
    }
}

async function changeModule(moduleName) {
    currentModule = moduleName;
    editingId = null;

    document.querySelectorAll("[data-module]").forEach((button) => {
        const active = button.dataset.module === moduleName;
        button.classList.toggle("active", active);
        button.classList.toggle("text-white", !active);
    });

    const config = modules[currentModule];
    moduleTitle.textContent = config.title;
    moduleDescription.textContent = config.description;
    renderForm();
    await loadRows();
}

function renderForm() {
    const config = modules[currentModule];
    crudForm.innerHTML = "";

    config.fields.forEach((field) => {
        const group = document.createElement("div");
        group.className = field.full ? "col-12" : field.wide ? "col-12 col-md-6" : "col-12 col-md-6 col-xl-3";

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
                const opt = document.createElement("option");
                opt.value = option;
                opt.textContent = option;
                input.appendChild(opt);
            });
        } else if (field.type === "textarea") {
            input = document.createElement("textarea");
            input.rows = 3;
            input.className = "form-control";
        } else {
            input = document.createElement("input");
            input.type = field.type || "text";
            input.className = "form-control";
            if (field.step) input.step = field.step;
        }

        input.id = field.name;
        input.name = field.name;
        if (field.required) input.required = true;
        group.appendChild(input);
        crudForm.appendChild(group);
    });

    saveBtn.textContent = "Guardar";
}

async function loadRows() {
    const config = modules[currentModule];

    try {
        const [rows] = await pool.query(`SELECT * FROM ${config.table} ORDER BY ${config.id} DESC`);
        currentRows = rows;
        renderTable(rows);
    } catch (error) {
        showMessage(appMessage, `Error al cargar datos: ${error.message}`, "error");
    }
}

function renderTable(rows) {
    const config = modules[currentModule];

    if (rows.length === 0) {
        tableContainer.innerHTML = '<div class="alert alert-secondary mb-0 text-center">No hay registros para mostrar.</div>';
        return;
    }

    const columns = config.fields.filter((field) => !field.name.startsWith("id_"))
        .map((field) => field.name);    const header = columns.map((column) => `<th>${getColumnLabel(config, column)}</th>`).join("");
    const body = rows.map((row, index) => {
        const cells = columns.map((column) => `<td>${formatValue(row[column])}</td>`).join("");

        return `
            <tr>
                ${cells}
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" type="button" onclick="editRecord(${index})">Editar</button>
                        <button class="btn btn-danger btn-sm" type="button" onclick="deleteRecord(${row[config.id]})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    tableContainer.innerHTML = `
        <table class="table table-striped table-hover table-bordered align-middle mb-0">
            <thead class="table-dark">
                <tr>${header}<th>Acciones</th></tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
}

function getColumnLabel(config, column) {
    if (column === config.id) return "ID";
    const field = config.fields.find((item) => item.name === column);
    return field ? field.label : column;
}

function formatValue(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
}

function getFormData() {
    const config = modules[currentModule];
    const data = {};

    for (const field of config.fields) {
        const element = document.getElementById(field.name);
        const value = element.value.trim();

        if (field.required && !value) {
            element.focus();
            throw new Error(`Complete el campo: ${field.label}`);
        }

        data[field.name] = value || null;
    }

    return data;
}

async function saveRecord() {
    const config = modules[currentModule];

    try {
        const data = getFormData();
        const columns = Object.keys(data);
        const values = Object.values(data);

        if (editingId) {
            const setClause = columns.map((column) => `${column} = ?`).join(", ");
            await pool.query(
                `UPDATE ${config.table} SET ${setClause} WHERE ${config.id} = ?`,
                [...values, editingId]
            );
            showMessage(appMessage, "Registro actualizado correctamente.");
        } else {
            const placeholders = columns.map(() => "?").join(", ");
            await pool.query(
                `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders})`,
                values
            );
            showMessage(appMessage, "Registro guardado correctamente.");
        }

        clearForm();
        await loadRows();
    } catch (error) {
        showMessage(appMessage, error.message, "error");
    }
}

window.editRecord = function(index) {
    const config = modules[currentModule];
    const row = currentRows[index];
    editingId = row[config.id];

    config.fields.forEach((field) => {
        const element = document.getElementById(field.name);
        element.value = formatForInput(row[field.name]);
    });

    saveBtn.textContent = "Actualizar";
    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteRecord = async function(id) {
    const config = modules[currentModule];
    const accepted = confirm("Desea eliminar este registro?");
    if (!accepted) return;

    try {
        await pool.query(`DELETE FROM ${config.table} WHERE ${config.id} = ?`, [id]);
        showMessage(appMessage, "Registro eliminado correctamente.");
        clearForm();
        await loadRows();
    } catch (error) {
        showMessage(appMessage, `No se pudo eliminar: ${error.message}`, "error");
    }
};

function formatForInput(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
}

function clearForm() {
    crudForm.reset();
    editingId = null;
    saveBtn.textContent = "Guardar";
}

function logout() {
    loginForm.reset();
    clearForm();
    tableContainer.innerHTML = "";
    appScreen.classList.add("d-none");
    loginScreen.classList.remove("d-none");
    document.getElementById("loginUser").focus();
}
