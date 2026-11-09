// UI dinamica a tag per i filtri
window.statoSelezione = {
	modello: null,
	tipologia: null,
	marca: null,
	misura: null,
	vie: null,
	navale: false
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
		s.tipologia = null;
		s.marca = null;
		s.misura = null;
		s.vie = null;
		aggiorna();
	}, val => dati.modelli?.[val] || val);

	// Tipologia attuatore
	const righeModello = righe.filter(r => !s.modello || r.modello === s.modello);
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

	// Opzione navale: visibile solo se la riga prevede il kit INOX-NAVI (*)
	const navaleBox = document.getElementById('navaleBox');
	const navaleCheck = document.getElementById('navaleCheck');
	const rigaUnica = s.modello && s.tipologia && s.misura ? righeMisura[0] : null;
	const prevedeNavale = !!rigaUnica?.opzioni.some(o => o.navale && marcaOk(o));
	if (navaleBox) navaleBox.style.display = prevedeNavale ? '' : 'none';
	if (!prevedeNavale) s.navale = false;
	if (navaleCheck) {
		navaleCheck.checked = s.navale;
		navaleCheck.onchange = () => {
			s.navale = navaleCheck.checked;
			if (window.onSelezioneCambiata) window.onSelezioneCambiata();
		};
	}
}

// Inizializzazione: attende che logic.js abbia caricato i dati
window.initTagUI = function(dati) {
	aggiornaTagUI(dati);
};
