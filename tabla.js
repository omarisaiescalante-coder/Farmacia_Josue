// Motor reutilizable de formularios, tablas, CRUD y procesos especiales.
// Lee la configuración del módulo activo para generar su interfaz y consultas.
const db = require("./database").promise();
const { ipcRenderer } = require("electron");

const moduleName = document.body.dataset.module;
const config = require(`./${moduleName}.js`);
const permissions = {
    Administrador: ["usuarios", "clientes", "medicamentos", "ventas", "compras", "lote", "facturas", "detalles_venta", "movimientos_puntos"],
    Cajero: ["clientes", "medicamentos", "ventas", "facturas", "detalles_venta", "movimientos_puntos"],
};

let editingId = null;
let rows = [];
let dniSearchTimer = null;
let saleItems = [];
let medicineCatalog = [];
let selectedSaleMedicineId = null;
let lotMedicineCatalog = [];
let selectedLotMedicine = null;
let presentationStockSchemaPromise = null;
let messageTimer = null;
const SALES_TAX_RATE = 0.15;
let user = ipcRenderer.sendSync("session:get-user");

if (!user) {
    try {
        user = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
    } catch {
        sessionStorage.removeItem("usuarioActivo");
    }
}
const isReadOnlyMedicine =
    user?.rol === "Cajero" && moduleName === "medicamentos";
const isImmutablePurchase = moduleName === "compras";
const isImmutableLot = moduleName === "lote";
const isReadOnlyModule = Boolean(config.readOnly);
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
tableTitle.textContent = `Registros de ${config.title}`;

const toggleTableButton = document.createElement("button");
toggleTableButton.type = "button";
toggleTableButton.className = "btn btn-success btn-sm px-3 py-2";
toggleTableButton.setAttribute("aria-expanded", "false");
toggleTableButton.textContent = "Desplegar la tabla ▼";

const tableActions = document.createElement("div");
tableActions.className = "d-flex flex-wrap gap-2";

const canOpenReport =
    (user?.rol === "Administrador" &&
        ["medicamentos", "ventas", "compras", "lote"].includes(moduleName)) ||
    (user?.rol === "Cajero" && moduleName === "ventas");

