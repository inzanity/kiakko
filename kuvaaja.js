let games;

function svgNode(name, paren, attrs, text) {
  const xmlns = "http://www.w3.org/2000/svg";
  let n = document.createElementNS(xmlns, name);
  for (const [attr, val] of Object.entries(attrs))
    n.setAttributeNS(null, attr, val);
  if (typeof paren === 'string')
    paren = document.getElementById(paren);
  paren.appendChild(n);
  if (text) {
    let textnode = name === 'text' ? n : svgNode('title', n, {});
    textnode.innerHTML = text.split('\n').map(text => {
      let span = document.createElement('span');
      span.innerText = text;
      return span.innerHTML;
    }).join('&#10;');
  }
  return n;
}

function node(name, attrs, text) {
  const n = document.createElement(name);
  for (const [name, value] of Object.entries(attrs))
    n[name] = value;
  n.innerText = text;
  return n;
}

function graph(datas, options) {
  const xmlns = "http://www.w3.org/2000/svg";
  var cw = 200;
  var ch = 100;

  let graph = document.getElementById('graph');
  graph.replaceChildren();
  options = options || {};

  let miny = options.yrange ? options.yrange.min : Math.min(...Object.values(datas).flatMap(data => data.map(([x, y]) => y)));
  let minx = Math.min(...Object.values(datas).flatMap(data => data.map(([x, y]) => x)));
  let maxy = options.yrange ? options.yrange.min : Math.max(...Object.values(datas).flatMap(data => data.map(([x, y]) => y)));
  let maxx = Math.max(...Object.values(datas).flatMap(data => data.map(([x, y]) => x)));

  const colors = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0",
    "#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78"];

  for (const [i, [name, data]] of Object.entries(datas).toSorted(([a, _a], [b, _b]) => (b < a) - (a < b)).entries()) {
    let g = svgNode('g', graph, {
      id: name,
      'class': 'entry',
      style: 'stroke:'+colors[i % colors.length]+';stroke-width:1;stroke-linejoin:round',
    }, name);

    svgNode('rect', g, { x: 1, y: i * 3 + 1, width: 2, height: 2, style: 'fill:'+colors[i % colors.length]+';stroke-width: 0.25;stroke:#000' });
    let t = svgNode('text', g, { x: 3, y: (i + 1) * 3, style:'fill:#000;font-size:3px;stroke:none;stroke-width: 0.02' }, name)

    let dx = cw / (maxx - minx);
    let dy = ch / (maxy - miny);
    const coords = data.map(([x, y, text]) => [(x - minx) * dx, ch - (y - miny) * dy, text]);

    const d = [...coords.entries().map(([i, [x, y]]) =>
      (i ? 'L' : 'M') + ' ' +  x + ',' + y
    )].join(' ');

    svgNode('path', g, { d });

    for (const [x, y, text] of coords)
      svgNode('circle', g, { cx: x, cy: y, r: 0.5 }, text);
  }
}

class Game {
  constructor(dets) {
    for (const [name, value] of Object.entries(dets))
      this[name] = value;
  }

  get date() {
    return Date.parse([this.played.slice(0, -4), this.played.slice(-4, -2), this.played.slice(-2)].join('-'));
  }

  get ot() {
    return this.det !== '';
  }

  get points() {
    return 3 * (this.gf > this.ga) ^ this.ot;
  }

  get expPoints() {
    if (this.egf > this.ega + 0.5)
      return 3;
    if (this.egf > this.ega)
      return 2;
    if (this.egf == this.ega)
      return 1.5;
    if (this.egf >= this.ega - 0.5)
      return 1;
    return 0;
  }

  get gd() {
    return this.gf - this.ga;
  }

  get egd() {
    return this.egf - this.ega;
  }
};

const functions = [
  { name: "Pisteet", func: fieldsummer('points') },
  { name: "Pisteodottama", func: fieldsummer('expPoints') },
  { name: "Pisteet-per-peli", func: fieldavgr('points', 1.5) },
  { name: "Pisteodottama-per-peli", func: fieldavgr('expPoints', 1.5) },
  { name: "Pelit", func: gamecount },
  { name: "Päivä", func: date },
  { name: "Tehdyt maalit", func: fieldsummer('gf') },
  { name: "Päästetyt maalit", func: fieldsummer('ga') },
  { name: "Maaliero", func: fieldsummer('gd') },
  { name: "Maaliodottama", func: fieldsummer('egf') },
  { name: "Päästöodottama", func: fieldsummer('ega') },
  { name: "Maaliero-odottama", func: fieldsummer('egd') },
  { name: "Tehdyt yli odottaman", func: forovere },
  { name: "Päästetyt yli odottaman", func: agovere },
  { name: "Maaliero yli odottaman", func: gdovere },
  { name: "5 pelin keskiarvo", func: fieldwindowavgr('points', 5) },
  { name: "Peliä 5 päivässä", func: gamesin5 },
  { name: "Putki", func: consecutive },
  { name: "Oma X", func: customx },
  { name: "Oma Y", func: customy },
];

