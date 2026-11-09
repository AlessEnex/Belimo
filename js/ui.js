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
		btn.className = 'tag-btn';
		btn.textContent = labelFn(val);
		if (selected === val) btn.classList.add('selected');
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

function aggiornaTagUI(dati) {
	const s = statoSelezione;
	const righe = dati.accoppiamenti;
	const aggiorna = () => {
		aggiornaTagUI(dati);
		if (window.onSelezioneCambiata) window.onSelezioneCambiata();
	};

	// Modello valvola
	const modelli = unici(righe.map(r => r.modello));
	creaTag(document.getElementById('modelloValvolaTags'), modelli, s.modello, null, val => {
		s.modello = s.modello === val ? null : val;
		s.variante = null;
		s.tipologia = null;
		s.marca = null;
		s.misura = null;
		s.vie = null;
		aggiorna();
	}, val => dati.modelli?.[val] || val);

	// Variante (Standard / Schrader / Ibrida): visibile solo se il modello ne ha più di una
	const righeMarcaValvola = righe.filter(r => !s.modello || r.modello === s.modello);
	const varianti = VARIANTI.filter(v => righeMarcaValvola.some(r => r.variante === v));
	if (s.variante && !varianti.includes(s.variante)) s.variante = null;
	if (!s.variante && varianti.length === 1) s.variante = varianti[0];
	const varianteBox = document.getElementById('varianteBox');
	if (varianteBox) varianteBox.style.display = s.modello && varianti.length > 1 ? '' : 'none';
	creaTag(document.getElementById('varianteTags'), varianti, s.variante, null, val => {
		s.variante = s.variante === val ? null : val;
		s.tipologia = null;
		s.misura = null;
		s.vie = null;
		aggiorna();
	}, val => VARIANTE_LABEL[val]);

	// Tipologia attuatore
	const righeModello = righeMarcaValvola.filter(r => !s.variante || r.variante === s.variante);
	const tipologie = unici(righeModello.map(r => r.tipologia));
	creaTag(document.getElementById('tipologiaTags'), tipologie, s.tipologia, null, val => {
		s.tipologia = s.tipologia === val ? null : val;
		s.misura = null;
		s.vie = null;
		aggiorna();
	});

	// Marca attuatore (Belimo, Watergate...): se ce n'è una sola viene scelta da sola
	const righeTipologia = righeModello.filter(r => !s.tipologia || r.tipologia === s.tipologia);
	const marcaOk = o => !s.marca || o.marca === s.marca;
	const marche = unici(righeTipologia.flatMap(r => r.opzioni.map(o => o.marca)));
	if (s.marca && !marche.includes(s.marca)) s.marca = null;
	if (!s.marca && marche.length === 1) s.marca = marche[0];
	creaTag(document.getElementById('marcaTags'), marche, s.marca, null, val => {
		s.marca = s.marca === val ? null : val;
		s.misura = null;
		s.vie = null;
		aggiorna();
	}, val => val.charAt(0) + val.slice(1).toLowerCase());

	// Misura: solo quelle con almeno un attuatore della marca scelta
	const righeMarca = righeTipologia.filter(r => r.opzioni.some(marcaOk));
	const misure = unici(righeMarca.map(r => r.misura));
	if (s.misura && !misure.includes(s.misura)) s.misura = null;
	creaTag(document.getElementById('misuraTags'), misure, s.misura, null, val => {
		s.misura = s.misura === val ? null : val;
		aggiorna();
	});

	// Vie: disponibili se c'è la valvola e un'opzione della marca valida per quelle vie
	const righeMisura = righeMarca.filter(r => !s.misura || r.misura === s.misura);
	const vieDisponibili = new Set(['2', '3'].filter(v => righeMisura.some(r =>
		r.valvole[v] && r.opzioni.some(o => marcaOk(o) && (!o.vie || o.vie === v)))));
	const vieDis = new Set(['2', '3'].filter(v => !vieDisponibili.has(v)));
	if (s.vie && vieDis.has(s.vie)) s.vie = null;
	creaTag(document.getElementById('vieTags'), ['2', '3'], s.vie, vieDis, val => {
		s.vie = s.vie === val ? null : val;
		aggiorna();
	}, val => VIE_LABEL[val]);

	// Opzione corpo inox: visibile solo se la riga prevede il kit corpo inox (*)
	const corpoInoxBox = document.getElementById('corpoInoxBox');
	const corpoInoxCheck = document.getElementById('corpoInoxCheck');
	const rigaUnica = s.modello && s.tipologia && s.misura ? righeMisura[0] : null;
	const prevedeCorpoInox = !!rigaUnica?.opzioni.some(o => o.corpoInox && marcaOk(o));
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

// Inizializzazione: attende che logic.js abbia caricato i dati
window.initTagUI = function(dati) {
	aggiornaTagUI(dati);
};
