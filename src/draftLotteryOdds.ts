// Computes each team's probability of landing the 1st overall pick,
// conditional on the picks revealed so far (the draft board reveals picks
// from the last one up to the 1st).
//
// The lottery draws numToPick picks first-to-last with weights proportional
// to chances, then the remaining teams fill the rest of the order. So the
// probability of a full outcome whose lottery winners are (t1, ..., tm) in
// order is the product of w(tj) / (W - w(t1) - ... - w(tj-1)) where W is the
// total chances of ALL teams. Conditioning on a revealed suffix of the order
// means summing those products over the outcomes consistent with it.

// Rough operation limit for the exact computation. Past this, fall back to
// each team's share of the remaining chances, which is a decent
// approximation. All the real-league presets stay exact.
const EXACT_BUDGET = 10_000_000;

const binomial = (n: number, r: number) => {
	if (r < 0 || r > n) {
		return 0;
	}
	r = Math.min(r, n - r);
	let result = 1;
	for (let i = 0; i < r; i++) {
		result = (result * (n - i)) / (i + 1);
	}
	return result;
};

// For a set of teams with the given weights drawn without replacement from a
// pool with poolTotal total weight, returns g where g[mask] is the
// probability that all the teams NOT in mask get drawn next, in any order.
// So g[0] is the probability the whole set gets drawn, and
// (weights[i] / poolTotal) * g[1 << i] is the probability the whole set gets
// drawn with team i drawn first.
const drawOrderings = (weights: number[], poolTotal: number) => {
	const size = 1 << weights.length;

	const maskSums = new Array(size).fill(0);
	for (let mask = 1; mask < size; mask++) {
		const lowestBit = mask & -mask;
		maskSums[mask] =
			maskSums[mask & (mask - 1)] + weights[Math.log2(lowestBit)];
	}

	const g = new Array(size).fill(0);
	g[size - 1] = 1;
	for (let mask = size - 2; mask >= 0; mask--) {
		const remainingTotal = poolTotal - maskSums[mask];
		if (remainingTotal <= 0) {
			continue;
		}

		let total = 0;
		for (let i = 0; i < weights.length; i++) {
			if (!(mask & (1 << i))) {
				total += (weights[i] / remainingTotal) * g[mask | (1 << i)];
			}
		}
		g[mask] = total;
	}

	return g;
};

// Returns an array indexed by team: the probability that team gets the 1st
// overall pick given the last numRevealed picks of lotteryResults, or
// undefined for teams whose pick has already been revealed.
export const firstPickOdds = (
	chances: number[],
	numToPick: number,
	lotteryResults: number[],
	numRevealed: number,
): (number | undefined)[] => {
	const numTeams = lotteryResults.length;
	const odds: (number | undefined)[] = new Array(numTeams).fill(undefined);

	const numUnrevealed = numTeams - numRevealed;
	if (numUnrevealed <= 0) {
		return odds;
	}

	const unplaced = lotteryResults.slice(0, numUnrevealed);
	const revealed = lotteryResults.slice(numUnrevealed);
	const totalAll = chances.reduce((sum, chance) => sum + chance, 0);

	// Teams with no chances can't win a lottery pick, so the lottery stops
	// early if numToPick exceeds the teams that can actually be drawn
	const numDrawable = chances.filter((chance) => chance > 0).length;
	const numWinners = Math.min(Math.max(numToPick, 0), numDrawable, numTeams);

	// No lottery at all (or nothing left to draw): the order is just the
	// original team order
	if (numWinners === 0 || totalAll <= 0) {
		const first = Math.min(...unplaced);
		for (const team of unplaced) {
			odds[team] = team === first ? 1 : 0;
		}
		return odds;
	}

	// Each team's share of the unplaced chances; exact before anything is
	// revealed, and the fallback approximation everywhere else
	const fallback = () => {
		const totalUnplaced = unplaced.reduce(
			(sum, team) => sum + chances[team],
			0,
		);
		for (const team of unplaced) {
			odds[team] = totalUnplaced > 0 ? chances[team] / totalUnplaced : 0;
		}
		return odds;
	};

	if (revealed.length === 0) {
		for (const team of unplaced) {
			odds[team] = chances[team] / totalAll;
		}
		return odds;
	}

	if (numUnrevealed <= numWinners) {
		// All unrevealed picks are lottery picks, so the unplaced teams were
		// drawn in some order as the first draws from the full pool
		if (2 ** numUnrevealed * numUnrevealed > EXACT_BUDGET) {
			return fallback();
		}

		const weights = unplaced.map((team) => chances[team]);
		const g = drawOrderings(weights, totalAll);
		if (g[0] <= 0) {
			return fallback();
		}

		for (let i = 0; i < unplaced.length; i++) {
			odds[unplaced[i]] = ((weights[i] / totalAll) * g[1 << i]) / g[0];
		}
		return odds;
	}

	// Some unrevealed picks are non-lottery picks. Those go to the
	// non-winners in original team order, so the unplaced non-winners must
	// all come before every revealed team in the original order. Enumerate
	// which unplaced teams the non-winners could be, and weight each
	// possible winner set by the probability the lottery drew it.
	const minRevealed = Math.min(...revealed);
	const candidates = unplaced.filter((team) => team < minRevealed);
	const numNonWinners = numUnrevealed - numWinners;

	const numSets = binomial(candidates.length, numNonWinners);
	if (numSets < 1 || numSets * 2 ** numWinners * numWinners > EXACT_BUDGET) {
		return fallback();
	}

	const numerators = new Map<number, number>();
	let denominator = 0;

	const lockedWinners = unplaced.filter((team) => team >= minRevealed);
	const nonWinners: number[] = [];
	const enumerate = (start: number) => {
		if (nonWinners.length === numNonWinners) {
			const winners = [
				...candidates.filter((team) => !nonWinners.includes(team)),
				...lockedWinners,
			];
			const weights = winners.map((team) => chances[team]);
			const g = drawOrderings(weights, totalAll);
			denominator += g[0];
			for (let i = 0; i < winners.length; i++) {
				numerators.set(
					winners[i],
					(numerators.get(winners[i]) ?? 0) +
						(weights[i] / totalAll) * g[1 << i],
				);
			}
			return;
		}

		for (
			let i = start;
			i <= candidates.length - (numNonWinners - nonWinners.length);
			i++
		) {
			nonWinners.push(candidates[i]);
			enumerate(i + 1);
			nonWinners.pop();
		}
	};
	enumerate(0);

	if (denominator <= 0) {
		return fallback();
	}

	for (const team of unplaced) {
		odds[team] = (numerators.get(team) ?? 0) / denominator;
	}
	return odds;
};

export const formatOdds = (p: number) => {
	if (p >= 0.9995) {
		return "100%";
	}
	if (p > 0 && p < 0.001) {
		return "<0.1%";
	}
	return `${(p * 100).toFixed(1)}%`;
};
