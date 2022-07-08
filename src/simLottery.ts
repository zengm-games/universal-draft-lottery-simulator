const randomChoice = <T>(
	x: readonly T[],
	weightInput?: ((a: T, index: number) => number) | number[],
): T => {
	if (weightInput === undefined) {
		return x[Math.floor(Math.random() * x.length)];
	}

	let weights;
	if (Array.isArray(weightInput)) {
		weights = weightInput;
	} else {
		weights = x.map(weightInput);
	}
	weights = weights.map((weight) =>
		weight < 0 || Number.isNaN(weight) ? Number.MIN_VALUE : weight,
	);

	const cumsums = weights.reduce((array, weight, i) => {
		if (i === 0) {
			array[0] = weight;
		} else {
			array[i] = array[i - 1] + weight;
		}

		return array;
	}, []);
	const max = cumsums.at(-1)!;
	const rand = Math.random() * max;
	const ind = cumsums.findIndex((cumsum) => cumsum >= rand);
	return x[ind];
};

export const simLottery = (chances: number[], numToPick: number) => {
	let teams = chances.map((chance, index) => ({
		chances: chance,
		index,
	}));

	const pickIndexes: number[] = [];

	for (let i = 0; i < numToPick; i++) {
		const team = randomChoice(teams, (team) => team.chances);
		pickIndexes.push(team.index);
		teams = teams.filter((team2) => team2 !== team);
	}

	pickIndexes.push(...teams.map((team) => team.index));

	return pickIndexes;
};
