const db = require("./database").promise();

const moduleName = document.body.dataset.module;
const config = require(`./${moduleName}.js`);
const permissions = {
    Administrador: ["usuarios", "clientes", "medicamentos", "ventas", "compras", "lote", "detalles_venta", "movimientos_puntos"],
    Cajero: ["clientes", "medicamentos", "ventas", "detalles_venta", "movimientos_puntos"],
};

let editingId = null;
let rows = [];
let dniSearchTimer = null;
let saleItems = [];
let medicineCatalog = [];
let selectedSaleMedicineId = null;
const SALES_TAX_RATE = 0.15;
const user = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
const isReadOnlyMedicine =
    user?.rol === "Cajero" && moduleName === "medicamentos";
const isImmutablePurchase = moduleName === "compras";
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

const tableActions = document.createElement("div");
tableActions.className = "d-flex flex-wrap gap-2";

if (
    user?.rol === "Administrador" &&
    ["medicamentos", "ventas"].includes(moduleName)
) {
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "btn btn-outline-success btn-sm px-3 py-2";

    if (moduleName === "medicamentos") {
        reportButton.textContent = "Reporte de vencimientos";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_vencimientos.html";
        });
    } else {
        reportButton.textContent = "Reporte de ventas";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_ventas.html";
        });
    }

    tableActions.appendChild(reportButton);
}

tableActions.appendChild(toggleTableButton);
tableHeader.append(tableTitle, tableActions);
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
    textGroup.className =
        "col-12 col-md-8 position-relative";

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

    let medicineSearchSuggestions = null;

    if (moduleName === "medicamentos") {
        medicineSearchSuggestions =
            document.createElement("div");
        medicineSearchSuggestions.id =
            "medicineSearchSuggestions";
        medicineSearchSuggestions.className =
            "list-group position-absolute start-0 end-0 mx-2 shadow z-3 d-none";
        textGroup.appendChild(medicineSearchSuggestions);
    }

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
        medicineSearchSuggestions?.classList.add("d-none");
    });

    clearSearchButton.addEventListener("click", () => {
        searchText.value = "";
        renderTable();
        medicineSearchSuggestions?.classList.add("d-none");
    });

    searchText.addEventListener("input", () => {
        if (moduleName === "medicamentos") {
            renderModuleMedicineSuggestions(
                searchText,
                medicineSearchSuggestions,
                options
            );
        }
    });

    searchText.addEventListener("focus", () => {
        if (moduleName === "medicamentos") {
            renderModuleMedicineSuggestions(
                searchText,
                medicineSearchSuggestions,
                options
            );
        }
    });

    searchText.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            filterRecords(searchText.value, options);
            medicineSearchSuggestions?.classList.add("d-none");
        }
    });

    document.addEventListener("click", (event) => {
        if (
            medicineSearchSuggestions &&
            !textGroup.contains(event.target)
        ) {
            medicineSearchSuggestions.classList.add("d-none");
        }
    });
}

function renderModuleMedicineSuggestions(
    searchInput,
    suggestions,
    options
) {
    const value = searchInput.value
        .trim()
        .toLocaleLowerCase("es");
    const matches = rows
        .filter((row) => {
            return (
                String(row.codigo || "")
                    .toLocaleLowerCase("es")
                    .includes(value) ||
                String(row.nombre || "")
                    .toLocaleLowerCase("es")
                    .includes(value)
            );
        })
        .slice(0, 8);

    suggestions.replaceChildren();

    matches.forEach((medicine) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className =
            "list-group-item list-group-item-action bg-white text-dark border-success-subtle";

        const title = document.createElement("span");
        title.className = "d-block fw-semibold text-success";
        title.textContent =
            `${medicine.codigo} - ${medicine.nombre}`;

        const detail = document.createElement("small");
        detail.className = "text-secondary";
        detail.textContent =
            `Stock: ${medicine.stock_total || 0}` +
            ` | Precio: L ${Number(medicine.precio_venta || 0).toFixed(2)}`;

        option.append(title, detail);
        option.addEventListener("click", () => {
            searchInput.value =
                `${medicine.codigo} - ${medicine.nombre}`;
            suggestions.classList.add("d-none");
            filterRecords(medicine.codigo, options);
        });

        suggestions.appendChild(option);
    });

    suggestions.classList.toggle(
        "d-none",
        matches.length === 0
    );
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
    document.getElementById("pageDescription").textContent =
        isReadOnlyMedicine
            ? "Consulta del catálogo de medicamentos."
            : config.description;
    document.getElementById("sessionUser").textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
    if (isReadOnlyMedicine) {
        form.closest("section").classList.add("d-none");
    } else {
        renderForm();
    }
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
        if (field.hidden) {
            const hiddenInput = document.createElement("input");
            hiddenInput.type = "hidden";
            hiddenInput.id = field.name;
            hiddenInput.name = field.name;
            form.appendChild(hiddenInput);
            continue;
        }

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
        } else if (field.type === "client-dni") {
            input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.placeholder = "Escriba el DNI del cliente";
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
            if (field.minlength) input.minLength = field.minlength;
        }
        input.id = field.name;
        input.name = field.name;
        input.required = Boolean(field.required);

        if (field.currentUser) {
            input.value = user.id_usuario;
        }

        if (field.autoInvoice) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.automaticDiscount) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.automaticChange) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.automaticTotal) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.automaticPoints) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.automaticSubtotal) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        if (field.readOnly) {
            input.readOnly = true;
            input.classList.add("bg-light");
        }

        group.append(label, input);
        form.appendChild(group);
    }

    if (moduleName === "ventas") {
        loadNextInvoiceNumber();
        configureAutomaticDiscount();
        configureAutomaticChange();
        createSaleItemsSection();
    }

    if (moduleName === "compras") {
        configurePurchaseTotal();
    }
}

function configurePurchaseTotal() {
    const quantity = document.getElementById("cantidad");
    const price = document.getElementById("precio_unitario");
    const total = document.getElementById("total");
    const update = () => {
        total.value = (
            Number(quantity.value || 0) *
            Number(price.value || 0)
        ).toFixed(2);
    };
    quantity.addEventListener("input", update);
    price.addEventListener("input", update);
}

function configureAutomaticChange() {
    document
        .getElementById("monto_recibido")
        .addEventListener("input", updateSalesChange);

    document
        .getElementById("metodo_pago")
        .addEventListener("change", updateSalesChange);
}

