const db = require("./database").promise();
const { ipcRenderer } = require("electron");
let editingProviderId = null;

let user = ipcRenderer.sendSync("session:get-user");

if (!user) {
    try {
        user = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
    } catch {
        sessionStorage.removeItem("usuarioActivo");
    }
}

const canViewProviders = user?.rol === "Administrador";

if (!canViewProviders) {
    window.alert("No tiene permiso para consultar laboratorios y proveedores.");
    window.location.replace("index.html");
} else {
    document.getElementById("sessionUser").textContent =
        `${user.nombre} ${user.apellido} - ${user.rol}`;
    loadProviders();
    window.setInterval(() => {
        if (!document.hidden) loadProviders();
    }, 5000);
}

document.getElementById("backButton").addEventListener("click", () => {
    window.location.href = "compras.html";
});

document.getElementById("providerForm").addEventListener("submit", saveProvider);
document.getElementById("cancelEditButton").addEventListener("click", closeEditForm);
document.getElementById("providerPhone").addEventListener("input", (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
    event.target.value = [digits.slice(0, 4), digits.slice(4)]
        .filter(Boolean)
        .join("-");
});

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    ipcRenderer.send("session:clear-user");
    window.location.href = "index.html";
});

async function loadProviders() {
    try {
        const [providers] = await db.query(
            `SELECT id_distribuidor, nombre, telefono, correo, direccion,
                    estado, fecha_registro
             FROM distribuidores
             ORDER BY nombre`
        );

        document.getElementById("providersTotal").textContent = providers.length;
        renderProviders(providers);
        document.getElementById("message").className = "alert d-none";
    } catch (error) {
        showMessage(`No se pudo cargar el listado: ${error.message}`, true);
    }
}

function showMessage(text, error = false) {
    const message = document.getElementById("message");
    message.textContent = text;
    message.className = error ? "alert alert-danger" : "alert alert-success";
}

function openEditForm(provider) {
    editingProviderId = provider.id_distribuidor;
    document.getElementById("providerName").value = provider.nombre || "";
    document.getElementById("providerPhone").value = formatPhone(provider.telefono)
        .replace("No registrado", "");
    document.getElementById("providerEmail").value = provider.correo || "";
    document.getElementById("providerAddress").value = provider.direccion || "";
    document.getElementById("providerStatus").value = provider.estado || "Activo";

    const section = document.getElementById("providerFormSection");
    section.classList.remove("d-none");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("providerName").focus();
}

function closeEditForm() {
    editingProviderId = null;
    document.getElementById("providerForm").reset();
    document.getElementById("providerFormSection").classList.add("d-none");
}

async function saveProvider(event) {
    event.preventDefault();
    if (!editingProviderId) return;

    const name = document.getElementById("providerName").value.trim();
    const phone = document.getElementById("providerPhone").value.trim();
    const email = document.getElementById("providerEmail").value.trim();
    const address = document.getElementById("providerAddress").value.trim();
    const status = document.getElementById("providerStatus").value;

    if (!name) {
        showMessage("Ingrese el nombre del laboratorio o proveedor.", true);
        return;
    }
    if (phone && !/^\d{4}-\d{4}$/.test(phone)) {
        showMessage("El teléfono debe tener el formato 9999-9999.", true);
        return;
    }

    try {
        await db.execute(
            `UPDATE distribuidores
             SET nombre = ?, telefono = ?, correo = ?, direccion = ?, estado = ?
             WHERE id_distribuidor = ?`,
            [
                name,
                phone.replace(/\D/g, "") || null,
                email || null,
                address || null,
                status,
                editingProviderId,
            ]
        );
        closeEditForm();
        await loadProviders();
        showMessage("Laboratorio o proveedor actualizado correctamente.");
    } catch (error) {
        const text = error.code === "ER_DUP_ENTRY"
            ? "Ya existe un laboratorio o proveedor con ese nombre."
            : `No se pudo actualizar: ${error.message}`;
        showMessage(text, true);
    }
}

async function deleteProvider(provider) {
    const confirmed = window.confirm(
        `¿Desea eliminar el laboratorio o proveedor "${provider.nombre}"?`
    );
    if (!confirmed) return;

    try {
        await db.execute(
            "DELETE FROM distribuidores WHERE id_distribuidor = ?",
            [provider.id_distribuidor]
        );
        if (editingProviderId === provider.id_distribuidor) closeEditForm();
        await loadProviders();
        showMessage("Laboratorio o proveedor eliminado correctamente.");
    } catch (error) {
        const isReferenced =
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED";
        const text = isReferenced
            ? "No se puede eliminar porque el proveedor tiene compras asociadas. Puede cambiar su estado a Inactivo."
            : `No se pudo eliminar: ${error.message}`;
        showMessage(text, true);
    }
}

function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return value || "No registrado";
}

function formatDate(value) {
    if (!value) return "No registrada";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).replace(/T.*$/, "");
}

function renderProviders(providers) {
    const container = document.getElementById("providersTable");
    container.replaceChildren();

    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";
    const header = table.createTHead().insertRow();
    header.className = "table-success";

    ["Nombre", "Teléfono", "Correo", "Dirección", "Estado", "Registro", "Acciones"]
        .forEach((text) => {
            const th = document.createElement("th");
            th.textContent = text;
            header.appendChild(th);
        });

    const body = table.createTBody();
    providers.forEach((provider) => {
        const row = body.insertRow();
        const values = [
            provider.nombre,
            formatPhone(provider.telefono),
            provider.correo || "No registrado",
            provider.direccion || "No registrada",
            provider.estado,
            formatDate(provider.fecha_registro),
        ];
        values.forEach((value) => {
            row.insertCell().textContent = value;
        });

        const actionsCell = row.insertCell();
        actionsCell.className = "d-flex flex-column align-items-start gap-1";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn btn-outline-success btn-sm";
        editButton.textContent = "Editar";
        editButton.addEventListener("click", () => openEditForm(provider));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn btn-danger btn-sm";
        deleteButton.textContent = "Eliminar";
        deleteButton.addEventListener("click", () => deleteProvider(provider));

        actionsCell.append(editButton, deleteButton);
    });

    if (!providers.length) {
        const cell = body.insertRow().insertCell();
        cell.colSpan = 7;
        cell.className = "text-center text-secondary p-4";
        cell.textContent = "No hay laboratorios o proveedores registrados.";
    }

    container.appendChild(table);
}
