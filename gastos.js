// Variables globales
let gastos = JSON.parse(localStorage.getItem('gastos')) || [];

// Fecha LOCAL YYYY-MM-DD (NUNCA usar toISOString().split('T')[0]:
// en Colombia UTC-5, después de las 7:00 p.m. UTC ya es el día siguiente).
function fechaLocalISOGastos(valor = new Date()) {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Día laboral actual (respeta "operar después de medianoche" si está activo en el POS)
function getFechaHoyGastos() {
    const activo = localStorage.getItem('operarDespuesMedianoche') === 'true';
    if (!activo) return new Date();
    const ahora = new Date();
    const horaFin = parseInt(localStorage.getItem('horaFinDiaLaboral') || '4', 10);
    if (ahora.getHours() < horaFin) {
        return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1, 12, 0, 0);
    }
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0);
}

function esGastoDelDiaLaboral(gasto, diaRef = getFechaHoyGastos()) {
    try {
        if (!gasto || !gasto.fecha) return false;
        const fechaGasto = new Date(gasto.fecha);
        if (isNaN(fechaGasto.getTime())) return false;
        if (fechaLocalISOGastos(fechaGasto) !== fechaLocalISOGastos(diaRef)) return false;

        // Tras cierre administrativo, ultimaHoraCierre marca el corte del turno
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        if (ultimaHoraCierreStr) {
            const ultimaHoraCierre = new Date(ultimaHoraCierreStr);
            if (!isNaN(ultimaHoraCierre.getTime()) && fechaGasto.getTime() <= ultimaHoraCierre.getTime()) {
                return false;
            }
        }
        return true;
    } catch (e) {
        return false;
    }
}

function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function limpiarFormGasto() {
    document.getElementById('gastoEditandoId').value = '';
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('categoriaGasto').value = '';
    const titulo = document.getElementById('tituloFormGasto');
    if (titulo) titulo.innerHTML = '<i class="fas fa-edit me-2"></i>Nuevo Gasto';
    const btn = document.getElementById('btnGuardarGasto');
    if (btn) btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar';
}

function cancelarFormGasto() {
    limpiarFormGasto();
    document.getElementById('formGasto').style.display = 'none';
}

// Función para mostrar/ocultar el formulario de gastos (nuevo)
function agregarGasto() {
    const formGasto = document.getElementById('formGasto');
    const estabaOculto = formGasto.style.display === 'none';
    limpiarFormGasto();
    formGasto.style.display = estabaOculto ? 'block' : 'none';
    if (formGasto.style.display === 'block') {
        document.getElementById('descripcionGasto').focus();
    }
}

// Función para validar el monto
function validarMonto(monto) {
    if (isNaN(monto) || monto <= 0) {
        alert('Por favor ingrese un monto válido mayor a 0');
        return false;
    }
    return true;
}

// Función para formatear el monto
function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(monto);
}