function updateSalesChange() {
    const paymentMethod =
        document.getElementById("metodo_pago").value;
    const received = Number(
        document.getElementById("monto_recibido").value || 0
    );
    const total = Number(
        document.getElementById("total").value || 0
    );
    const hasNoChange =
        paymentMethod === "Tarjeta" ||
        paymentMethod === "Transferencia";
    const change = hasNoChange
        ? 0
        : Math.max(0, received - total);

    document.getElementById("cambio").value =
        change.toFixed(2);
}

function configureAutomaticDiscount() {
    const dniInput = document.getElementById("id_cliente");
    const subtotalInput = document.getElementById("subtotal");
    createQuickClientRegistration();
    form.dataset.discountRate = "0";
    document.getElementById("puntos_disponibles").value = "0";

    dniInput.addEventListener("input", () => {
        if (dniSearchTimer) {
            window.clearTimeout(dniSearchTimer);
        }

        dniSearchTimer = window.setTimeout(() => {
            updateSalesDiscount(false);
            dniSearchTimer = null;
        }, 400);
    });

    dniInput.addEventListener("blur", () => {
        updateSalesDiscount(true);
    });

    dniInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            updateSalesDiscount(true);
        }
    });

    subtotalInput.addEventListener("input", () => {
        calculateSalesTotals();
    });

    document
        .getElementById("puntos_utilizados")
        .addEventListener("input", calculateSalesTotals);
}

function createQuickClientRegistration() {
    const container = document.createElement("div");
    container.id = "quickClientRegistration";
    container.className = "col-12 d-none";
    container.innerHTML = `
        <div class="card border-warning-subtle bg-warning-subtle">
            <div class="card-body">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <h3 class="h6 mb-1">Cliente no registrado</h3>
                        <p class="small text-secondary mb-0">
                            Puede registrarlo sin salir de la venta.
                        </p>
                    </div>
                    <button
                        id="showQuickClientForm"
                        class="btn btn-warning btn-sm"
                        type="button"
                    >
                        Registrar nuevo cliente
                    </button>
                </div>
                <div id="quickClientFields" class="row g-3 mt-1 d-none">
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientIdentity">DNI</label>
                        <input id="quickClientIdentity" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientName">Nombre</label>
                        <input id="quickClientName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientLastName">Apellido</label>
                        <input id="quickClientLastName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientPhone">Teléfono</label>
                        <input id="quickClientPhone" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientBirthDate">Fecha de nacimiento</label>
                        <input id="quickClientBirthDate" class="form-control" type="date">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientEmail">Correo</label>
                        <input id="quickClientEmail" class="form-control" type="email">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="quickClientAddress">Dirección</label>
                        <input id="quickClientAddress" class="form-control" type="text">
                    </div>
                    <div class="col-12">
                        <button
                            id="saveQuickClient"
                            class="btn btn-success"
                            type="button"
                        >
                            Guardar cliente y continuar venta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    form.appendChild(container);

    document
        .getElementById("showQuickClientForm")
        .addEventListener("click", () => {
            document.getElementById("quickClientIdentity").value =
                document.getElementById("id_cliente").value.trim();
            document
                .getElementById("quickClientFields")
                .classList.remove("d-none");
        });
    document
        .getElementById("saveQuickClient")
        .addEventListener("click", saveQuickClient);
}

function toggleQuickClientRegistration(show) {
    const container = document.getElementById(
        "quickClientRegistration"
    );
    if (!container) return;
    container.classList.toggle("d-none", !show);
    if (!show) {
        document
            .getElementById("quickClientFields")
            .classList.add("d-none");
    }
}

async function saveQuickClient() {
    const identity = document
        .getElementById("quickClientIdentity")
        .value.trim();
    const name = document.getElementById("quickClientName").value.trim();
    const lastName = document
        .getElementById("quickClientLastName")
        .value.trim();
    const phone = document
        .getElementById("quickClientPhone")
        .value.trim();
    const birthDate = document
        .getElementById("quickClientBirthDate")
        .value;

    if (!identity || !name || !lastName || !phone || !birthDate) {
        showMessage(
            "Complete DNI, nombre, apellido, teléfono y fecha de nacimiento.",
            true
        );
        return;
    }

    try {
        await db.execute(
            `INSERT INTO clientes
                (
                    nombre,
                    apellido,
                    identidad,
                    telefono,
                    correo,
                    direccion,
                    fecha_nacimiento,
                    puntos_acumulados,
                    estado
                )
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Activo')`,
            [
                name,
                lastName,
                identity,
                phone,
                document.getElementById("quickClientEmail").value.trim() || null,
                document.getElementById("quickClientAddress").value.trim() || null,
                birthDate,
            ]
        );
        document.getElementById("id_cliente").value = identity;
        toggleQuickClientRegistration(false);
        await updateSalesDiscount(false);
        showMessage(
            "Cliente registrado y seleccionado para la venta."
        );
    } catch (error) {
        const duplicate = error.code === "ER_DUP_ENTRY";
        showMessage(
            duplicate
                ? "El DNI o correo ya pertenece a otro cliente."
                : `No se pudo registrar el cliente: ${error.message}`,
            true
        );
    }
}

