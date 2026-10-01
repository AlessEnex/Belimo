// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Opzione kit/attuatore selezionata quando ci sono multiple opzioni
window.kitSelezionato = null;
window.motoreSelezionato = null;
// Risultato mostrato a video (usato da salvataggio ed export)
window.risultatoCorrente = null;

// Dati caricati da data/accoppiamenti.json (tabella accoppiamenti valvole-motori)
let dati = { modelli: {}, kit: [], adattatori: [], attuatori: [], accoppiamenti: [] };

const VIE_TESTO = { '2': '2-VIE', '3': '3-VIE' };

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function renderRecapPills(items, type, emptyLabel = 'N/A') {
	if (!items || items.length === 0) {
		return `<span class="recap-pill recap-pill-empty">${emptyLabel}</span>`;
	}

	return items.map(item => {
		const code = item.codice || item.code || item;
		const meta = item.meta || item.descrizione || item.description || '';
		return `
			<span class="recap-pill recap-pill-${type}" title="${escapeHtml(meta || code)}">
				<span class="recap-pill-code">${escapeHtml(code)}</span>
				${meta ? `<span class="recap-pill-meta">${escapeHtml(meta)}</span>` : ''}
			</span>
		`;
	}).join('');
}

function trovaKit(codice) {
	return dati.kit.find(k => k.codice === codice) || { codice, descrizione: '' };
}

function trovaAdattatore(codice) {
	return codice ? (dati.adattatori.find(a => a.codice === codice) || { codice, descrizione: '' }) : null;
}

function trovaAttuatore(codice) {
	return dati.attuatori.find(a => a.codice === codice) || { codice, descrizione: '' };
}

function testoArticolo(item) {
	return item ? `${item.codice} — ${item.descrizione || ''}` : '';
}

// Opzioni kit+attuatore valide per la riga e le vie scelte (con sostituzione kit navale)
function opzioniPerVie(riga, vie, navale) {
	return riga.opzioni
		.filter(o => !o.vie || o.vie === vie)
		.map(o => ({
			kit: trovaKit(navale && o.navale ? dati.kitNavale : o.kit),
			attuatore: trovaAttuatore(o.attuatore)
		}));
}

async function caricaDati() {
	const [accoppiamentiRes, puntiImpiantoRes] = await Promise.all([
		fetch('data/accoppiamenti.json'),
		fetch('data/punti_impianto.json')
	]);
	dati = await accoppiamentiRes.json();
	window.puntiImpianto = (await puntiImpiantoRes.json()).punti || [];
}

function getSelezioneCorrente() {
	const s = window.statoSelezione || {};
	return {
		puntoImpianto: document.getElementById('puntoImpiantoSelect')?.value || '',
		modello: s.modello,
		tipologia: s.tipologia,
		misura: s.misura,
		vie: s.vie,
		navale: !!s.navale
	};
}

function mostraRisultatoAutomatico() {
	const s = getSelezioneCorrente();
	// Serve tutto selezionato
	if (!s.modello || !s.tipologia || !s.misura || !s.vie) {
		document.getElementById('risultato').classList.add('hidden');
		nascondiErrore();
		window.risultatoCorrente = null;
		return;
	}
	const riga = dati.accoppiamenti.find(r => r.modello === s.modello && r.tipologia === s.tipologia && r.misura === s.misura);
	const valvola = riga?.valvole[s.vie];
	if (!valvola) {
		mostraErrore('Nessuna valvola disponibile per la combinazione selezionata.');
		return;
	}
	const opzioni = opzioniPerVie(riga, s.vie, s.navale);
	if (opzioni.length === 0) {
		mostraErrore('Nessun kit/attuatore configurato per questa combinazione.');
		return;
	}
	renderRisultato({ valvola, adattatoreObj: trovaAdattatore(riga.adattatore), opzioni });
}

