// ===============================
// LÓGICA DE USUARIO Y SEGUIMIENTO
// ===============================

const copyBtns = document.querySelectorAll('.copy-btn');
const toast = document.getElementById('toast');
const tabs = document.querySelectorAll('.tab-btn');
const views = {
    binance: document.getElementById('view-binance'),
    binancepay: document.getElementById('view-binancepay'),
    zelle: document.getElementById('view-zelle')
};
let currentView = 'binance';

// Lógica de pestañas
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        if (currentView === target) return;

        document.querySelector('.tab-btn.active').classList.remove('active');
        tab.classList.add('active');

        views[currentView].classList.remove('active');
        views[target].classList.add('active');

        if (target === 'zelle') document.body.classList.add('theme-zelle');
        else document.body.classList.remove('theme-zelle');
        
        currentView = target;
    });
});

// Cargar configuraciones dinámicas de la base de datos
window.loadDynamicSettings = async function() {
    try {
        if (!dbClient) return;
        
        // 1. Verificar Estado Operativo de la Tienda
        const { data: storeData } = await dbClient.from('settings').select('value').eq('id', 'store_status').single();
        const isOpen = storeData?.value ? storeData.value.is_open : true;
        console.log("Portal Status:", isOpen ? "Abierto" : "Cerrado");

        const container = document.getElementById('paymentMethodsContainer');
        const closedMsg = document.getElementById('storeClosedMessage');
        
        if (!isOpen) {
            // Tienda cerrada: Ocultar todo y mostrar aviso
            if(container) container.style.display = 'none';
            if(closedMsg) closedMsg.style.display = 'block';
            return; 
        } else {
            // Tienda Abierta: Asegurar que se muestre todo
            if(container) container.style.display = 'block';
            if(closedMsg) closedMsg.style.display = 'none';
        }

        // 2. Cargar Zelle Config
        const { data, error } = await dbClient.from('settings').select('value').eq('id', 'zelle_config').single();
        if (data && data.value) {
            const config = data.value;
            const zelleTabBtn = document.getElementById('zelleTabBtn');
            
            if (!config.active) {
                // Esconder Zelle por completo
                if (zelleTabBtn) zelleTabBtn.style.display = 'none';
                
                // Si el usuario por casualidad estaba en Zelle, mandarlo a Binance
                if (currentView === 'zelle') {
                    document.querySelector('.tab-btn[data-target="binance"]').click();
                }
            } else {
                if (zelleTabBtn) zelleTabBtn.style.display = 'inline-block';
                
                // Actualizar textos
                const elEmail = document.getElementById('zelleDisplayEmail');
                const elName = document.getElementById('zelleDisplayName');
                const btnCopy = document.getElementById('zelleCopyBtn');
                
                if (elEmail) elEmail.innerText = config.email;
                if (elName) elName.innerText = config.name;
                if (btnCopy) btnCopy.dataset.copy = config.email;
            }
        }
    } catch(e) {
        console.warn("Ajustes dinámicos no cargaron o no existen aún.", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadDynamicSettings();
});

// Portapapeles
copyBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const textToCopy = btn.dataset.copy;
        try {
            await navigator.clipboard.writeText(textToCopy);
            showToast("¡Copiado con éxito!");
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            try { document.execCommand('copy'); showToast("¡Copiado al portapapeles!"); } catch (e) { }
            document.body.removeChild(textArea);
        }
    });
});

