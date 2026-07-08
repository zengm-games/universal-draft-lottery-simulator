import { simLottery } from "./simLottery.ts";

export type Nba2027Restrictions = {
	restricted1: number[];
	restricted5: number[];
};

// This just came from testing on my machine to see where it gets slower than 1 second to generate the probabilities. nba2027 basically never triggers this because numEquivalenceClasses is low
const draftLotteryProbsTooSlow = (numEquivalenceClasses: number, numToPick: number) => {
	if (numEquivalenceClasses <= 11) {
		// This handles all nba2027 cases
		return false;
	} else if (numToPick === 1) {
		return false;
	} else if (numToPick === 2) {
		return numEquivalenceClasses > 150;
	} else if (numToPick === 3) {
		return numEquivalenceClasses > 80;
	} else if (numToPick === 4) {
		return numEquivalenceClasses > 45;
	} else if (numToPick === 5) {
		return numEquivalenceClasses > 30;
	}

	return numEquivalenceClasses * Math.sqrt(numToPick) > 55;
};

const sum = (values: number[]) => {
	let total = 0;
	for (const value of values) {
		total += value;
	}
	return total;
};

// If it's too slow to calculate the precise probability, just estimate
const monteCarloLotteryProbs = (
	chances: number[],
	numToPick: number,
	nba2027Restrictions: Nba2027Restrictions | undefined,
) => {
	const ITERATIONS = 100000;

	const probs: number[][] = [];

	for (let i = 0; i < ITERATIONS; i++) {
		const result = simLottery(chances, numToPick, nba2027Restrictions);
		for (let j = 0; j < result.length; j++) {
			const k = result[j]!;
			probs[k] ??= [];
			probs[k][j] ??= 0;
			// @ts-expect-error
			probs[k][j] += 1 / ITERATIONS;
		}
	}

	// First column we can trivially calculate
	const firstPickChances = chances.map((x, i) =>
		nba2027Restrictions &&
		(nba2027Restrictions.restricted1.includes(i) || nba2027Restrictions.restricted5.includes(i))
			? 0
			: x,
	);
	const firstPickChancesSum = sum(firstPickChances);
	for (const [i, chances] of firstPickChances.entries()) {
		if (chances > 0) {
			probs[i]![0] = chances / firstPickChancesSum;
		}
	}

	return probs;
};

// Calculating the binomial coefficient might be slower than log-gamma transformations?
const nChooseK = (n: number, k: number) => {
	// The number of ways you can pick k items is the same as how many ways you can leave n - k items behind
	if (k > n / 2) {
		k = n - k;
	}

	if (k < 0 || k > n) {
		return 0;
	}
	if (k === 0 || n === k) {
		return 1;
	}

	let res = 1;
	for (let i = 1; i <= k; i++) {
		res *= (n - k + i) / i;
	}
	return res;
};

/**
 * Returns probability of drawing 'k' successes from a sample 'N',
 * where the population 'K' contains 'n' total successes.
 * Much faster than enumerating over every state to determine who jumped up because it's combinatorial
 */
const hypergeometricPMF = (
	k: number, // Successes within sample
	N: number, // Total size
	K: number, // Total successes
	n: number, // Sample size
) => {
	const numerator = nChooseK(K, k) * nChooseK(N - K, n - k);
	const denominator = nChooseK(N, n);
	return denominator === 0 ? 0 : numerator / denominator;
};

const checkChancesSorted = (chances: number[]) => {
	for (let i = 1; i < chances.length; i++) {
		const prev = chances[i - 1]!;
		const current = chances[i]!;
		if (current > prev) {
			return false;
		}
	}

	return true;
};

