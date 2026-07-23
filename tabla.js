const db = require("./database").promise();

const moduleName = document.body.dataset.module;
const config = require(`./${moduleName}.js`);
const permissions = {
    Administrador: ["clientes", "usuarios", "medicamentos", "recetas", "detalle_recetas", "lote", "ventas", "detalles_venta", "movimientos_puntos"],
    Jefa: ["clientes", "usuarios", "medicamentos", "recetas", "detalle_recetas", "lote", "ventas", "detalles_venta", "movimientos_puntos"],
    Cajero: ["clientes", "medicamentos", "ventas", "detalles_venta", "movimientos_puntos"],
    Farmaceutico: ["clientes", "medicamentos", "recetas", "detalle_recetas", "lote"],
};

let editingId = null;
let rows = [];
const user = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
const form = document.getElementById("recordForm");
const tableContainer = document.getElementById("tableContainer");
const message = document.getElementById("message");
const saveButton = document.getElementById("saveButton");

/*
Botón para desplegar u ocultar la tabla.
Se crea aquí para que aparezca automáticamente
en las nueve páginas.
*/
const tableSection = tableContainer.parentElement;
const tableHeader = document.createElement("div");
tableHeader.className = "d-flex justify-content-between align-items-center p-3 border-bottom";

const tableTitle = document.createElement("h2");
tableTitle.className = "h5 mb-0";
tableTitle.textContent = "Registros";

const toggleTableButton = document.createElement("button");
toggleTableButton.type = "button";
toggleTableButton.className = "btn btn-success btn-sm px-3 py-2";
toggleTableButton.setAttribute("aria-expanded", "false");
toggleTableButton.textContent = "Desplegar la tabla ▼";

tableHeader.append(tableTitle, toggleTableButton);
tableSection.insertBefore(tableHeader, tableContainer);
tableContainer.classList.add("d-none");

toggleTableButton.addEventListener("click", () => {
    const willShow = tableContainer.classList.contains("d-none");
    tableContainer.classList.toggle("d-none", !willShow);
    toggleTableButton.setAttribute("aria-expanded", String(willShow));
    toggleTableButton.textContent = willShow
        ? "Ocultar la tabla ▲"
        : "Desplegar la tabla ▼";
});

/*
Buscador exclusivo para Usuarios y Medicamentos.
Se coloca debajo del formulario y antes de los registros.
*/
createSearchSection();

function createSearchSection() {
    const searchOptions = {
        clientes: [
            ["nombre", "Nombre"],
            ["identidad", "Identidad"],
        ],
        usuarios: [
            ["nombre", "Nombre"],
            ["identidad", "Identidad"],
            ["rol", "Rol"],
        ],
        medicamentos: [
            ["nombre", "Nombre"],
            ["codigo", "Código"],
        ],
    };

    const options = searchOptions[moduleName];

    if (!options) {
        return;
    }

    const searchCard = document.createElement("section");
    searchCard.className =
        "card border-0 rounded-4 shadow-sm p-4 mb-4";

    const searchTitle = document.createElement("h2");
    searchTitle.className = "h5 mb-3";
    const searchTitles = {
        clientes: "Buscar clientes",
        usuarios: "Buscar usuarios",
        medicamentos: "Buscar medicamentos",
    };

    searchTitle.textContent = searchTitles[moduleName];

    const searchRow = document.createElement("div");
    searchRow.className = "row g-3 align-items-end";

    const textGroup = document.createElement("div");
    textGroup.className = "col-12 col-md-8";

    const textLabel = document.createElement("label");
    textLabel.className = "form-label fw-semibold";
    textLabel.htmlFor = "searchText";
    const searchLabels = {
        clientes: "Buscar por nombre o identidad",
        usuarios: "Buscar por nombre o DNI",
        medicamentos: "Buscar por nombre o código",
    };

    textLabel.textContent = searchLabels[moduleName];

    const searchText = document.createElement("input");
    searchText.id = "searchText";
    searchText.className = "form-control";
    searchText.type = "text";
    const searchPlaceholders = {
        clientes: "Escriba el cliente que desea buscar",
        usuarios: "Escriba el usuario que desea buscar",
        medicamentos: "Escriba el medicamento que desea buscar",
    };

    searchText.placeholder = searchPlaceholders[moduleName];

    textGroup.append(textLabel, searchText);

    const buttonsGroup = document.createElement("div");
    buttonsGroup.className = "col-12 col-md-4 d-flex gap-2";

    const searchButton = document.createElement("button");
    searchButton.className = "btn btn-success w-100";
    searchButton.type = "button";
    searchButton.textContent = "Buscar";

    const clearSearchButton = document.createElement("button");
    clearSearchButton.className = "btn btn-outline-secondary w-100";
    clearSearchButton.type = "button";
    clearSearchButton.textContent = "Mostrar todos";

    buttonsGroup.append(searchButton, clearSearchButton);
    searchRow.append(textGroup, buttonsGroup);
    searchCard.append(searchTitle, searchRow);

    tableSection.parentElement.insertBefore(
        searchCard,
        tableSection
    );

    searchButton.addEventListener("click", () => {
        filterRecords(searchText.value, options);
    });

    clearSearchButton.addEventListener("click", () => {
        searchText.value = "";
        renderTable();
    });

    searchText.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            filterRecords(searchText.value, options);
        }
    });
}

function filterRecords(searchValue, options) {
    const value = searchValue.trim().toLocaleLowerCase("es");

    if (!value) {
        renderTable();
        showRecordsTable();
        return;
    }

    const filteredRows = rows.filter((row) => {
        return options.some(([field]) => {
            const fieldValue =
                field === "nombre" &&
                ["usuarios", "clientes"].includes(moduleName)
                    ? `${row.nombre || ""} ${row.apellido || ""}`
                    : row[field];

            return String(fieldValue || "")
                .toLocaleLowerCase("es")
                .includes(value);
        });
    });

    renderTable(filteredRows);
    showRecordsTable();
}