function calculateAge(birthDate) {
    const birth = new Date(`${formatDate(birthDate)}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const birthdayPassed =
        today.getMonth() > birth.getMonth() ||
        (
            today.getMonth() === birth.getMonth() &&
            today.getDate() >= birth.getDate()
        );

    if (!birthdayPassed) {
        age -= 1;
    }

    return age;
}

function getDiscountRate(age) {
    if (age >= 80) {
        return 0.40;
    }
    if (age >= 60) {
        return 0.25;
    }
    return 0;
}

async function updateSalesDiscount(showInvalidDni) {
    const dni = document.getElementById("id_cliente").value.trim();

    if (!dni) {
        toggleQuickClientRegistration(false);
        form.dataset.discountRate = "0";
        document.getElementById("puntos_disponibles").value = "0";
        calculateSalesTotals();
        return;
    }

    const [clients] = await db.execute(
        `SELECT fecha_nacimiento, puntos_acumulados
         FROM clientes
         WHERE identidad = ?
            AND estado = 'Activo'
         LIMIT 1`,
        [dni]
    );

    if (!clients.length) {
        toggleQuickClientRegistration(true);
        form.dataset.discountRate = "0";
        document.getElementById("puntos_disponibles").value = "0";
        calculateSalesTotals();

        if (showInvalidDni) {
            showMessage(
                "No existe un cliente activo con el DNI ingresado.",
                true
            );
        }
        return;
    }

    const age = calculateAge(clients[0].fecha_nacimiento);
    toggleQuickClientRegistration(false);
    const rate = getDiscountRate(age);
    form.dataset.discountRate = String(rate);
    document.getElementById("puntos_disponibles").value =
        String(clients[0].puntos_acumulados || 0);

    calculateSalesTotals();
}

function calculateSalesTotals() {
    const subtotal = Number(
        document.getElementById("subtotal").value || 0
    );
    const ageRate = Number(form.dataset.discountRate || 0);
    const availablePoints = Number(
        document.getElementById("puntos_disponibles").value || 0
    );
    const requestedPoints = Number(
        document.getElementById("puntos_utilizados").value || 0
    );
    const usablePoints = Math.min(
        Math.max(0, requestedPoints),
        availablePoints
    );
    const pointsRate = usablePoints * 0.0005;
    const rate = Math.min(1, ageRate + pointsRate);
    const discount = subtotal * rate;
    const taxableSubtotal = Math.max(0, subtotal - discount);
    const tax = taxableSubtotal * SALES_TAX_RATE;

    document.getElementById("descuento").value =
        discount.toFixed(2);
    document.getElementById("impuesto").value =
        tax.toFixed(2);

    const totalInput = document.getElementById("total");
    const total = taxableSubtotal + tax;
    totalInput.value = total.toFixed(2);

    document.getElementById("puntos_generados").value =
        String(Math.floor(total / 100));

    updateSalesChange();
}

async function loadNextInvoiceNumber() {
    if (editingId !== null) {
        return;
    }

    try {
        const [result] = await db.query(
            `SELECT COALESCE(
                MAX(
                    CAST(
                        SUBSTRING(numero_factura, 5)
                        AS UNSIGNED
                    )
                ),
                0
             ) + 1 AS siguiente
             FROM ventas
             WHERE numero_factura LIKE 'FAC-%'`
        );

        const nextNumber = Number(result[0].siguiente);
        document.getElementById("numero_factura").value =
            `FAC-${String(nextNumber).padStart(4, "0")}`;
    } catch (error) {
        showMessage(
            `No se pudo generar el número de factura: ${error.message}`,
            true
        );
    }
}

function createSaleItemsSection() {
    const container = document.createElement("div");
    container.className = "col-12 mt-4";
    container.innerHTML = `
        <div class="card border-success-subtle">
            <div class="card-header bg-success text-white">
                <h2 class="h5 mb-0">Medicamentos de la venta</h2>
            </div>
            <div class="card-body">
                <div class="row g-3 align-items-end mb-3">
                    <div class="col-12 col-md-5 position-relative">
                        <label for="saleMedicine" class="form-label fw-semibold">
                            Buscar medicamento
                        </label>
                        <input
                            id="saleMedicine"
                            class="form-control"
                            type="text"
                            autocomplete="off"
                            placeholder="Escriba el código o nombre"
                        >
                        <div
                            id="saleMedicineOptions"
                            class="list-group position-absolute start-0 end-0 mx-2 shadow z-3 d-none"
                        ></div>
                    </div>
                    <div class="col-12 col-md-3">
                        <label for="salePresentation" class="form-label fw-semibold">
                            Presentación
                        </label>
                        <select
                            id="salePresentation"
                            class="form-select"
                            disabled
                        >
                            <option value="">Seleccione un medicamento...</option>
                        </select>
                        <small id="salePresentationPrice" class="text-success"></small>
                    </div>
                    <div class="col-12 col-md-2">
                        <label for="saleQuantity" class="form-label fw-semibold">
                            Cantidad
                        </label>
                        <input
                            id="saleQuantity"
                            class="form-control"
                            type="number"
                            min="1"
                            value="1"
                        >
                    </div>
                    <div class="col-12 col-md-2">
                        <button
                            id="addMedicineButton"
                            class="btn btn-success w-100"
                            type="button"
                        >
                            Agregar medicamento
                        </button>
                    </div>
                </div>
                <div id="saleItemsTable" class="table-responsive"></div>
            </div>
        </div>
    `;

    form.appendChild(container);
    document
        .getElementById("addMedicineButton")
        .addEventListener("click", addMedicineToSale);

    const medicineInput =
        document.getElementById("saleMedicine");

    medicineInput.addEventListener("input", () => {
        selectedSaleMedicineId = null;
        resetSalePresentation();
        renderMedicineSuggestions(medicineInput.value);
    });

    document
        .getElementById("salePresentation")
        .addEventListener("change", updateSalePresentationPrice);

    medicineInput.addEventListener("focus", () => {
        renderMedicineSuggestions(medicineInput.value);
    });

    document.addEventListener("click", (event) => {
        if (!container.contains(event.target)) {
            hideMedicineSuggestions();
        }
    });

    loadSaleMedicineCatalog();
    renderSaleItems();
}

async function loadSaleMedicineCatalog() {
    try {
        const [catalogRows] = await db.query(
            `SELECT m.id_medicamento, m.codigo, m.nombre,
                    m.precio_venta, m.stock_total, m.restriccion,
                    mp.id_presentacion,
                    mp.nombre_presentacion,
                    mp.precio_venta AS precio_presentacion
             FROM medicamentos m
             LEFT JOIN medicamento_presentaciones mp
                ON mp.id_medicamento = m.id_medicamento
               AND mp.estado = 'Activa'
             WHERE m.estado = 'Disponible'
                AND m.stock_total > 0
             ORDER BY m.nombre, mp.nombre_presentacion`
        );
        const medicines = new Map();
        catalogRows.forEach((row) => {
            if (!medicines.has(row.id_medicamento)) {
                medicines.set(row.id_medicamento, {
                    id_medicamento: row.id_medicamento,
                    codigo: row.codigo,
                    nombre: row.nombre,
                    precio_venta: Number(row.precio_venta),
                    stock_total: Number(row.stock_total),
                    restriccion: row.restriccion,
                    presentations: [],
                });
            }
            if (row.id_presentacion) {
                medicines.get(row.id_medicamento).presentations.push({
                    id_presentacion: row.id_presentacion,
                    nombre: row.nombre_presentacion,
                    precio: Number(row.precio_presentacion),
                });
            }
        });
        medicineCatalog = [...medicines.values()];

        hideMedicineSuggestions();
    } catch (error) {
        showMessage(
            `No se pudieron cargar los medicamentos: ${error.message}`,
            true
        );
    }
}

function renderMedicineSuggestions(searchValue) {
    const results =
        document.getElementById("saleMedicineOptions");

    if (!results || !medicineCatalog.length) {
        return;
    }

    const search = searchValue
        .trim()
        .toLocaleLowerCase("es");
    const matches = medicineCatalog
        .filter((medicine) => {
            return (
                medicine.codigo
                    .toLocaleLowerCase("es")
                    .includes(search) ||
                medicine.nombre
                    .toLocaleLowerCase("es")
                    .includes(search)
            );
        })
        .slice(0, 8);

    results.replaceChildren();

    matches.forEach((medicine) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className =
            "list-group-item list-group-item-action bg-white text-dark border-success-subtle";

        const name = document.createElement("span");
        name.className = "d-block fw-semibold text-success";
        name.textContent =
            `${medicine.codigo} - ${medicine.nombre}`;

        const detail = document.createElement("small");
        detail.className = "text-secondary";
        const prices = medicine.presentations.map(
            (presentation) => presentation.precio
        );
        const startingPrice = prices.length
            ? Math.min(...prices)
            : medicine.precio_venta;
        detail.textContent =
            `Stock: ${medicine.stock_total} | Desde: L ${startingPrice.toFixed(2)}`;
        if (medicine.restriccion === "Con Receta Medica") {
            detail.textContent += " | Venta controlada";
        }

        option.append(name, detail);
        option.addEventListener("click", () => {
            document.getElementById("saleMedicine").value =
                getMedicineDisplay(medicine);
            selectSaleMedicine(medicine);
            hideMedicineSuggestions();
        });

        results.appendChild(option);
    });

    results.classList.toggle(
        "d-none",
        matches.length === 0
    );
}

function selectSaleMedicine(medicine) {
    selectedSaleMedicineId = medicine.id_medicamento;
    const select = document.getElementById("salePresentation");
    select.replaceChildren(
        new Option("Seleccione la presentación...", "")
    );
    medicine.presentations.forEach((presentation) => {
        select.add(
            new Option(
                `${presentation.nombre} - L ${presentation.precio.toFixed(2)}`,
                String(presentation.id_presentacion)
            )
        );
    });
    select.disabled = medicine.presentations.length === 0;
    if (medicine.presentations.length === 1) {
        select.value = String(
            medicine.presentations[0].id_presentacion
        );
    }
    updateSalePresentationPrice();
}

function resetSalePresentation() {
    const select = document.getElementById("salePresentation");
    if (!select) return;
    select.replaceChildren(
        new Option("Seleccione un medicamento...", "")
    );
    select.disabled = true;
    document.getElementById("salePresentationPrice").textContent = "";
}

function updateSalePresentationPrice() {
    const medicine = medicineCatalog.find(
        (item) => item.id_medicamento === selectedSaleMedicineId
    );
    const presentation = medicine?.presentations.find(
        (item) =>
            String(item.id_presentacion) ===
            document.getElementById("salePresentation").value
    );
    document.getElementById("salePresentationPrice").textContent =
        presentation
            ? `Precio seleccionado: L ${presentation.precio.toFixed(2)}`
            : "";
}

function hideMedicineSuggestions() {
    document
        .getElementById("saleMedicineOptions")
        ?.classList.add("d-none");
}

function addMedicineToSale() {
    const medicineText =
        document.getElementById("saleMedicine")
            .value
            .trim()
            .toLocaleLowerCase("es");
    const quantity = Number(
        document.getElementById("saleQuantity").value
    );
    const medicine = medicineCatalog.find(
        (item) => {
            return (
                item.id_medicamento === selectedSaleMedicineId ||
                getMedicineDisplay(item)
                    .toLocaleLowerCase("es") === medicineText ||
                item.codigo.toLocaleLowerCase("es") === medicineText ||
                item.nombre.toLocaleLowerCase("es") === medicineText
            );
        }
    );

    if (!medicine) {
        showMessage("Seleccione un medicamento.", true);
        return;
    }
    const presentation = medicine.presentations.find(
        (item) =>
            String(item.id_presentacion) ===
            document.getElementById("salePresentation").value
    );
    if (!presentation) {
        showMessage(
            "Seleccione la presentación del medicamento.",
            true
        );
        return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        showMessage("Ingrese una cantidad válida.", true);
        return;
    }

    const existing = saleItems.find(
        (item) =>
            item.id_medicamento === medicine.id_medicamento &&
            item.id_presentacion === presentation.id_presentacion
    );
    const medicineQuantity = saleItems
        .filter(
            (item) =>
                item.id_medicamento === medicine.id_medicamento
        )
        .reduce((sum, item) => sum + item.cantidad, 0);
    const totalQuantity = quantity + medicineQuantity;

    if (totalQuantity > medicine.stock_total) {
        showMessage(
            `Solo hay ${medicine.stock_total} unidades disponibles.`,
            true
        );
        return;
    }

    if (
        medicine.restriccion === "Con Receta Medica" &&
        !window.confirm(
            "Este medicamento es de venta controlada. ¿Verificó la receta médica?"
        )
    ) {
        return;
    }

    if (existing) {
        existing.cantidad = totalQuantity;
        existing.subtotal =
            existing.cantidad * existing.precio_unitario;
    } else {
        saleItems.push({
            id_medicamento: medicine.id_medicamento,
            codigo: medicine.codigo,
            nombre: medicine.nombre,
            id_presentacion: presentation.id_presentacion,
            presentacion: presentation.nombre,
            cantidad: quantity,
            precio_unitario: presentation.precio,
            restriccion: medicine.restriccion,
            subtotal: quantity * presentation.precio,
        });
    }

    document.getElementById("saleMedicine").value = "";
    selectedSaleMedicineId = null;
    resetSalePresentation();
    hideMedicineSuggestions();
    document.getElementById("saleQuantity").value = "1";
    renderSaleItems();
}

function getMedicineDisplay(medicine) {
    const prices = medicine.presentations.map(
        (presentation) => presentation.precio
    );
    const startingPrice = prices.length
        ? Math.min(...prices)
        : medicine.precio_venta;
    return (
        `${medicine.codigo} - ${medicine.nombre}` +
        ` | Stock: ${medicine.stock_total}` +
        ` | Desde L ${startingPrice.toFixed(2)}`
    );
}

function removeMedicineFromSale(index) {
    saleItems.splice(index, 1);
    renderSaleItems();
}

function renderSaleItems() {
    const container = document.getElementById("saleItemsTable");
    if (!container) return;
    container.replaceChildren();

    if (!saleItems.length) {
        const empty = document.createElement("p");
        empty.className = "text-secondary text-center mb-0";
        empty.textContent = "No se han agregado medicamentos.";
        container.appendChild(empty);
    } else {
        const table = document.createElement("table");
        table.className = "table table-sm table-striped align-middle mb-0";
        const header = table.createTHead().insertRow();
        header.className = "table-success";
        ["Código", "Medicamento", "Presentación", "Cantidad", "Precio", "Subtotal", "Acción"]
            .forEach((text) => {
                const th = document.createElement("th");
                th.textContent = text;
                header.appendChild(th);
            });
        const body = table.createTBody();
        saleItems.forEach((item, index) => {
            const row = body.insertRow();
            [
                item.codigo,
                item.nombre,
                item.presentacion,
                item.cantidad,
                `L ${item.precio_unitario.toFixed(2)}`,
                `L ${item.subtotal.toFixed(2)}`,
            ].forEach((value) => {
                row.insertCell().textContent = value;
            });
            const action = row.insertCell();
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-danger btn-sm";
            remove.textContent = "Quitar";
            remove.addEventListener(
                "click",
                () => removeMedicineFromSale(index)
            );
            action.appendChild(remove);
        });
        container.appendChild(table);
    }

    const subtotal = saleItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
    );
    document.getElementById("subtotal").value = subtotal.toFixed(2);
    calculateSalesTotals();
}

async function loadRows() {
    try {
        const fields = config.fields.filter((field) => {
            return field.type !== "password" && !field.virtual;
        });
        const columns = [
            `${config.table}.${config.id}`,
            ...fields.map((field) => `${config.table}.${field.name}`),
        ];

        const usesClientDni = moduleName === "ventas";
        const usesDistributor = moduleName === "compras";
        let join = "";
        if (usesClientDni) {
            join = `LEFT JOIN clientes
                    ON ${config.table}.id_cliente = clientes.id_cliente`;
        } else if (usesDistributor) {
            join = `LEFT JOIN distribuidores
                    ON compras.id_distribuidor =
                       distribuidores.id_distribuidor`;
        }
        const clientIdentity = usesClientDni
            ? ", clientes.identidad AS identidad_cliente"
            : "";
        const distributorName = usesDistributor
            ? ", distribuidores.nombre AS nombre_distribuidor"
            : "";
        const lotCount = moduleName === "medicamentos"
            ? `, (SELECT COUNT(*)
                  FROM lote
                  WHERE lote.id_medicamento =
                        medicamentos.id_medicamento) AS lotes_registrados`
            : "";

        [rows] = await db.query(
            `SELECT ${columns.join(", ")}${clientIdentity}
                    ${distributorName}${lotCount}
             FROM ${config.table}
             ${join}
             ORDER BY ${config.table}.${config.id} DESC`
        );
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
    const fields = config.fields.filter((field) => {
        return (
            field.type !== "password" &&
            !field.virtual &&
            (!field.name.startsWith("id_") || field.showInTable)
        );
    });

    if (moduleName === "clientes") {
        fields.unshift({
            name: config.id,
            label: "ID Cliente",
        });
    }
    if (moduleName === "medicamentos") {
        fields.push({
            name: "lotes_registrados",
            label: "Lotes",
        });
    }
    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";
    const header = table.createTHead().insertRow();
    header.className = "table-success";
    fields.forEach((field) => { const th = document.createElement("th"); th.textContent = field.label; header.appendChild(th); });
    if (!isReadOnlyMedicine && !isImmutablePurchase) {
        const actionsHeader = document.createElement("th");
        actionsHeader.textContent = "Acciones";
        header.appendChild(actionsHeader);
    }
    const body = table.createTBody();
    records.forEach((row) => {
        const tr = body.insertRow();
        if (moduleName === "medicamentos") {
            const stock = Number(row.stock_total || 0);
            if (stock <= 10) {
                tr.classList.add("table-danger");
            } else if (stock <= 50) {
                tr.classList.add("table-warning");
            }
        }
        fields.forEach((field) => {
            const column = field.displayName || field.name;
            tr.insertCell().textContent = formatValue(row[column]);
        });
        if (!isReadOnlyMedicine && !isImmutablePurchase) {
            const actions = tr.insertCell();
            const edit = document.createElement("button");
            edit.className = "btn btn-outline-success btn-sm me-2";
            edit.textContent = "Editar";
            edit.addEventListener("click", () => editRecord(row));
            const remove = document.createElement("button");
            remove.className = "btn btn-danger btn-sm";
            remove.textContent = "Eliminar";
            remove.addEventListener(
                "click",
                () => deleteRecord(row[config.id])
            );
            actions.append(edit, remove);
        }
    });
    tableContainer.appendChild(table);
}

function formatValue(value) {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).replace(/T.*$/, "");
}

function formatDate(value) {
    if (value == null) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return String(value).replace(/T.*$/, "");
}

function getData() {
    const data = {};
    config.fields.forEach((field) => {
        if (field.virtual) {
            return;
        }

        const value = document.getElementById(field.name).value.trim();
        if (field.required && !value && !(editingId !== null && field.type === "password")) throw new Error(`Complete el campo: ${field.label}`);

        if (field.passwordRule && value) {
            const validPassword =
                value.length >= 8 &&
                /[A-Z]/.test(value) &&
                /[0-9]/.test(value) &&
                /[^A-Za-z0-9]/.test(value);

            if (!validPassword) {
                throw new Error(
                    "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial."
                );
            }
        }

        data[field.name] = value || null;
    });

    if (moduleName === "ventas") {
        const available = Number(
            document.getElementById("puntos_disponibles").value || 0
        );
        const used = Number(data.puntos_utilizados || 0);

        if (used > available) {
            throw new Error(
                "Los puntos utilizados no pueden superar los puntos disponibles."
            );
        }
    }

    return data;
}

async function saveRecord(event) {
    event.preventDefault();
    if (isReadOnlyMedicine) {
        showMessage(
            "El Cajero solo puede consultar medicamentos.",
            true
        );
        return;
    }
    try {
        const data = getData();

        if (moduleName === "medicamentos") {
            await saveMedicineWithLot(data);
            showMessage(
                "Medicamento y lote registrados correctamente."
            );
            clearForm();
            await loadRows();
            return;
        }

        if (moduleName === "compras") {
            await savePurchaseWithLot(data);
            showMessage(
                "Compra, lote e inventario registrados correctamente."
            );
            clearForm();
            await loadRows();
            return;
        }

        const clientDniField = config.fields.find(
            (field) => field.type === "client-dni"
        );

        let selectedClient = null;

        if (clientDniField && data.id_cliente) {
            const [clients] = await db.execute(
                `SELECT id_cliente, fecha_nacimiento,
                        puntos_acumulados
                 FROM clientes
                 WHERE identidad = ?
                    AND estado = 'Activo'
                 LIMIT 1`,
                [data.id_cliente]
            );

            if (!clients.length) {
                throw new Error(
                    "No existe un cliente activo con el DNI ingresado. Regístrelo primero en Clientes."
                );
            }

            selectedClient = clients[0];
            data.id_cliente = selectedClient.id_cliente;
        }

        if (moduleName === "ventas") {
            if (!saleItems.length) {
                throw new Error(
                    "Agregue al menos un medicamento a la venta."
                );
            }

            const subtotal = Number(data.subtotal || 0);
            const usedPoints = Number(data.puntos_utilizados || 0);
            const availablePoints =
                Number(selectedClient?.puntos_acumulados || 0);

            if (usedPoints > availablePoints) {
                throw new Error(
                    "Los puntos utilizados no pueden superar los puntos disponibles."
                );
            }

            const ageRate = selectedClient
                ? getDiscountRate(
                    calculateAge(selectedClient.fecha_nacimiento)
                )
                : 0;
            const pointsRate = usedPoints * 0.0005;
            const discountRate = Math.min(
                1,
                ageRate + pointsRate
            );

            data.descuento =
                Number((subtotal * discountRate).toFixed(2));
            const taxableSubtotal = Math.max(
                0,
                subtotal - data.descuento
            );
            data.impuesto =
                Number((taxableSubtotal * SALES_TAX_RATE).toFixed(2));
            data.total =
                Number(
                    (taxableSubtotal + data.impuesto).toFixed(2)
                );
            data.puntos_generados =
                Math.floor(data.total / 100);
            const hasNoChange =
                data.metodo_pago === "Tarjeta" ||
                data.metodo_pago === "Transferencia";
            data.cambio = hasNoChange
                ? 0
                : Number(
                    Math.max(
                        0,
                        Number(data.monto_recibido || 0) -
                        data.total
                    ).toFixed(2)
                );

            await saveSaleTransaction(data);
            showMessage(
                editingId === null
                    ? "Venta guardada correctamente."
                    : "Venta actualizada correctamente."
            );
            clearForm();
            await loadRows();
            return;
        }

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

function getLotFormData(prefix) {
    const number = document.getElementById(
        `numero_lote_${prefix}`
    )?.value.trim();
    const quantityInput = prefix === "registro"
        ? "cantidad_lote_registro"
        : "cantidad";
    const quantity = Number(
        document.getElementById(quantityInput)?.value
    );
    const manufacture = document.getElementById(
        "fecha_fabricacion_lote"
    )?.value;
    const expiration = document.getElementById(
        "fecha_vencimiento_lote"
    )?.value;

    if (
        !number ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !manufacture ||
        !expiration
    ) {
        throw new Error(
            "Complete todos los datos del lote con una cantidad válida."
        );
    }
    if (expiration <= manufacture) {
        throw new Error(
            "La fecha de vencimiento debe ser posterior a la fabricación."
        );
    }
    const today = new Date().toISOString().slice(0, 10);
    if (expiration <= today) {
        throw new Error(
            "No se puede registrar un lote vencido."
        );
    }

    return {
        numero_lote: number,
        cantidad: quantity,
        fecha_fabricacion: manufacture,
        fecha_vencimiento: expiration,
    };
}

async function saveMedicineWithLot(data) {
    if (editingId !== null) {
        const columns = Object.keys(data).filter(
            (column) => column !== "stock_total"
        );
        await db.execute(
            `UPDATE medicamentos
             SET ${columns.map((column) => `${column} = ?`).join(", ")}
             WHERE id_medicamento = ?`,
            [...columns.map((column) => data[column]), editingId]
        );
        await saveMedicinePresentations(db, editingId, data);
        return;
    }

    const lot = getLotFormData("registro");
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [duplicateLots] = await connection.execute(
            "SELECT id_lote FROM lote WHERE numero_lote = ? LIMIT 1",
            [lot.numero_lote]
        );
        if (duplicateLots.length) {
            throw new Error("El número de lote ya está registrado.");
        }

        const [existing] = await connection.execute(
            `SELECT id_medicamento
             FROM medicamentos
             WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))
             LIMIT 1
             FOR UPDATE`,
            [data.nombre]
        );
        let medicineId;

        if (existing.length) {
            medicineId = existing[0].id_medicamento;
            await connection.execute(
                `UPDATE medicamentos
                 SET stock_total = stock_total + ?,
                     estado = 'Disponible'
                 WHERE id_medicamento = ?`,
                [lot.cantidad, medicineId]
            );
        } else {
            data.stock_total = lot.cantidad;
            data.estado = data.estado || "Disponible";
            const columns = Object.keys(data);
            const [result] = await connection.execute(
                `INSERT INTO medicamentos
                    (${columns.join(", ")})
                 VALUES
                    (${columns.map(() => "?").join(", ")})`,
                Object.values(data)
            );
            medicineId = result.insertId;
        }

        await saveMedicinePresentations(
            connection,
            medicineId,
            data
        );

        await connection.execute(
            `INSERT INTO lote
                (
                    id_medicamento,
                    numero_lote,
                    cantidad_inicial,
                    cantidad_disponible,
                    fecha_fabricacion,
                    fecha_vencimiento,
                    precio_compra,
                    estado
                )
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Disponible')`,
            [
                medicineId,
                lot.numero_lote,
                lot.cantidad,
                lot.cantidad,
                lot.fecha_fabricacion,
                lot.fecha_vencimiento,
                data.precio_compra,
            ]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function saveMedicinePresentations(
    connection,
    medicineId,
    medicineData
) {
    const defaultName = medicineData.forma_venta;
    if (defaultName) {
        await connection.execute(
            `INSERT INTO medicamento_presentaciones
                (
                    id_medicamento,
                    nombre_presentacion,
                    precio_venta,
                    estado
                )
             VALUES (?, ?, ?, 'Activa')
             ON DUPLICATE KEY UPDATE
                precio_venta = VALUES(precio_venta),
                estado = 'Activa'`,
            [
                medicineId,
                defaultName,
                medicineData.precio_venta,
            ]
        );
    }

    const alternativeName = document
        .getElementById("presentacion_alternativa")
        ?.value.trim();
    const alternativePrice = Number(
        document.getElementById(
            "precio_presentacion_alternativa"
        )?.value
    );
    if (
        alternativeName &&
        Number.isFinite(alternativePrice) &&
        alternativePrice > 0
    ) {
        await connection.execute(
            `INSERT INTO medicamento_presentaciones
                (
                    id_medicamento,
                    nombre_presentacion,
                    precio_venta,
                    estado
                )
             VALUES (?, ?, ?, 'Activa')
             ON DUPLICATE KEY UPDATE
                precio_venta = VALUES(precio_venta),
                estado = 'Activa'`,
            [medicineId, alternativeName, alternativePrice]
        );
    } else if (alternativeName || alternativePrice > 0) {
        throw new Error(
            "Complete la presentación alternativa y su precio."
        );
    }
}