export const getProbs = (
	allChances: number[],
	numToPick: number,
	nba2027Restrictions: Nba2027Restrictions | undefined,
): { tooSlow: boolean; probs?: (number | undefined)[][] } => {
	// Can't guarantee chances are sorted if user edits it
	const chancesSorted = checkChancesSorted(allChances);

	const probs: number[][] = [];

	// Clever dynamic programming and bitmask stuff below comes from wiigeneral https://discord.com/channels/@me/1511922269084188723/1514152028039811153

	const numTeams = allChances.length;
	const numTeamsBigInt = BigInt(numTeams); // I severely doubt precomputing changes anything, but it's more readable

	for (let i = 0; i < numTeams; i++) {
		// Initialize values that we'll definitely fill in soon
		probs[i] = new Array(numTeams).fill(undefined);
	}

	// This can be a type
	const equivalenceMap = new Map<
		number,
		{
			chances: number;
			isBottom3: boolean;
			isRestricted1: boolean | undefined;
			isRestricted5: boolean | undefined;
			teamIndices: number[];
		}
	>();

	let bottom3Mask = 0n;

	let lastKey = null;
	let equivalenceClassIdx = 0;

	for (const [i, chances] of allChances.entries()) {
		const isBottom3 = !!nba2027Restrictions && i < 3;
		if (isBottom3) {
			bottom3Mask |= 1n << BigInt(i);
		}

		const isRestricted1 = nba2027Restrictions?.restricted1.includes(i);
		const isRestricted5 = nba2027Restrictions?.restricted5.includes(i);

		const key =
			(chances << 3) |
			((isBottom3 ? 1 : 0) << 2) |
			((isRestricted1 ? 1 : 0) << 1) |
			(isRestricted5 ? 1 : 0);

		if (!nba2027Restrictions && !chancesSorted && key !== lastKey) {
			// This is needed for when teams are not sorted by chances in a non-nba2027 lottery (which impedes supporting nba2027Restrictions on non-nba2027 lotteries)
			equivalenceClassIdx++;
		}

		lastKey = key;
		const mapKey = key + equivalenceClassIdx;

		const existinEquivalence = equivalenceMap.get(mapKey);
		if (existinEquivalence) {
			existinEquivalence.teamIndices.push(i);
		} else {
			equivalenceMap.set(mapKey, {
				chances,
				isBottom3,
				isRestricted1,
				isRestricted5,
				teamIndices: [i],
			});
		}
	}
	const equivalenceClasses = Array.from(equivalenceMap.values());

	const tooSlow = draftLotteryProbsTooSlow(equivalenceClasses.length, numToPick);

	if (tooSlow) {
		// Estimate probs
		return {
			tooSlow,
			probs: monteCarloLotteryProbs(allChances, numToPick, nba2027Restrictions),
		};
	}

	for (const equivalenceClass of equivalenceClasses) {
		for (const idx of equivalenceClass.teamIndices) {
			equivalenceMap.set(idx, equivalenceClass);
		}
	}

	const pickLayers: (Map<bigint, number> | null)[] = Array.from(
		{ length: numTeams + 1 },
		() => new Map(),
	);

	// Start at the first pick with 0 teams drawn, 0 slots filled with 100% chance
	pickLayers[0]!.set(0n, 1.0);

	const lowerHalfMask = (1n << numTeamsBigInt) - 1n;
	const classProbs: number[][] = equivalenceClasses.map(() => new Array(numTeams).fill(0));

	// Find the lowest available pick slot that hasn't been filled yet
	for (let currentLayer = 0; currentLayer < numTeams; currentLayer++) {
		for (const [stateKey, prob] of pickLayers[currentLayer]!) {
			if (prob <= 0) {
				continue;
			}

			// Extract masks from the bitmask, the first half for drawn teams, and the second half for filled teams
			// Since it's a BigInt, the amount of picks shouldn't be restricted
			const drawnTeamsMask = stateKey & lowerHalfMask;
			const filledSlotsMask = stateKey >> numTeamsBigInt;

			let currentPick = 0;
			while (currentPick < numTeams && filledSlotsMask & (1n << BigInt(currentPick))) {
				currentPick++;
			}

			if (currentPick >= numTeams) {
				continue;
			}

			if (!nba2027Restrictions && currentLayer === numToPick) {
				// For the later picks, account for how many times each team was "skipped" (lower lottery team won lottery and moved ahead) and keep track of those probabilities
				const skipped: number[] = new Array(equivalenceClasses.length).fill(0);

				for (const [i, equivalenceClass] of equivalenceClasses.entries()) {
					for (const teamIdx of equivalenceClass.teamIndices) {
						if (drawnTeamsMask & (1n << BigInt(teamIdx))) {
							skipped[i]!++;
						}
					}
				}

				// Place all remaining undrawn teams into the remaining slots in strict standings order
				let skippedPicksByPriorClasses = 0;
				for (const [equivalenceClass, skipSize] of Iterator.zip([equivalenceClasses, skipped], {
					mode: "strict",
				})) {
					const classSize = equivalenceClass.teamIndices.length;
					const probNotPicked = (classSize - skipSize) / classSize;

					if (probNotPicked > 0) {
						for (let t = 0; t < classSize; t++) {
							const teamIdx = equivalenceClass.teamIndices[t]!;

							const teamsWithBetterRank = t;
							const maxJumps = Math.min(skipSize, teamsWithBetterRank);

							for (let jumps = 0; jumps <= maxJumps; jumps++) {
								// Given that a team didn't jump up into the lottery, (the numToPick picks) calculate the probability that X teams ahead in the standings did jump
								// For example: To find the probability of the team with the 5th best odds getting the 7th pick, calculate the probability of 2 worse teams than them jumping
								const probXTeamsJumped = hypergeometricPMF(
									jumps,
									classSize - 1,
									teamsWithBetterRank,
									skipSize,
								);

								// Multiply the probability of this team not getting picked by the probability of how many teams needed to jump for the team to get this pick
								const branchProb = prob * probNotPicked * probXTeamsJumped;
								const betterRankedTeamsLeft = teamsWithBetterRank - jumps;

								const skippedPickIdx =
									numToPick + skippedPicksByPriorClasses + betterRankedTeamsLeft;

								probs[teamIdx]![skippedPickIdx] =
									(probs[teamIdx]![skippedPickIdx] ?? 0) + branchProb;
							}
						}
					}
					skippedPicksByPriorClasses += classSize - skipSize;
				}
				continue;
			}

			if (nba2027Restrictions) {
				const emptySlots: number[] = [];
				for (let j = currentPick; j <= 11; j++) {
					if (!(filledSlotsMask & (1n << BigInt(j)))) {
						emptySlots.push(j);
					}
				}

				const remainingBottom3Mask = bottom3Mask & ~drawnTeamsMask;
				let skipCount = 0;
				for (let temp = remainingBottom3Mask; temp > 0n; temp &= temp - 1n) {
					skipCount++;
				}

				if (emptySlots.length > 0 && skipCount === emptySlots.length) {
					// Determine the individual team share for landing in a slot for the bottom 3 teams
					const probsPerTeam = prob / skipCount;

					for (let i = 0; i < numTeams; i++) {
						if (remainingBottom3Mask & (1n << BigInt(i))) {
							const equivalenceClass = equivalenceMap.get(i)!;
							const equivalenceClassIdx = equivalenceClasses.indexOf(equivalenceClass);

							for (const slotIdx of emptySlots) {
								if (slotIdx < numTeams) {
									classProbs[equivalenceClassIdx]![slotIdx]! += probsPerTeam;
								}
							}
						}
					}

					const nextDrawnMask = drawnTeamsMask | remainingBottom3Mask;
					let nextFilledMask = filledSlotsMask;
					for (const slotIdx of emptySlots) {
						nextFilledMask |= 1n << BigInt(slotIdx);
					}

					// Skip however spots many the bottom 3 teams forcefully occupied in the top 12
					const nextLayerID = currentLayer + skipCount;
					const nextKey = (nextFilledMask << numTeamsBigInt) | nextDrawnMask;
					const nextPickLayer = pickLayers[nextLayerID]!;
					nextPickLayer.set(nextKey, (nextPickLayer.get(nextKey) ?? 0) + prob);
					continue;
				}
			}

			// Compute probability for each individual equivalence class
			let totalAvailableChances = 0;
			const activeTeamsPerClass: number[][] = [];

			for (const equivalenceClass of equivalenceClasses) {
				const activeTeams: number[] = [];
				for (const i of equivalenceClass.teamIndices) {
					if (!(drawnTeamsMask & (1n << BigInt(i)))) {
						activeTeams.push(i);
					}
				}
				activeTeamsPerClass.push(activeTeams);
				totalAvailableChances += activeTeams.length * equivalenceClass.chances;
			}

			if (totalAvailableChances === 0) {
				continue;
			}

			// Use the first active team per class
			for (const [equivalenceClass, activeTeams, classProb] of Iterator.zip(
				[equivalenceClasses, activeTeamsPerClass, classProbs],
				{
					mode: "strict",
				},
			)) {
				const repTeamIdx = activeTeams[0];
				if (repTeamIdx === undefined) {
					continue;
				}

				// The probability is the chances a class has multiplied by the teams in the class divided by total chances of all undrawn teams
				const branchProb = prob * (equivalenceClass.chances / totalAvailableChances);

				let targetPick = currentPick;
				while (true) {
					const isBanned =
						!!nba2027Restrictions &&
						((targetPick === 0 && equivalenceClass.isRestricted1) ||
							(targetPick <= 4 && equivalenceClass.isRestricted5));

					if (!isBanned && !(filledSlotsMask & (1n << BigInt(targetPick)))) {
						break;
					}
					targetPick++;
				}

				if (targetPick < numTeams) {
					classProb[targetPick]! += branchProb * activeTeams.length;
				}

				const nextDrawnMask = drawnTeamsMask | (1n << BigInt(repTeamIdx));
				const nextFilledMask = filledSlotsMask | (1n << BigInt(targetPick));
				const nextKey = (nextFilledMask << numTeamsBigInt) | nextDrawnMask;
				const nextLayerID = currentLayer + 1;

				// Multiply the probability by the amount of teams in the class
				const nextPickLayer = pickLayers[nextLayerID]!;
				nextPickLayer.set(
					nextKey,
					(nextPickLayer.get(nextKey) ?? 0) + branchProb * activeTeams.length,
				);
			}
		}
		pickLayers[currentLayer] = null;
	}

	// Divide the probabilities among each class equally
	for (const [equivalenceClass, classProb] of Iterator.zip([equivalenceClasses, classProbs], {
		mode: "strict",
	})) {
		const classSize = equivalenceClass.teamIndices.length;
		for (let slot = 0; slot < numToPick; slot++) {
			const totalSlotProb = classProb[slot]!;
			if (totalSlotProb > 0) {
				const probPerTeam = totalSlotProb / classSize;
				for (const teamIdx of equivalenceClass.teamIndices) {
					probs[teamIdx]![slot] = probPerTeam;
				}
			}
		}
	}

	return {
		tooSlow,
		probs,
	};
};
