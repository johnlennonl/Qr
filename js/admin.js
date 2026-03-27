// ===============================
// LÓGICA DE DASHBOARD MODO ADMIN
// ===============================

// Almacenamiento de sesión al recargar
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('appLoader');
    document.getElementById('loaderText').innerText = "RESTABLECIENDO SESIÓN...";
    loader.style.opacity = '1';
    loader.style.pointerEvents = 'auto';

    const { data: { session } } = await dbClient.auth.getSession();
    if (session) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardApp').style.display = 'block';
        
        document.getElementById('loaderText').innerText = "SINCRONIZANDO DATOS...";
        await fetchData();
        await loadStoreStatus();
        setupRealtime();
        
        setTimeout(() => {
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
        }, 800);
    } else {
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
    }
});

// Manejo de la pantalla de inicio de sesión visual
window.login = async function() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPass').value;
    const btn = document.getElementById('loginBtn');
    
    if (!email || !password) return;
    
    btn.innerText = "Verificando Credenciales...";
    document.getElementById('loginError').style.display = 'none';
    
    const { data, error } = await dbClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        document.getElementById('loginError').style.display = 'block';
        btn.innerText = "Sincronizar Panel";
        return;
    }

    const loader = document.getElementById('appLoader');
    document.getElementById('loaderText').innerText = "AUTENTICANDO...";
    loader.style.opacity = '1';
    loader.style.pointerEvents = 'auto';

    setTimeout(async () => {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardApp').style.display = 'block';
        document.getElementById('loaderText').innerText = "OBTENIENDO COMPROBANTES...";
        
        await fetchData();
        await loadStoreStatus();
        setupRealtime();
        
        setTimeout(() => {
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
        }, 800);
    }, 500);
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
        if (item.isNew) tr.classList.add('row-new');
        
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
                    <button class="btn-icon btn-delete" onclick="deletePayment('${item.id}')" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
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

window.deletePayment = async function(id) {
    if(!confirm('¿Estás seguro de que deseas ELIMINAR este pago permanentemente? Esta acción no se puede deshacer.')) return;
    try {
        const { error } = await dbClient.from('payments').delete().eq('id', id);
        if(error) throw error;
        fetchData();
    } catch(e) { alert("Error al eliminar: " + e.message); }
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

// LÓGICA DE TIEMPO REAL (NOTIFICACIONES)
let unreadCount = 0;
let realtimeSubscription = null;

window.setupRealtime = function() {
    if (realtimeSubscription) return;
    
    realtimeSubscription = dbClient
        .channel('admin-payments-channel')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'payments' },
            (payload) => {
                const newPayment = payload.new;
                newPayment.isNew = true; // Flag for highlighting
                
                // Add to array at position 0
                allPayments.unshift(newPayment);
                applyFilters();
                
                // Remove highlight after 4 seconds
                setTimeout(() => {
                    newPayment.isNew = false;
                    applyFilters();
                }, 4000);
                
                // Update badge indicator
                unreadCount++;
                const badge = document.getElementById('notifBadge');
                badge.innerText = unreadCount;
                badge.style.opacity = '1';
                badge.style.transform = 'scale(1.2)';
                setTimeout(() => badge.style.transform = 'scale(1)', 300);
                
                // Optional context sound
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.volume = 0.5;
                    audio.play();
                } catch(e) {}

                // Show visual floating Toast
                const toast = document.getElementById('adminToast');
                document.getElementById('toastMessage').innerText = `${newPayment.payer_name} envió un pago vía ${newPayment.payment_method}`;
                toast.style.bottom = '30px';
                
                setTimeout(() => {
                    toast.style.bottom = '-100px';
                }, 6000);

                // Add to dropdown list
                const notifList = document.getElementById('notifList');
                if(notifList.innerHTML.includes('No hay notificaciones')) notifList.innerHTML = '';
                
                const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const notifHtml = `
                    <div style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <div style="font-size: 13px; margin-bottom: 4px;">
                            <strong style="color:var(--accent)">${newPayment.payer_name}</strong> envió un pago de ${newPayment.payment_method}.
                        </div>
                        <div style="color: var(--text-muted); font-size: 11px;">${timeStr}</div>
                    </div>
                `;
                notifList.insertAdjacentHTML('afterbegin', notifHtml);
            }
        )
        .subscribe();
};

window.toggleNotifPopup = function() {
    const popup = document.getElementById('notifPopup');
    if (popup.style.display === 'none') {
        popup.style.display = 'block';
        resetNotifications();
    } else {
        popup.style.display = 'none';
    }
};