function renderRisultato({ valvola, adattatoreObj, opzioni }) {
	const risultato = document.getElementById('risultato');
	const valvolaInfo = document.getElementById('valvolaInfo');
	const kitInfo = document.getElementById('kitInfo');
	const adattatoreInfo = document.getElementById('adattatoreInfo');
	const motoreInfo = document.getElementById('motoreInfo');

	valvolaInfo.innerHTML = `<p><strong>Valvola:</strong> <span class="code">${escapeHtml(valvola.codice)}</span> — ${escapeHtml(valvola.descrizione)}</p>`;

	adattatoreInfo.innerHTML = adattatoreObj
		? `<p><strong>Adattatore:</strong> <span class="code">${escapeHtml(adattatoreObj.codice)}</span> — ${escapeHtml(adattatoreObj.descrizione)}</p>`
		: `<p><strong>Adattatore:</strong> non richiesto.</p>`;

	const mostraMotore = opzione => {
		const a = opzione.attuatore;
		motoreInfo.innerHTML = `<p><strong>Attuatore:</strong> <span class="code">${escapeHtml(a.codice)}</span> — ${escapeHtml(a.descrizione)}</p>`;
		window.kitSelezionato = opzione.kit;
		window.motoreSelezionato = a;
		window.risultatoCorrente = { valvola, adattatore: adattatoreObj, kit: opzione.kit, motore: a };
	};

	if (opzioni.length > 1) {
		// Più kit disponibili: ogni kit ha il suo attuatore
		const righe = opzioni.map((o, idx) => `
			<label style="display:block;margin:6px 0;cursor:pointer;">
				<input type="radio" name="kitChoice" value="${idx}" ${idx === 0 ? 'checked' : ''}>
				<span class="code">${escapeHtml(o.kit.codice)}</span> — ${escapeHtml(o.kit.descrizione)}
				<span style="opacity:0.7;">→ attuatore ${escapeHtml(o.attuatore.codice)}</span>
			</label>
		`).join('');
		kitInfo.innerHTML = '<p style="font-weight:600;margin-bottom:8px;">Scegli un kit:</p>' + righe;
		kitInfo.querySelectorAll('input[name="kitChoice"]').forEach(radio => {
			radio.addEventListener('change', function() {
				mostraMotore(opzioni[Number(this.value)]);
			});
		});
	} else {
		const k = opzioni[0].kit;
		kitInfo.innerHTML = `<p><strong>Kit:</strong> <span class="code">${escapeHtml(k.codice)}</span> — ${escapeHtml(k.descrizione)}</p>`;
	}
	mostraMotore(opzioni[0]);

	risultato.classList.remove('hidden');
	nascondiErrore();
	// Mostra il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = '';

	// Mostra il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = '';
}

function mostraErrore(msg) {
	const el = document.getElementById('errore');
	el.textContent = msg;
	el.classList.remove('hidden');
	document.getElementById('risultato').classList.add('hidden');
	window.risultatoCorrente = null;
	// Nascondi il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = 'none';

	// Nascondi il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = 'none';
}

function nascondiErrore() {
	const el = document.getElementById('errore');
	el.textContent = '';
	el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
	await caricaDati();
	window.onSelezioneCambiata = mostraRisultatoAutomatico;
	if (window.initTagUI) window.initTagUI(dati);
	// Popola la select punto di impianto
	const select = document.getElementById('puntoImpiantoSelect');
	const infoIcon = document.getElementById('puntoImpiantoInfoIcon');
	const infoMsg = document.getElementById('puntoImpiantoInfoMsg');
	if (select && window.puntiImpianto) {
		select.innerHTML = '<option value="">Seleziona punto di impianto...</option>' + window.puntiImpianto.map(p => `<option value="${p}">${p}</option>`).join('');
		select.addEventListener('change', function() {
			if (select.value === 'Collettore AUX-PDC') {
				infoIcon.style.display = '';
				infoMsg.style.display = '';
				infoMsg.textContent = 'Questa configurazione si riferisce a quando ci sono circuiti con pompa di calore o aria condizionata che richiedono un motore sul collettore di aspirazione che divide due bancate di compressori';
			} else {
				infoIcon.style.display = 'none';
				infoMsg.style.display = 'none';
				infoMsg.textContent = '';
			}
		});
		// Mostra info se già selezionato
		select.dispatchEvent(new Event('change'));
		// Tooltip su icona
		if (infoIcon) {
			infoIcon.onclick = function() {
				alert(infoMsg.textContent);
			};
		}
	}

	// Collega il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			if (typeof esportaRisultatoCSV === 'function') esportaRisultatoCSV();
		});
	}

	// Collega il pulsante Salva riepilogo PDF
	const exportSummaryPdfBtn = document.getElementById('exportSummaryPdfBtn');
	if (exportSummaryPdfBtn) {
		exportSummaryPdfBtn.addEventListener('click', () => {
			if (typeof esportaRiepilogoPDF === 'function') esportaRiepilogoPDF();
		});
	}

	// Collega il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			const r = window.risultatoCorrente;
			if (!r) return;
			window.configurazioniSalvate.push({
				...getSelezioneCorrente(),
				valvola: testoArticolo(r.valvola),
				kit: testoArticolo(r.kit),
				adattatore: r.adattatore ? testoArticolo(r.adattatore) : '',
				motore: testoArticolo(r.motore)
			});
			aggiornaTabellaConfigurazioni();
		});
	}

	// Collega il pulsante esporta tutte in CSV
	const exportAllBtn = document.getElementById('exportAllCsvBtn');
	if (exportAllBtn) {
		exportAllBtn.addEventListener('click', () => {
			esportaTutteConfigurazioniCSV();
		});
	}

	// Collega il pulsante Mostra Recap
	const toggleRecapBtn = document.getElementById('toggleRecapBtn');
	const recapModal = document.getElementById('recapModal');
	const closeRecapBtn = document.getElementById('closeRecapBtn');
	if (toggleRecapBtn && recapModal) {
		toggleRecapBtn.addEventListener('click', () => {
			mostraRecapConfigurazione();
			recapModal.style.display = 'flex';
		});
	}
	if (closeRecapBtn && recapModal) {
		closeRecapBtn.addEventListener('click', () => {
			recapModal.style.display = 'none';
		});
	}
});

