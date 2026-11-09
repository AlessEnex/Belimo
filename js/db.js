// Accesso alla base dati: esegue data/belimo.sql in un SQLite in memoria (sql.js)
// Richiede sql-wasm.js caricato prima di questo file.
const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';

window.db = null;

async function apriDatabase() {
	const [SQL, script] = await Promise.all([
		initSqlJs({ locateFile: f => SQLJS_CDN + f }),
		fetch('data/belimo.sql').then(r => {
			if (!r.ok) throw new Error(`data/belimo.sql: HTTP ${r.status}`);
			return r.text();
		})
	]);
	window.db = new SQL.Database();
	window.db.exec(script);
	return window.db;
}

// Esegue una SELECT e restituisce un array di oggetti { colonna: valore }
function query(sql, params = []) {
	const stmt = window.db.prepare(sql);
	try {
		stmt.bind(params);
		const righe = [];
		while (stmt.step()) righe.push(stmt.getAsObject());
		return righe;
	} finally {
		stmt.free();
	}
}

// Valore numerico (mm) di una misura "16 mm" / "1 1/4\"" per ordinarle
function misuraValore(m) {
	const s = String(m).trim();
	const mm = s.match(/^([\d.,]+)\s*mm$/i);
	if (mm) return parseFloat(mm[1].replace(',', '.'));
	const inch = s.match(/^(?:(\d+)\s+)?(?:(\d+)\/(\d+)|(\d+))"$/);
	if (inch) {
		const intero = Number(inch[1] || 0) + Number(inch[4] || 0);
		const frazione = inch[2] ? Number(inch[2]) / Number(inch[3]) : 0;
		return (intero + frazione) * 25.4;
	}
	return 9999;
}

// Righe di accoppiamento già in ordine di modello: mantiene i gruppi
// (modello + tipologia) nell'ordine di comparsa e ordina le misure in modo crescente
function ordinaPerMisura(righe) {
	const gruppo = {};
	righe.forEach((r, i) => { gruppo[r.modello + '|' + r.tipologia] ??= i; });
	return [...righe].sort((a, b) =>
		gruppo[a.modello + '|' + a.tipologia] - gruppo[b.modello + '|' + b.tipologia]
		|| misuraValore(a.misura) - misuraValore(b.misura));
}

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
