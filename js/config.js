// ==========================================
// CONFIGURACIÓN DE BASE DE DATOS (SUPABASE)
// ==========================================

/* 
  Nota sobre Seguridad: 
  Esta clave (sb_publishable_...) es una clave "Anónima Pública" por diseño. 
  No hay riesgo de que "te hackeen" porque Supabase protege los datos a través 
  de Políticas SQL (RLS - Row Level Security) en tu servidor, no escondiendo 
  esta clave. La hemos movido a este archivo para mantener el código limpio.
*/

const SUPABASE_URL = 'https://wozkealekidlsxapxsnd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pEA4evun2sDVGcRM249aUQ_ebtQl9Nc';

let dbClient = null;

// Inicializamos el cliente si la librería CDN cargó correctamente
if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Error crítico: El motor de Supabase no cargó. Revisa tu conexión a internet.");
}