function sincronizarGastoEnListas(gastoActualizado) {
    let listaGastos = JSON.parse(localStorage.getItem('gastos')) || [];
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const id = gastoActualizado.id;

    const idxG = listaGastos.findIndex(g => String(g.id) === String(id));
    if (idxG >= 0) listaGastos[idxG] = { ...listaGastos[idxG], ...gastoActualizado };
    else listaGastos.push(gastoActualizado);

    const idxH = historialGastos.findIndex(g => String(g.id) === String(id));
    if (idxH >= 0) historialGastos[idxH] = { ...historialGastos[idxH], ...gastoActualizado };
    else historialGastos.push(gastoActualizado);

    localStorage.setItem('gastos', JSON.stringify(listaGastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    gastos = listaGastos;
}

function eliminarGastoDeListas(id) {
    let listaGastos = JSON.parse(localStorage.getItem('gastos')) || [];
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    listaGastos = listaGastos.filter(g => String(g.id) !== String(id));
    historialGastos = historialGastos.filter(g => String(g.id) !== String(id));
    localStorage.setItem('gastos', JSON.stringify(listaGastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    gastos = listaGastos;
}

// Guardar nuevo o actualizar existente
function guardarGasto() {
    const idEditando = (document.getElementById('gastoEditandoId').value || '').trim();
    const descripcion = document.getElementById('descripcionGasto').value.trim();
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const categoria = document.getElementById('categoriaGasto').value;

    if (!descripcion) {
        alert('Por favor ingrese una descripción del gasto');
        document.getElementById('descripcionGasto').focus();
        return;
    }

    if (!validarMonto(monto)) {
        document.getElementById('montoGasto').focus();
        return;
    }

    if (!categoria) {
        alert('Por favor seleccione una categoría');
        document.getElementById('categoriaGasto').focus();
        return;
    }

    if (idEditando) {
        const listaGastos = JSON.parse(localStorage.getItem('gastos')) || [];
        const existente = listaGastos.find(g => String(g.id) === String(idEditando));
        if (!existente) {
            alert('No se encontró el gasto a editar');
            cancelarFormGasto();
            cargarGastos();
            return;
        }
        sincronizarGastoEnListas({
            ...existente,
            id: existente.id,
            descripcion,
            monto,
            categoria,
            fecha: existente.fecha || new Date().toISOString()
        });
        cancelarFormGasto();
        cargarGastos();
        alert('Gasto actualizado correctamente');
        return;
    }

    const gasto = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        descripcion,
        monto,
        categoria
    };

    sincronizarGastoEnListas(gasto);
    cancelarFormGasto();
    cargarGastos();
    alert('Gasto guardado correctamente');
}

function editarGasto(id) {
    const listaGastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const gasto = listaGastos.find(g => String(g.id) === String(id));
    if (!gasto) {
        alert('Gasto no encontrado');
        return;
    }

    document.getElementById('gastoEditandoId').value = String(gasto.id);
    document.getElementById('descripcionGasto').value = gasto.descripcion || '';
    document.getElementById('montoGasto').value = gasto.monto ?? '';
    document.getElementById('categoriaGasto').value = gasto.categoria || '';

    const titulo = document.getElementById('tituloFormGasto');
    if (titulo) titulo.innerHTML = '<i class="fas fa-pen me-2"></i>Editar Gasto';
    const btn = document.getElementById('btnGuardarGasto');
    if (btn) btn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';

    const formGasto = document.getElementById('formGasto');
    formGasto.style.display = 'block';
    formGasto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('descripcionGasto').focus();
}

function eliminarGasto(id) {
    const listaGastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const gasto = listaGastos.find(g => String(g.id) === String(id));
    if (!gasto) {
        alert('Gasto no encontrado');
        return;
    }

    const ok = confirm(
        `¿Eliminar este gasto?\n\n${gasto.descripcion}\n${formatearMonto(gasto.monto)}\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;

    eliminarGastoDeListas(id);

    const editando = document.getElementById('gastoEditandoId').value;
    if (String(editando) === String(id)) cancelarFormGasto();

    cargarGastos();
    alert('Gasto eliminado correctamente');
}

function getCategoriaColor(categoria) {
    const colores = {
        'insumos': 'categoria-insumos',
        'servicios': 'categoria-servicios',
        'nomina': 'categoria-nomina',
        'renta': 'categoria-renta',
        'utilities': 'categoria-utilities',
        'otros': 'categoria-otros'
    };
    return colores[categoria] || 'categoria-otros';
}

function cargarGastos() {
    gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const gastosHoy = gastos.filter(g => esGastoDelDiaLaboral(g));

    const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    document.getElementById('totalGastosHoy').textContent = formatearMonto(totalGastos);

    const gastosPorCategoria = {};
    gastosHoy.forEach(g => {
        gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + (parseFloat(g.monto) || 0);
    });

    const categoriaDiv = document.getElementById('gastosPorCategoria');
    categoriaDiv.innerHTML = '';

    if (Object.keys(gastosPorCategoria).length === 0) {
        categoriaDiv.innerHTML = '<p class="text-muted">No hay gastos registrados hoy</p>';
    } else {
        Object.entries(gastosPorCategoria).forEach(([cat, monto]) => {
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center mb-2';
            div.innerHTML = `
                <span class="categoria-badge ${getCategoriaColor(cat)}">${escaparHtml(cat)}</span>
                <span class="text-warning">${formatearMonto(monto)}</span>
            `;
            categoriaDiv.appendChild(div);
        });
    }

    const listaGastos = document.getElementById('listaGastos');
    listaGastos.innerHTML = '';

    if (gastosHoy.length === 0) {
        listaGastos.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-receipt fa-3x mb-3"></i>
                <p>No hay gastos registrados hoy</p>
            </div>
        `;
        return;
    }

    gastosHoy.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(gasto => {
        const div = document.createElement('div');
        div.className = 'gasto-item';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${escaparHtml(gasto.descripcion)}</h6>
                    <span class="categoria-badge ${getCategoriaColor(gasto.categoria)}">${escaparHtml(gasto.categoria)}</span>
                </div>
                <div class="text-end me-2">
                    <h5 class="mb-0 text-warning">${formatearMonto(gasto.monto)}</h5>
                    <small class="text-muted">${new Date(gasto.fecha).toLocaleTimeString()}</small>
                </div>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-info" title="Editar"
                            onclick="editarGasto('${escaparHtml(String(gasto.id))}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" title="Eliminar"
                            onclick="eliminarGasto('${escaparHtml(String(gasto.id))}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        listaGastos.appendChild(div);
    });
}

function exportarGastos() {
    gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const hoyLocal = fechaLocalISOGastos(getFechaHoyGastos());
    const gastosHoy = gastos.filter(g => esGastoDelDiaLaboral(g));

    if (gastosHoy.length === 0) {
        alert('No hay gastos para exportar hoy');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(gastosHoy.map(g => ({
        Fecha: new Date(g.fecha).toLocaleString(),
        Descripción: g.descripcion,
        Categoría: g.categoria,
        Monto: g.monto
    })));

    ws['!cols'] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 }
    ];

    for (let i = 1; i <= gastosHoy.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (ws[cellRef]) ws[cellRef].z = '"$"#,##0';
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_${hoyLocal}.xlsx`);
    alert('Reporte exportado correctamente');
}

document.addEventListener('DOMContentLoaded', cargarGastos);