if (canOpenReport) {
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "btn btn-outline-success btn-sm px-3 py-2";

    if (moduleName === "medicamentos") {
        reportButton.textContent = "Reporte de vencimientos";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_vencimientos.html";
        });
    } else if (moduleName === "ventas"){
        reportButton.textContent = "Reporte de ventas";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_ventas.html";
        });
    } else if (moduleName === "compras") {
        reportButton.textContent = "Reporte de compras";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_compras.html";
        });
    } else {
        reportButton.textContent = "Reporte de lotes";
        reportButton.addEventListener("click", () => {
            window.location.href = "reporte_lotes.html";
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

function ensurePresentationStockSchema() {
    if (!presentationStockSchemaPromise) {
        presentationStockSchemaPromise = (async () => {
            const [columns] = await db.query(
                `SELECT COLUMN_NAME
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'medicamento_presentaciones'
                   AND COLUMN_NAME = 'unidades_stock'`
            );
            if (!columns.length) {
                await db.query(
                    `ALTER TABLE medicamento_presentaciones
                     ADD COLUMN unidades_stock INT NOT NULL DEFAULT 1
                     AFTER precio_venta`
                );
            }
        })().catch((error) => {
            presentationStockSchemaPromise = null;
            throw error;
        });
    }
    return presentationStockSchemaPromise;
}

function getPresentationStockUnits(presentationName, medicinePresentation = "") {
    const name = String(presentationName || "").trim().toLocaleLowerCase("es");
    const description = String(medicinePresentation || "")
        .trim()
        .toLocaleLowerCase("es");
    const explicitQuantity = name.match(/\b(?:x|de)\s*(\d+)\b/);

    if (explicitQuantity) {
        return Math.max(1, Number(explicitQuantity[1]));
    }
    if (name.includes("unidad")) {
        return 1;
    }

    const packageQuantity = description.match(
        /\b(?:caja|frasco)\s+de\s+(\d+)\s+(?:tabletas?|capsulas?|cápsulas?|ampollas?|unidades?)\b/
    );
    const unitsPerPackage = packageQuantity
        ? Math.max(1, Number(packageQuantity[1]))
        : 1;

    if (name.includes("caja")) {
        return unitsPerPackage;
    }
    if (name.includes("blister") || name.includes("blíster")) {
        return Math.min(10, unitsPerPackage);
    }
    return 1;
}

function getMedicineStockDisplay(medicine, preferredPresentation = "Caja") {
    const presentation = medicine.presentations.find(
        (item) =>
            item.nombre.toLocaleLowerCase("es") ===
            preferredPresentation.toLocaleLowerCase("es")
    ) || medicine.presentations[0];
    const unitsPerPresentation = Math.max(
        1,
        Number(presentation?.unidades_stock) || 1
    );
    const amount = medicine.stock_total / unitsPerPresentation;
    const formattedAmount = Number.isInteger(amount)
        ? String(amount)
        : amount.toFixed(2);
    const presentationName = presentation?.nombre || "Unidad";
    return `${formattedAmount} ${presentationName.toLocaleLowerCase("es")}`;
}

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
        if (
            ["usuarios", "clientes"].includes(moduleName) &&
            /^\d/.test(searchText.value)
        ) {
            searchText.value = formatStructuredInput(
                searchText.value,
                "identity"
            );
        } else if (moduleName === "medicamentos") {
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
            "list-group-item list-group-item-action sale-stock-option";
        if (medicine.stock_total <= 10) {
            option.classList.add("sale-stock-danger");
            option.style.setProperty(
                "background-color",
                "#f8d7da",
                "important"
            );
            option.style.setProperty(
                "border-left",
                "6px solid #dc3545",
                "important"
            );
            if (medicine.stock_total <= 0) {
                option.classList.add("sale-medicine-agotado");
            }
        } else if (medicine.stock_total <= 30) {
            option.classList.add("sale-stock-warning");
            option.style.setProperty(
                "background-color",
                "#fff0dc",
                "important"
            );
            option.style.setProperty(
                "border-left",
                "6px solid #fd7e14",
                "important"
            );
        } else {
            option.classList.add("sale-stock-normal");
            option.style.setProperty(
                "background-color",
                "#ffffff",
                "important"
            );
            option.style.setProperty(
                "border-left",
                "6px solid #ced8d5",
                "important"
            );
        }

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

function normalizeSearchText(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function filterRecords(searchValue, options) {
    const value = normalizeSearchText(searchValue);

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

            return normalizeSearchText(fieldValue).includes(value);
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
    window.location.replace("index.html");
} else {
    document.getElementById("pageTitle").textContent = config.title;
    document.getElementById("pageDescription").textContent =
        isReadOnlyMedicine
            ? "Consulta del catálogo de medicamentos."
            : config.description;
    document.getElementById("sessionUser").textContent = `${user.nombre} ${user.apellido} - ${user.rol}`;
    if (isReadOnlyMedicine && form) {
        form.closest("section").classList.add("d-none");
    } else if (!isReadOnlyModule) {
        renderForm();
    }
    loadRows();
}

document.getElementById("backButton").addEventListener("click", () => { window.location.href = "index.html"; });
document.getElementById("providersButton")?.addEventListener("click", () => {
    window.location.href = "proveedores.html";
});
document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    ipcRenderer.send("session:clear-user");
    window.location.href = "index.html";
});
document.getElementById("clearButton")?.addEventListener("click", clearForm);
form?.addEventListener("submit", saveRecord);

function showMessage(text, error = false) {
    if (messageTimer) {
        window.clearTimeout(messageTimer);
    }
    message.textContent = text;
    message.className = error ? "alert alert-danger" : "alert alert-success";
    messageTimer = window.setTimeout(() => {
        message.className = "alert d-none";
        messageTimer = null;
    }, 3500);
}

function formatStructuredInput(value, format) {
    const digits = String(value || "").replace(/\D/g, "");
    if (format === "identity") {
        return [
            digits.slice(0, 4),
            digits.slice(4, 8),
            digits.slice(8, 13),
        ].filter(Boolean).join("-");
    }
    if (format === "phone") {
        return [
            digits.slice(0, 4),
            digits.slice(4, 8),
        ].filter(Boolean).join("-");
    }
    return value;
}

// Construye los campos del formulario desde la configuración del módulo activo.
function renderForm() {
    for (const field of config.fields) {
        if (field.hidden) {
            const hiddenInput = document.createElement("input");
            hiddenInput.type = "hidden";
            hiddenInput.id = field.name;
            hiddenInput.name = field.name;
            hiddenInput.value = field.currentUser
                ? user.id_usuario
                : (field.defaultValue ?? "");
            hiddenInput.defaultValue = hiddenInput.value;
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
        } else if (field.type === "medicine-name") {
            input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.autocomplete = "off";
            input.placeholder = "Escriba el nombre o código del medicamento";
        } else if (field.type === "client-dni") {
            input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.placeholder =
                field.placeholder || "Ej. 0706-2000-04500";
        } else if (field.type === "distributor-name") {
            input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.setAttribute("autocomplete", "off");
            input.placeholder = "Escriba o busque el laboratorio";
        } else if (field.type === "textarea") {
            input = document.createElement("textarea");
            input.className = "form-control";
            input.rows = 3;
        } else {
            input = document.createElement("input");
            input.type = field.showPassword ? "text" : (field.type || "text");
            input.className = "form-control";
            if (field.step) input.step = field.step;
            if (field.min !== undefined) input.min = field.min;
            if (field.max !== undefined) input.max = field.max;
            if (field.maxToday) {
                input.max = new Date().toISOString().slice(0, 10);
            }
            if (field.minlength) input.minLength = field.minlength;
        }
        if (field.exactLength) {
            input.minLength = field.exactLength;
            input.maxLength = field.exactLength;
        }
        if (field.type === "date") {
            limitDateYearToFourDigits(input);
        }
        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }
        input.id = field.name;
        input.name = field.name;
        input.required = Boolean(field.required);

        if (field.currentUser) {
            input.value = user.id_usuario;
        }
        if (
            !field.currentUser &&
            field.defaultValue !== undefined
        ) {
            input.value = String(field.defaultValue);
            input.defaultValue = String(field.defaultValue);
            if (field.type === "select" && input.selectedIndex >= 0) {
                input.options[input.selectedIndex].defaultSelected = true;
            }
        }
        // Completa las fechas configuradas con la fecha local actual sin bloquear su edición.
        if (!field.currentUser && field.defaultToday && !input.value) {
            input.value = getLocalDateValue();
            input.defaultValue = input.value;
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
        if (field.type === "distributor-name") {
            group.classList.add("position-relative");
            const suggestionsDiv = document.createElement("div");
            suggestionsDiv.id = "distributorSuggestions";
            suggestionsDiv.className =
                "list-group position-absolute top-100 start-0 end-0 " +
                "mx-3 mt-1 shadow z-3 d-none";
            group.appendChild(suggestionsDiv);
        }

        group.append(label, input);
        if (field.passwordRule) {
            const passwordFeedback = document.createElement("div");
            passwordFeedback.id = `${field.name}Feedback`;
            passwordFeedback.className = "invalid-feedback";
            passwordFeedback.textContent =
                "La contraseña debe tener 8 o más caracteres, incluir una letra mayúscula, un número y un carácter especial.";
            input.setAttribute("aria-describedby", passwordFeedback.id);

            input.addEventListener("blur", () => {
                const value = input.value;
                const isValid =
                    !value ||
                    (value.length >= 8 &&
                        /[A-Z]/.test(value) &&
                        /[0-9]/.test(value) &&
                        /[^A-Za-z0-9]/.test(value));

                input.classList.toggle("is-invalid", !isValid);
            });

            input.addEventListener("input", () => {
                input.classList.remove("is-invalid");
            });
            group.appendChild(passwordFeedback);
        }
        if (field.type === "client-dni") {
            const clientName = document.createElement("div");
            clientName.id = "selectedClientName";
            clientName.className = "form-text fw-semibold";
            group.appendChild(clientName);
        }
        form.appendChild(group);

        if (field.format) {
            input.addEventListener("input", () => {
                input.value = formatStructuredInput(
                    input.value,
                    field.format
                );
            });
        }
    }

    if (moduleName === "ventas") {
        loadNextInvoiceNumber();
        configureAutomaticDiscount();
        configureAutomaticChange();
        createSaleItemsSection();
    }

    if (moduleName === "medicamentos") {
        loadNextMedicineCode();
    }

    if (moduleName === "compras") {
        configureDistributorAutocomplete();
        createQuickDistributorRegistration();
        loadNextPurchaseInvoiceNumber();
    }

    if (moduleName === "lote") {
        configureLotForm();
    }
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
        updateSalesDiscount(false);
    });

    dniInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            updateSalesDiscount(false);
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
        <div class="card quick-client-card overflow-hidden">
            <div class="quick-client-accent" aria-hidden="true"></div>
            <div class="card-body p-4">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <span class="quick-client-icon d-inline-flex align-items-center justify-content-center rounded-circle"
                            aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <circle cx="9" cy="8" r="3"></circle>
                                <path d="M3.5 19a5.5 5.5 0 0 1 11 0"></path>
                                <path d="M18 8v6M15 11h6"></path>
                            </svg>
                        </span>
                        <div>
                            <span class="badge quick-client-badge rounded-pill mb-2">
                                Registro rápido
                            </span>
                            <h3 id="quickClientTitle" class="h5 fw-bold mb-1">Cliente no registrado</h3>
                            <p id="quickClientDescription" class="small text-secondary mb-0">
                                Puede registrarlo sin salir de la venta.
                            </p>
                        </div>
                    </div>
                    <button
                        id="showQuickClientForm"
                        class="btn btn-warning fw-semibold px-3"
                        type="button"
                    >
                        Registrar nuevo cliente
                    </button>
                </div>
                <div id="quickClientFields"
                    class="row g-3 mt-4 pt-3 border-top d-none">
                    <div class="col-12">
                        <p class="small text-secondary mb-0">
                            Los campos marcados con <span class="text-danger">*</span>
                            son obligatorios.
                        </p>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientIdentity">
                            DNI <span class="text-danger">*</span>
                        </label>
                        <input id="quickClientIdentity" class="form-control"
                            type="text" minlength="15" maxlength="15"
                            placeholder="Ej. 0706-2000-04500">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientName">
                            Nombre <span class="text-danger">*</span>
                        </label>
                        <input id="quickClientName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientLastName">
                            Apellido <span class="text-danger">*</span>
                        </label>
                        <input id="quickClientLastName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientPhone">
                            Teléfono <span class="text-danger">*</span>
                        </label>
                        <input id="quickClientPhone" class="form-control"
                            type="text" minlength="9" maxlength="9"
                            placeholder="Ej. 9999-9999">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientBirthDate">
                            Fecha de nacimiento <span class="text-danger">*</span>
                        </label>
                        <input id="quickClientBirthDate" class="form-control" type="date">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickClientEmail">
                            Correo
                        </label>
                        <input id="quickClientEmail" class="form-control" type="email">
                    </div>
                    <div class="col-12">
                        <label class="form-label fw-semibold" for="quickClientAddress">
                            Dirección
                        </label>
                        <input id="quickClientAddress" class="form-control" type="text">
                    </div>
                    <div class="col-12 d-flex flex-wrap justify-content-end gap-2 pt-2">
                        <button
                            id="cancelQuickClient"
                            class="btn btn-outline-secondary px-3"
                            type="button"
                        >
                            Cancelar
                        </button>
                        <button
                            id="saveQuickClient"
                            class="btn btn-success fw-semibold px-4"
                            type="button"
                        >
                            Guardar cliente y continuar venta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const dniGroup = document.getElementById("id_cliente")?.closest("div");
    if (dniGroup) {
        dniGroup.insertAdjacentElement("afterend", container);
    } else {
        form.appendChild(container);
    }

    document
        .getElementById("showQuickClientForm")
        .addEventListener("click", () => {
            document.getElementById("quickClientIdentity").value =
                document.getElementById("id_cliente").value.trim();
            document
                .getElementById("quickClientFields")
                .classList.remove("d-none");
            document
                .getElementById("showQuickClientForm")
                .classList.add("d-none");
        });
    document
        .getElementById("saveQuickClient")
        .addEventListener("click", saveQuickClient);
    document
        .getElementById("cancelQuickClient")
        .addEventListener("click", () => {
            document
                .getElementById("quickClientFields")
                .classList.add("d-none");
            document
                .getElementById("showQuickClientForm")
                .classList.remove("d-none");
        });
    document.getElementById("quickClientIdentity")
        .addEventListener("input", (event) => {
            event.target.value =
                formatStructuredInput(event.target.value, "identity");
        });
    document.getElementById("quickClientPhone")
        .addEventListener("input", (event) => {
            event.target.value =
                formatStructuredInput(event.target.value, "phone");
        });
    document.getElementById("quickClientBirthDate").max =
        new Date().toISOString().slice(0, 10);
}

function toggleQuickClientRegistration(show, mode = "unregistered") {
    const container = document.getElementById(
        "quickClientRegistration"
    );
    if (!container) return;
    const isInactive = mode === "inactive";
    const title = document.getElementById("quickClientTitle");
    const description = document.getElementById("quickClientDescription");
    const actionButton = document.getElementById("showQuickClientForm");
    if (title) {
        title.textContent = isInactive
            ? "Cliente inactivo"
            : "Cliente no registrado";
    }
    if (description) {
        description.textContent = isInactive
            ? "Este cliente no puede utilizarse mientras permanezca inactivo."
            : "Puede registrarlo sin salir de la venta.";
    }
    actionButton?.classList.toggle("d-none", isInactive);
    container.classList.toggle("d-none", !show);
    if (!show) {
        document
            .getElementById("quickClientFields")
            .classList.add("d-none");
        if (!isInactive) {
            actionButton?.classList.remove("d-none");
        }
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
    if (birthDate > new Date().toISOString().slice(0, 10)) {
        showMessage(
            "La fecha de nacimiento no puede ser posterior a la fecha actual.",
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
    const clientName = document.getElementById("selectedClientName");

    if (!dni) {
        if (clientName) {
            clientName.textContent = "";
            clientName.className = "form-text fw-semibold";
        }
        toggleQuickClientRegistration(false);
        form.dataset.discountRate = "0";
        document.getElementById("puntos_disponibles").value = "0";
        calculateSalesTotals();
        return;
    }
    if (dni.length < 15) {
        if (clientName) {
            clientName.textContent = "";
        }
        toggleQuickClientRegistration(false);
        return;
    }

    const [clients] = await db.execute(
        `SELECT nombre, apellido, fecha_nacimiento, puntos_acumulados, estado
         FROM clientes
         WHERE identidad = ?
         LIMIT 1`,
        [dni]
    );

    if (!clients.length) {
        if (clientName) {
            clientName.textContent = "";
            clientName.className = "form-text fw-semibold";
        }
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

    const client = clients[0];
    if (client.estado !== "Activo") {
        if (clientName) {
            clientName.textContent = "Cliente inactivo";
            clientName.className = "form-text fw-semibold text-danger";
        }
        toggleQuickClientRegistration(true, "inactive");
        form.dataset.discountRate = "0";
        document.getElementById("puntos_disponibles").value = "0";
        calculateSalesTotals();
        return;
    }
    if (clientName) {
        clientName.textContent =
            `Cliente: ${client.nombre} ${client.apellido}`;
        clientName.className = "form-text fw-semibold text-success";
    }
    const age = calculateAge(client.fecha_nacimiento);
    toggleQuickClientRegistration(false);
    const rate = getDiscountRate(age);
    form.dataset.discountRate = String(rate);
    document.getElementById("puntos_disponibles").value =
        String(client.puntos_acumulados || 0);

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
        await ensurePresentationStockSchema();
        const [catalogRows] = await db.query(
            `SELECT m.id_medicamento, m.codigo, m.nombre, m.presentacion,
                    m.precio_venta, m.stock_total, m.restriccion,
                    m.estado,
                    mp.id_presentacion,
                    mp.nombre_presentacion,
                    mp.precio_venta AS precio_presentacion,
                    mp.unidades_stock
             FROM medicamentos m
             LEFT JOIN medicamento_presentaciones mp
                ON mp.id_medicamento = m.id_medicamento
               AND mp.estado = 'Activa'
             WHERE m.estado <> 'Inactivo'
             ORDER BY m.nombre, mp.nombre_presentacion`
        );
        const medicines = new Map();
        catalogRows.forEach((row) => {
            if (!medicines.has(row.id_medicamento)) {
                medicines.set(row.id_medicamento, {
                    id_medicamento: row.id_medicamento,
                    codigo: row.codigo,
                    nombre: row.nombre,
                    presentacion_base: row.presentacion,
                    precio_venta: Number(row.precio_venta),
                    stock_total: Number(row.stock_total),
                    restriccion: row.restriccion,
                    estado: row.estado,
                    presentations: [],
                });
            }
            if (row.id_presentacion) {
                medicines.get(row.id_medicamento).presentations.push({
                    id_presentacion: row.id_presentacion,
                    nombre: row.nombre_presentacion,
                    precio: Number(row.precio_presentacion),
                    unidades_stock: Math.max(
                        1,
                        Number(row.unidades_stock) || 1,
                        getPresentationStockUnits(
                            row.nombre_presentacion,
                            row.presentacion
                        )
                    ),
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
        if (medicine.stock_total <= 10) {
            name.style.setProperty("color", "#842029", "important");
        } else if (medicine.stock_total <= 30) {
            name.style.setProperty("color", "#9a4b00", "important");
        }
        name.textContent =
            `${medicine.codigo} - ${medicine.nombre}`;

        const detail = document.createElement("small");
        detail.className = "text-secondary";
        if (medicine.stock_total <= 10) {
            detail.style.setProperty("color", "#842029", "important");
        } else if (medicine.stock_total <= 30) {
            detail.style.setProperty("color", "#8a5a25", "important");
        }
        const prices = medicine.presentations.map(
            (presentation) => presentation.precio
        );
        const startingPrice = prices.length
            ? Math.min(...prices)
            : medicine.precio_venta;
        detail.textContent = medicine.stock_total <= 0
            ? "Agotado"
            : `Stock: ${getMedicineStockDisplay(medicine)} | ` +
              `Desde: L ${startingPrice.toFixed(2)}`;
        if (
            medicine.stock_total > 0 &&
            medicine.restriccion === "Con Receta Medica"
        ) {
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
            ? `Precio seleccionado: L ${presentation.precio.toFixed(2)} | ` +
              `Descuenta ${presentation.unidades_stock} ` +
              `unidad${presentation.unidades_stock === 1 ? "" : "es"} del stock | ` +
              `Disponible: ${getMedicineStockDisplay(
                  medicine,
                  presentation.nombre
              )}`
            : "";
}

function hideMedicineSuggestions() {
    document
        .getElementById("saleMedicineOptions")
        ?.classList.add("d-none");
}

async function addMedicineToSale() {
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
    if (medicine.stock_total <= 0) {
        showMessage(
            `${medicine.nombre}: Agotado.`,
            true
        );
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
    const usedStock = saleItems
        .filter(
            (item) =>
                item.id_medicamento === medicine.id_medicamento
        )
        .reduce((sum, item) => sum + item.cantidad * item.unidades_stock, 0);
    const requestedStock = quantity * presentation.unidades_stock;
    const totalStock = requestedStock + usedStock;

    if (totalStock > medicine.stock_total) {
        const availablePresentations = Math.floor(
            (medicine.stock_total - usedStock) /
            presentation.unidades_stock
        );
        showMessage(
            `Solo hay ${Math.max(0, availablePresentations)} ` +
            `${presentation.nombre.toLocaleLowerCase("es")} disponibles.`,
            true
        );
        return;
    }

    if (
        medicine.restriccion === "Con Receta Medica" &&
        !await confirmControlledMedicine(medicine.nombre)
    ) {
        return;
    }

    if (existing) {
        existing.cantidad += quantity;
        existing.subtotal =
            existing.cantidad * existing.precio_unitario;
    } else {
        saleItems.push({
            id_medicamento: medicine.id_medicamento,
            codigo: medicine.codigo,
            nombre: medicine.nombre,
            id_presentacion: presentation.id_presentacion,
            presentacion: presentation.nombre,
            unidades_stock: presentation.unidades_stock,
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

function confirmControlledMedicine(medicineName) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "controlled-medicine-dialog";
        dialog.innerHTML = `
            <section class="controlled-medicine-card">
                <header class="controlled-medicine-header">
                    <span class="controlled-medicine-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 3 2.8 19h18.4L12 3Z"></path>
                            <path d="M12 9v4M12 16.5h.01"></path>
                        </svg>
                    </span>
                    <span>
                        <span class="controlled-medicine-eyebrow">
                            Venta controlada
                        </span>
                        <strong>Verificación de receta médica</strong>
                    </span>
                </header>
                <div class="controlled-medicine-body">
                    <p>
                        El medicamento <strong data-value="medicine"></strong>
                        requiere receta médica.
                    </p>
                    <div class="controlled-medicine-notice">
                        Confirme únicamente si revisó la receta presentada
                        por el cliente.
                    </div>
                </div>
                <footer class="controlled-medicine-actions">
                    <button data-action="cancel" type="button"
                        class="btn btn-outline-secondary">
                        Volver y corregir
                    </button>
                    <button data-action="confirm" type="button"
                        class="btn btn-warning fw-semibold">
                        Receta verificada
                    </button>
                </footer>
            </section>`;
        dialog.querySelector('[data-value="medicine"]').textContent =
            medicineName;

        let completed = false;
        const finish = (result) => {
            if (completed) return;
            completed = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };
        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => finish(true));
        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) finish(false);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
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
        (
            medicine.stock_total <= 0
                ? " | Agotado"
                : ` | Stock: ${getMedicineStockDisplay(medicine)}`
        ) +
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

// Consulta los registros del módulo actual y actualiza la tabla visual.
async function loadRows() {
    try {
        if (moduleName === "facturas") {
            [rows] = await db.query(
                `SELECT
                    CONCAT('V-', v.id_venta) AS referencia,
                    v.numero_factura,
                    v.fecha_venta AS fecha,
                    CONCAT(u.nombre, ' ', u.apellido) AS responsable,
                    COALESCE(
                        CONCAT(c.nombre, ' ', c.apellido),
                        'Consumidor final'
                    ) AS tercero,
                    v.subtotal,
                    v.descuento,
                    v.impuesto,
                    v.total,
                    v.metodo_pago,
                    v.monto_recibido,
                    v.cambio,
                    v.puntos_generados,
                    v.puntos_utilizados,
                    v.estado
                 FROM ventas v
                 INNER JOIN usuarios u
                    ON v.id_usuario = u.id_usuario
                 LEFT JOIN clientes c
                    ON v.id_cliente = c.id_cliente
                 ORDER BY fecha DESC, numero_factura DESC`
            );
            renderTable();
            showRecordsTable();
            return;
        }

        const fields = config.fields.filter((field) => {
            return field.type !== "password" && !field.virtual;
        });
        const columns = [
            `${config.table}.${config.id}`,
            ...fields.map((field) => `${config.table}.${field.name}`),
        ];
        // El stock se administra mediante lotes, compras y ventas, por lo que no
        // forma parte del formulario de medicamentos. Aun así debe incluirse en
        // la consulta para que las tarjetas muestren el inventario real.
        if (moduleName === "medicamentos") {
            columns.push("medicamentos.stock_total");
        }

        const usesClientDni = moduleName === "ventas";
        const usesDistributor = moduleName === "compras";
        const usesLotMedicine = moduleName === "lote";
        let join = "";
        if (usesClientDni) {
            join = `LEFT JOIN clientes
                    ON ${config.table}.id_cliente = clientes.id_cliente`;
        } else if (usesDistributor) {
            join = `LEFT JOIN distribuidores
                    ON compras.id_distribuidor =
                         distribuidores.id_distribuidor`;
        } else if (usesLotMedicine) {
            join = `LEFT JOIN medicamentos
                    ON lote.id_medicamento =
                         medicamentos.id_medicamento`;
        }
        const clientIdentity = usesClientDni
            ? `, clientes.identidad AS identidad_cliente,
                 COALESCE(
                    CONCAT(clientes.nombre, ' ', clientes.apellido),
                    'Consumidor final'
                 ) AS nombre_cliente`
            : "";
        const distributorName = usesDistributor
            ? ", distribuidores.nombre AS nombre_distribuidor"
            : "";
        const lotMedicineName = usesLotMedicine
            ? `, medicamentos.nombre AS nombre_medicamento,
                medicamentos.laboratorio AS laboratorio`
            : "";

        [rows] = await db.query(
            `SELECT ${columns.join(", ")}${clientIdentity}
                    ${distributorName}${lotMedicineName}
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

    if (moduleName === "medicamentos") {
        renderCardGrid(records);
        return;
    }

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
            !field.hideInTable &&
            (!field.name.startsWith("id_") || field.showInTable)
        );
    });

    if (moduleName === "clientes") {
        fields.unshift({
            name: config.id,
            label: "ID Cliente",
        });
    }
    if (moduleName === "ventas") {
        const dniIndex = fields.findIndex(
            (field) => field.name === "id_cliente"
        );
        fields.splice(dniIndex + 1, 0, {
            name: "nombre_cliente",
            label: "Nombre del cliente",
        });
    }
    if (moduleName === "lote") {
        const medicineIndex = fields.findIndex(
            (field) => field.name === "id_medicamento"
        );
        fields.splice(medicineIndex + 1, 0, {
            name: "laboratorio",
            label: "Laboratorio",
        });
    }

    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";
    const header = table.createTHead().insertRow();
    header.className = "table-success";
    fields.forEach((field) => { 
        const th = document.createElement("th"); 
        th.textContent = field.label; 
        header.appendChild(th); 
    });
    if (moduleName === "facturas") {
        const invoiceHeader = document.createElement("th");
        invoiceHeader.textContent = "Factura";
        header.appendChild(invoiceHeader);
    }
    
    if (
        !isReadOnlyMedicine &&
        !isImmutablePurchase &&
        !isImmutableLot &&
        !isReadOnlyModule
    ) {
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
            const invoiceMoneyFields = [
                "subtotal",
                "descuento",
                "impuesto",
                "total",
                "monto_recibido",
                "cambio",
            ];
            const value =
                moduleName === "facturas" &&
                invoiceMoneyFields.includes(field.name)
                ? `L ${Number(row[column] || 0).toFixed(2)}`
                : formatValue(row[column]);
            tr.insertCell().textContent = value;
        });
        if (moduleName === "facturas") {
            const invoiceCell = tr.insertCell();
            const invoiceButton = document.createElement("button");
            invoiceButton.type = "button";
            invoiceButton.className = "btn btn-outline-success btn-sm";
            invoiceButton.textContent = "Generar factura";
            invoiceButton.addEventListener("click", () => {
                const id = moduleName === "ventas"
                    ? row[config.id]
                    : Number(
                        String(row.referencia || "").replace("V-", "")
                    );
                openInvoiceDocument(id);
            });
            invoiceCell.appendChild(invoiceButton);
        }
        if (
            !isReadOnlyMedicine &&
            !isImmutablePurchase &&
            !isImmutableLot &&
            !isReadOnlyModule
        ) {
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

/*=============================================
FUNCION PARA EL MODO TRAJETA EN MEDICAMENTOS
===============================================*/
// ====== GRID MODERNO DE MEDICAMENTOS (SIN TOOLTIP FLOTANTE) ======
function renderCardGrid(records = rows) {
    tableContainer.replaceChildren();

    if (!records.length) {
        tableContainer.innerHTML = `
            <div class="text-center text-secondary py-5">
                No hay medicamentos registrados.
            </div>
        `;
        return;
    }

    // CSS una sola vez
    if (!document.getElementById("medicine-card-styles")) {
        const style = document.createElement("style");
        style.id = "medicine-card-styles";
        style.textContent = `
            .medicine-grid{
                display:grid;
                grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
                gap:18px;
                padding:16px;
            }

            .medicine-card{
                position:relative;
                background:#fff;
                border:none;
                border-radius:24px;
                padding:18px;
                min-height:150px;
                cursor:pointer;
                transition:all .28s ease;
                box-shadow:0 6px 18px rgba(13,110,253,.08);
                overflow:hidden;
            }

            .medicine-card:hover{
                transform:translateY(-4px);
                box-shadow:0 16px 34px rgba(13,110,253,.18);
                min-height:270px;
            }

            .medicine-code{
                font-size:.75rem;
                font-weight:700;
                color:#64748b;
                margin-bottom:10px;
            }

            .medicine-name{
                font-size:1.05rem;
                font-weight:800;
                color:#111827;
                line-height:1.2;
                margin-bottom:6px;
                display:-webkit-box;
                -webkit-line-clamp:2;
                -webkit-box-orient:vertical;
                overflow:hidden;
            }

            .medicine-category{
                font-size:.78rem;
                color:#94a3b8;
                margin-bottom:16px;
            }

            .stock-bar{
                position:absolute;
                left:18px;
                right:18px;
                bottom:14px;
                height:8px;
                border-radius:999px;
                background:#e5e7eb;
                overflow:hidden;
            }

            .stock-fill{
                height:100%;
                border-radius:999px;
                transition:width .3s ease;
            }

            .stock-red{ background:#ef4444; }
            .stock-yellow{ background:#f59e0b; }
            .stock-green{ background:#22c55e; }

            /* INFO QUE APARECE AL PASAR EL MOUSE */
            .medicine-details{
                margin-top:18px;
                padding-top:14px;
                border-top:1px solid #eef2f7;
                opacity:0;
                max-height:0;
                overflow:hidden;
                transform:translateY(8px);
                transition:all .25s ease;
            }

            .medicine-card:hover .medicine-details{
                opacity:1;
                max-height:200px;
                transform:translateY(0);
            }

            .tooltip-row{
                display:flex;
                justify-content:space-between;
                gap:10px;
                font-size:.82rem;
                margin-bottom:8px;
            }

            .tooltip-label{
                color:#64748b;
            }

            .tooltip-value{
                color:#0f172a;
                font-weight:700;
                text-align:right;
            }

            .tooltip-actions{
                display:flex;
                gap:8px;
                margin-top:14px;
            }

            .tooltip-btn{
                flex:1;
                border:none;
                border-radius:10px;
                padding:8px 10px;
                font-size:.8rem;
                font-weight:700;
                cursor:pointer;
                transition:all .2s ease;
            }

            .tooltip-btn.edit{
                background:#ecfdf5;
                color:#047857;
            }

            .tooltip-btn.edit:hover{
                background:#d1fae5;
            }

            .tooltip-btn.delete{
                background:#fef2f2;
                color:#b91c1c;
            }

            .tooltip-btn.delete:hover{
                background:#fee2e2;
            }

            @media (max-width:768px){
                .medicine-grid{
                    grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
                }
            }
        `;
        document.head.appendChild(style);
    }

    const grid = document.createElement("div");
    grid.className = "medicine-grid";

    records.forEach((row) => {

        // STOCK
        const stock = Number(row.stock_total || row.stock || 0);

        let colorClass = "stock-green";
        if (stock <= 10) colorClass = "stock-red";
        else if (stock <= 30) colorClass = "stock-yellow";

        const width = Math.min(Math.max(stock, 5), 100);

        const estadoColor = row.estado === "Inactivo"
            ? "#dc2626"
            : "#059669";

        const card = document.createElement("div");
        card.className = "medicine-card";

        card.innerHTML = `
            <div class="medicine-code">${row.codigo || "---"}</div>

            <div class="medicine-name">
                ${row.nombre || "Sin nombre"}
            </div>

            <div class="medicine-category">
                ${row.categoria || "Sin categoría"}
            </div>

            <div class="medicine-details">

                <div class="tooltip-row">
                    <span class="tooltip-label">Stock</span>
                    <span class="tooltip-value">${stock} unidades</span>
                </div>

                <div class="tooltip-row">
                    <span class="tooltip-label">Presentación</span>
                    <span class="tooltip-value">${row.presentacion || "No definida"}</span>
                </div>

                <div class="tooltip-row">
                    <span class="tooltip-label">Estado</span>
                    <span class="tooltip-value" style="color:${estadoColor}">
                        ${row.estado || "Disponible"}
                    </span>
                </div>

                <div class="tooltip-actions">
                    <button class="tooltip-btn edit">Editar</button>
                    <button class="tooltip-btn delete">Eliminar</button>
                </div>

            </div>

            <div class="stock-bar">
                <div class="stock-fill ${colorClass}"
                     style="width:${width}%"></div>
            </div>
        `;

        // Botón editar
        card.querySelector(".edit").addEventListener("click", (e) => {
            e.stopPropagation();
            editRecord(row);
        });

        // Botón eliminar
        card.querySelector(".delete").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteRecord(row[config.id]);
        });

        grid.appendChild(card);
    });

    tableContainer.appendChild(grid);
}
/*=============================================
TERMINAR FUNCION PARA EL MODO TRAJETA EN MEDICAMENTOS
===============================================*/
function openInvoiceDocument(saleId) {
    if (!Number.isInteger(Number(saleId)) || Number(saleId) <= 0) {
        showMessage("No se pudo identificar la factura.", true);
        return;
    }
    window.open(
        `factura_documento.html?id=${encodeURIComponent(saleId)}`,
        "_blank",
        "width=520,height=860"
    );
}

function showInvoiceReadyMessage(saleId) {
    if (messageTimer) {
        window.clearTimeout(messageTimer);
        messageTimer = null;
    }
    message.className = "alert d-none";

    const dialog = document.createElement("dialog");
    dialog.className = "invoice-ready-dialog";
    dialog.innerHTML = `
        <section class="invoice-ready-card">
            <div class="invoice-ready-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="m7 12 3 3 7-7"></path>
                </svg>
            </div>
            <span class="invoice-ready-eyebrow">Venta completada</span>
            <h2>Venta guardada correctamente</h2>
            <p>
                La venta fue registrada y el inventario fue actualizado.
                Puede generar la factura ahora.
            </p>
            <div class="invoice-ready-actions">
                <button data-action="close" type="button"
                    class="btn btn-outline-secondary">
                    Continuar sin factura
                </button>
                <button data-action="invoice" type="button"
                    class="btn btn-success fw-semibold">
                    Generar factura
                </button>
            </div>
        </section>`;

    const closeDialog = () => {
        dialog.close();
        dialog.remove();
    };
    dialog.querySelector('[data-action="close"]')
        .addEventListener("click", closeDialog);
    dialog.querySelector('[data-action="invoice"]')
        .addEventListener("click", () => {
            closeDialog();
            openInvoiceDocument(saleId);
        });
    dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeDialog();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
}

function confirmSaleData(details) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "sale-confirm-dialog";
        dialog.innerHTML = `
            <form method="dialog" class="sale-confirm-card">
                <header class="sale-confirm-header">
                    <span class="sale-confirm-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"></path>
                            <path d="M8 8h8M8 12h5"></path>
                        </svg>
                    </span>
                    <span>
                        <span class="sale-confirm-eyebrow">Confirmar venta</span>
                        <strong>Verifique los datos</strong>
                    </span>
                </header>
                <div class="sale-confirm-body">
                    <p class="text-secondary mb-3">
                        Revise la información antes de registrar la venta.
                    </p>
                    <div class="sale-confirm-client">
                        <span>Cliente</span>
                        <span class="sale-confirm-client-data">
                            <strong data-value="client"></strong>
                            <small data-value="dni"></small>
                        </span>
                    </div>
                    <dl class="sale-confirm-summary">
                        <div><dt>Método de pago</dt>
                            <dd data-value="paymentMethod"></dd></div>
                        <div><dt>Monto recibido</dt>
                            <dd data-value="received"></dd></div>
                        <div><dt>Cambio</dt>
                            <dd data-value="change"></dd></div>
                        <div><dt>Puntos utilizados</dt>
                            <dd data-value="usedPoints"></dd></div>
                    </dl>
                    <div class="sale-confirm-total">
                        <span>Total a pagar</span>
                        <strong data-value="total"></strong>
                    </div>
                </div>
                <footer class="sale-confirm-actions">
                    <button data-action="cancel" type="button"
                        class="btn btn-outline-secondary">
                        Volver y corregir
                    </button>
                    <button data-action="confirm" type="button"
                        class="btn btn-success fw-semibold">
                        Confirmar y registrar
                    </button>
                </footer>
            </form>`;

        const money = (value) => `L ${Number(value || 0).toFixed(2)}`;
        const setValue = (name, value) => {
            dialog.querySelector(`[data-value="${name}"]`).textContent =
                value;
        };
        setValue("client", details.client);
        setValue("dni", `DNI: ${details.dni}`);
        setValue("paymentMethod", details.paymentMethod);
        setValue("received", money(details.received));
        setValue("change", money(details.change));
        setValue("usedPoints", String(details.usedPoints));
        setValue("total", money(details.total));

        let completed = false;
        const finish = (result) => {
            if (completed) return;
            completed = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };
        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => finish(true));
        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) finish(false);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

function confirmLotData(details) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "sale-confirm-dialog";
        dialog.innerHTML = `
            <form method="dialog" class="sale-confirm-card">
                <header class="sale-confirm-header">
                    <span class="sale-confirm-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"></path>
                            <path d="M8 8h8M8 12h5"></path>
                        </svg>
                    </span>
                    <span>
                        <span class="sale-confirm-eyebrow">Confirmar lote</span>
                        <strong>Verifique los datos</strong>
                    </span>
                </header>
                <div class="sale-confirm-body">
                    <p class="text-secondary mb-3">
                        Revise la información antes de registrar el lote.
                    </p>
                    <div class="sale-confirm-client">
                        <span>Medicamento</span>
                        <span class="sale-confirm-client-data">
                            <strong data-value="medicine"></strong>
                            <small data-value="code"></small>
                        </span>
                    </div>
                    <dl class="sale-confirm-summary">
                        <div><dt>Número de lote</dt>
                            <dd data-value="lotNumber"></dd></div>
                        <div><dt>Cantidad a ingresar</dt>
                            <dd data-value="quantity"></dd></div>
                        <div><dt>Fecha de fabricación</dt>
                            <dd data-value="manufactureDate"></dd></div>
                        <div><dt>Fecha de vencimiento</dt>
                            <dd data-value="expirationDate"></dd></div>
                        <div><dt>Precio de compra</dt>
                            <dd data-value="purchasePrice"></dd></div>
                        <div><dt>Formas de venta</dt>
                            <dd data-value="presentations"></dd></div>
                    </dl>
                    <div class="sale-confirm-total">
                        <span>Precio de compra total</span>
                        <strong data-value="total"></strong>
                    </div>
                </div>
                <footer class="sale-confirm-actions">
                    <button data-action="cancel" type="button"
                        class="btn btn-outline-secondary">
                        Volver y corregir
                    </button>
                    <button data-action="confirm" type="button"
                        class="btn btn-success fw-semibold">
                        Confirmar y registrar
                    </button>
                </footer>
            </form>`;

        const money = (value) => `L ${Number(value || 0).toFixed(2)}`;
        const setValue = (name, value) => {
            dialog.querySelector(`[data-value="${name}"]`).textContent =
                value;
        };
        setValue("medicine", details.medicine);
        setValue("code", `Código: ${details.code}`);
        setValue("lotNumber", details.lotNumber);
        setValue("quantity", String(details.quantity));
        setValue("manufactureDate", details.manufactureDate);
        setValue("expirationDate", details.expirationDate);
        setValue("purchasePrice", money(details.purchasePrice));
        setValue("presentations", details.presentations);
        setValue("total", money(details.total));

        let completed = false;
        const finish = (result) => {
            if (completed) return;
            completed = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };
        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => finish(true));
        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) finish(false);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

// Muestra la misma confirmación visual para registros que no requieren un flujo especial.
function confirmRecordData(details) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "sale-confirm-dialog";
        dialog.innerHTML = `
            <form method="dialog" class="sale-confirm-card">
                <header class="sale-confirm-header">
                    <span class="sale-confirm-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"></path>
                            <path d="M8 8h8M8 12h5"></path>
                        </svg>
                    </span>
                    <span>
                        <span class="sale-confirm-eyebrow" data-value="title"></span>
                        <strong>Verifique los datos</strong>
                    </span>
                </header>
                <div class="sale-confirm-body">
                    <p class="text-secondary mb-3" data-value="description"></p>
                    <div class="sale-confirm-client">
                        <span data-value="subjectLabel"></span>
                        <span class="sale-confirm-client-data">
                            <strong data-value="subject"></strong>
                            <small data-value="secondary"></small>
                        </span>
                    </div>
                    <dl class="sale-confirm-summary"></dl>
                    <div class="sale-confirm-total d-none">
                        <span data-value="totalLabel"></span>
                        <strong data-value="total"></strong>
                    </div>
                </div>
                <footer class="sale-confirm-actions">
                    <button data-action="cancel" type="button"
                        class="btn btn-outline-secondary">Volver y corregir</button>
                    <button data-action="confirm" type="button"
                        class="btn btn-success fw-semibold">Confirmar y registrar</button>
                </footer>
            </form>`;

        const setValue = (name, value) => {
            dialog.querySelector(`[data-value="${name}"]`).textContent =
                value || "No registrado";
        };
        setValue("title", details.title);
        setValue("description", details.description);
        setValue("subjectLabel", details.subjectLabel);
        setValue("subject", details.subject);
        setValue("secondary", details.secondary);

        const summary = dialog.querySelector(".sale-confirm-summary");
        details.fields.forEach(({ label, value }) => {
            const item = document.createElement("div");
            const term = document.createElement("dt");
            const definition = document.createElement("dd");
            term.textContent = label;
            definition.textContent = value || "No registrado";
            item.append(term, definition);
            summary.appendChild(item);
        });

        if (details.total) {
            const total = dialog.querySelector(".sale-confirm-total");
            total.classList.remove("d-none");
            setValue("totalLabel", details.total.label);
            setValue("total", details.total.value);
        }

        let completed = false;
        const finish = (result) => {
            if (completed) return;
            completed = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };
        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => finish(true));
        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) finish(false);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

function formatValue(value) {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(text)
        ? text.slice(0, 10)
        : text;
}

function formatDate(value) {
    if (value == null) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(text)
        ? text.slice(0, 10)
        : text;
}

async function loadNextMedicineCode() {
    const codigoInput = document.getElementById("codigo");
    if (!codigoInput || editingId !== null) return;
    try {
        const [result] = await db.execute(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo, 4) AS UNSIGNED)), 0) + 1 AS siguiente
             FROM medicamentos
             WHERE codigo LIKE 'MED%'`
        );
        codigoInput.value =
            "MED" + String(result[0].siguiente).padStart(3, "0");
    } catch (error) {
        console.error("No se pudo generar el código del medicamento:", error);
    }
}

function getData() {
    const data = {};

    // Si estamos en el módulo de medicamentos, generamos el código consecutivo automáticamente si está vacío
    if (moduleName === "medicamentos") {
        const codigoInput = document.getElementById("codigo");
        if (codigoInput && !codigoInput.value.trim()) {
            // Buscamos en la tabla de la interfaz el último código o generamos el siguiente consecutivo basado en los elementos actuales
            const rows = document.querySelectorAll("table tbody tr");
            let nextNumber = 1;
            
            if (rows.length > 0) {
                // Intentamos extraer el número del primer código visible en la tabla
                const firstCodeCell = rows[0].querySelector("td");
                if (firstCodeCell) {
                    const match = firstCodeCell.textContent.trim().match(/MED(\d+)/i);
                    if (match) {
                        nextNumber = parseInt(match[1], 10) + 1;
                    }
                }
            }
            
            // Formateamos con ceros a la izquierda para que quede exactamente como MED021, MED022, etc.
            codigoInput.value = "MED" + String(nextNumber).padStart(3, '0');
        }
    }

    config.fields.forEach((field) => {
        if (field.virtual) {
            return;
        }

        const element = document.getElementById(field.name);
        if (!element) return;

        const value = element.value.trim();
        if (field.required && !value && !(editingId !== null && field.type === "password")) throw new Error(`Complete el campo: ${field.label}`);
        if (
            value &&
            field.exactLength &&
            value.length !== field.exactLength
        ) {
            throw new Error(
                `${field.label} debe tener exactamente ` +
                `${field.exactLength} caracteres.`
            );
        }

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

// Valida y guarda el formulario; incluye flujos especiales de ventas, compras y lotes.
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
            const confirmed = await confirmRecordData({
                title: "Confirmar compra",
                description:
                    "Revise la información antes de registrar la compra.",
                subjectLabel: "Proveedor",
                subject: data.id_distribuidor,
                secondary: document.getElementById("correo_distribuidor")
                    ?.value.trim(),
                fields: [
                    { label: "Fecha de compra", value: data.fecha_compra },
                    { label: "Método de pago", value: data.metodo_pago },
                    { label: "Condición", value: data.estado },
                    {
                        label: "Teléfono",
                        value: document.getElementById("telefono_distribuidor")
                            ?.value.trim(),
                    },
                ],
                total: {
                    label: "Total de la compra",
                    value: `L ${Number(data.total || 0).toFixed(2)}`,
                },
            });
            if (!confirmed) return;
            await savePurchaseWithLot(data);
            showMessage(
                "Compra, lote e inventario registrados correctamente."
            );
            clearForm();
            await loadRows();
            return;
        }

        if (moduleName === "lote") {
            const lotDetails = validateLotData(data);
            const confirmed = await confirmLotData({
                medicine: selectedLotMedicine.nombre,
                code: selectedLotMedicine.codigo,
                lotNumber: data.numero_lote,
                quantity: lotDetails.quantity,
                manufactureDate: data.fecha_fabricacion,
                expirationDate: data.fecha_vencimiento,
                purchasePrice: lotDetails.purchasePrice,
                presentations: lotDetails.presentations
                    .map((item) => item.nombre)
                    .join(", "),
                total: lotDetails.quantity * lotDetails.purchasePrice,
            });
            if (!confirmed) {
                return;
            }
            await saveLotTransaction(data);
            showMessage("Lote e inventario registrados correctamente.");
            clearForm();
            await loadRows();
            return;
        }

        if (moduleName === "usuarios" && editingId === null) {
            const confirmed = await confirmRecordData({
                title: "Confirmar usuario",
                description:
                    "Revise la información antes de registrar el usuario.",
                subjectLabel: "Usuario",
                subject: `${data.nombre} ${data.apellido}`.trim(),
                secondary: data.nombre_usuario,
                fields: [
                    { label: "Identidad", value: data.identidad },
                    { label: "Correo", value: data.correo },
                    { label: "Teléfono", value: data.telefono },
                    { label: "Rol", value: data.rol },
                    { label: "Estado", value: data.estado || "Activo" },
                ],
            });
            if (!confirmed) return;
        }

        const clientDniField = config.fields.find(
            (field) => field.type === "client-dni"
        );

        let selectedClient = null;

        if (clientDniField && data.id_cliente) {
            const [clients] = await db.execute(
                `SELECT id_cliente, nombre, apellido, identidad,
                        fecha_nacimiento, puntos_acumulados
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

            const receivedAmount = Number(data.monto_recibido || 0);
            if (
                !Number.isFinite(receivedAmount) ||
                receivedAmount < data.total
            ) {
                throw new Error(
                    "El monto recibido no puede ser menor " +
                    "que el total a pagar."
                );
            }

            const clientLabel = selectedClient
                ? `${selectedClient.nombre} ${selectedClient.apellido}`
                : "Consumidor final";
            const confirmed = await confirmSaleData({
                client: clientLabel,
                dni: selectedClient?.identidad || "No registrado",
                total: data.total,
                paymentMethod: data.metodo_pago,
                received: receivedAmount,
                change: Number(data.cambio || 0),
                usedPoints,
            });
            if (!confirmed) {
                return;
            }

            const isNewSale = editingId === null;
            const savedSaleId = await saveSaleTransaction(data);
            clearForm();
            await loadRows();
            if (isNewSale) {
                showInvoiceReadyMessage(savedSaleId);
            } else {
                showMessage("Venta actualizada correctamente.");
            }
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
        if (moduleName === "clientes" && error?.code === "ER_DUP_ENTRY") {
            showMessage(
                "Cliente ya registrado. La identidad ingresada ya existe.",
                true
            );
            return;
        }
        showMessage(error.message, true);
    }
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

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

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
                [data.stock_total || 0, medicineId]
            );
        } else {
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

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
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
                    document.getElementById("telefono_distribuidor")?.value.trim() || null,
                    document.getElementById("correo_distribuidor")?.value.trim() || null,
                ]
            );
            distributorId = result.insertId;
        }

        data.id_distribuidor = distributorId;
        
        delete data.cantidad;
        delete data.precio_unitario;
    
        const columns = Object.keys(data);
        await connection.execute(
            `INSERT INTO compras
                (${columns.join(", ")})
             VALUES
                (${columns.map(() => "?").join(", ")})`,
            Object.values(data)
        );

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
                `SELECT dv.id_medicamento, dv.cantidad, dv.presentacion,
                        m.presentacion AS presentacion_base,
                        mp.unidades_stock
                 FROM detalles_venta dv
                 INNER JOIN medicamentos m
                    ON m.id_medicamento = dv.id_medicamento
                 LEFT JOIN medicamento_presentaciones mp
                    ON mp.id_presentacion = dv.id_presentacion
                 WHERE id_venta = ?`,
                [editingId]
            );

            for (const item of oldItems) {
                const restoredStock = item.cantidad * Math.max(
                    Number(item.unidades_stock) || 1,
                    getPresentationStockUnits(
                        item.presentacion,
                        item.presentacion_base
                    )
                );
                await connection.execute(
                    `UPDATE medicamentos
                     SET stock_total = stock_total + ?,
                         estado = 'Disponible'
                     WHERE id_medicamento = ?`,
                    [restoredStock, item.id_medicamento]
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
                        sum + saleItem.cantidad * saleItem.unidades_stock,
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
                    item.cantidad * item.unidades_stock,
                    item.cantidad * item.unidades_stock,
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
        return saleId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Carga el registro seleccionado en el formulario para su actualización.
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
                    m.nombre, m.restriccion, m.presentacion AS presentacion_base,
                    dv.cantidad,
                    dv.id_presentacion, dv.presentacion,
                    dv.precio_unitario, dv.subtotal, mp.unidades_stock
             FROM detalles_venta dv
             INNER JOIN medicamentos m
                ON dv.id_medicamento = m.id_medicamento
             LEFT JOIN medicamento_presentaciones mp
                ON mp.id_presentacion = dv.id_presentacion
             WHERE dv.id_venta = ?`,
            [editingId]
        );

        saleItems = details.map((item) => ({
            ...item,
            cantidad: Number(item.cantidad),
            unidades_stock: Math.max(
                Number(item.unidades_stock) || 1,
                getPresentationStockUnits(
                    item.presentacion,
                    item.presentacion_base
                )
            ),
            precio_unitario: Number(item.precio_unitario),
            subtotal: Number(item.subtotal),
        }));
        renderSaleItems();
        updateSalesDiscount(false);
    }

    saveButton.textContent = "Actualizar";
    if (moduleName === "medicamentos") {
        saveButton.classList.remove("d-none");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Solicita confirmación y elimina el registro o revierte una venta si corresponde.
async function deleteRecord(id) {
    if (isReadOnlyMedicine) {
        showMessage(
            "El Cajero no puede eliminar medicamentos.",
            true
        );
        return;
    }
    if (!(await confirmDeleteRecord())) return;
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

function confirmDeleteRecord() {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "delete-confirm-dialog";
        dialog.innerHTML = `
            <section class="delete-confirm-card">
                <header class="delete-confirm-header">
                    <span class="delete-confirm-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"></path>
                            <path d="M10 11v5M14 11v5"></path>
                        </svg>
                    </span>
                    <span>
                        <span class="delete-confirm-eyebrow">
                            Confirmar eliminaci&oacute;n
                        </span>
                        <strong>&iquest;Eliminar este registro?</strong>
                    </span>
                </header>
                <div class="delete-confirm-body">
                    <p>Esta acci&oacute;n quitar&aacute; el registro seleccionado.</p>
                    <small>Puede cancelar para conservar la informaci&oacute;n.</small>
                </div>
                <footer class="delete-confirm-actions">
                    <button data-action="cancel" type="button"
                        class="btn btn-outline-secondary">Cancelar</button>
                    <button data-action="confirm" type="button"
                        class="btn btn-danger fw-semibold">S&iacute;, eliminar</button>
                </footer>
            </section>`;

        let completed = false;
        const finish = (result) => {
            if (completed) return;
            completed = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };

        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => finish(true));
        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) finish(false);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
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
            `SELECT dv.id_medicamento, dv.cantidad, dv.presentacion,
                    m.presentacion AS presentacion_base,
                    mp.unidades_stock
             FROM detalles_venta dv
             INNER JOIN medicamentos m
                ON m.id_medicamento = dv.id_medicamento
             LEFT JOIN medicamento_presentaciones mp
                ON mp.id_presentacion = dv.id_presentacion
             WHERE id_venta = ?`,
            [id]
        );

        for (const item of items) {
            const restoredStock = item.cantidad * Math.max(
                Number(item.unidades_stock) || 1,
                getPresentationStockUnits(
                    item.presentacion,
                    item.presentacion_base
                )
            );
            await connection.execute(
                `UPDATE medicamentos
                 SET stock_total = stock_total + ?,
                     estado = 'Disponible'
                 WHERE id_medicamento = ?`,
                [restoredStock, item.id_medicamento]
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
    form.querySelectorAll(".is-invalid").forEach((input) => {
        input.classList.remove("is-invalid");
    });
    editingId = null;
    saveButton.textContent = "Guardar";
    if (moduleName === "medicamentos") {
        saveButton.classList.add("d-none");
    }
    
    const password = config.fields.find((field) => field.type === "password");
    if (password) {
        document.getElementById(password.name).required = Boolean(password.required);
    }

    config.fields
        .filter((field) => field.currentUser)
        .forEach((field) => {
            const input = document.getElementById(field.name);
            if (input) {
                input.value = user.id_usuario;
            }
        });

    if (moduleName === "ventas") {
        saleItems = [];
        selectedSaleMedicineId = null;
        form.dataset.discountRate = "0";
        const puntosDisponibles = document.getElementById("puntos_disponibles");
        if (puntosDisponibles) puntosDisponibles.value = "0";
        
        toggleQuickClientRegistration(false);
        resetSalePresentation();
        renderSaleItems();
        loadSaleMedicineCatalog();
        loadNextInvoiceNumber();
    }
    if (moduleName === "compras") {
        toggleQuickDistributorRegistration(false);
        loadNextPurchaseInvoiceNumber();
    }

    if (moduleName === "medicamentos") {
        loadNextMedicineCode();
    }

    if (moduleName === "lote") {
        selectedLotMedicine = null;
        toggleQuickMedicineRegistration(false);
        document.getElementById("lotPresentations")?.replaceChildren();
        loadLotMedicineCatalog().then(() => {
            renderLotMedicineOptions();
            document.getElementById("lotMedicineOptions")
                ?.classList.add("d-none");
            renderQuickMedicineLaboratoryOptions();
        });
        loadNextLotNumber();
    }
}

async function configureLotForm() {
    const medicineInput = document.getElementById("id_medicamento");
    const quantityInput = document.getElementById("cantidad_inicial");
    const purchasePriceInput = document.getElementById("precio_compra");
    const manufactureDateInput =
        document.getElementById("fecha_fabricacion");
    const expirationDateInput =
        document.getElementById("fecha_vencimiento");
    if (!medicineInput || !quantityInput || !purchasePriceInput) return;

    if (manufactureDateInput) {
        limitDateYearToFourDigits(manufactureDateInput);
        manufactureDateInput.title =
            "La fecha tiene que ser inferior a la actual.";
        const validateManufactureDate = () => validateCompletedLotDate(
            manufactureDateInput,
            (value, today) => value >= today,
            "La fecha de fabricación tiene que ser inferior a la actual."
        );
        manufactureDateInput.addEventListener(
            "input",
            validateManufactureDate
        );
        manufactureDateInput.addEventListener(
            "change",
            validateManufactureDate
        );
    }
    if (expirationDateInput) {
        limitDateYearToFourDigits(expirationDateInput);
        expirationDateInput.title =
            "La fecha tiene que ser superior a la actual.";
        const validateExpirationDate = () => validateCompletedLotDate(
            expirationDateInput,
            (value, today) => value <= today,
            "La fecha de vencimiento tiene que ser superior a la actual."
        );
        expirationDateInput.addEventListener(
            "input",
            validateExpirationDate
        );
        expirationDateInput.addEventListener(
            "change",
            validateExpirationDate
        );
    }

    medicineInput.removeAttribute("list");
    const medicineGroup = medicineInput.closest("div");
    medicineGroup.classList.add("position-relative");
    let options = document.getElementById("lotMedicineOptions");
    if (!options) {
        options = document.createElement("div");
        options.id = "lotMedicineOptions";
        options.className = "lot-dropdown d-none";
        medicineGroup.appendChild(options);
    }

    const presentationsGroup =
        document.getElementById("formas_venta")?.closest("div");
    if (presentationsGroup) {
        presentationsGroup.innerHTML = `
            <label class="form-label fw-semibold">Formas de Venta y Precios</label>
            <div class="row g-2 mb-3">
                <div id="lotBoxBlistersField" class="col-12 col-md-4 d-none">
                    <label class="form-label">Blísteres por caja</label>
                    <input id="lotBlistersPerBox" class="form-control"
                        type="number" min="1" step="1" value="1">
                </div>
                <div id="lotBoxUnitsField" class="col-12 col-md-4 d-none">
                    <label class="form-label">Unidades por blíster</label>
                    <input id="lotUnitsPerBlister" class="form-control"
                        type="number" min="1" step="1" value="1">
                </div>
                <div class="col-12 col-md-4">
                    <label class="form-label">Presentación que ingresa</label>
                    <select id="lotEntryPresentation"
                        class="form-select" required>
                        <option value="">Seleccione...</option>
                        <option value="Caja">Caja</option>
                        <option value="Ampolla">Ampolla</option>
                        <option value="Suero">Suero</option>
                        <option value="Frasco">Frasco</option>
                    </select>
                </div>
                <div id="lotSingleSalePriceField"
                    class="col-12 col-md-4 d-none">
                    <label class="form-label" for="lotSingleSalePrice">
                        Precio de venta
                    </label>
                    <input id="lotSingleSalePrice" class="form-control"
                        type="number" min="0.01" step="0.01"
                        placeholder="Precio de venta">
                </div>
            </div>
            <div id="lotPresentations" class="row g-2 d-none"></div>
            <button id="addLotPresentation" type="button"
                class="btn btn-outline-success btn-sm mt-2 d-none">
                Agregar forma de venta
            </button>`;
        document.getElementById("addLotPresentation")
            .addEventListener("click", () => addLotPresentationRow());
        ["lotBlistersPerBox", "lotUnitsPerBlister"].forEach((id) => {
            document.getElementById(id).addEventListener(
                "input",
                updateLotPresentationConversions
            );
        });
        document.getElementById("lotEntryPresentation").addEventListener(
            "change",
            () => {
                toggleLotBoxOptions();
                updateLotSingleSalePrice();
                updateLotDisplayedStock();
                updateLotConversionSummary();
            }
        );
    }

    createQuickMedicineRegistration();
    medicineInput.addEventListener("input", () => {
        const value = medicineInput.value.trim().toLocaleLowerCase("es");
        renderLotMedicineOptions(value);
        const medicine = lotMedicineCatalog.find(
            (item) =>
                item.nombre.toLocaleLowerCase("es") === value ||
                item.codigo.toLocaleLowerCase("es") === value
        );
        const possible = lotMedicineCatalog.some(
            (item) =>
                item.nombre.toLocaleLowerCase("es").includes(value) ||
                item.codigo.toLocaleLowerCase("es").includes(value)
        );
        if (medicine) {
            selectLotMedicine(medicine);
        } else {
            selectedLotMedicine = null;
            clearLotMedicineDetails();
            toggleQuickMedicineRegistration(Boolean(value) && !possible);
        }
    });
    medicineInput.addEventListener("focus", () => {
        renderLotMedicineOptions(medicineInput.value);
    });
    medicineInput.addEventListener("blur", () => {
        setTimeout(() => options.classList.add("d-none"), 150);
    });
    quantityInput.addEventListener("input", () => {
        updateLotDisplayedStock();
        updateLotTotalPurchasePrice();
    });
    purchasePriceInput.addEventListener(
        "input",
        updateLotTotalPurchasePrice
    );

    await loadLotMedicineCatalog();
    renderLotMedicineOptions();
    options.classList.add("d-none");
    renderQuickMedicineLaboratoryOptions();
    await loadNextLotNumber();
}

function limitDateYearToFourDigits(input) {
    if (!input.max) {
        input.max = "9999-12-31";
    }
    if (input.dataset.fourDigitYearLimit) return;
    input.dataset.fourDigitYearLimit = "true";
    input.addEventListener("input", () => {
        const parts = input.value.split("-");
        if (parts[0]?.length > 4) {
            parts[0] = parts[0].slice(0, 4);
            input.value = parts.join("-");
        }
    });
}

function getLocalDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadLotMedicineCatalog() {
    await ensurePresentationStockSchema();
    const [catalog] = await db.query(
        `SELECT m.id_medicamento, m.codigo, m.nombre, m.stock_total,
                m.laboratorio, mp.nombre_presentacion, mp.precio_venta,
                mp.unidades_stock
         FROM medicamentos m
         LEFT JOIN medicamento_presentaciones mp
            ON mp.id_medicamento = m.id_medicamento
           AND mp.estado = 'Activa'
         ORDER BY m.nombre, mp.nombre_presentacion`
    );
    const medicines = new Map();
    catalog.forEach((row) => {
        if (!medicines.has(row.id_medicamento)) {
            medicines.set(row.id_medicamento, {
                id_medicamento: row.id_medicamento,
                codigo: row.codigo,
                nombre: row.nombre,
                stock_total: Number(row.stock_total || 0),
                laboratorio: row.laboratorio || "",
                presentations: [],
            });
        }
        if (row.nombre_presentacion) {
            medicines.get(row.id_medicamento).presentations.push({
                nombre: row.nombre_presentacion,
                precio: Number(row.precio_venta),
                unidades_stock: Math.max(1, Number(row.unidades_stock) || 1),
            });
        }
    });
    lotMedicineCatalog = [...medicines.values()];
}

function renderLotMedicineOptions(searchValue = "") {
    const container = document.getElementById("lotMedicineOptions");
    if (!container) return;
    container.replaceChildren();
    const search = searchValue.trim().toLocaleLowerCase("es");
    const matches = lotMedicineCatalog.filter((medicine) =>
        medicine.nombre.toLocaleLowerCase("es").includes(search) ||
        medicine.codigo.toLocaleLowerCase("es").includes(search)
    ).slice(0, 8);
    matches.forEach((medicine) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "lot-dropdown-option";
        option.innerHTML = `
            <span>${medicine.nombre}</span>
            <small>${medicine.codigo} · Stock: ${medicine.stock_total}</small>`;
        option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectLotMedicine(medicine);
            container.classList.add("d-none");
        });
        container.appendChild(option);
    });
    container.classList.toggle("d-none", matches.length === 0);
}

function selectLotMedicine(medicine) {
    selectedLotMedicine = medicine;
    document.getElementById("id_medicamento").value = medicine.nombre;
    document.getElementById("laboratorio").value = medicine.laboratorio;
    renderLotPresentations(medicine.presentations);
    updateLotDisplayedStock();
    toggleQuickMedicineRegistration(false);
    // Al seleccionar o registrar un medicamento, la lista ya no es necesaria.
    document.getElementById("lotMedicineOptions")?.classList.add("d-none");
}

function clearLotMedicineDetails() {
    const laboratory = document.getElementById("laboratorio");
    const stock = document.getElementById("stock_total");
    if (laboratory) laboratory.value = "";
    if (stock) stock.value = "";
    document.getElementById("lotPresentations")?.replaceChildren();
}

function updateLotDisplayedStock() {
    const stock = document.getElementById("stock_total");
    if (!stock) return;
    const quantity = Number(
        document.getElementById("cantidad_inicial")?.value || 0
    );
    const entryUnits = getLotEntryStockUnits();
    const currentStockInPresentation =
        Number(selectedLotMedicine?.stock_total || 0) / entryUnits;
    const displayedStock =
        currentStockInPresentation +
        (Number.isFinite(quantity) ? quantity : 0);
    stock.value = Number.isInteger(displayedStock)
        ? String(displayedStock)
        : displayedStock.toFixed(2);

    const presentation =
        document.getElementById("lotEntryPresentation")?.value || "";
    const stockLabel = stock
        .closest("div")
        ?.querySelector(`label[for="stock_total"]`);
    if (stockLabel) {
        stockLabel.textContent = presentation
            ? `Stock total en ${presentation.toLocaleLowerCase("es")}`
            : "Stock total";
    }
}

function updateLotTotalPurchasePrice() {
    const total = document.getElementById("precio_compra_total");
    if (!total) return;
    const quantity = Number(
        document.getElementById("cantidad_inicial")?.value || 0
    );
    const price = Number(
        document.getElementById("precio_compra")?.value || 0
    );
    total.value = (quantity * price).toFixed(2);
}

function renderLotPresentations(presentations = []) {
    const container = document.getElementById("lotPresentations");
    if (!container) return;
    container.replaceChildren();
    const blister = presentations.find((item) =>
        item.nombre.toLocaleLowerCase("es").includes("blister") ||
        item.nombre.toLocaleLowerCase("es").includes("blíster")
    );
    const box = presentations.find((item) =>
        item.nombre.toLocaleLowerCase("es").includes("caja")
    );
    const unitsPerBlister = Math.max(
        1,
        Number(blister?.unidades_stock) || 1
    );
    const blistersPerBox = box
        ? Math.max(
            1,
            Math.round(Number(box.unidades_stock) / unitsPerBlister)
        )
        : 1;
    document.getElementById("lotUnitsPerBlister").value =
        String(unitsPerBlister);
    document.getElementById("lotBlistersPerBox").value =
        String(blistersPerBox);
    presentations.forEach((presentation) => {
        addLotPresentationRow(
            presentation.nombre,
            presentation.precio,
            presentation.unidades_stock
        );
    });
    updateLotEntryPresentationOptions();
    updateLotSingleSalePrice();
    updateLotConversionSummary();
}

function addLotPresentationRow(name = "", price = "", stockUnits = "") {
    const container = document.getElementById("lotPresentations");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "col-12 row g-2 align-items-end";
    row.innerHTML = `
        <div class="col-12 col-md-5">
            <select class="form-select lot-presentation-name">
                <option value="">Seleccione una forma de venta...</option>
                <option value="Caja">Caja</option>
                <option value="Unidad">Unidad</option>
                <option value="Frasco">Frasco</option>
                <option value="Blister">Blíster</option>
                <option value="Sobre">Sobre</option>
                <option value="Ampolla">Ampolla</option>
                <option value="Suero">Suero</option>
            </select>
        </div>
        <div class="col-12 col-md-5"><input
            class="form-control lot-presentation-price"
            type="number" min="0.01" step="0.01"
            placeholder="Precio de venta"></div>
        <input class="lot-presentation-units" type="hidden">
        <div class="col-12 col-md-2"><button
            class="btn btn-outline-danger w-100"
            type="button">Quitar</button></div>`;
    const presentationSelect = row.querySelector(".lot-presentation-name");
    if (name && ![...presentationSelect.options].some(
        (option) => option.value === name
    )) {
        presentationSelect.appendChild(new Option(name, name));
    }
    presentationSelect.value = name;
    row.querySelector(".lot-presentation-price").value = price;
    row.querySelector(".lot-presentation-units").value = stockUnits;
    row.querySelector(".lot-presentation-name").addEventListener(
        "input",
        updateLotPresentationConversions
    );
    row.querySelector("button").addEventListener("click", () => {
        row.remove();
        updateLotEntryPresentationOptions();
        updateLotConversionSummary();
    });
    container.appendChild(row);
    updateLotPresentationConversions();
}

function getLotPresentations() {
    const presentations =
        [...document.querySelectorAll("#lotPresentations > div")]
        .map((row) => ({
            nombre: row.querySelector(".lot-presentation-name").value.trim(),
            precio: Number(
                row.querySelector(".lot-presentation-price").value
            ),
            unidades_stock: Number(
                row.querySelector(".lot-presentation-units").value
            ),
        }))
        .filter((item) => item.nombre || item.precio || item.unidades_stock);

    const entryPresentation =
        document.getElementById("lotEntryPresentation")?.value;
    if (entryPresentation && entryPresentation !== "Caja") {
        const price = Number(
            document.getElementById("lotSingleSalePrice")?.value
        );
        const existing = presentations.find(
            (item) =>
                item.nombre.toLocaleLowerCase("es") ===
                entryPresentation.toLocaleLowerCase("es")
        );
        if (existing) {
            existing.precio = price;
            existing.unidades_stock = 1;
        } else {
            presentations.push({
                nombre: entryPresentation,
                precio: price,
                unidades_stock: 1,
            });
        }
    }
    return presentations;
}

function updateLotPresentationConversions() {
    const blisters = Number(
        document.getElementById("lotBlistersPerBox")?.value || 1
    );
    const units = Number(
        document.getElementById("lotUnitsPerBlister")?.value || 1
    );
    document.querySelectorAll("#lotPresentations > div").forEach((row) => {
        const name = row.querySelector(".lot-presentation-name")
            .value.trim().toLocaleLowerCase("es");
        const stockUnits = row.querySelector(".lot-presentation-units");
        if (name.includes("caja")) {
            stockUnits.value = String(blisters * units);
        } else if (name.includes("blister") || name.includes("blíster")) {
            stockUnits.value = String(units);
        } else if (name.includes("unidad")) {
            stockUnits.value = "1";
        } else if (!stockUnits.value) {
            stockUnits.value = "1";
        }
    });
    updateLotEntryPresentationOptions();
    updateLotDisplayedStock();
    updateLotConversionSummary();
}

function updateLotEntryPresentationOptions() {
    const select = document.getElementById("lotEntryPresentation");
    if (!select) return;
    const presentations = getLotPresentations()
        .filter((item) => item.nombre && item.unidades_stock > 0);
    if (!select.value) {
        const preferred = ["Caja", "Ampolla", "Suero", "Frasco"].find(
            (option) => presentations.some(
                (item) =>
                    item.nombre.toLocaleLowerCase("es") ===
                    option.toLocaleLowerCase("es")
            )
        );
        select.value = preferred || "";
    }
    toggleLotBoxOptions();
}

function toggleLotBoxOptions() {
    const selectedPresentation =
        document.getElementById("lotEntryPresentation")?.value || "";
    const isBox = selectedPresentation === "Caja";
    document.getElementById("lotBoxBlistersField")
        ?.classList.toggle("d-none", !isBox);
    document.getElementById("lotBoxUnitsField")
        ?.classList.toggle("d-none", !isBox);
    document.getElementById("lotConversionSummary")
        ?.classList.toggle("d-none", !isBox);
    document.getElementById("addLotPresentation")
        ?.classList.toggle("d-none", !isBox);
    document.getElementById("lotPresentations")
        ?.classList.toggle("d-none", !isBox);
    document.getElementById("lotSingleSalePriceField")
        ?.classList.toggle(
            "d-none",
            !selectedPresentation || isBox
        );

    const quantityInput = document.getElementById("cantidad_inicial");
    const quantityLabel = quantityInput
        ?.closest("div")
        ?.querySelector(`label[for="cantidad_inicial"]`);
    if (quantityLabel) {
        quantityLabel.textContent = isBox
            ? "Cantidad de cajas a ingresar"
            : "Cantidad a ingresar";
    }
    if (quantityInput) {
        quantityInput.placeholder = isBox
            ? "Número de cajas"
            : "Cantidad";
    }
}

function updateLotSingleSalePrice() {
    const input = document.getElementById("lotSingleSalePrice");
    const selected =
        document.getElementById("lotEntryPresentation")?.value;
    if (!input || !selected || selected === "Caja") {
        if (input) input.value = "";
        return;
    }
    const matchingRow = [...document.querySelectorAll(
        "#lotPresentations > div"
    )].find((row) =>
        row.querySelector(".lot-presentation-name")
            .value.trim().toLocaleLowerCase("es") ===
        selected.toLocaleLowerCase("es")
    );
    input.value = matchingRow
        ? matchingRow.querySelector(".lot-presentation-price").value
        : "";
}

function getLotEntryStockUnits() {
    const selected = document.getElementById("lotEntryPresentation")?.value;
    return getLotPresentations().find(
        (item) => item.nombre === selected
    )?.unidades_stock || 1;
}

function updateLotConversionSummary() {
    const summary = document.getElementById("lotConversionSummary");
    if (!summary) return;
    const blisters = Number(
        document.getElementById("lotBlistersPerBox")?.value || 1
    );
    const units = Number(
        document.getElementById("lotUnitsPerBlister")?.value || 1
    );
    summary.textContent =
        `1 caja = ${blisters} blíster(es) = ${blisters * units} unidades. ` +
        `Cada blíster contiene ${units} unidades.`;
}

function createQuickMedicineRegistrationLegacy() {
    if (document.getElementById("quickMedicineRegistration")) return;
    const container = document.createElement("div");
    container.id = "quickMedicineRegistration";
    container.className = "col-12 d-none";
    container.innerHTML = `
        <div class="card border-warning-subtle bg-warning-subtle">
            <div class="card-body">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div><h3 class="h6 mb-1">Medicamento no registrado</h3>
                    <p class="small text-secondary mb-0">
                        Puede registrarlo sin salir del ingreso del lote.
                    </p></div>
                    <button id="showQuickMedicineForm"
                        class="btn btn-warning btn-sm" type="button">
                        Registrar nuevo medicamento
                    </button>
                </div>
                <div id="quickMedicineFields" class="row g-3 mt-1 d-none">
                    <div class="col-12 col-md-6"><label class="form-label">Nombre</label>
                        <input id="quickMedicineName" class="form-control"></div>
                    <div class="col-12 col-md-6"><label class="form-label">Laboratorio</label>
                        <input id="quickMedicineLaboratory" class="form-control"
                            list="quickMedicineLaboratoryOptions">
                        <datalist id="quickMedicineLaboratoryOptions"></datalist></div>
                    <div class="col-12 col-md-6"><label class="form-label">Categoría</label>
                        <input id="quickMedicineCategory" class="form-control"></div>
                    <div class="col-12 col-md-6"><label class="form-label">Presentación</label>
                        <input id="quickMedicinePresentation" class="form-control"></div>
                    <div class="col-12 col-md-6"><label class="form-label">Restricción</label>
                        <select id="quickMedicineRestriction" class="form-select">
                            <option value="">Seleccione...</option>
                            <option value="Sin Receta Medica">Sin Receta Médica</option>
                            <option value="Con Receta Medica">Con Receta Médica</option>
                        </select></div>
                    <div class="col-12 col-md-6"><label class="form-label">Forma de venta</label>
                        <input id="quickMedicineSaleForm" class="form-control"
                            list="lotSaleFormOptions"></div>
                    <div class="col-12 col-md-6"><label class="form-label">Precio de venta</label>
                        <input id="quickMedicineSalePrice" class="form-control"
                            type="number" min="0.01" step="0.01"></div>
                    <div class="col-12"><button id="saveQuickMedicine"
                        class="btn btn-success" type="button">
                        Guardar medicamento y continuar lote
                    </button></div>
                </div>
            </div>
        </div>`;
    form.appendChild(container);
    document.getElementById("showQuickMedicineForm")
        .addEventListener("click", () => {
            document.getElementById("quickMedicineName").value =
                document.getElementById("id_medicamento").value.trim();
            document.getElementById("quickMedicineFields")
                .classList.remove("d-none");
        });
    document.getElementById("saveQuickMedicine")
        .addEventListener("click", saveQuickMedicine);
}

function createQuickMedicineRegistration() {
    if (document.getElementById("quickMedicineRegistration")) return;
    const container = document.createElement("div");
    container.id = "quickMedicineRegistration";
    container.className = "col-12 d-none";
    container.innerHTML = `
        <div class="card quick-client-card quick-medicine-card overflow-hidden">
            <div class="quick-client-accent" aria-hidden="true"></div>
            <div class="card-body p-4">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <span class="quick-client-icon d-inline-flex align-items-center justify-content-center rounded-circle"
                            aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <path d="M10.5 4.5 19.5 13.5"></path>
                                <path d="M6.3 17.7a4.24 4.24 0 0 1 0-6l5.4-5.4a4.24 4.24 0 0 1 6 6l-5.4 5.4a4.24 4.24 0 0 1-6 0Z"></path>
                                <path d="m8.8 9.2 6 6"></path>
                            </svg>
                        </span>
                        <div>
                            <span class="badge quick-client-badge rounded-pill mb-2">
                                Registro rápido
                            </span>
                            <h3 class="h5 fw-bold mb-1">
                                Medicamento no registrado
                            </h3>
                            <p class="small text-secondary mb-0">
                                Puede registrarlo sin salir del ingreso del lote.
                            </p>
                        </div>
                    </div>
                    <button id="showQuickMedicineForm"
                        class="btn btn-warning fw-semibold px-3" type="button">
                        Registrar nuevo medicamento
                    </button>
                </div>
                <div id="quickMedicineFields"
                    class="row g-3 mt-4 pt-3 border-top d-none">
                    <div class="col-12">
                        <p class="small text-secondary mb-0">
                            Los campos marcados con <span class="text-danger">*</span>
                            son obligatorios.
                        </p>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickMedicineName">
                            Nombre <span class="text-danger">*</span>
                        </label>
                        <input id="quickMedicineName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickMedicineLaboratory">
                            Laboratorio <span class="text-danger">*</span>
                        </label>
                        <div class="position-relative">
                            <input id="quickMedicineLaboratory"
                                class="form-control" type="text"
                                autocomplete="off">
                            <div id="quickMedicineLaboratoryOptions"
                                class="lot-dropdown d-none"></div>
                        </div>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickMedicineCategory">
                            Categoría
                        </label>
                        <input id="quickMedicineCategory" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickMedicineRestriction">
                            Restricción <span class="text-danger">*</span>
                        </label>
                        <select id="quickMedicineRestriction" class="form-select">
                            <option value="">Seleccione...</option>
                            <option value="Sin Receta Medica">Sin Receta Médica</option>
                            <option value="Con Receta Medica">Con Receta Médica</option>
                        </select>
                    </div>
                    <div class="col-12 d-flex flex-wrap justify-content-end gap-2 pt-2">
                        <button id="cancelQuickMedicine"
                            class="btn btn-outline-secondary px-3" type="button">
                            Cancelar
                        </button>
                        <button id="saveQuickMedicine"
                            class="btn btn-success fw-semibold px-4" type="button">
                            Guardar medicamento y continuar lote
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    const medicineGroup =
        document.getElementById("id_medicamento")?.closest("div");
    if (medicineGroup) {
        medicineGroup.insertAdjacentElement("afterend", container);
    } else {
        form.appendChild(container);
    }

    document.getElementById("showQuickMedicineForm")
        .addEventListener("click", () => {
            document.getElementById("quickMedicineName").value =
                document.getElementById("id_medicamento").value.trim();
            document.getElementById("quickMedicineFields")
                .classList.remove("d-none");
            document.getElementById("showQuickMedicineForm")
                .classList.add("d-none");
        });
    document.getElementById("saveQuickMedicine")
        .addEventListener("click", saveQuickMedicine);
    const laboratoryInput =
        document.getElementById("quickMedicineLaboratory");
    laboratoryInput.addEventListener("input", () => {
        renderQuickMedicineLaboratoryOptions(laboratoryInput.value);
    });
    laboratoryInput.addEventListener("focus", () => {
        renderQuickMedicineLaboratoryOptions(laboratoryInput.value);
    });
    laboratoryInput.addEventListener("blur", () => {
        setTimeout(() => {
            document.getElementById("quickMedicineLaboratoryOptions")
                ?.classList.add("d-none");
        }, 150);
    });
    document.getElementById("cancelQuickMedicine")
        .addEventListener("click", () => {
            document.getElementById("quickMedicineFields")
                .classList.add("d-none");
            document.getElementById("showQuickMedicineForm")
                .classList.remove("d-none");
        });
}

function validateCompletedLotDate(input, isInvalid, errorText) {
    const value = input.value;
    const isComplete = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!isComplete) {
        input.setCustomValidity("");
        return;
    }
    const invalid = isInvalid(value, getLocalDateValue());
    input.setCustomValidity(invalid ? errorText : "");
    if (invalid) {
        showMessage(errorText, true);
    } else if (message.textContent === errorText) {
        if (messageTimer) {
            window.clearTimeout(messageTimer);
            messageTimer = null;
        }
        message.className = "alert d-none";
        message.textContent = "";
    }
}

function toggleQuickMedicineRegistration(show) {
    const container = document.getElementById("quickMedicineRegistration");
    if (!container) return;
    container.classList.toggle("d-none", !show);
    if (!show) {
        document.getElementById("quickMedicineFields")
            ?.classList.add("d-none");
        document.getElementById("showQuickMedicineForm")
            ?.classList.remove("d-none");
    }
}

function renderQuickMedicineLaboratoryOptions(searchValue = "") {
    const container = document.getElementById(
        "quickMedicineLaboratoryOptions"
    );
    if (!container) return;
    container.replaceChildren();
    const search = searchValue.trim().toLocaleLowerCase("es");
    const laboratories = [...new Set(
        lotMedicineCatalog.map((item) => item.laboratorio.trim()).filter(Boolean)
    )].sort().filter((laboratory) =>
        laboratory.toLocaleLowerCase("es").includes(search)
    ).slice(0, 8);
    laboratories.forEach((laboratory) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "lot-dropdown-option";
        option.textContent = laboratory;
        option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            document.getElementById("quickMedicineLaboratory").value =
                laboratory;
            container.classList.add("d-none");
        });
        container.appendChild(option);
    });
    const laboratoryInput =
        document.getElementById("quickMedicineLaboratory");
    const shouldShow =
        document.activeElement === laboratoryInput &&
        laboratories.length > 0;
    container.classList.toggle("d-none", !shouldShow);
}

async function saveQuickMedicine() {
    const name = document.getElementById("quickMedicineName").value.trim();
    const laboratory =
        document.getElementById("quickMedicineLaboratory").value.trim();
    const category =
        document.getElementById("quickMedicineCategory").value.trim();
    const restriction =
        document.getElementById("quickMedicineRestriction").value;
    const purchasePrice = Number(
        document.getElementById("precio_compra").value
    );
    if (!name || !laboratory || !restriction) {
        showMessage(
            "Complete nombre, laboratorio y restricción.",
            true
        );
        return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        showMessage("Revise el precio de compra.", true);
        return;
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [existing] = await connection.execute(
            `SELECT id_medicamento FROM medicamentos
             WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))
             LIMIT 1 FOR UPDATE`,
            [name]
        );
        if (existing.length) {
            throw new Error("Ya existe un medicamento con ese nombre.");
        }
        const [nextCode] = await connection.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo, 4) AS UNSIGNED)), 0) + 1
                    AS siguiente
             FROM medicamentos WHERE codigo LIKE 'MED%'`
        );
        const code = `MED${String(nextCode[0].siguiente).padStart(3, "0")}`;
        const [result] = await connection.execute(
            `INSERT INTO medicamentos
                (codigo, nombre, descripcion, categoria, presentacion,
                 precio_compra, precio_venta, stock_total, stock_minimo,
                 restriccion, laboratorio, forma_venta, estado)
             VALUES (?, ?, NULL, ?, ?, ?, ?, 0, 5, ?, ?, ?, 'Agotado')`,
            [
                code, name, category || null, null,
                purchasePrice, 0, restriction, laboratory, "Unidad",
            ]
        );
        await connection.commit();
        await loadLotMedicineCatalog();
        const medicine = lotMedicineCatalog.find(
            (item) => item.id_medicamento === result.insertId
        );
        renderLotMedicineOptions();
        renderQuickMedicineLaboratoryOptions();
        selectLotMedicine(medicine);
        showMessage("Medicamento registrado y seleccionado para el lote.");
    } catch (error) {
        await connection.rollback();
        showMessage(`No se pudo registrar: ${error.message}`, true);
    } finally {
        connection.release();
    }
}

async function loadNextLotNumber() {
    const input = document.getElementById("numero_lote");
    if (!input) return;
    const [result] = await db.query(
        `SELECT COALESCE(
            MAX(CAST(SUBSTRING(numero_lote, 5) AS UNSIGNED)), 0
         ) + 1 AS siguiente
         FROM lote WHERE numero_lote LIKE 'LOT-%'`
    );
    input.value = `LOT-${String(result[0].siguiente).padStart(4, "0")}`;
}

function validateLotData(data) {
    if (!selectedLotMedicine) {
        throw new Error("Seleccione un medicamento registrado.");
    }
    const today = getLocalDateValue();
    if (data.fecha_fabricacion >= today) {
        throw new Error(
            "La fecha de fabricación tiene que ser inferior a la actual."
        );
    }
    if (data.fecha_vencimiento <= today) {
        throw new Error(
            "La fecha de vencimiento tiene que ser superior a la actual."
        );
    }
    const quantity = Number(data.cantidad_inicial);
    const purchasePrice = Number(data.precio_compra);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Ingrese una cantidad válida.");
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        throw new Error("Ingrese un precio de compra válido.");
    }
    const presentations = getLotPresentations();
    if (presentations.some((item) => !item.nombre || !(item.precio > 0))) {
        throw new Error("Complete correctamente las formas de venta.");
    }
    return { quantity, purchasePrice, presentations };
}

async function saveLotTransaction(data) {
    if (!selectedLotMedicine) {
        throw new Error("Seleccione un medicamento registrado.");
    }
    const quantity = Number(data.cantidad_inicial);
    const purchasePrice = Number(data.precio_compra);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Ingrese una cantidad válida.");
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        throw new Error("Ingrese un precio de compra válido.");
    }
    const presentations = getLotPresentations();
    const entryPresentation =
        document.getElementById("lotEntryPresentation")?.value;
    if (!entryPresentation) {
        throw new Error("Seleccione la presentación que está ingresando.");
    }
    if (entryPresentation === "Caja" && !presentations.length) {
        throw new Error(
            "Agregue al menos una forma de venta para la caja."
        );
    }
    if (presentations.some((item) =>
        !item.nombre ||
        !(item.precio > 0) ||
        !Number.isInteger(item.unidades_stock) ||
        item.unidades_stock <= 0
    )) {
        throw new Error("Complete correctamente las formas de venta.");
    }
    const entryUnits = getLotEntryStockUnits();
    const stockQuantity = quantity * entryUnits;
    const primaryPresentation = presentations[0];
    const allowedSaleForms = [
        "Caja", "Unidad", "Frasco", "Blister", "Sobre", "Ampolla"
    ];
    const normalizedSaleForm =
        primaryPresentation.nombre === "Blíster"
            ? "Blister"
            : primaryPresentation.nombre;
    const legacySaleForm = allowedSaleForms.includes(normalizedSaleForm)
        ? normalizedSaleForm
        : "Unidad";

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            `INSERT INTO lote
                (id_medicamento, numero_lote, cantidad_inicial,
                 cantidad_disponible, fecha_fabricacion,
                 fecha_vencimiento, precio_compra, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Disponible')`,
            [
                selectedLotMedicine.id_medicamento, data.numero_lote,
                stockQuantity, stockQuantity, data.fecha_fabricacion,
                data.fecha_vencimiento, purchasePrice,
            ]
        );
        await connection.execute(
            `UPDATE medicamentos
             SET stock_total = stock_total + ?,
                 precio_compra = ?,
                 presentacion = ?,
                 precio_venta = ?,
                 forma_venta = ?,
                 estado = 'Disponible'
             WHERE id_medicamento = ?`,
            [
                stockQuantity,
                purchasePrice,
                entryPresentation,
                primaryPresentation.precio,
                legacySaleForm,
                selectedLotMedicine.id_medicamento,
            ]
        );
        for (const item of presentations) {
            await connection.execute(
                `INSERT INTO medicamento_presentaciones
                    (id_medicamento, nombre_presentacion, precio_venta,
                     unidades_stock, estado)
                 VALUES (?, ?, ?, ?, 'Activa')
                 ON DUPLICATE KEY UPDATE
                    precio_venta = VALUES(precio_venta),
                    unidades_stock = VALUES(unidades_stock),
                    estado = 'Activa'`,
                [
                    selectedLotMedicine.id_medicamento,
                    item.nombre,
                    item.precio,
                    item.unidades_stock,
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

/* ====================================================================================
Configuración para el autocompletado y autorrelleno de distribuidores en Compras 
====================================================================================*/

function configureDistributorAutocomplete() {
    const distributorInput = document.getElementById("id_distribuidor");
    if (!distributorInput) return;
    let searchRequestId = 0;
    let distributorSearchTimer = null;

    const container = distributorInput.parentElement;
    let suggestionsDiv = document.getElementById("distributorSuggestions");

    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement("div");
        suggestionsDiv.id = "distributorSuggestions";
        suggestionsDiv.className =
            "list-group position-absolute top-100 start-0 end-0 " +
            "mx-3 mt-1 shadow z-3 d-none";
        container.appendChild(suggestionsDiv);
    }

    distributorInput.addEventListener("input", () => {
        const query = distributorInput.value.trim();
        const requestId = ++searchRequestId;
        if (distributorSearchTimer) {
            window.clearTimeout(distributorSearchTimer);
        }
        suggestionsDiv.classList.add("d-none");
        if (query.length === 0) {
            toggleQuickDistributorRegistration(false);
            return;
        }

        distributorSearchTimer = window.setTimeout(async () => {
            try {
                const [results] = await db.execute(
                    `SELECT nombre, telefono, correo
                     FROM distribuidores
                     WHERE nombre LIKE ?
                     LIMIT 5`,
                    [`%${query}%`]
                );

                if (requestId !== searchRequestId) return;
                renderDistributorSuggestions(
                    results,
                    suggestionsDiv,
                    distributorInput
                );
                toggleQuickDistributorRegistration(results.length === 0);
            } catch (error) {
                console.error("Error buscando distribuidores:", error);
            } finally {
                if (requestId === searchRequestId) {
                    distributorSearchTimer = null;
                }
            }
        }, 700);
    });

    distributorInput.addEventListener("focus", async () => {
        if (distributorInput.value.trim().length > 0) {
            const requestId = ++searchRequestId;
            const [results] = await db.execute(
                `SELECT nombre, telefono, correo FROM distribuidores WHERE nombre LIKE ? LIMIT 5`,
                [`%${distributorInput.value.trim()}%`]
            );
            if (requestId !== searchRequestId) return;
            renderDistributorSuggestions(results, suggestionsDiv, distributorInput);
        }
    });

    distributorInput.addEventListener("blur", () => {
        if (distributorSearchTimer) {
            window.clearTimeout(distributorSearchTimer);
            distributorSearchTimer = null;
        }
        searchRequestId += 1;
        window.setTimeout(async () => {
            const query = distributorInput.value.trim();
            if (!query) {
                toggleQuickDistributorRegistration(false);
                return;
            }
            try {
                const [results] = await db.execute(
                    `SELECT id_distribuidor
                     FROM distribuidores
                     WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))
                     LIMIT 1`,
                    [query]
                );
                toggleQuickDistributorRegistration(results.length === 0);
            } catch (error) {
                console.error(
                    "Error verificando el distribuidor:",
                    error
                );
            }
        }, 220);
    });

    document.addEventListener("click", (event) => {
        if (!container.contains(event.target)) {
            suggestionsDiv.classList.add("d-none");
        }
    });
}

function renderDistributorSuggestions(distributors, suggestionsDiv, inputElement) {
    suggestionsDiv.replaceChildren();

    if (!distributors.length) {
        suggestionsDiv.classList.add("d-none");
        return;
    }

    distributors.forEach((dist) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "list-group-item list-group-item-action bg-white text-dark";
        item.textContent = dist.nombre;

        item.addEventListener("click", () => {
            inputElement.value = dist.nombre;
            
            // Autorrellenar teléfono y correo si existen los campos virtuales
            const phoneInput = document.querySelector("[name='telefono_distribuidor']");
            const emailInput = document.querySelector("[name='correo_distribuidor']");

            if (phoneInput) {
                phoneInput.value = formatStructuredInput(
                    dist.telefono || "",
                    "phone"
                );
            }
            if (emailInput) emailInput.value = dist.correo || "";

            suggestionsDiv.classList.add("d-none");
            toggleQuickDistributorRegistration(false);
        });

        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.classList.remove("d-none");
}

function createQuickDistributorRegistration() {
    const container = document.createElement("div");
    container.id = "quickDistributorRegistration";
    container.className = "col-12 d-none";
    container.innerHTML = `
        <div class="card quick-client-card quick-provider-card overflow-hidden">
            <div class="quick-client-accent" aria-hidden="true"></div>
            <div class="card-body p-4">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <span class="quick-client-icon d-inline-flex align-items-center justify-content-center rounded-circle"
                            aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <path d="M3 7h12v10H3z"></path>
                                <path d="M15 10h3l3 3v4h-6z"></path>
                                <circle cx="7" cy="18" r="2"></circle>
                                <circle cx="18" cy="18" r="2"></circle>
                            </svg>
                        </span>
                        <div>
                            <span class="badge quick-client-badge rounded-pill mb-2">
                                Registro rápido
                            </span>
                            <h3 class="h5 fw-bold mb-1">
                                Laboratorio o proveedor no registrado
                            </h3>
                            <p class="small text-secondary mb-0">
                                Puede registrarlo sin salir de la compra.
                            </p>
                        </div>
                    </div>
                    <button id="showQuickDistributorForm"
                        class="btn btn-warning fw-semibold px-3" type="button">
                        Registrar laboratorio o proveedor
                    </button>
                </div>
                <div id="quickDistributorFields"
                    class="row g-3 mt-4 pt-3 border-top d-none">
                    <div class="col-12">
                        <p class="small text-secondary mb-0">
                            Los campos marcados con <span class="text-danger">*</span>
                            son obligatorios.
                        </p>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickDistributorName">
                            Nombre <span class="text-danger">*</span>
                        </label>
                        <input id="quickDistributorName" class="form-control" type="text">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickDistributorPhone">
                            Teléfono <span class="text-danger">*</span>
                        </label>
                        <input id="quickDistributorPhone" class="form-control"
                            type="text" minlength="9" maxlength="9"
                            placeholder="Ej. 9999-9999">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-semibold" for="quickDistributorEmail">
                            Correo <span class="text-danger">*</span>
                        </label>
                        <input id="quickDistributorEmail" class="form-control" type="email">
                    </div>
                    <div class="col-12">
                        <label class="form-label fw-semibold" for="quickDistributorAddress">
                            Dirección
                        </label>
                        <input id="quickDistributorAddress" class="form-control" type="text">
                    </div>
                    <div class="col-12 d-flex flex-wrap justify-content-end gap-2 pt-2">
                        <button id="cancelQuickDistributor"
                            class="btn btn-outline-secondary px-3" type="button">
                            Cancelar
                        </button>
                        <button id="saveQuickDistributor"
                            class="btn btn-success fw-semibold px-4" type="button">
                            Guardar proveedor y continuar compra
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    const distributorGroup =
        document.getElementById("id_distribuidor")?.closest("div");
    if (distributorGroup) {
        distributorGroup.insertAdjacentElement("afterend", container);
    } else {
        form.appendChild(container);
    }

    document.getElementById("showQuickDistributorForm")
        .addEventListener("click", () => {
            document.getElementById("quickDistributorName").value =
                document.getElementById("id_distribuidor").value.trim();
            document.getElementById("quickDistributorFields")
                .classList.remove("d-none");
            document.getElementById("showQuickDistributorForm")
                .classList.add("d-none");
        });
    document.getElementById("saveQuickDistributor")
        .addEventListener("click", saveQuickDistributor);
    document.getElementById("cancelQuickDistributor")
        .addEventListener("click", () => {
            document.getElementById("quickDistributorFields")
                .classList.add("d-none");
            document.getElementById("showQuickDistributorForm")
                .classList.remove("d-none");
        });
    document.getElementById("quickDistributorPhone")
        .addEventListener("input", (event) => {
            event.target.value =
                formatStructuredInput(event.target.value, "phone");
        });
}

function toggleQuickDistributorRegistration(show) {
    const container = document.getElementById("quickDistributorRegistration");
    if (!container) return;
    container.classList.toggle("d-none", !show);
    if (!show) {
        document.getElementById("quickDistributorFields")
            ?.classList.add("d-none");
        document.getElementById("showQuickDistributorForm")
            ?.classList.remove("d-none");
    }
}

async function saveQuickDistributor() {
    const name = document.getElementById("quickDistributorName").value.trim();
    const phone = document.getElementById("quickDistributorPhone").value.trim();
    const email = document.getElementById("quickDistributorEmail").value.trim();
    const address = document.getElementById("quickDistributorAddress").value.trim();

    if (!name || !phone || !email) {
        showMessage(
            "Complete el nombre, teléfono y correo del proveedor.",
            true
        );
        return;
    }
    if (phone.length !== 9) {
        showMessage(
            "El teléfono del proveedor debe tener exactamente 9 caracteres.",
            true
        );
        return;
    }

    try {
        await db.execute(
            `INSERT INTO distribuidores
                (nombre, telefono, correo, direccion, estado)
             VALUES (?, ?, ?, ?, 'Activo')`,
            [name, phone, email, address || null]
        );
        document.getElementById("id_distribuidor").value = name;
        document.getElementById("telefono_distribuidor").value = phone;
        document.getElementById("correo_distribuidor").value = email;
        toggleQuickDistributorRegistration(false);
        showMessage("Proveedor registrado y seleccionado para la compra.");
    } catch (error) {
        showMessage(
            error.code === "ER_DUP_ENTRY"
                ? "Ya existe un proveedor con ese nombre."
                : `No se pudo registrar el proveedor: ${error.message}`,
            true
        );
    }
}

/* ====================================================================================
Función para cargar automáticamente el siguiente número de factura en Compras
====================================================================================*/

async function loadNextPurchaseInvoiceNumber() {
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
             FROM compras
             WHERE numero_factura LIKE 'COM-%'`
        );

        const nextNumber = Number(result[0].siguiente);
        const invoiceInput = document.getElementById("numero_factura");
        if (invoiceInput) {
            invoiceInput.value = `COM-${String(nextNumber).padStart(4, "0")}`;
        }
    } catch (error) {
        console.error("No se pudo generar el número de factura de compra");
    }
}