function showToast(msg) {
    toast.innerHTML = msg;
    if (currentView === 'zelle') toast.classList.add('theme-zelle-toast');
    else toast.classList.remove('theme-zelle-toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---------------------------
// MODAL DE REPORTE PAGO
// ---------------------------
let activeMethodName = '';

window.openReportModal = function(method) {
    activeMethodName = method;
    document.getElementById('modalMethod').innerText = method;
    document.getElementById('reportModal').classList.add('active');
    
    document.getElementById('reportForm').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('successState').style.display = 'none';
    document.getElementById('reportForm').reset();
    document.getElementById('fileName').innerText = 'Toca para subir una imagen';
};

window.closeModal = function() {
    document.getElementById('reportModal').classList.remove('active');
};

document.getElementById('receiptFile').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        document.getElementById('fileName').innerText = e.target.files[0].name;
        document.querySelector('.file-upload').style.borderColor = 'var(--brand-color)';
        document.querySelector('.file-upload').style.background = 'var(--bg-gradient)';
    }
});

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = document.getElementById('receiptFile').files[0];
    const name = document.getElementById('payerName').value.trim();
    const ref = document.getElementById('payerRef').value.trim();
    
    if (!file) return alert('Por favor sube una captura de pantalla del comprobante.');

    document.getElementById('reportForm').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';

    try {
        if (!dbClient) throw new Error("Base de datos desconectada. Revisa tu internet.");

        // Subir a Storage
        const fileExt = file.name.split('.').pop();
        const safeName = Math.random().toString(36).substring(2, 10);
        const fileName = `${Date.now()}_${safeName}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await dbClient.storage
            .from('receipts')
            .upload(fileName, file);
            
        if (uploadError) throw new Error("Error subiendo foto: " + uploadError.message);

        // Obtener Link público
        const { data: { publicUrl } } = dbClient.storage
            .from('receipts')
            .getPublicUrl(fileName);

        // Insertar a Base de Datos
        const { error: insertError } = await dbClient.from('payments').insert([{
            payer_name: name,
            reference: ref || 'No indicada',
            payment_method: activeMethodName,
            receipt_url: publicUrl,
            status: 'pending'
        }]);

        if (insertError) throw new Error("Error guardando reporte: " + insertError.message);

        // Disparar Notificación de Telegram (Opcional - Silencioso)
        if (typeof TELEGRAM_BOT_TOKEN !== 'undefined' && TELEGRAM_BOT_TOKEN !== '' && TELEGRAM_CHAT_ID !== '') {
            try {
                const textMsg = `🚨 <b>¡NUEVO PAGO RECIBIDO!</b> 🚨\n\n👤 <b>Cliente:</b> ${name}\n🧾 <b>Referencia:</b> ${ref || 'No indicada'}\n💳 <b>Método:</b> ${activeMethodName}\n\n<a href="${publicUrl}">Ver Comprobante Adjunto</a>\n\n⚠️ <i>Entra a tu Dashboard Privado para Aprobar este pago.</i>`;
                
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: textMsg,
                        parse_mode: 'HTML'
                    })
                });
            } catch (telegramErr) {
                console.warn("No se pudo enviar noti a Telegram", telegramErr);
            }
        }

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('successState').style.display = 'block';
    } catch (error) {
        console.error(error);
        alert('Hubo un error al subir tu reporte: ' + error.message);
        document.getElementById('reportForm').style.display = 'block';
        document.getElementById('loadingState').style.display = 'none';
    }
});

// ---------------------------
// TRACKER (RASTREADOR DE PAGO)
// ---------------------------
window.openTrackerModal = function() {
    document.getElementById('trackerModal').classList.add('active');
    document.getElementById('searchResult').innerHTML = '';
    document.getElementById('searchRef').value = '';
};

window.closeTracker = function() {
    document.getElementById('trackerModal').classList.remove('active');
};

window.searchPayment = async function(e) {
    if (e) e.preventDefault();
    const ref = document.getElementById('searchRef').value.trim();
    if (!ref) return alert("Por favor ingresa un dato para buscar.");

    const btn = document.getElementById('searchBtn');
    btn.innerText = "Buscando...";
    btn.disabled = true;

    try {
        if (!dbClient) throw new Error("Base de datos fuera de línea.");

        const { data, error } = await dbClient.from('payments')
            .select('status, created_at, payment_method, payer_name')
            .or(`reference.eq.${ref},payer_name.ilike.%${ref}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        
        btn.innerText = "Buscar";
        btn.disabled = false;

        const resBox = document.getElementById('searchResult');
        if (data.length === 0) {
            resBox.innerHTML = `<p style="color:var(--danger); padding:15px; background:rgba(255,59,48,0.1); border-radius:10px; margin-top:15px; border:1px solid rgba(255,59,48,0.2);">❌ No se encontró ningún reporte con ese dato.</p>`;
            return;
        }

        const p = data[0];
        let sLabel = '🔄 En Revisión (Pendiente)';
        let sColor = 'var(--brand-color)';
        if (p.status === 'approved') { sLabel = '✅ PAGO APROBADO EXITOSAMENTE'; sColor = '#02C076'; }
        if (p.status === 'rejected') { sLabel = '❌ PAGO RECHAZADO'; sColor = '#F6465D'; }

        resBox.innerHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-top: 20px; text-align: left;">
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom:5px;">Cliente: <strong style="color:white;">${p.payer_name}</strong></p>
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom:15px;">Método: <strong style="color:white;">${p.payment_method}</strong></p>
                <div style="font-size: 15px; font-weight: 700; color: ${sColor}; padding: 10px; border: 1px dashed ${sColor}; border-radius: 8px; text-align: center;">${sLabel}</div>
            </div>
        `;
    } catch (e) {
        alert(e.message);
        btn.innerText = "Buscar";
        btn.disabled = false;
    }
};
