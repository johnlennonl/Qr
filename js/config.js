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

// ==========================================
// CONFIGURACIÓN DE TELEGRAM (Notificaciones)
// ==========================================
const TELEGRAM_BOT_TOKEN = '8744841803:AAF6EHVcKRCBM25SQUbvzBNwUJ02QE9xiPY'; // Pega aquí tu Token del BotFather (Ej: '123456:ABC-DEF...')
const TELEGRAM_CHAT_ID = '8501328211';   // Pega aquí tu Chat ID (Ej: '987654321')

let dbClient = null;

// Inicializamos el cliente si la librería CDN cargó correctamente
if (window.supabase) {
  dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error("Error crítico: El motor de Supabase no cargó. Revisa tu conexión a internet.");
}
