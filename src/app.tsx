import { useEffect, useMemo, useState } from "preact/hooks";
import { getProbs } from "./getProbs";

const presets = [
	{
		key: "nba2019",
		title: "NBA 2019-present",
		description:
			"Weighted lottery for the top 4 picks, like the NBA since 2019",
		numToPick: 4,
		chances: [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5],
	},
	{
		key: "nba1994",
		title: "NBA 1994-2018",
		description:
			"Weighted lottery for the top 3 picks, like the NBA from 1994-2018",
		numToPick: 3,
		chances: [250, 199, 156, 119, 88, 63, 43, 28, 17, 11, 8, 7, 6, 5],
	},
	{
		key: "nba1990",
		title: "NBA 1990-1993",
		description:
			"Weighted lottery for the top 3 picks, like the NBA from 1990-1993",
		numToPick: 3,
		chances: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
	},
	{
		key: "nba1987",
		title: "NBA 1987-1989",
		description:
			"Random lottery for the top 3 picks, like the NBA from 1987-1989",
		numToPick: 3,
		chances: [1, 1, 1, 1, 1, 1, 1],
	},
	{
		key: "nba1985",
		title: "NBA 1985-1986",
		description:
			"Non-playoff teams draft in random order, like the NBA from 1985-1986",
		numToPick: 7,
		chances: [1, 1, 1, 1, 1, 1, 1],
	},
	{
		key: "nba1966",
		title: "NBA 1966-1984",
		description:
			"Coin flip to determine the top 2 picks, like the NBA from 1966-1984",
		numToPick: 2,
		chances: [1, 1, 0, 0, 0, 0, 0],
	},
	{
		key: "nhl2021",
		title: "NHL 2021-present",
		description:
			"Weighted lottery for the top 2 picks, like the NHL since 2021. This does not include the NHL's constraint on the number of spots a team can move up.",
		numToPick: 2,
		chances: [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 5, 5],
	},
	{
		key: "nhl2017",
		title: "NHL 2017-2020",
		description:
			"Weighted lottery for the top 3 picks, like the NHL from 2017-2020",
		numToPick: 3,
		chances: [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 10],
	},
	{
		key: "mlb2022",
		title: "MLB 2022-present",
		description:
			"Weighted lottery for the top 6 picks, like the MLB since 2022",
		numToPick: 6,
		chances: [
			1650, 1650, 1650, 1325, 1000, 750, 550, 390, 270, 180, 140, 110, 90, 76,
			62, 48, 36, 23,
		],
	},
];