document.addEventListener('DOMContentLoaded', () => {
  let selected = document.location.hash.slice(1).split(',').map(decodeURI);
  if (functions.findIndex(({ name }) => name == selected[0]) == -1)
    selected[0] = 'Pelit';
  if (functions.findIndex(({ name }) => name == selected[1]) == -1)
    selected[1] = 'Pisteet';
  const axes = ['x', 'y'].map(id => document.getElementById(id + 'axis'));
  for (const [i, sel] of axes.entries()) {
    sel.replaceChildren(...functions.map(({name}) => node('option', {}, name)));
    sel.selectedIndex = functions.findIndex(({name}) => name === selected[i]);
    sel.addEventListener('change', update);
  }
  for (const [ta, f] of [['x', customx], ['y', customy]].map(([id, f]) => [document.getElementById(id + 'custom'), f])) {
    document.getElementById('xcustom').addEventListener('change', () => {
      if (axes.any(i => functions[i.selectedIndex].func == f))
	update();
    });
  }

  update();
});

function summer(f) {
  let acc = 0;
  return [acc, (g) => acc += f(g)];
}

function fieldsummer(field) {
  return () => summer((g) => g[field]);
}

function averager(f, initial) {
  let counter = 0;
  let acc = 0;
  return [initial, (g) => (acc += f(g)) / ++counter];
}

function fieldavgr(field, initial) {
  return () => averager((g) => g[field], initial);
}

function windowaverager(f, n) {
  let win = [];
  return [undefined, (g) => (win = [...win, f(g)].slice(-n)).reduce(([pa, n], p) => [(pa * n + p) / (n + 1), n + 1], [0, 0])[0]];
}

function fieldwindowavgr(field, n) {
  return () => windowaverager((g) => g[field], n);
}

function gamecount() {
  return summer(() => 1);
}

function gamesin5() {
  let win = [];
  return [undefined, ({ date }) => (win = [...win.filter(d => date - d < (5 * 24 + 1) * 3600000), date]).length];
}

function date() {
  return [undefined, ({ date }) => +date];
}

function customx() {
  return new Function(document.getElementById('xcustom').value)();
}

function customy() {
  return new Function(document.getElementById('ycustom').value)();
}

function forovere() {
  return summer(({ egf, gf }) => gf - egf);
}

function agovere() {
  return summer(({ ega, ga }) => ga - ega);
}

function gdovere() {
  return summer(({ gd, egd }) => gd - egd);
}

function consecutive() {
  let n;

  return [undefined, ({ gf, ga }) => {
    if (gf > ga) {
      if (!(n > 0))
	n = 0;
      return ++n;
    }
    if (!(n < 0))
      n = 0;
    return --n;
  }];
}

function update() {
  if (document.readyState === 'loading' || !games)
    return;

  document.location.hash = '#' + ['xaxis', 'yaxis'].map(a => encodeURI(functions[document.getElementById(a).selectedIndex].name)).join(',');
  const xinit = functions[document.getElementById('xaxis').selectedIndex].func;
  const yinit = functions[document.getElementById('yaxis').selectedIndex].func;

  let teams = Object.keys(games.flatMap(g => [g.home, g.away]).reduce((acc, t) => ({ ...acc, [t]: undefined }), {})).reduce((acc, t) => {
    let [x0, xf] = xinit();
    let [y0, yf] = yinit();
    let points = x0 !== undefined && y0 !== undefined ? [[x0, y0]] : [];
    return { ...acc, [t]: { points, xf, yf } }
  }, {});
  for (const { home, away, homeScore, awayScore, homeExp, awayExp, det, played } of games) {
    let ot = det !== '';
    for (const [team, opp, gf, ga, egf, ega] of [[home, away, homeScore, awayScore, homeExp, awayExp], [away, home, awayScore, homeScore, awayExp, homeExp]]) {
      let g = new Game({ gf, ga, egf, ega, det, played });
      let {points, xf, yf} = teams[team];
      let y = yf(g);
      let x = xf(g);
      points.push([x, y, '' + team + ': ' + y + '/' + x + '\n' + played + ' ' + home + ' - ' + away + ' ' + homeScore + '-' + awayScore + det]);
    }
  }
  graph(Object.entries(teams).reduce((acc, [name, { points }]) => ({ ...acc, [name]: points }), {}));
}

fetch('games.json').then(r => r.json()).then(data => {
  games = data.filter(g => g.homeScore !== undefined);
  update();
});