// Mostra la tabella accoppiamenti valvole-motori
function mostraRecapConfigurazione() {
	const recapContent = document.getElementById('recapContent');
	const articoliBox = document.getElementById('articoliDisponibili');
	if (!recapContent) return;

	if (!dati.accoppiamenti || dati.accoppiamenti.length === 0) {
		recapContent.innerHTML = '<p style="color:#8e8e93;text-align:center;padding:20px;">Dati non ancora caricati.</p>';
		return;
	}

	// Popola la sidebar con articoli disponibili
	if (articoliBox) {
		const sezione = (titolo, items) => `
			<div style="margin-bottom:16px;"><h4 style="color:#007aff;font-size:0.9em;margin:0 0 8px 0;">${titolo}</h4>
			<div style="font-size:0.8em;color:#8e8e93;line-height:1.6;">
				${items.map(i => `<div><strong>${escapeHtml(i.codice)}</strong> - ${escapeHtml(i.descrizione)}</div>`).join('')}
			</div></div>`;
		articoliBox.innerHTML =
			sezione('Kit', dati.kit) +
			sezione('Attuatori', dati.attuatori) +
			sezione('Adattatori', dati.adattatori);
	}

	let html = `
		<div class="recap-toolbar">
			<div class="recap-count">${dati.accoppiamenti.length} righe — ${escapeHtml(dati.fonte || '')}</div>
			<div class="recap-legend">
				<span class="recap-pill recap-pill-brand"><span class="recap-pill-code">BELIMO</span></span>
				<span class="recap-pill recap-pill-watergate"><span class="recap-pill-code">WATERGATE</span></span>
				<span class="recap-pill recap-pill-onoff"><span class="recap-pill-code">ON-OFF</span></span>
				<span class="recap-pill recap-pill-modulating"><span class="recap-pill-code">MODULANTE</span></span>
			</div>
		</div>
		<div class="recap-table-wrap">
			<table class="recap-rules-table">
				<thead>
					<tr>
						<th>Misura</th>
						<th>Valvola 2-vie</th>
						<th>Valvola 3-vie</th>
						<th>Adattatore</th>
						<th>Kit attuatore</th>
						<th>Attuatore</th>
					</tr>
				</thead>
				<tbody>
	`;

	let gruppoCorrente = '';
	dati.accoppiamenti.forEach(r => {
		const gruppo = `${dati.modelli?.[r.modello] || r.modello} — ${r.tipologia}`;
		if (gruppo !== gruppoCorrente) {
			gruppoCorrente = gruppo;
			html += `<tr class="recap-brand-row"><td colspan="6">${escapeHtml(gruppo)}</td></tr>`;
		}
		const adattatore = trovaAdattatore(r.adattatore);
		const kitItems = r.opzioni.map(o => {
			const k = trovaKit(o.kit);
			const note = [o.vie ? `solo ${VIE_TESTO[o.vie]}` : '', o.navale ? `navale: ${dati.kitNavale}` : ''].filter(Boolean).join(' · ');
			return { codice: k.codice, descrizione: note ? `${k.descrizione} (${note})` : k.descrizione };
		});
		const attuatoriHtml = r.opzioni.map(o => {
			const a = trovaAttuatore(o.attuatore);
			return `
				<div class="recap-pair">
					<span class="recap-pill ${a.brand === 'WATERGATE' ? 'recap-pill-watergate' : 'recap-pill-brand'}" title="${escapeHtml(a.descrizione)}">
						<span class="recap-pill-code">${escapeHtml(a.codice)}</span>
						<span class="recap-pill-meta">${escapeHtml(a.descrizione)}</span>
					</span>
					<span class="recap-pill ${a.tipo === 'MODULANTE' ? 'recap-pill-modulating' : 'recap-pill-onoff'}" title="${escapeHtml(a.tipo || 'N/A')}">
						<span class="recap-pill-code">${a.tipo === 'MODULANTE' ? 'MOD' : escapeHtml(a.tipo || 'N/A')}</span>
					</span>
				</div>`;
		}).join('');

		html += `
			<tr>
				<td class="recap-valve-cell"><div class="recap-valve-title">${escapeHtml(r.misura)}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['2'] ? [r.valvole['2']] : [], 'geometry', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['3'] ? [r.valvole['3']] : [], 'vport', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(adattatore ? [adattatore] : [], 'adapter', 'Non richiesto')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(kitItems, 'kit')}</div></td>
				<td><div class="recap-pill-stack">${attuatoriHtml}</div></td>
			</tr>
		`;
	});

	html += `
				</tbody>
			</table>
		</div>
		<p style="font-size:0.85em;color:#8e8e93;margin-top:10px;">(*) Se macchina navale usare kit INOX-NAVI codice ${escapeHtml(dati.kitNavale || '')} al posto di 25C162A.</p>
	`;
	recapContent.innerHTML = html;
}

