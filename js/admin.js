// ===============================
// LÓGICA DE DASHBOARD MODO ADMIN
// ===============================

// Almacenamiento de sesión al recargar
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('adminAuth') === 'true') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardApp').style.display = 'block';
        fetchData();
    }
});

// Manejo de la pantalla de inicio de sesión visual
window.login = function() {
    if(document.getElementById('adminPass').value === "admin123") {
        localStorage.setItem('adminAuth', 'true');
        document.getElementById('loginScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardApp').style.display = 'block';
            fetchData();
        }, 400);
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('adminPass').style.borderColor = 'var(--danger)';
    }
}

let allPayments = [];

// Generación de la tabla desde Supabase
window.fetchData = async function() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="6" style="padding:0;"><div class="skeleton"></div></td></tr><tr><td colspan="6" style="padding:0;"><div class="skeleton"></div></td></tr>`;

    try {
        if (!dbClient) throw new Error("Base de Datos no conectada.");
        const { data, error } = await dbClient.from('payments').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        allPayments = data || [];
        applyFilters(); 

    } catch(e) { console.error(e); alert("Error de Sincronización DB: " + e.message); }
}

window.applyFilters = function() {
    const searchTerm = document.getElementById('filterSearch').value.toLowerCase();
    const statusVal = document.getElementById('filterStatus').value;
    const dateVal = document.getElementById('filterDate').value;
    
    let filtered = allPayments.filter(p => {
        // Filtro por Estado
        if (statusVal !== 'all' && p.status !== statusVal) return false;
        
        // Búsqueda de Texto
        if (searchTerm) {
           const matchName = p.payer_name.toLowerCase().includes(searchTerm);
           const matchRef = p.reference ? p.reference.toLowerCase().includes(searchTerm) : false;
           if (!matchName && !matchRef) return false;
        }

        // Filtro por Fecha
        if (dateVal !== 'all') {
            const dateObj = new Date(p.created_at);
            const now = new Date();
            const diffMs = now - dateObj;
            if (dateVal === 'today' && diffMs > 86400000) return false;
            if (dateVal === 'week' && diffMs > 604800000) return false;
            if (dateVal === 'month' && diffMs > 2592000000) return false;
        }

        return true;
    });

    renderTable(filtered);
}

window.renderTable = function(data) {
    const tbody = document.getElementById('tableBody');

    // Actualizar estadísticas Superiores dinámicamente según filtros
    document.getElementById('valPending').innerText = data.filter(d => d.status === 'pending').length;
    document.getElementById('valApproved').innerText = data.filter(d => d.status === 'approved').length;
    document.getElementById('valTotal').innerText = data.length;

    tbody.innerHTML = '';
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color:#666;">No se encontraron resultados para los filtros actuales.</td></tr>`;
        return;
    }

    data.forEach(item => {
        const dateObj = new Date(item.created_at);
        const isPending = item.status === 'pending';
        
        let sClass = 's-pending'; let sText = 'Pendiente';
        if(item.status === 'approved') { sClass = 's-approved'; sText = 'Aprobado'; }
        if(item.status === 'rejected') { sClass = 's-rejected'; sText = 'Rechazado'; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="client-col">
                    <div class="avatar">${item.payer_name.charAt(0).toUpperCase()}</div>
                    ${item.payer_name}
                </div>
            </td>
            <td style="font-family: monospace; letter-spacing: 0.5px;">${item.reference || 'N/A'}</td>
            <td><div class="method-badge">${item.payment_method}</div></td>
            <td style="color:#888;">${dateObj.toLocaleDateString()} <span style="font-size:11px;">${dateObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></td>
            <td><div class="status-badge ${sClass}">${sText}</div></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-view" onclick="openImg('${item.receipt_url}')" title="Ver Comprobante">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    ${isPending ? `
                    <button class="btn-icon btn-ok" onclick="setStatus('${item.id}', 'approved')" title="Aprobar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <button class="btn-icon btn-no" onclick="setStatus('${item.id}', 'rejected')" title="Rechazar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.setStatus = async function(id, newStatus) {
    const isOk = newStatus === 'approved';
    if(!confirm(`¿Estás seguro de ${isOk ? 'APROBAR' : 'RECHAZAR'} transacción?`)) return;
    try {
        const { error } = await dbClient.from('payments').update({ status: newStatus }).eq('id', id);
        if(error) throw error;
        fetchData();
    } catch(e) { alert("Error: " + e.message); }
}

// Modal de imagen
window.openImg = function(url) {
    document.getElementById('modalGraphic').src = url;
    const m = document.getElementById('imgModal');
    m.style.opacity = '1'; m.style.pointerEvents = 'auto';
}

window.closeImg = function() {
    const m = document.getElementById('imgModal');
    m.style.opacity = '0'; m.style.pointerEvents = 'none';
    setTimeout(() => { document.getElementById('modalGraphic').src = ''; }, 300);
}

// Cerrar sesión
window.logout = function() {
    localStorage.removeItem('adminAuth');
    location.reload();
}
