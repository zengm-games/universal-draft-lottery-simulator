export const ordinal = (x: number) => {
	let suffix;

	if (x % 100 >= 11 && x % 100 <= 13) {
		suffix = "th";
	} else if (x % 10 === 1) {
		suffix = "st";
	} else if (x % 10 === 2) {
		suffix = "nd";
	} else if (x % 10 === 3) {
		suffix = "rd";
	} else {
		suffix = "th";
	}

	return x.toString() + suffix;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// Evenly-spaced hues guarantee every pair of teams is at least 360/numTeams
// degrees apart, and visiting them with a stride near numTeams/φ (kept
// coprime with numTeams so every hue is used once) makes consecutive team
// indexes very different colors
const teamHue = (teamIndex: number, numTeams: number) => {
	let stride = Math.max(1, Math.round(numTeams / 1.618));
	while (gcd(stride, numTeams) !== 1) {
		stride += 1;
	}

	return Math.round(((teamIndex * stride) % numTeams) * (360 / numTeams));
};

// Top and bottom colors of a team's gradient
export const teamGradientColors = (teamIndex: number, numTeams: number) => {
	const hue = teamHue(teamIndex, numTeams);

	return [`hsl(${hue}, 65%, 45%)`, `hsl(${hue}, 70%, 27%)`] as const;
};