function showRecordsTable() {
    tableContainer.classList.remove("d-none");
    toggleTableButton.setAttribute("aria-expanded", "true");
    toggleTableButton.textContent = "Ocultar la tabla ▲";
}

if (!user || !permissions[user.rol]?.includes(moduleName)) {
    window.alert("Debe iniciar sesión o no tiene permiso para consultar esta tabla.");
    window.location.replace("Index.html");
} else {
    document.getElementById("pageTitle").textContent = config.title;
    document.getElementById("pageDescription").textContent = config.description;
    document.getElementById("sessionUser").textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
    renderForm();
    loadRows();
}

document.getElementById("backButton").addEventListener("click", () => { window.location.href = "Index.html"; });
document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    window.location.href = "Index.html";
});
document.getElementById("clearButton").addEventListener("click", clearForm);
form.addEventListener("submit", saveRecord);

function showMessage(text, error = false) {
    message.textContent = text;
    message.className = error ? "alert alert-danger" : "alert alert-success";
    setTimeout(() => { message.className = "alert d-none"; }, 3500);
}

function renderForm() {
    for (const field of config.fields) {
        const group = document.createElement("div");
        group.className = field.full ? "col-12" : "col-12 col-md-6 col-xl-3";
        const label = document.createElement("label");
        label.className = "form-label fw-semibold";
        label.htmlFor = field.name;
        label.textContent = field.label;
        let input;
        if (field.type === "select") {
            input = document.createElement("select");
            input.className = "form-select";
            input.add(new Option("Seleccione...", ""));
            field.options.forEach((option) => input.add(new Option(option, option)));
        } else if (field.type === "textarea") {
            input = document.createElement("textarea");
            input.className = "form-control";
            input.rows = 3;
        } else {
            input = document.createElement("input");
            input.type = field.type || "text";
            input.className = "form-control";
            if (field.step) input.step = field.step;
            if (field.min !== undefined) input.min = field.min;
        }
        input.id = field.name;
        input.name = field.name;
        input.required = Boolean(field.required);
        group.append(label, input);
        form.appendChild(group);
    }
}

async function loadRows() {
    try {
        const fields = config.fields.filter((field) => field.type !== "password");
        const columns = [config.id, ...fields.map((field) => field.name)];
        [rows] = await db.query(`SELECT ${columns.join(", ")} FROM ${config.table} ORDER BY ${config.id} DESC`);
        renderTable();
    } catch (error) {
        showMessage(`Error al cargar: ${error.message}`, true);
    }
}

function renderTable(records = rows) {
    tableContainer.replaceChildren();
    if (!records.length) {
        const empty = document.createElement("p");
        empty.className = "text-center text-secondary m-3";
        empty.textContent = "No hay registros para mostrar.";
        tableContainer.appendChild(empty);
        return;
    }
    const fields = config.fields.filter((field) => !field.name.startsWith("id_") && field.type !== "password");
    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";
    const header = table.createTHead().insertRow();
    header.className = "table-success";
    fields.forEach((field) => { const th = document.createElement("th"); th.textContent = field.label; header.appendChild(th); });
    const actionsHeader = document.createElement("th"); actionsHeader.textContent = "Acciones"; header.appendChild(actionsHeader);
    const body = table.createTBody();
    records.forEach((row) => {
        const tr = body.insertRow();
        fields.forEach((field) => { tr.insertCell().textContent = formatValue(row[field.name]); });
        const actions = tr.insertCell();
        const edit = document.createElement("button");
        edit.className = "btn btn-outline-success btn-sm me-2";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => editRecord(row));
        const remove = document.createElement("button");
        remove.className = "btn btn-danger btn-sm";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", () => deleteRecord(row[config.id]));
        actions.append(edit, remove);
    });
    tableContainer.appendChild(table);
}

function formatValue(value) {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).replace(/T.*$/, "");
}

function getData() {
    const data = {};
    config.fields.forEach((field) => {
        const value = document.getElementById(field.name).value.trim();
        if (field.required && !value && !(editingId !== null && field.type === "password")) throw new Error(`Complete el campo: ${field.label}`);
        data[field.name] = value || null;
    });
    return data;
}

async function saveRecord(event) {
    event.preventDefault();
    try {
        const data = getData();
        if (editingId !== null && config.table === "usuarios" && !data.contrasena) delete data.contrasena;
        const columns = Object.keys(data);
        if (editingId === null) {
            await db.execute(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, Object.values(data));
        } else {
            await db.execute(`UPDATE ${config.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE ${config.id} = ?`, [...Object.values(data), editingId]);
        }
        showMessage(editingId === null ? "Registro guardado." : "Registro actualizado.");
        clearForm();
        await loadRows();
    } catch (error) {
        showMessage(error.message, true);
    }
}

function editRecord(row) {
    editingId = row[config.id];
    config.fields.forEach((field) => {
        const input = document.getElementById(field.name);
        input.value = field.type === "password" ? "" : formatValue(row[field.name]);
        if (field.type === "password") input.required = false;
    });
    saveButton.textContent = "Actualizar";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
    if (!window.confirm("¿Desea eliminar este registro?")) return;
    try {
        await db.execute(`DELETE FROM ${config.table} WHERE ${config.id} = ?`, [id]);
        showMessage("Registro eliminado.");
        await loadRows();
    } catch (error) {
        showMessage(`No se pudo eliminar: ${error.message}`, true);
    }
}

function clearForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = "Guardar";
    const password = config.fields.find((field) => field.type === "password");
    if (password) document.getElementById(password.name).required = Boolean(password.required);
}
