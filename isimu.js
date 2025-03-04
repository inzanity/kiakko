let games = [];
let basestd = {};
let upcoming = [];
let work = undefined;
let kchanged = true;
let splitschanged = true;
let iterations = 0;
let result = undefined;
let otprob;
let curr = 0;

let worker = new Worker('isimuworker.js');

function elem(type, attrs, ev) {
	let elem = document.createElement(type);
	for (const [name, value] of Object.entries(attrs || {}))
		elem[name] = value;
	for (const [name, value] of Object.entries(ev || {}))
		elem.addEventListener(name, value);
	return elem;
}

function format(count, iterations, split) {
	let prefix = "";
	if (split)
		prefix = "split ";
	if (count == iterations)
		return { innerText: '+', className: prefix + 'certain' };
	if (count == 0)
		return { innerText: '-', className: prefix + 'never' };

	let prob = count * 100 / iterations;
	if (prob >= 90)
		return { innerText: prob.toFixed(0), className: prefix + 'likely' };
	if (prob >= 30)
		return { innerText: prob.toFixed(0), className: prefix + 'probable' };
	if (prob >= 10)
		return { innerText: prob.toFixed(0), className: prefix + 'possible' };
	if (prob >= 1)
		return { innerText: prob.toFixed(1), className: prefix + 'unlikely' };
	return { innerText: prob.toFixed(1), className: prefix + 'bluemoon' };
}

worker.onmessage = (e) => {
	let splits = document.getElementById('splits').value.split(/[^\d]+/).map(Number);
	if (iterations == 0 || splitschanged) {
		let row = document.getElementById('res-hdr');
		row.replaceChildren();
		row.appendChild(elem('th', { innerText: 'Joukkue' }));
		row.appendChild(elem('th', { innerText: 'O' }));
		row.appendChild(elem('th', { innerText: 'P' }));
		for (let i = 1; i <= Object.keys(basestd).length; i++) {
			row.appendChild(elem('th', { innerText: i }));
			if (splits.indexOf(i) != -1)
				row.appendChild(elem('th', { innerText: '<=' + i }));
		}
		splitschanged = false;
	}

	if (iterations == 0) {
		result = e.data.result;
	} else {
		for (const [name, data] of Object.entries(e.data.result || {})) {
			result[name].points += data.points;
			result[name].games += data.games;
			for (const i in data.positions)
				result[name].positions[i] += data.positions[i];
		}
	}
	iterations += e.data.iterations;

	let t = document.getElementById('res-data');
	t.replaceChildren();
	let j = 1;
	for (const [name, data] of Object.entries(result).toSorted(([_a, a], [_b, b]) => (b.points * a.games) - (a.points * b.games))) {
		let row;
		if (splits.indexOf(j++) != -1) {
			row = elem('tr', { className: 'split' });
			t.appendChild(row);
		} else {
			row = t.insertRow();
		}
		let sum = 0;
		row.insertCell().innerText = name;
		row.insertCell().innerText = data.games / iterations;
		row.insertCell().innerText = Math.round(10 * data.points / iterations) / 10;

		for (let i = 0; i < data.positions.length; i++) {
			const pc = data.positions[i];
			sum += pc;
			row.appendChild(elem('td', format(pc, iterations)));

			if (splits.indexOf(i + 1) != -1)
				row.appendChild(elem('td', format(sum, iterations, true)));
		}
	}

	if (iterations < document.getElementById('iters').value)
		worker.postMessage({ id: curr, base: basestd, upcoming: work, otprob, iterations: 1000 });
};

fetch('games.json').then(r => r.json()).then(gms => {
	document.getElementById('k').addEventListener('change', () => {
		kchanged = true;
		update();
	});
	document.getElementById('hadv').addEventListener('change', () => {
		kchanged = true;
		update();
	});
	document.getElementById('otp').addEventListener('change', update);
	document.getElementById('iters').addEventListener('change', () => {
		if (iterations < document.getElementById('iters').value)
			worker.postMessage({ id: curr, base: basestd, upcoming: work, otprob, iterations: 1000 });
	});
	document.getElementById('splits').addEventListener('change', () => {
		splitschanged = true;
		if (iterations !== 0)
			worker.onmessage({ data: { curr, iterations: 0 } });
	});
	for (const g of gms) {
		if (g.homeScore !== undefined)
			games.push(g);
		else
			upcoming.push(g);
	}
	update();
});

function update() {
	let k = document.getElementById('k').value;
	let hadv = document.getElementById('hadv').value;
	otprob = document.getElementById('otp').value / 100.0;
	curr++;

	let elo = {};

	if (kchanged) {
		basestd = {};
		for (const g of games) {
			let helo = elo[g.home] || 2000;
			let aelo = elo[g.away] || 2000;
			let ot = g.det !== "";
			let ex =
			    1.0 / (1.0 + Math.pow(10.0, (aelo - helo - hadv) / 400.0));
			let p = g.homeScore > g.awayScore ? !ot ? 3 : 2 : ot ? 1 : 0;
			let w = p / 3.0;
	
			let hs = basestd[g.home] || {games : 0, points : 0, wins : 0, gf: 0, ga: 0 };
			hs.games += 1;
			hs.points += p;
			hs.wins += p == 3;
			hs.gf += g.homeScore;
			hs.ga += g.awayScore;
			basestd[g.home] = hs;
	
			let as = basestd[g.away] || {games : 0, points : 0, wins : 0, gf: 0, ga: 0 };
			as.games += 1;
			as.points += 3 - p;
			as.wins += p == 0;
			as.gf += g.awayScore;
			as.ga += g.homeScore;
			basestd[g.away] = as;
	
			elo[g.home] = helo + k * (w - ex);
			elo[g.away] = aelo + k * (ex - w);
		}
		for (const g of upcoming) {
			if (basestd[g.home] === undefined)
				basestd[g.home] = { games: 0, points: 0, wins: 0, gf: 0, ga: 0 };
			if (basestd[g.away] === undefined)
				basestd[g.away] = { games: 0, points: 0, wins: 0, gf: 0, ga: 0 };
		}
	
		let std = document.getElementById('standings');
		std.replaceChildren();
		for (const [name, data] of Object.entries(basestd).toSorted(
			 ([ _a, a ], [ _b, b ]) => {
				 let d = (b.points * a.games) - (a.points * b.games);
				 if (d)
					 return d;
				 d = b.wins - a.wins;
				 if (d)
				 	return d;
				 d = (b.gf - b.ga) - (a.gf - a.ga);
				 if (d)
				 	return d;
				 return b.gf - a.gf;
			})) {
			let row = std.insertRow();
			row.insertCell().innerText = name;
			row.insertCell().innerText = data.games;
			row.insertCell().innerText = data.wins;
			row.insertCell().innerText = data.points;
			row.insertCell().appendChild(elem("input", {
				id: "elo" + name,
				size: 5,
				value: Math.round(elo[name])
			}, { 'change': update }));
		}

		kchanged = false;
	}

	let elos = Object.keys(basestd).reduce((acc, name) => ({ ...acc, [name]: document.getElementById('elo' + name).value}), {});
	work = upcoming.map(({ home, away }) => {
		let ex =
		    1.0 / (1.0 + Math.pow(10.0, (elos[away] - elos[home] - hadv) / 400.0));
		return { home, away, ex }
	});

	iterations = 0;
	worker.postMessage({ id: curr, base: basestd, upcoming: work, otprob, iterations: 1000 });
}
