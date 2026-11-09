// UI dinamica a tag per i filtri
window.statoSelezione = {
	modello: null,
	variante: null,
	tipologia: null,
	marca: null,
	misura: null,
	vie: null,
	corpoInox: false
};

const VIE_LABEL = { '2': '2-VIE', '3': '3-VIE' };

function creaTag(container, values, selected, disabledSet, onClick, labelFn = v => v) {
	container.innerHTML = '';
	values.forEach(val => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'tag-btn';
		btn.textContent = labelFn(val);
		const isSelected = selected === val;
		if (isSelected) btn.classList.add('selected');
		btn.setAttribute('aria-pressed', String(isSelected));
		if (disabledSet && disabledSet.has(val)) {
			btn.classList.add('disabled');
			btn.disabled = true;
		}
		btn.addEventListener('click', () => onClick(val));
		container.appendChild(btn);
	});
}

function unici(arr) {
	return [...new Set(arr)];
}

// Passo bloccato finché non è scelto quello a monte
function bloccaPasso(containerId, messaggio) {
	const container = document.getElementById(containerId);
	container.innerHTML = `<span class="tag-locked">${escapeHtml(messaggio)}</span>`;
	container.closest('.field')?.classList.add('field-locked');
}

function sbloccaPasso(containerId) {
	document.getElementById(containerId).closest('.field')?.classList.remove('field-locked');
}

// Pill della valvola: materiale corpo e tipo di passaggio della sfera
function pillValvola(v) {
	const pills = [];
	if (v.corpo) pills.push(`<span class="pill ${v.corpo === 'INOX' ? 'pill-inox' : 'pill-ottone'}">corpo ${escapeHtml(v.corpo.toLowerCase())}</span>`);
	if (v.passaggio) pills.push(`<span class="pill ${v.passaggio === 'V-PORT' ? 'pill-vport' : 'pill-full'}">${escapeHtml(v.passaggio)}</span>`);
	return pills.join('');
}

// Anteprima nel pannello Risultato: valvole che corrispondono ai filtri scelti finora
function aggiornaAnteprimaValvola(righe) {
	const s = statoSelezione;
	const box = document.getElementById('valvolaPreview');
	if (!box) return;
	if (!s.vie) {
		box.innerHTML = '';
		box.classList.add('hidden');
		return;
	}
	const viste = new Set();
	const voci = righe
		.filter(r => r.valvole[s.vie])
		.sort((a, b) => misuraValore(a.misura) - misuraValore(b.misura))
		.filter(r => {
			const chiave = r.valvole[s.vie].codice;
			if (viste.has(chiave)) return false;
			viste.add(chiave);
			return true;
		});
	const righeHtml = voci.map(r => {
		const v = r.valvole[s.vie];
		return `
			<div class="vp-row">
				<div class="vp-head">
					<span class="code">${escapeHtml(v.codice)}</span>
					<span class="vp-desc">${escapeHtml(v.descrizione)}</span>
				</div>
				<div class="vp-pills">
					<span class="pill pill-tipo">${VIE_LABEL[s.vie]}</span>
					<span class="pill pill-tipo">${escapeHtml(datiUI?.modelli?.[r.modello] || r.modello)}</span>
					<span class="pill pill-tipo">${escapeHtml(r.misura)}</span>
					<span class="pill pill-tipo">${escapeHtml(VARIANTE_BREVE[r.variante] || 'Standard')}</span>
					${pillValvola(v)}
				</div>
			</div>`;
	}).join('');
	box.innerHTML = `<div class="vp-title">Valvole che corrispondono · ${voci.length}</div>
		<div class="vp-list">${righeHtml || '<span class="res-muted">Nessuna valvola</span>'}</div>`;
	box.classList.remove('hidden');
}

