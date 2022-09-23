import { useEffect, useState } from "preact/hooks";
import { simLottery } from "./simLottery";
import { Button } from "./Button";
// @ts-expect-error
import MyWorker from "./worker?worker&inline";

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

const getDefaultNames = (numTeams: number) => {
	const names = [];
	for (let i = 0; i < numTeams; i++) {
		names.push(`Team ${i + 1}`);
	}
	return names;
};

const checkNamesAreAllDefault = (names: string[]) => {
	const defaultNames = getDefaultNames(names.length);
	for (let i = 0; i < names.length; i++) {
		if (names[i] !== defaultNames[i]) {
			return false;
		}
	}

	return true;
};

const worker: Worker = new MyWorker();
let requestCount = 0;

export const App = () => {
	const [presetKey, setPresetKey] = useState("nba2019");
	const preset = presets.find((preset) => preset.key === presetKey);

	const [chances, setChances] = useState(preset?.chances ?? []);
	const [numToPick, setNumToPick] = useState(preset?.numToPick ?? 0);
	const [lotteryResults, setLotteryResults] = useState<number[] | undefined>();
	const [names, setNames] = useState(() => getDefaultNames(chances.length));
	const [loadingProbs, setLoadingProbs] = useState(true);
	const [probs, setProbs] = useState<number[][] | undefined>(); // undefined on initial load only
	const [tooSlow, setTooSlow] = useState(false);

	useEffect(() => {
		setLoadingProbs(true);
		requestCount += 1;
		worker.postMessage({ chances, numToPick, requestCount });
	}, [chances, numToPick]);

	useEffect(() => {
		const listener = (event: any) => {
			// Make sure this data is not already stale
			if (event.data.requestCount !== requestCount) {
				return;
			}

			setTooSlow(event.data.tooSlow);
			setProbs(event.data.probs);
			setLoadingProbs(false);
		};

		worker.addEventListener("message", listener);

		return () => {
			worker.removeEventListener("message", listener);
		};
	}, []);

	const onAddTeam = (direction: "top" | "bottom") => () => {
		setLotteryResults(undefined);

		if (direction === "bottom") {
			setChances([...chances, chances[chances.length - 1] ?? 1]);
		} else {
			setChances([chances[0] ?? 1, ...chances]);
		}

		const namesAreAllDefault = checkNamesAreAllDefault(names);
		if (namesAreAllDefault) {
			setNames(getDefaultNames(chances.length + 1));
		} else {
			if (direction === "bottom") {
				setNames([...names, `Team ${names.length + 1}`]);
			} else {
				setNames([`Team ${names.length + 1}`, ...names]);
			}
		}

		setPresetKey("custom");
	};

	const onClearTeams = () => {
		setLotteryResults(undefined);
		setChances([]);
		setNames([]);
		setPresetKey("custom");
	};

	const addClearButtons = (direction: "top" | "bottom") => (
		<>
			<Button
				variant="primary"
				outline
				className="mr-2"
				onClick={onAddTeam(direction)}
			>
				Add Team
			</Button>

			<Button
				variant="danger"
				outline
				className="mr-2"
				onClick={onClearTeams}
				disabled={chances.length === 0}
			>
				Clear Teams
			</Button>
		</>
	);

	return (
		<>
			<div
				className="columns-2"
				style={{
					maxWidth: 500,
				}}
			>
				<div>
					<label htmlFor="presetKey">Preset Lottery Type</label>
					<select
						className="form-control mt-1 h-[42px]"
						id="presetKey"
						onChange={(event) => {
							const preset = presets.find(
								(preset) => preset.key === (event.target as any).value,
							);

							if (preset) {
								setLotteryResults(undefined);
								setPresetKey(preset.key);
								setChances(preset.chances);
								setNumToPick(preset.numToPick);

								const namesAreAllDefault = checkNamesAreAllDefault(names);
								const numNamesNeeded = preset.chances.length;
								if (namesAreAllDefault) {
									setNames(getDefaultNames(numNamesNeeded));
								} else {
									const newNames = names.slice(0, numNamesNeeded);
									while (newNames.length < numNamesNeeded) {
										newNames.push(`Team ${newNames.length + 1}`);
									}
									setNames(newNames);
								}
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

				<div>
					<label htmlFor="numToPick">
						<span className="sm:hidden"># Lottery Selections</span>
						<span className="hidden sm:inline">
							Number of Lottery Selections
						</span>
					</label>
					<input
						className="form-control mt-1 h-[42px]"
						id="numToPick"
						type="number"
						value={numToPick}
						onChange={(event) => {
							setLotteryResults(undefined);
							setPresetKey("custom");
							setNumToPick(Math.round((event.target as any).valueAsNumber));
						}}
					></input>
				</div>
			</div>
			{preset ? (
				<div className="text-slate-500 mt-1">{preset.description}</div>
			) : null}

			{tooSlow ? (
				<>
					<div className="text-red-600 mt-1">
						Computing exact odds for so many teams and picks is too slow, so
						estimates are shown.
					</div>
				</>
			) : null}

			<div className="mt-3 sm:flex">
				<div>{addClearButtons("top")}</div>

				<div className="mt-2 sm:mt-0">
					<Button
						variant="success"
						onClick={() => {
							const results = simLottery(chances, numToPick);
							setLotteryResults(results);
						}}
						disabled={chances.length === 0}
					>
						Sim Lottery
					</Button>

					{lotteryResults ? (
						<Button
							variant="danger"
							className="ml-2"
							onClick={() => {
								setLotteryResults(undefined);
							}}
							outline
							disabled={chances.length === 0}
						>
							Clear Sim
						</Button>
					) : null}
				</div>
			</div>

			{!probs ? (
				<div className="my-3">Loading...</div>
			) : (
				<>
					{chances.length > 0 ? (
						<div className="mt-2 overflow-x-auto">
							<table
								className="table-auto"
								style={{
									width: "unset",
								}}
							>
								<thead className="text-center">
									<tr className="border-b-2 border-slate-500">
										<th />
										<th>Team Name</th>
										<th>Chances</th>
										{chances.map((_chance, i) => (
											<th key={i}>{ordinal(i + 1)}</th>
										))}
									</tr>
								</thead>
								<tbody className="text-end">
									{chances.map((chance, i) => {
										const nameId = `name-${i}`;
										const chancesId = `chances-${i}`;

										return (
											<tr className="border-b">
												<td className="py-0 w-0">
													<button
														className="text-red-600 text-xl"
														type="button"
														onClick={() => {
															setLotteryResults(undefined);
															setChances(
																chances.filter((_chance, j) => j !== i),
															);
															setPresetKey("custom");
															const namesAreAllDefault =
																checkNamesAreAllDefault(names);
															if (namesAreAllDefault) {
																setNames(getDefaultNames(chances.length - 1));
															} else {
																setNames(names.filter((_name, j) => j !== i));
															}
														}}
														title="Remove team"
													>
														✕
													</button>
												</td>
												<td className="py-0">
													<label className="sr-only" htmlFor={nameId}>
														Name of team #{i + 1}
													</label>
													<input
														id={nameId}
														className="form-control py-1 px-2 text-sm w-[100px]"
														type="text"
														value={names[i]}
														onChange={(event) => {
															const newName = (event.target as any).result;
															setNames(
																names.map((name, j) =>
																	j === i ? newName : name,
																),
															);
														}}
													/>
												</td>
												<td className="py-0 w-0">
													<label className="sr-only" htmlFor={chancesId}>
														Lottery chances for team #{i + 1}
													</label>
													<input
														id={chancesId}
														className="form-control py-1 px-2 text-sm"
														type="text"
														value={chance}
														onChange={(event) => {
															const number = parseFloat(
																(event.target as any).value,
															);
															if (!Number.isNaN(number)) {
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
												{chances.map((_chance, j) => {
													const pct = formatPercent(probs[i]?.[j]);
													return (
														<td
															className={`${
																lotteryResults && lotteryResults[j] === i
																	? "bg-green-200"
																	: ""
															}${loadingProbs ? " text-slate-500" : ""}`}
														>
															{pct ?? "\u00A0"}
														</td>
													);
												})}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					) : (
						<div className="my-3">You should add some teams...</div>
					)}

					{chances.length > 0 ? (
						<div className="my-3">{addClearButtons("bottom")}</div>
					) : null}
				</>
			)}
			<div className="alert">
				If you like simulating hypothetical draft lotteries, maybe you'd like
				simulating a whole league? <a href="https://zengm.com/">ZenGM</a> has
				you covered! Play{" "}
				<a href="https://play.basketball-gm.com/">basketball</a>,{" "}
				<a href="https://play.football-gm.com/">football</a>,{" "}
				<a href="https://baseball.zengm.com/">baseball</a>, or{" "}
				<a href="https://hockey.zengm.com/">hockey</a>. You can customize the
				draft lottery and tons of other things, and play as many seasons as you
				want. All for free!
			</div>
			<p>
				<a href="https://github.com/zengm-games/universal-draft-lottery-simulator">
					Source code on GitHub
				</a>
			</p>
		</>
	);
};