async function savePurchaseWithLot(data) {
    if (editingId !== null) {
        throw new Error(
            "Las compras registradas no se editan; registre una nueva compra."
        );
    }

    const distributorName = String(data.id_distribuidor || "").trim();
    if (!distributorName) {
        throw new Error("Ingrese el laboratorio o proveedor.");
    }
    const lot = getLotFormData("compra");
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const [medicines] = await connection.execute(
            `SELECT id_medicamento
             FROM medicamentos
             WHERE id_medicamento = ?
             LIMIT 1
             FOR UPDATE`,
            [data.id_medicamento]
        );
        if (!medicines.length) {
            throw new Error(
                "El medicamento no está registrado. Regístrelo primero con su lote."
            );
        }

        const [duplicateLots] = await connection.execute(
            "SELECT id_lote FROM lote WHERE numero_lote = ? LIMIT 1",
            [lot.numero_lote]
        );
        if (duplicateLots.length) {
            throw new Error("El número de lote ya está registrado.");
        }

        const [distributors] = await connection.execute(
            `SELECT id_distribuidor
             FROM distribuidores
             WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))
             LIMIT 1`,
            [distributorName]
        );
        let distributorId;
        if (distributors.length) {
            distributorId = distributors[0].id_distribuidor;
        } else {
            const [result] = await connection.execute(
                `INSERT INTO distribuidores
                    (nombre, telefono, correo, estado)
                 VALUES (?, ?, ?, 'Activo')`,
                [
                    distributorName,
                    document.getElementById("telefono_distribuidor").value.trim() || null,
                    document.getElementById("correo_distribuidor").value.trim() || null,
                ]
            );
            distributorId = result.insertId;
        }

        data.id_distribuidor = distributorId;
        data.total = Number(
            (
                Number(data.cantidad) *
                Number(data.precio_unitario)
            ).toFixed(2)
        );
        const columns = Object.keys(data);
        const [purchaseResult] = await connection.execute(
            `INSERT INTO compras
                (${columns.join(", ")})
             VALUES
                (${columns.map(() => "?").join(", ")})`,
            Object.values(data)
        );

        await connection.execute(
            `INSERT INTO lote
                (
                    id_medicamento,
                    id_compra,
                    numero_lote,
                    cantidad_inicial,
                    cantidad_disponible,
                    fecha_fabricacion,
                    fecha_vencimiento,
                    precio_compra,
                    estado
                )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Disponible')`,
            [
                data.id_medicamento,
                purchaseResult.insertId,
                lot.numero_lote,
                lot.cantidad,
                lot.cantidad,
                lot.fecha_fabricacion,
                lot.fecha_vencimiento,
                data.precio_unitario,
            ]
        );

        if (data.estado !== "Cancelada") {
            await connection.execute(
                `UPDATE medicamentos
                 SET stock_total = stock_total + ?,
                     precio_compra = ?,
                     estado = 'Disponible'
                 WHERE id_medicamento = ?`,
                [
                    lot.cantidad,
                    data.precio_unitario,
                    data.id_medicamento,
                ]
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function saveSaleTransaction(data) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        if (editingId !== null) {
            const [oldSales] = await connection.execute(
                `SELECT id_cliente, puntos_generados,
                        puntos_utilizados
                 FROM ventas
                 WHERE id_venta = ?
                 FOR UPDATE`,
                [editingId]
            );
            const oldSale = oldSales[0];

            if (oldSale?.id_cliente) {
                await connection.execute(
                    `UPDATE clientes
                     SET puntos_acumulados =
                        puntos_acumulados +
                        ? - ?
                     WHERE id_cliente = ?`,
                    [
                        oldSale.puntos_utilizados || 0,
                        oldSale.puntos_generados || 0,
                        oldSale.id_cliente,
                    ]
                );
            }

            const [oldItems] = await connection.execute(
                `SELECT id_medicamento, cantidad
                 FROM detalles_venta
                 WHERE id_venta = ?`,
                [editingId]
            );

            for (const item of oldItems) {
                await connection.execute(
                    `UPDATE medicamentos
                     SET stock_total = stock_total + ?,
                         estado = 'Disponible'
                     WHERE id_medicamento = ?`,
                    [item.cantidad, item.id_medicamento]
                );
            }

            await connection.execute(
                "DELETE FROM detalles_venta WHERE id_venta = ?",
                [editingId]
            );
        }

        for (const item of saleItems) {
            const requiredStock = saleItems
                .filter(
                    (saleItem) =>
                        saleItem.id_medicamento ===
                        item.id_medicamento
                )
                .reduce(
                    (sum, saleItem) =>
                        sum + saleItem.cantidad,
                    0
                );
            const [stockRows] = await connection.execute(
                `SELECT stock_total, restriccion
                 FROM medicamentos
                 WHERE id_medicamento = ?
                 FOR UPDATE`,
                [item.id_medicamento]
            );

            if (
                !stockRows.length ||
                stockRows[0].stock_total < requiredStock
            ) {
                throw new Error(
                    `No hay suficiente stock de ${item.nombre}.`
                );
            }
            if (
                stockRows[0].restriccion === "Con Receta Medica" &&
                item.restriccion !== "Con Receta Medica"
            ) {
                throw new Error(
                    `${item.nombre} es un medicamento de venta controlada.`
                );
            }
        }

        const columns = Object.keys(data);
        let saleId = editingId;

        if (editingId === null) {
            const [result] = await connection.execute(
                `INSERT INTO ventas
                 (${columns.join(", ")})
                 VALUES (${columns.map(() => "?").join(", ")})`,
                Object.values(data)
            );
            saleId = result.insertId;
        } else {
            await connection.execute(
                `UPDATE ventas
                 SET ${columns.map(
                    (column) => `${column} = ?`
                 ).join(", ")}
                 WHERE id_venta = ?`,
                [...Object.values(data), editingId]
            );
        }

        for (const item of saleItems) {
            await connection.execute(
                `INSERT INTO detalles_venta
                 (
                    id_venta,
                    id_medicamento,
                    id_presentacion,
                    presentacion,
                    cantidad,
                    precio_unitario,
                    descuento,
                    subtotal
                 )
                  VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                [
                    saleId,
                    item.id_medicamento,
                    item.id_presentacion,
                    item.presentacion,
                    item.cantidad,
                    item.precio_unitario,
                    item.subtotal,
                ]
            );

            await connection.execute(
                `UPDATE medicamentos
                 SET estado = CASE
                        WHEN stock_total - ? <= 0
                        THEN 'Agotado'
                        ELSE estado
                     END,
                     stock_total = stock_total - ?
                 WHERE id_medicamento = ?`,
                [
                    item.cantidad,
                    item.cantidad,
                    item.id_medicamento,
                ]
            );
        }

        if (data.id_cliente) {
            await connection.execute(
                `UPDATE clientes
                 SET puntos_acumulados =
                    puntos_acumulados - ? + ?
                 WHERE id_cliente = ?`,
                [
                    data.puntos_utilizados || 0,
                    data.puntos_generados || 0,
                    data.id_cliente,
                ]
            );
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function editRecord(row) {
    if (isReadOnlyMedicine) {
        return;
    }
    editingId = row[config.id];
    config.fields.forEach((field) => {
        const input = document.getElementById(field.name);
        if (field.virtual) {
            input.value = "";
            if (field.lotField) {
                input.required = false;
            }
            return;
        }
        const column = field.displayName || field.name;
        input.value =
            field.type === "password"
                ? ""
                : formatValue(row[column]);
        if (field.type === "password") input.required = false;
    });

    if (moduleName === "ventas") {
        const [details] = await db.execute(
            `SELECT dv.id_medicamento, m.codigo,
                    m.nombre, m.restriccion, dv.cantidad,
                    dv.id_presentacion, dv.presentacion,
                    dv.precio_unitario, dv.subtotal
             FROM detalles_venta dv
             INNER JOIN medicamentos m
                ON dv.id_medicamento = m.id_medicamento
             WHERE dv.id_venta = ?`,
            [editingId]
        );

        saleItems = details.map((item) => ({
            ...item,
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precio_unitario),
            subtotal: Number(item.subtotal),
        }));
        renderSaleItems();
        updateSalesDiscount(false);
    }

    saveButton.textContent = "Actualizar";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
    if (isReadOnlyMedicine) {
        showMessage(
            "El Cajero no puede eliminar medicamentos.",
            true
        );
        return;
    }
    if (!window.confirm("¿Desea eliminar este registro?")) return;
    try {
        if (moduleName === "ventas") {
            await deleteSaleTransaction(id);
        } else {
            await db.execute(
                `DELETE FROM ${config.table}
                 WHERE ${config.id} = ?`,
                [id]
            );
        }
        showMessage("Registro eliminado.");
        await loadRows();
    } catch (error) {
        showMessage(`No se pudo eliminar: ${error.message}`, true);
    }
}

async function deleteSaleTransaction(id) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const [sales] = await connection.execute(
            `SELECT id_cliente, puntos_generados,
                    puntos_utilizados
             FROM ventas
             WHERE id_venta = ?
             FOR UPDATE`,
            [id]
        );
        const sale = sales[0];
        const [items] = await connection.execute(
            `SELECT id_medicamento, cantidad
             FROM detalles_venta
             WHERE id_venta = ?`,
            [id]
        );

        for (const item of items) {
            await connection.execute(
                `UPDATE medicamentos
                 SET stock_total = stock_total + ?,
                     estado = 'Disponible'
                 WHERE id_medicamento = ?`,
                [item.cantidad, item.id_medicamento]
            );
        }

        if (sale?.id_cliente) {
            await connection.execute(
                `UPDATE clientes
                 SET puntos_acumulados =
                    puntos_acumulados +
                    ? - ?
                 WHERE id_cliente = ?`,
                [
                    sale.puntos_utilizados || 0,
                    sale.puntos_generados || 0,
                    sale.id_cliente,
                ]
            );
        }

        await connection.execute(
            "DELETE FROM detalles_venta WHERE id_venta = ?",
            [id]
        );
        await connection.execute(
            "DELETE FROM ventas WHERE id_venta = ?",
            [id]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

function clearForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = "Guardar";
    const password = config.fields.find((field) => field.type === "password");
    if (password) document.getElementById(password.name).required = Boolean(password.required);
    config.fields
        .filter((field) => field.lotField)
        .forEach((field) => {
            document.getElementById(field.name).required =
                Boolean(field.required);
        });
    config.fields
        .filter((field) => field.currentUser)
        .forEach((field) => {
            document.getElementById(field.name).value =
                user.id_usuario;
        });

    if (moduleName === "ventas") {
        saleItems = [];
        selectedSaleMedicineId = null;
        form.dataset.discountRate = "0";
        document.getElementById("puntos_disponibles").value = "0";
        toggleQuickClientRegistration(false);
        resetSalePresentation();
        renderSaleItems();
        loadSaleMedicineCatalog();
        loadNextInvoiceNumber();
    }
}