const ordinal = (x: number) => {
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

const formatPercent = (num: number | undefined) =>
	num !== undefined ? `${(num * 100).toFixed(1)}%` : undefined;

export function App() {
	const [presetKey, setPresetKey] = useState("nba2019");
	const preset = presets.find((preset) => preset.key === presetKey);

	const [chances, setChances] = useState(preset?.chances ?? []);
	const [numToPick, setNumToPick] = useState(preset?.numToPick ?? 0);
	const [lotteryResults, setLotteryResults] = useState<number[] | undefined>();

	const { probs: probsNormal, tooSlow: tooSlowNormal } = useMemo(
		() => getProbs(chances, numToPick, false),
		[chances, numToPick],
	);

	const [probsOverride, setProbsOverride] = useState<
		typeof probsNormal | undefined
	>();

	const probs = probsOverride ?? probsNormal;
	const tooSlow = probsOverride ? false : tooSlowNormal;

	const onAddTeam = (direction: "top" | "bottom") => () => {
		setProbsOverride(undefined);
		setLotteryResults(undefined);
		if (direction === "bottom") {
			setChances([...chances, chances.at(-1) ?? 1]);
		} else {
			setChances([chances[0] ?? 1, ...chances]);
		}
		setPresetKey("custom");
	};

	return (
		<>
			<h1>Universal Draft Lottery Simulator</h1>
			<p>
				Calculate the odds and simulate an{" "}
				<a href="https://en.wikipedia.org/wiki/NBA_draft_lottery">
					NBA-like draft lottery
				</a>{" "}
				with any number of teams and any chances per team.
			</p>

			<form
				className="row"
				style={{
					maxWidth: 500,
				}}
			>
				<div className="col">
					<label className="form-label" htmlFor="presetKey">
						Preset Lottery Type
					</label>
					<select
						className="form-control"
						id="presetKey"
						onChange={(event) => {
							const preset = presets.find(
								(preset) => preset.key === event.target.value,
							);

							if (preset) {
								setProbsOverride(undefined);
								setLotteryResults(undefined);
								setPresetKey(preset.key);
								setChances(preset.chances);
								setNumToPick(preset.numToPick);
							} else {
								setPresetKey("custom");
							}
						}}
						value={preset?.key ?? "custom"}
					>
						{presets.map((preset) => (
							<option key={preset.key} value={preset.key}>
								{preset.title}
							</option>
						))}
						<option value="custom">Custom</option>
					</select>
				</div>

				<div className="col">
					<label className="form-label" htmlFor="numToPick">
						<span className="d-sm-none"># Lottery Selections</span>
						<span className="d-none d-sm-inline">
							Number of Lottery Selections
						</span>
					</label>
					<input
						className="form-control"
						id="numToPick"
						type="number"
						value={numToPick}
						onChange={(event) => {
							setProbsOverride(undefined);
							setLotteryResults(undefined);
							setPresetKey("custom");
							setNumToPick(Math.round(event.target.valueAsNumber));
						}}
					></input>
				</div>
			</form>
			{preset ? (
				<div className="text-muted mt-2">{preset.description}</div>
			) : null}

			{tooSlow ? (
				<>
					<div className="text-danger mt-2 mb-1">
						Computing lottery odds for so many teams and picks is too slow.
					</div>
					<div>
						<button
							className="btn btn-danger"
							onClick={() => {
								const result = getProbs(chances, numToPick, true);
								setProbsOverride(result.probs);
								setLotteryResults(undefined);
							}}
							role="button"
						>
							Do it anyway! (might freeze your browser)
						</button>
					</div>
				</>
			) : null}

			<div className="mt-3">
				<button
					className="btn btn-outline-primary me-2"
					type="button"
					onClick={onAddTeam("top")}
				>
					Add Team
				</button>

				<button
					className="btn btn-success"
					type="button"
					onClick={() => {
						console.log("SIMULATE");
						setLotteryResults([0, 1]);
					}}
				>
					Sim Lottery
				</button>

				{lotteryResults ? (
					<button
						className="btn btn-outline-danger ms-2"
						type="button"
						onClick={() => {
							setLotteryResults(undefined);
						}}
					>
						Clear Sim
					</button>
				) : null}
			</div>

			<div className="table-responsive mt-2">
				<table
					className="table mb-0"
					style={{
						width: "unset",
					}}
				>
					<thead className="text-center">
						<tr>
							<th />
							<th>Chances</th>
							{chances.map((chance, i) => (
								<th key={i}>{ordinal(i + 1)}</th>
							))}
						</tr>
					</thead>
					<tbody className="text-end">
						{chances.map((chance, i) => (
							<tr>
								<td
									className="py-0 align-middle"
									style={{
										width: 0,
									}}
								>
									<button
										className="btn btn-link text-danger border-0 p-0 m-0 text-decoration-none fs-5"
										type="button"
										onClick={() => {
											setProbsOverride(undefined);
											setLotteryResults(undefined);
											setChances(chances.filter((chance, j) => j !== i));
											setPresetKey("custom");
										}}
									>
										✕
									</button>
								</td>
								<td
									className="py-0 align-middle"
									style={{
										width: 0,
									}}
								>
									<input
										className="form-control form-control-sm"
										type="text"
										value={chance}
										onChange={(event) => {
											const number = parseFloat(event.target.value);
											if (!Number.isNaN(number)) {
												setProbsOverride(undefined);
												setLotteryResults(undefined);
												setPresetKey("custom");
												setChances(
													chances.map((chance, j) =>
														i === j ? number : chance,
													),
												);
											}
										}}
									/>
								</td>
								{chances.map((chance, j) => {
									let pct = formatPercent(probs[i][j]);
									if (tooSlow && pct !== undefined && j > 0) {
										pct = "?";
									}
									return <td>{pct}</td>;
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<button
				className="btn btn-outline-primary my-3"
				type="button"
				onClick={onAddTeam("bottom")}
			>
				Add Team
			</button>

			<p
				style={{
					maxWidth: 700,
				}}
			>
				If you like simulating hypothetical draft lotteries, maybe you'd like
				simulating a whole league? <a href="https://zengm.com/">ZenGM</a> has
				you covered! Play{" "}
				<a href="https://play.basketball-gm.com/">basketball</a>,{" "}
				<a href="https://play.football-gm.com/">football</a>,{" "}
				<a href="https://baseball.zengm.com/">baseball</a>, or{" "}
				<a href="https://hockey.zengm.com/">hockey</a>. You can customize the
				draft lottery and tons of other things, and play as many seasons as you
				want. All for free!
			</p>
		</>
	);
}