function aggiornaTabellaConfigurazioni() {
	const box = document.getElementById('configListBox');
	const table = document.getElementById('configListTable');
	if (!box || !table) return;
	if (window.configurazioniSalvate.length === 0) {
		box.style.display = 'none';
		table.innerHTML = '';
		return;
	}
	box.style.display = '';
	// Header
	table.innerHTML = `<tr><th>Punto impianto</th><th>Valvola</th><th>Motore</th><th>Perno/Kit</th><th>Adattatore</th></tr>`;
	// Righe
	window.configurazioniSalvate.forEach(cfg => {
		table.innerHTML += `<tr>
			<td>${escapeHtml(cfg.puntoImpianto)}</td>
			<td>${escapeHtml(cfg.valvola)}</td>
			<td>${escapeHtml(cfg.motore)}</td>
			<td>${escapeHtml(cfg.kit)}</td>
			<td>${escapeHtml(cfg.adattatore || 'Non richiesto')}</td>
		</tr>`;
	});
}

// Esporta tutte le configurazioni salvate in un unico CSV
function esportaTutteConfigurazioniCSV() {
	if (configurazioniSalvate.length === 0) return;
	// Raggruppa articoli (valvola, kit, adattatore, motore) e somma le quantità
	const articoli = {};
	const aggiungi = (tipo, descrizione) => {
		if (!descrizione) return;
		if (!articoli[descrizione]) articoli[descrizione] = { tipo, descrizione, quantita: 1 };
		else articoli[descrizione].quantita++;
	};
	configurazioniSalvate.forEach(cfg => {
		aggiungi('Valvola', cfg.valvola);
		aggiungi('Kit', cfg.kit);
		aggiungi('Adattatore', cfg.adattatore);
		aggiungi('Motore', cfg.motore);
	});
	mostraCsvArticoliPreviewModal(articoli);
}

// Mostra il modal di preview con lista articoli e quantità
function mostraCsvArticoliPreviewModal(articoli) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la lista HTML
	let html = '<table style="width:100%;text-align:left;font-size:1.05em;">';
	html += '<tr><th>Articolo</th><th>Quantità</th></tr>';
	Object.values(articoli).forEach(a => {
		html += `<tr><td>${escapeHtml(a.descrizione)}</td><td style="text-align:center;">${a.quantita}</td></tr>`;
	});
	html += '</table>';
	tableBox.innerHTML = html;
	modal.style.display = 'flex';

	// Gestione pulsanti
	const btnConferma = document.getElementById('csvPreviewConfirmBtn');
	const btnAnnulla = document.getElementById('csvPreviewCancelBtn');
	if (btnConferma) {
		btnConferma.onclick = function() {
			esportaCsvArticoli(articoli);
			modal.style.display = 'none';
		};
	}
	if (btnAnnulla) {
		btnAnnulla.onclick = function() {
			modal.style.display = 'none';
		};
	}
}

// Esporta i dati articoli (descrizione + quantità)
function esportaCsvArticoli(articoli) {
	const header = ['Articolo','Quantità'];
	const rows = Object.values(articoli).map(a => [a.descrizione, a.quantita]);
	let csv = [header, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'articoli.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