window.resetNotifications = function() {
    unreadCount = 0;
    const badge = document.getElementById('notifBadge');
    badge.style.opacity = '0';
};

// ==========================================
// CONFIGURACIÓN DE APERTURA (TIENDA ABIERTA/CERRADA)
// ==========================================

window.loadStoreStatus = async function() {
    try {
        const { data } = await dbClient.from('settings').select('value').eq('id', 'store_status').single();
        if (data && data.value) {
            const isOpen = data.value.is_open;
            document.getElementById('storeMasterToggle').checked = isOpen;
            updateStoreToggleUI(isOpen);
        }
    } catch(e) {
        console.warn("No store_status found", e);
    }
};

window.updateStoreToggleUI = function(isOpen) {
    const label = document.getElementById('storeStatusLabel');
    const slider = document.getElementById('storeToggleSlider');
    const knob = document.getElementById('storeToggleKnob');
    
    if(isOpen) {
        label.innerText = "ABIERTO";
        label.style.color = "var(--success)";
        slider.style.backgroundColor = "var(--success)";
        knob.style.transform = "translateX(20px)";
    } else {
        label.innerText = "CERRADO";
        label.style.color = "var(--danger)";
        slider.style.backgroundColor = "var(--danger)";
        knob.style.transform = "translateX(0)";
    }
};

window.toggleStoreStatus = async function() {
    const isOpen = document.getElementById('storeMasterToggle').checked;
    updateStoreToggleUI(isOpen);
    
    try {
        await dbClient.from('settings').upsert({ id: 'store_status', value: { is_open: isOpen } });
    } catch (e) {
        alert("Error al actualizar la apertura de la tienda: " + e.message);
    }
};

// ==========================================
// CONFIGURACIÓN DINÁMICA (AJUSTES)
// ==========================================
window.updateToggleUI = function() {
    const isChecked = document.getElementById('zelleActiveToggle').checked;
    const slider = document.getElementById('zelleToggleSlider');
    const knob = document.getElementById('zelleToggleKnob');
    if (isChecked) {
        slider.style.backgroundColor = 'var(--success)';
        knob.style.transform = 'translateX(24px)';
    } else {
        slider.style.backgroundColor = '#444';
        knob.style.transform = 'translateX(0)';
    }
};

window.openSettingsModal = async function() {
    document.getElementById('settingsModal').style.opacity = '1';
    document.getElementById('settingsModal').style.pointerEvents = 'auto';
    
    // Load current
    const btn = document.getElementById('saveSettingsBtn');
    btn.innerText = "Cargando...";
    
    try {
        const { data, error } = await dbClient.from('settings').select('value').eq('id', 'zelle_config').single();
        if (data && data.value) {
            document.getElementById('zelleActiveToggle').checked = data.value.active;
            document.getElementById('zelleEmailInput').value = data.value.email || '';
            document.getElementById('zelleNameInput').value = data.value.name || '';
            updateToggleUI();
        }
    } catch(e) { 
        console.warn("No hay config inicial o error", e);
    }
    btn.innerText = "Guardar Cambios";
};

window.closeSettingsModal = function() {
    document.getElementById('settingsModal').style.opacity = '0';
    document.getElementById('settingsModal').style.pointerEvents = 'none';
};

window.saveSettings = async function() {
    const btn = document.getElementById('saveSettingsBtn');
    btn.innerText = "Guardando...";
    
    const config = {
        active: document.getElementById('zelleActiveToggle').checked,
        email: document.getElementById('zelleEmailInput').value.trim(),
        name: document.getElementById('zelleNameInput').value.trim()
    };
    
    try {
        const { error } = await dbClient.from('settings').upsert({ id: 'zelle_config', value: config });
        if(error) throw error;
        
        btn.innerText = "¡Guardado con éxito!";
        setTimeout(() => closeSettingsModal(), 1000);
    } catch(e) {
        alert("Error al guardar: " + e.message);
        btn.innerText = "Guardar Cambios";
    }
};

// Cerrar sesión
window.logout = async function() {
    const loader = document.getElementById('appLoader');
    document.getElementById('loaderText').innerText = "CERRANDO SESIÓN...";
    loader.style.opacity = '1';
    loader.style.pointerEvents = 'auto';

    if(realtimeSubscription) {
        dbClient.removeChannel(realtimeSubscription);
    }
    await dbClient.auth.signOut();
    
    setTimeout(() => {
        location.reload();
    }, 1200);
}
