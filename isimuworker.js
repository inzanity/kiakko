onmessage = (e) => {
	const { base, upcoming, otprob, iterations, id } = e.data;

	let result = Object.keys(base).reduce((acc, team) => ({...acc, [team]: { points: 0, games: 0, positions: Object.keys(base).map(_ => 0) } }), {});

	for (let i = 0; i < iterations; i++) {
		let teams = Object.entries(base).reduce((acc, [team, data]) => ({ ...acc, [team]: {...data} }), {});

		for (const { home, away, ex } of upcoming) {
			let r = Math.random();
			let hp;

			if (r < ex * otprob) {
				hp = 2;
			} else if (r < ex) {
				hp = 3;
			} else if (r < 1 - (ex * otprob)) {
				hp = 0
			} else {
				hp = 1;
			}

			teams[home].games++;
			teams[home].points += hp;
			teams[home].wins += hp == 3;

			teams[away].games++;
			teams[away].points += 3 - hp;
			teams[away].wins += hp == 0;
		}

		let std = Object.entries(teams).toSorted(([_a, a], [_b, b]) => {
			 let d = (b.points * a.games) - (a.points * b.games);
			 if (d)
				 return d;
			 d = b.wins - a.wins;
			 if (d)
			 	return d;
			 return Math.random() - 0.5;
		}).map(([name, data]) => ({ name, ...data }));

		for (const i in std) {
			result[std[i].name].positions[i]++;
			result[std[i].name].points += std[i].points;
			result[std[i].name].games += std[i].games;
		}
	}

	postMessage({ id, result, iterations });
}