function aggiornaTagUI(dati) {
	const s = statoSelezione;
	const aggiorna = () => {
		aggiornaTagUI(dati);
		if (window.onSelezioneCambiata) window.onSelezioneCambiata();
	};
	const vieOk = o => !o.vie || o.vie === s.vie;
	const rigaVie = (r, v) => r.valvole[v] && r.opzioni.some(o => !o.vie || o.vie === v);

	// 1. Tipo valvola (2 / 3 vie)
	const vieDis = new Set(['2', '3'].filter(v => !dati.accoppiamenti.some(r => rigaVie(r, v))));
	creaTag(document.getElementById('vieTags'), ['2', '3'], s.vie, vieDis, val => {
		s.vie = s.vie === val ? null : val;
		aggiorna();
	}, val => VIE_LABEL[val]);
	const righeVie = dati.accoppiamenti.filter(r => s.vie && rigaVie(r, s.vie));

	// 2. Brand valvola (GMC, REF...)
	const modelli = unici(righeVie.map(r => r.modello));
	if (s.modello && !modelli.includes(s.modello)) s.modello = null;
	if (!s.vie) bloccaPasso('modelloValvolaTags', 'Scegli prima 2 vie o 3 vie');
	else {
		sbloccaPasso('modelloValvolaTags');
		creaTag(document.getElementById('modelloValvolaTags'), modelli, s.modello, null, val => {
			s.modello = s.modello === val ? null : val;
			s.misura = null;
			s.variante = null;
			s.tipologia = null;
			s.marca = null;
			aggiorna();
		}, val => dati.modelli?.[val] || val);
	}

	// 3. Misura (tutte le varianti e tipologie attuatore del brand)
	const righeModello = righeVie.filter(r => s.modello && r.modello === s.modello);
	const misure = unici(righeModello.map(r => r.misura)).sort((a, b) => misuraValore(a) - misuraValore(b));
	if (s.misura && !misure.includes(s.misura)) s.misura = null;
	if (!s.modello) bloccaPasso('misuraTags', 'Scegli prima il brand');
	else {
		sbloccaPasso('misuraTags');
		creaTag(document.getElementById('misuraTags'), misure, s.misura, null, val => {
			s.misura = s.misura === val ? null : val;
			aggiorna();
		});
	}

	// 4. Variante (Standard / Schrader / Ibrida): visibile solo se il brand ne ha più di una;
	// quelle che non esistono nella misura scelta sono disattivate, se ne resta una è scelta da sola
	const variantiBrand = VARIANTI.filter(v => righeModello.some(r => r.variante === v));
	const righeMisuraTutte = righeModello.filter(r => s.misura && r.misura === s.misura);
	const varianti = variantiBrand.filter(v => variantiBrand.length === 1 || righeMisuraTutte.some(r => r.variante === v));
	if (s.variante && !varianti.includes(s.variante)) s.variante = null;
	// Predefinita: Standard quando la misura la supporta; operatore libero di scegliere Schrader o Ibrida.
	if (!s.variante) s.variante = varianti.includes('STANDARD') ? 'STANDARD' : (varianti.length === 1 ? varianti[0] : null);
	const varianteBox = document.getElementById('varianteBox');
	if (varianteBox) varianteBox.style.display = s.modello && variantiBrand.length > 1 ? '' : 'none';
	if (!s.misura && variantiBrand.length > 1) bloccaPasso('varianteTags', 'Scegli prima la misura');
	else {
		sbloccaPasso('varianteTags');
		const varDis = new Set(variantiBrand.filter(v => !varianti.includes(v)));
		creaTag(document.getElementById('varianteTags'), variantiBrand, s.variante, varDis, val => {
			s.variante = s.variante === val ? null : val;
			s.tipologia = null;
			s.marca = null;
			aggiorna();
		}, val => VARIANTE_LABEL[val]);
	}
	const righeMisura = righeMisuraTutte.filter(r => s.variante && r.variante === s.variante);

	// 5. Tipologia attuatore: sempre On-off e Modulante. Se per la valvola non c'è una regola
	// di quella tipologia (es. modulante su GMC full passage) la scelta è "fuori regola":
	// valvola dell'altra regola, attuatore e kit scelti a mano e da verificare
	const tipologie = unici(dati.attuatori.map(a => a.tipo)).sort((a, b) => (a === 'ON-OFF' ? -1 : 1) - (b === 'ON-OFF' ? -1 : 1));
	const conRegola = new Set(righeMisura.map(r => r.tipologia));
	if (s.tipologia && !tipologie.includes(s.tipologia)) s.tipologia = null;
	if (!s.misura) bloccaPasso('tipologiaTags', 'Scegli prima la misura');
	else if (!s.variante) bloccaPasso('tipologiaTags', 'Scegli prima la variante');
	else {
		sbloccaPasso('tipologiaTags');
		creaTag(document.getElementById('tipologiaTags'), tipologie, s.tipologia, null, val => {
			s.tipologia = s.tipologia === val ? null : val;
			aggiorna();
		}, val => val === 'MODULANTE' ? 'Modulante' : 'On-off');
		tipologie.forEach((t, i) => {
			if (conRegola.has(t)) return;
			const b = document.getElementById('tipologiaTags').children[i];
			b.classList.add('tag-fuori');
			b.title = 'Nessuna regola di questa tipologia per la valvola: kit e adattatore presi dall’attuatore di pari marca e torque';
		});
	}

	// 6. Marca attuatore (Belimo, Watergate...): se ce n'è una sola viene scelta da sola
	const rigaTipologia = righeMisura.find(r => s.tipologia && r.tipologia === s.tipologia);
	const fuoriRegola = !!(s.tipologia && !rigaTipologia && righeMisura.length);
	// Fuori regola: marche con un attuatore di pari meccanica (stessa marca e torque) dell'altra regola;
	// se non ce ne sono, tutte le marche della tipologia (scelta manuale)
	const rigaBase = rigaTipologia || (fuoriRegola ? righeMisura[0] : null);
	const marcheEquivalenti = fuoriRegola ? unici(opzioniEquivalenti(rigaBase, s.vie, false, s.tipologia).map(o => o.attuatore.brand)) : [];
	const marche = rigaTipologia
		? unici(rigaTipologia.opzioni.filter(vieOk).map(o => o.marca))
		: fuoriRegola
			? (marcheEquivalenti.length ? marcheEquivalenti : unici(dati.attuatori.filter(a => a.tipo === s.tipologia).map(a => a.brand)))
			: [];
	if (s.marca && !marche.includes(s.marca)) s.marca = null;
	if (!s.marca && marche.length === 1) s.marca = marche[0];
	if (!s.tipologia) bloccaPasso('marcaTags', 'Scegli prima la tipologia attuatore');
	else {
		sbloccaPasso('marcaTags');
		creaTag(document.getElementById('marcaTags'), marche, s.marca, null, val => {
			s.marca = s.marca === val ? null : val;
			aggiorna();
		}, val => val.charAt(0) + val.slice(1).toLowerCase());
	}

	// Anteprima: righe filtrate con le scelte fatte finora
	let filtrate = righeVie;
	if (s.modello) filtrate = filtrate.filter(r => r.modello === s.modello);
	if (s.misura) filtrate = filtrate.filter(r => r.misura === s.misura);
	if (s.variante) filtrate = filtrate.filter(r => r.variante === s.variante);
	if (s.tipologia && !fuoriRegola) filtrate = filtrate.filter(r => r.tipologia === s.tipologia);
	aggiornaAnteprimaValvola(filtrate);

	// Opzione corpo inox: visibile solo se la riga prevede il kit corpo inox (*)
	const corpoInoxBox = document.getElementById('corpoInoxBox');
	const corpoInoxCheck = document.getElementById('corpoInoxCheck');
	const prevedeCorpoInox = !!(s.marca && rigaBase?.opzioni.some(o => o.corpoInox && o.marca === s.marca && vieOk(o)));
	if (corpoInoxBox) corpoInoxBox.style.display = prevedeCorpoInox ? '' : 'none';
	if (!prevedeCorpoInox) s.corpoInox = false;
	if (corpoInoxCheck) {
		corpoInoxCheck.checked = s.corpoInox;
		corpoInoxCheck.onchange = () => {
			s.corpoInox = corpoInoxCheck.checked;
			if (window.onSelezioneCambiata) window.onSelezioneCambiata();
		};
	}
}

let datiUI = null;

// Inizializzazione: attende che logic.js abbia caricato i dati
window.initTagUI = function(dati) {
	datiUI = dati;
	aggiornaTagUI(dati);
};

// Imposta la selezione da codice (selettore pulito o riga salvata richiamata)
window.impostaSelezione = function(valori = {}) {
	Object.assign(statoSelezione, {
		modello: null, variante: null, tipologia: null, marca: null, misura: null, vie: null, corpoInox: false
	}, valori);
	aggiornaTagUI(datiUI);
	if (window.onSelezioneCambiata) window.onSelezioneCambiata();
};
